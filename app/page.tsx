'use client'
import { useEffect, useRef, useState } from 'react'
import { InputPanel } from '@/components/InputPanel'
import { ResultPanel } from '@/components/ResultPanel'
import { VoiceComparison } from '@/components/VoiceComparison'
import { HistoryPanel } from '@/components/HistoryPanel'
import { useVoiceoverTask } from '@/hooks/useVoiceoverTask'

export default function Home() {
  const task = useVoiceoverTask()
  const isLoading = task.state === 'translating' || task.state === 'generating'
  const resultRef = useRef<HTMLDivElement>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    if (task.state === 'done' || task.state === 'error') {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [task.state])

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 shadow-sm flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">口播翻译工具</h1>
        <button onClick={() => setHistoryOpen(o => !o)}
          className="md:hidden rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
          历史记录
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* mobile history drawer */}
        {historyOpen && (
          <div className="md:hidden absolute inset-0 z-10 flex">
            <div className="flex-1 bg-black/30" onClick={() => setHistoryOpen(false)} />
            <div className="w-64 h-full bg-white shadow-xl">
              <HistoryPanel onSelect={r => { task.loadFromHistory(r); setHistoryOpen(false) }} />
            </div>
          </div>
        )}

        {/* desktop sidebar */}
        <div className="hidden md:flex">
          <HistoryPanel onSelect={task.loadFromHistory} />
        </div>

        <main className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6 md:space-y-6">
          <InputPanel onGenerate={task.generate} isLoading={isLoading} />
          {task.state !== 'idle' && (
            <div ref={resultRef}>
              <ResultPanel englishText={task.englishText} speechResult={task.speechResult}
                state={task.state} error={task.error} />
            </div>
          )}
          {task.state === 'done' && task.speechResult && task.multiVoiceResults.length > 0 && (
            <VoiceComparison primarySpeechResult={task.speechResult} multiVoiceResults={task.multiVoiceResults} />
          )}
        </main>
      </div>
    </div>
  )
}
