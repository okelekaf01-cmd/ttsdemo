'use client'
import { useEffect, useState } from 'react'
import { getAllRecords, getRecord, deleteRecord } from '@/lib/history'
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

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await deleteRecord(id)
    if (selectedId === id) setSelectedId(null)
    refresh()
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white">
      <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">历史记录</div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {items.length === 0 && <p className="px-2 py-4 text-xs text-gray-400">暂无历史记录</p>}
        {items.map(item => (
          <div key={item.id} className={`group relative w-full rounded-lg transition-colors hover:bg-gray-50 ${selectedId === item.id ? 'bg-blue-50' : ''}`}>
            <button onClick={() => handleSelect(item.id)} className="w-full px-3 py-2.5 text-left text-xs pr-8">
              <div className={`truncate font-medium ${selectedId === item.id ? 'text-blue-700' : 'text-gray-700'}`}>
                {item.chineseText.slice(0, 20)}{item.chineseText.length > 20 ? '...' : ''}
              </div>
              <div className="mt-0.5 text-gray-400">{new Date(item.createdAt).toLocaleDateString('zh-CN')}</div>
            </button>
            <button onClick={e => handleDelete(e, item.id)}
              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 rounded p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all">
              ✕
            </button>
          </div>
        ))}
      </div>
    </aside>
  )
}
