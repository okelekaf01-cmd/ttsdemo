'use client'
import { useState } from 'react'
import { HighlightPlayer } from './HighlightPlayer'
import type { SpeechResult, TaskState } from '@/types'

interface ResultPanelProps {
  englishText: string; speechResult: SpeechResult | null
  state: TaskState; error: string | null
}

export function ResultPanel({ englishText, speechResult, state, error }: ResultPanelProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(englishText)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const download = () => {
    if (!speechResult) return
    const bytes = Uint8Array.from(atob(speechResult.audioBase64), c => c.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }))
    Object.assign(document.createElement('a'), { href: url, download: 'voiceover.mp3' }).click()
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">英文结果</label>
        {state === 'translating' && <span className="text-xs text-blue-500 animate-pulse">翻译中...</span>}
        {state === 'generating' && <span className="text-xs text-blue-500 animate-pulse">生成语音中...</span>}
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}
      {englishText && (
        <>
          <div className="flex gap-2">
            <button onClick={copy}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
              {copied ? '✓ 已复制' : '复制'}
            </button>
            {speechResult && (
              <button onClick={download}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                下载音频
              </button>
            )}
          </div>
          {speechResult
            ? <HighlightPlayer englishText={englishText} speechResult={speechResult} />
            : <p className="text-sm leading-relaxed text-gray-700">{englishText}</p>}
        </>
      )}
    </div>
  )
}
