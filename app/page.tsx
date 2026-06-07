'use client'
import { useEffect, useRef } from 'react'
import { InputPanel } from '@/components/InputPanel'
import { ResultPanel } from '@/components/ResultPanel'
import { VoiceComparison } from '@/components/VoiceComparison'
import { HistoryPanel } from '@/components/HistoryPanel'
import { useVoiceoverTask } from '@/hooks/useVoiceoverTask'

export default function Home() {
  const task = useVoiceoverTask()
  const isLoading = task.state === 'translating' || task.state === 'generating'
  const resultRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (task.state === 'done' || task.state === 'error') {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [task.state])

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">口播翻译工具</h1>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <HistoryPanel onSelect={task.loadFromHistory} />
        <main className="flex-1 space-y-6 overflow-y-auto p-6">
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
