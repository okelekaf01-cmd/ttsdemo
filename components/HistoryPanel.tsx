'use client'
import { useEffect, useState } from 'react'
import { getAllRecords, getRecord } from '@/lib/history'
import type { HistoryRecord } from '@/types'

type ListItem = Omit<HistoryRecord, 'audioBlob' | 'alignment' | 'voiceId'>

interface Props { onSelect: (record: HistoryRecord) => void }

export function HistoryPanel({ onSelect }: Props) {
  const [items, setItems] = useState<ListItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const refresh = () => getAllRecords().then(setItems)
  useEffect(() => {
    refresh()
    window.addEventListener('history-updated', refresh)
    return () => window.removeEventListener('history-updated', refresh)
  }, [])

  const handleSelect = async (id: string) => {
    setSelectedId(id)
    const record = await getRecord(id)
    if (record) onSelect(record)
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col overflow-hidden border-r border-gray-800">
      <div className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">历史记录</div>
      <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-2">
        {items.length === 0 && <p className="px-2 py-4 text-xs text-gray-600">暂无历史记录</p>}
        {items.map(item => (
          <button key={item.id} onClick={() => handleSelect(item.id)}
            className={`w-full rounded px-3 py-2 text-left text-xs hover:bg-gray-800 ${selectedId === item.id ? 'bg-gray-800' : ''}`}>
            <div className="truncate font-medium text-gray-300">
              {item.chineseText.slice(0, 20)}{item.chineseText.length > 20 ? '...' : ''}
            </div>
            <div className="mt-0.5 text-gray-600">{new Date(item.createdAt).toLocaleDateString('zh-CN')}</div>
          </button>
        ))}
      </div>
    </aside>
  )
}
