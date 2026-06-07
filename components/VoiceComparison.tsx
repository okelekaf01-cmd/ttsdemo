'use client'
import { useEffect, useState } from 'react'
import { VOICES } from '@/lib/voices.config'
import type { MultiVoiceResult, SpeechResult } from '@/types'

interface Props { primarySpeechResult: SpeechResult; multiVoiceResults: MultiVoiceResult[] }

export function VoiceComparison({ primarySpeechResult, multiVoiceResults }: Props) {
  const allVoices = [
    { voiceId: VOICES.primary.id, voiceName: VOICES.primary.name, audioBase64: primarySpeechResult.audioBase64 },
    ...multiVoiceResults,
  ]
  const allVoicesMeta = [...[VOICES.primary], ...VOICES.comparison]
  const getTag = (id: string) => allVoicesMeta.find(v => v.id === id)?.tag ?? ''
  const [urls, setUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    const map: Record<string, string> = {}
    for (const v of allVoices) {
      if (v.audioBase64) {
        const bytes = Uint8Array.from(atob(v.audioBase64), c => c.charCodeAt(0))
        map[v.voiceId] = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }))
      }
    }
    setUrls(map)
    return () => { for (const u of Object.values(map)) URL.revokeObjectURL(u) }
  }, [primarySpeechResult, multiVoiceResults]) // eslint-disable-line

  const download = (voiceId: string, voiceName: string) => {
    const url = urls[voiceId]; if (!url) return
    Object.assign(document.createElement('a'), { href: url, download: `voiceover-${voiceName}.mp3` }).click()
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      <label className="text-sm font-medium text-gray-700">多音色对比</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {allVoices.map(v => (
          <div key={v.voiceId} className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-800">{v.voiceName}</span>
              <span className="text-xs text-gray-400">{getTag(v.voiceId)}</span>
            </div>
            {'error' in v && v.error
              ? <p className="text-xs text-red-500">{v.error}</p>
              : urls[v.voiceId]
                ? <>
                    <audio src={urls[v.voiceId]} controls className="h-8 w-full"
                      onPlay={e => document.querySelectorAll('audio').forEach(a => { if (a !== e.currentTarget) a.pause() })} />
                    <button onClick={() => download(v.voiceId, v.voiceName)}
                      className="w-full rounded-lg border border-gray-200 bg-white py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                      下载 {v.voiceName}
                    </button>
                  </>
                : <p className="text-xs text-gray-400">生成中...</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
