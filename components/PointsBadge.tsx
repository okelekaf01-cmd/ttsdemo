'use client'

import { useAuth } from '@/components/AuthProvider'

export function PointsBadge() {
  const { balance, loading } = useAuth()
  if (loading) return null
  return (
    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
      {balance} 积分
    </span>
  )
}
