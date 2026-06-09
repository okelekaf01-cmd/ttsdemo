'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'

interface PointLog {
  id: string
  delta: number
  source: string
  createdAt: string
}

const SOURCE_LABEL: Record<string, string> = {
  registration_bonus: '注册奖励',
  tts_primary: '主音色生成',
  tts_multi: '多音色对比',
}

export function PointsBadge() {
  const { balance, loading } = useAuth()
  const [open, setOpen] = useState(false)
  const [logs, setLogs] = useState<PointLog[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    fetch('/api/points')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setLogs(d.logs) })
  }, [open])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (loading) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
      >
        {balance} 积分
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-56 rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-4 py-2.5 text-xs font-semibold text-gray-500">
            积分明细
          </div>
          <div className="max-h-64 overflow-y-auto">
            {logs.length === 0 && (
              <p className="px-4 py-3 text-xs text-gray-400">暂无记录</p>
            )}
            {logs.map(log => (
              <div key={log.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
                <div>
                  <div className="text-xs font-medium text-gray-700">
                    {SOURCE_LABEL[log.source] ?? log.source}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(log.createdAt).toLocaleDateString('zh-CN')}
                  </div>
                </div>
                <span className={`text-sm font-semibold ${log.delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {log.delta > 0 ? `+${log.delta}` : log.delta}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
