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
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-400">英文结果</label>
        {state === 'translating' && <span className="text-xs text-blue-400 animate-pulse">翻译中...</span>}
        {state === 'generating' && <span className="text-xs text-blue-400 animate-pulse">生成语音中...</span>}
      </div>
      {error && <div className="rounded border border-red-700 bg-red-900/30 p-3 text-sm text-red-400">{error}</div>}
      {englishText && (
        <>
          <div className="flex gap-2">
            <button onClick={copy} className="rounded border border-gray-700 px-3 py-1.5 text-xs hover:bg-gray-800">
              {copied ? '✓ 已复制' : '复制'}
            </button>
            {speechResult && (
              <button onClick={download} className="rounded border border-gray-700 px-3 py-1.5 text-xs hover:bg-gray-800">
                下载音频
              </button>
            )}
          </div>
          {speechResult
            ? <HighlightPlayer englishText={englishText} speechResult={speechResult} />
            : <p className="text-sm leading-relaxed text-gray-300">{englishText}</p>}
        </>
      )}
    </div>
  )
}
