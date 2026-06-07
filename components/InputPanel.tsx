'use client'

interface InputPanelProps {
  value: string
  onChange: (text: string) => void
  onGenerate: (text: string) => void
  isLoading: boolean
}

export function InputPanel({ value, onChange, onGenerate, isLoading }: InputPanelProps) {
  const MAX = 2000

  return (
    <form onSubmit={e => { e.preventDefault(); if (value.trim() && !isLoading) onGenerate(value.trim()) }}
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
      <label className="block text-sm font-medium text-gray-700">中文输入</label>
      <textarea
        value={value} onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && value.trim() && !isLoading) { e.preventDefault(); onGenerate(value.trim()) } }}
        maxLength={MAX} rows={6} placeholder="请输入中文口播文本..."
        className="w-full resize-none rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
      <div className="flex items-center justify-between">
        <span className={`text-xs ${value.length > MAX * 0.9 ? 'text-red-500' : 'text-gray-400'}`}>
          {value.length} / {MAX} 字
        </span>
        <button type="submit" disabled={isLoading || !value.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors">
          {isLoading ? '生成中...' : <><span>生成翻译 + 语音</span><span className="hidden sm:inline opacity-60 text-xs ml-1">Ctrl+↵</span></>}
        </button>
      </div>
    </form>
  )
}
