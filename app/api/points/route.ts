import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-server'
import { getBalance, getPointLogs } from '@/lib/points'

export const GET = withAuth(async (req) => {
  const balance = await getBalance(req.user.id)
  const logs = await getPointLogs(req.user.id)
  return NextResponse.json({ balance, logs })
})
