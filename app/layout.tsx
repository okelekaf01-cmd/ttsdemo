import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '口播翻译工具',
  description: '中文口播文本转英文翻译 + 语音生成',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className={`${inter.className} bg-gray-950 text-gray-100`}>{children}</body>
    </html>
  )
}
