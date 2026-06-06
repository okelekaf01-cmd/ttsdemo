import { type NextRequest, NextResponse } from 'next/server'
import { generateSpeechWithTimestamps } from '@/lib/elevenlabs'
import { checkRateLimit } from '@/lib/rate-limiter'
import { VOICES } from '@/lib/voices.config'

const ALLOWED = new Set([VOICES.primary.id, ...VOICES.comparison.map(v => v.id)])

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  const host = req.headers.get('host')
  if (origin && host && !origin.includes(host))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!checkRateLimit(req.headers.get('x-forwarded-for') ?? 'unknown'))
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { text, voiceId } = await req.json().catch(() => ({}))
  if (typeof text !== 'string' || text.length < 1 || text.length > 2000)
    return NextResponse.json({ error: 'Invalid text' }, { status: 400 })
  if (!ALLOWED.has(voiceId))
    return NextResponse.json({ error: 'Invalid voiceId' }, { status: 400 })

  try {
    return NextResponse.json(await generateSpeechWithTimestamps(text, voiceId))
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'TTS failed' },
      { status: 502 }
    )
  }
}
