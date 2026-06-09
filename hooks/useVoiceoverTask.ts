'use client'

import { useCallback, useState } from 'react'
import { encryptedFetch } from '@/lib/crypto.client'
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

    const translateResult = await encryptedFetch<{ ok: boolean; text?: string; error?: string }>(
      '/api/translate',
      { chineseText }
    ).catch(err => ({ ok: false as const, error: String(err) }))

    if (!translateResult.ok) {
      setData(d => ({ ...d, state: 'error', error: translateResult.error ?? '翻译失败' }))
      return
    }

    const englishText = translateResult.text!
    setData(d => ({ ...d, state: 'generating', englishText }))

    const [speechRes, multiRes] = await Promise.allSettled([
      encryptedFetch<SpeechResult>('/api/tts-with-timestamps', {
        text: englishText,
        voiceId: VOICES.primary.id,
      }),
      encryptedFetch<MultiVoiceResult[]>('/api/tts-multi', {
        text: englishText,
        voiceIds: VOICES.comparison.map(v => v.id),
      }),
    ])

    const speechResult = speechRes.status === 'fulfilled' ? speechRes.value : null
    const multiVoiceResults = multiRes.status === 'fulfilled' ? multiRes.value : []

    if (!speechResult) {
      const reason =
        speechRes.status === 'rejected'
          ? speechRes.reason instanceof Error
            ? speechRes.reason.message
            : String(speechRes.reason)
          : ''
      setData(d => ({ ...d, state: 'error', error: `语音生成失败：${reason}` }))
      return
    }

    setData(d => ({ ...d, state: 'done', speechResult, multiVoiceResults }))

    const bytes = Uint8Array.from(atob(speechResult.audioBase64), c => c.charCodeAt(0))
    const audioBlob = new Blob([bytes], { type: 'audio/mpeg' })
    saveRecord({
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      chineseText,
      englishText,
      audioBlob,
      voiceId: VOICES.primary.id,
      alignment: speechResult.alignment,
      multiVoiceResults,
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
      multiVoiceResults: record.multiVoiceResults ?? [],
      error: null,
    })
  }, [])

  return { ...data, generate, loadFromHistory }
}
