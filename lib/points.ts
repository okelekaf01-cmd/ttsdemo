import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { AuthedRequest } from '@/lib/auth-server'

export type PointSource = 'registration_bonus' | 'tts_primary' | 'tts_multi'

export async function getBalance(userId: string): Promise<number> {
  const result = await prisma.pointLog.aggregate({
    where: { userId },
    _sum: { delta: true },
  })
  return result._sum.delta ?? 0
}

export async function deductPoints(userId: string, source: PointSource, delta = -1): Promise<void> {
  await prisma.pointLog.create({
    data: { userId, delta, source },
  })
}

export async function addPoints(userId: string, source: PointSource, delta: number): Promise<void> {
  await prisma.pointLog.create({
    data: { userId, delta, source },
  })
}

export async function getPointLogs(userId: string, limit = 20) {
  return prisma.pointLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

export function withPoints(source: PointSource) {
  return (
    handler: (req: AuthedRequest) => Promise<NextResponse>
  ): ((req: AuthedRequest) => Promise<NextResponse>) => {
    return async (req: AuthedRequest) => {
      const balance = await getBalance(req.user.id)
      if (balance < 1)
        return NextResponse.json({ error: '积分不足' }, { status: 402 })
      const response = await handler(req)
      if (response.ok) await deductPoints(req.user.id, source).catch(() => {})
      return response
    }
  }
}
