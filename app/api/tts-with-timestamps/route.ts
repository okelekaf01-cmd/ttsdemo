import { type NextRequest, NextResponse } from 'next/server'
import { generateSpeechWithTimestamps } from '@/lib/elevenlabs'
import { checkRateLimit } from '@/lib/rate-limiter'
import { VOICES } from '@/lib/voices.config'
import { decryptBody } from '@/lib/crypto.server'

const ALLOWED: Set<string> = new Set([VOICES.primary.id, ...VOICES.comparison.map(v => v.id)])

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  const host = req.headers.get('host')
  if (origin && host && !origin.includes(host))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!checkRateLimit(req.headers.get('x-forwarded-for') ?? 'unknown'))
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  let body: Record<string, unknown>
  try {
    body = await decryptBody(req)
  } catch {
    return NextResponse.json({ error: '无效请求' }, { status: 400 })
  }

  const { text, voiceId } = body
  if (typeof text !== 'string' || text.length < 1 || text.length > 2000)
    return NextResponse.json({ error: 'Invalid text' }, { status: 400 })
  if (!ALLOWED.has(voiceId as string))
    return NextResponse.json({ error: 'Invalid voiceId' }, { status: 400 })

  try {
    return NextResponse.json(await generateSpeechWithTimestamps(text, voiceId as string))
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'TTS failed'
    console.error('[tts-with-timestamps]', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
