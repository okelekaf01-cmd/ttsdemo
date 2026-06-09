'use client'
import { useEffect, useRef, useState } from 'react'
import { InputPanel } from '@/components/InputPanel'
import { ResultPanel } from '@/components/ResultPanel'
import { VoiceComparison } from '@/components/VoiceComparison'
import { HistoryPanel } from '@/components/HistoryPanel'
import { PointsBadge } from '@/components/PointsBadge'
import { useAuth } from '@/components/AuthProvider'
import { useVoiceoverTask } from '@/hooks/useVoiceoverTask'

export default function Home() {
  const { user, loading: authLoading, logout } = useAuth()
  const task = useVoiceoverTask()
  const isLoading = task.state === 'translating' || task.state === 'generating'
  const resultRef = useRef<HTMLDivElement>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [inputText, setInputText] = useState('')

  useEffect(() => {
    if (task.state === 'done' || task.state === 'error') {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [task.state])

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-400">加载中...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-400">请先登录</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 shadow-sm flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">口播翻译工具</h1>
        <div className="flex items-center gap-3">
          <PointsBadge />
          <span className="text-xs text-gray-400">{user.displayName}</span>
          <button onClick={logout}
            className="text-xs text-gray-500 hover:text-red-600 transition-colors">
            退出
          </button>
          <button onClick={() => setHistoryOpen(o => !o)}
            className="md:hidden rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
            历史记录
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {historyOpen && (
          <div className="md:hidden absolute inset-0 z-10 flex">
            <div className="flex-1 bg-black/30" onClick={() => setHistoryOpen(false)} />
            <div className="w-64 h-full bg-white shadow-xl">
              <HistoryPanel onSelect={r => { task.loadFromHistory(r); setInputText(r.chineseText); setHistoryOpen(false) }} />
            </div>
          </div>
        )}

        <div className="hidden md:flex">
          <HistoryPanel onSelect={r => { task.loadFromHistory(r); setInputText(r.chineseText) }} />
        </div>

        <main className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6 md:space-y-6">
          <InputPanel value={inputText} onChange={setInputText} onGenerate={task.generate} isLoading={isLoading} />
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
