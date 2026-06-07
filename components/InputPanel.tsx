'use client'
import { useState } from 'react'

interface InputPanelProps { onGenerate: (text: string) => void; isLoading: boolean }

export function InputPanel({ onGenerate, isLoading }: InputPanelProps) {
  const [text, setText] = useState('')
  const MAX = 2000

  return (
    <form onSubmit={e => { e.preventDefault(); if (text.trim() && !isLoading) onGenerate(text.trim()) }}
      className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-3">
      <label className="block text-sm font-medium text-gray-400">中文输入</label>
      <textarea
        value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && text.trim() && !isLoading) { e.preventDefault(); onGenerate(text.trim()) } }}
        maxLength={MAX} rows={6} placeholder="请输入中文口播文本..."
        className="w-full resize-none rounded border border-gray-700 bg-gray-950 p-3 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
      />
      <div className="flex items-center justify-between">
        <span className={`text-xs ${text.length > MAX * 0.9 ? 'text-red-400' : 'text-gray-500'}`}>
          {text.length} / {MAX} 字
        </span>
        <button type="submit" disabled={isLoading || !text.trim()}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
          {isLoading ? '生成中...' : <>生成翻译 + 语音 <span className="opacity-50 text-xs">Ctrl+↵</span></>}
        </button>
      </div>
    </form>
  )
}
