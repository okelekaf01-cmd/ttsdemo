import { type NextRequest, NextResponse } from 'next/server'
import { createToken, verifyPassword } from '@/lib/auth-server'
import { getBalance } from '@/lib/points'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}))

  if (!email || !password)
    return NextResponse.json({ error: '邮箱和密码为必填' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !(await verifyPassword(password, user.passwordHash)))
    return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 })

  const token = await createToken(user.id)

  const response = NextResponse.json({
    user: { id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt },
    balance: await getBalance(user.id),
  })

  response.cookies.set('token', token, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 604800,
  })
  return response
}
