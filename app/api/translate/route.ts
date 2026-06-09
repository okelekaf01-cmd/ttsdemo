import { createHash } from 'crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { decryptBody } from '@/lib/crypto.server'
import { checkRateLimit } from '@/lib/rate-limiter'
import { translateToEnglish } from '@/lib/deepl'

const cache = new Map<string, { translation: string; expiresAt: number }>()
const CACHE_TTL = 5 * 60 * 1000

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
    return NextResponse.json({ ok: false, error: '无效请求' }, { status: 400 })
  }

  const { chineseText } = body
  if (typeof chineseText !== 'string' || chineseText.length < 1 || chineseText.length > 2000)
    return NextResponse.json({ ok: false, error: '输入文本必须在 1-2000 字之间' }, { status: 400 })

  const hash = createHash('sha256').update(chineseText).digest('hex')
  const cached = cache.get(hash)
  if (cached && cached.expiresAt > Date.now())
    return NextResponse.json({ ok: true, text: cached.translation })

  try {
    const translation = await translateToEnglish(chineseText)
    cache.set(hash, { translation, expiresAt: Date.now() + CACHE_TTL })
    return NextResponse.json({ ok: true, text: translation })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `翻译失败：${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    )
  }
}
