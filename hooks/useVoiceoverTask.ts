'use client'

import { useCallback, useState } from 'react'
import { translateText } from '@/app/actions'
import { saveRecord } from '@/lib/history'
import { VOICES } from '@/lib/voices.config'
import type { HistoryRecord, MultiVoiceResult, SpeechResult, TaskState } from '@/types'

interface TaskData {
  state: TaskState
  chineseText: string
  englishText: string
  speechResult: SpeechResult | null
  multiVoiceResults: MultiVoiceResult[]
  error: string | null
}

const INITIAL: TaskData = {
  state: 'idle', chineseText: '', englishText: '',
  speechResult: null, multiVoiceResults: [], error: null,
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export function useVoiceoverTask() {
  const [data, setData] = useState<TaskData>(INITIAL)

  const generate = useCallback(async (chineseText: string) => {
    setData({ ...INITIAL, state: 'translating', chineseText })

    const translateResult = await translateText(chineseText)
    if (!translateResult.ok) {
      setData(d => ({ ...d, state: 'error', error: translateResult.error }))
      return
    }

    const englishText = translateResult.text
    setData(d => ({ ...d, state: 'generating', englishText }))

    const [speechRes, multiRes] = await Promise.allSettled([
      fetch('/api/tts-with-timestamps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: englishText, voiceId: VOICES.primary.id }),
      }).then(async r => {
        if (!r.ok) throw new Error(`TTS ${r.status}`)
        return r.json() as Promise<SpeechResult>
      }),
      fetch('/api/tts-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: englishText, voiceIds: VOICES.comparison.map(v => v.id) }),
      }).then(async r => {
        if (!r.ok) throw new Error(`Multi TTS ${r.status}`)
        return r.json() as Promise<MultiVoiceResult[]>
      }),
    ])

    const speechResult = speechRes.status === 'fulfilled' ? speechRes.value : null
    const multiVoiceResults = multiRes.status === 'fulfilled' ? multiRes.value : []

    if (!speechResult) {
      setData(d => ({ ...d, state: 'error', error: `语音生成失败：${speechRes.status === 'rejected' ? speechRes.reason : ''}` }))
      return
    }

    setData(d => ({ ...d, state: 'done', speechResult, multiVoiceResults }))

    // Fire-and-forget: save to history
    const bytes = Uint8Array.from(atob(speechResult.audioBase64), c => c.charCodeAt(0))
    const audioBlob = new Blob([bytes], { type: 'audio/mpeg' })
    saveRecord({
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      chineseText, englishText,
      audioBlob,
      voiceId: VOICES.primary.id,
      alignment: speechResult.alignment,
    })
      .then(() => window.dispatchEvent(new Event('history-updated')))
      .catch(console.error)
  }, [])

  const loadFromHistory = useCallback(async (record: HistoryRecord) => {
    const audioBase64 = await blobToBase64(record.audioBlob)
    setData({
      state: 'done',
      chineseText: record.chineseText,
      englishText: record.englishText,
      speechResult: { audioBase64, alignment: record.alignment },
      multiVoiceResults: [],
      error: null,
    })
  }, [])

  return { ...data, generate, loadFromHistory }
}
