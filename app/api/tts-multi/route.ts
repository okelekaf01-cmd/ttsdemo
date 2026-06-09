import { NextResponse } from 'next/server'
import { generateSpeech } from '@/lib/elevenlabs'
import { checkRateLimit } from '@/lib/rate-limiter'
import { VOICES } from '@/lib/voices.config'
import { decryptBody } from '@/lib/crypto.server'
import { withAuth, type AuthedRequest } from '@/lib/auth-server'
import { withPoints } from '@/lib/points'

const ALLOWED: Set<string> = new Set(VOICES.comparison.map(v => v.id))
const CONCURRENCY = 2

async function runBatched<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = []
  for (let i = 0; i < tasks.length; i += limit) {
    const batch = await Promise.allSettled(tasks.slice(i, i + limit).map(t => t()))
    results.push(...batch)
  }
  return results
}

const handler = async (req: AuthedRequest) => {
  const origin = req.headers.get('origin')
  const host = req.headers.get('host')
  if (origin && host && !origin.includes(host))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!checkRateLimit(req.headers.get('x-forwarded-for') ?? 'unknown'))
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  let body: Record<string, unknown>
  try { body = await decryptBody(req) }
  catch { return NextResponse.json({ error: '无效请求' }, { status: 400 }) }

  const { text, voiceIds } = body
  if (typeof text !== 'string' || text.length < 1 || text.length > 2000)
    return NextResponse.json({ error: 'Invalid text' }, { status: 400 })
  if (!Array.isArray(voiceIds) || !voiceIds.every((id: unknown) => ALLOWED.has(id as string)))
    return NextResponse.json({ error: 'Invalid voiceIds' }, { status: 400 })

  const tasks = (voiceIds as string[]).map((voiceId: string) => async () => ({
    voiceId,
    voiceName: VOICES.comparison.find(v => v.id === voiceId)?.name ?? voiceId,
    audioBase64: await generateSpeech(text, voiceId),
    error: undefined,
  }))

  const results = await runBatched(tasks, CONCURRENCY)

  return NextResponse.json(
    results.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : {
            voiceId: (voiceIds as string[])[i],
            voiceName: VOICES.comparison.find(v => v.id === (voiceIds as string[])[i])?.name ?? (voiceIds as string[])[i],
            audioBase64: null,
            error: 'Generation failed',
          }
    )
  )
}

export const POST = withAuth(withPoints('tts_multi')(handler))
