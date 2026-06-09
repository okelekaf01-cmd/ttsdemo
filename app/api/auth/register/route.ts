import { type NextRequest, NextResponse } from 'next/server'
import { hashPassword, createToken, validateEmail, validatePassword } from '@/lib/auth-server'
import { addPoints, getBalance } from '@/lib/points'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { email, password, displayName } = await req.json().catch(() => ({}))

  if (!email || !password)
    return NextResponse.json({ error: '邮箱和密码为必填' }, { status: 400 })
  if (!validateEmail(email))
    return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 })
  if (!validatePassword(password))
    return NextResponse.json({ error: '密码需 ≥8 位，且包含字母和数字' }, { status: 400 })

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing)
    return NextResponse.json({ error: '该邮箱已被注册' }, { status: 409 })

  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName: displayName || email.split('@')[0],
    },
  })

  await addPoints(user.id, 'registration_bonus', 10)
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
