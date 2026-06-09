import { type NextRequest, NextResponse } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'
import { compare, hash } from 'bcryptjs'
import { prisma } from '@/lib/db'
import type { User } from '@prisma/client'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-secret-change-in-production'
)
const JWT_EXPIRES = '7d'
const BCRYPT_ROUNDS = 12

// ─── JWT ────────────────────────────────────────────────────

export async function createToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES)
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<{ sub: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return { sub: payload.sub as string }
  } catch {
    return null
  }
}

function getToken(req: NextRequest): string | null {
  return req.cookies.get('token')?.value ?? null
}

// ─── Password ───────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return compare(password, hash)
}

// ─── Session ────────────────────────────────────────────────

export async function getSessionUser(req: NextRequest): Promise<User | null> {
  const token = getToken(req)
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload) return null
  return prisma.user.findUnique({ where: { id: payload.sub } })
}

// ─── Auth middleware wrapper ─────────────────────────────────

export type AuthedRequest = NextRequest & { user: User }

export function withAuth(
  handler: (req: AuthedRequest) => Promise<NextResponse>
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    const user = await getSessionUser(req)
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 })
    ;(req as AuthedRequest).user = user
    return handler(req as AuthedRequest)
  }
}

// ─── Auth helpers ───────────────────────────────────────────

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validatePassword(password: string): boolean {
  return password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password)
}
