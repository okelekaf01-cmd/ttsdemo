import { type NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth-server'
import { getBalance } from '@/lib/points'

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 })

  return NextResponse.json({
    user: { id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt },
    balance: await getBalance(user.id),
  })
}
