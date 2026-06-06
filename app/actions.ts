'use server'

import { createHash } from 'crypto'
import { headers } from 'next/headers'
import { translateToEnglish } from '@/lib/deepl'
import { checkRateLimit } from '@/lib/rate-limiter'

type Result = { ok: true; text: string } | { ok: false; error: string }

const cache = new Map<string, { translation: string; expiresAt: number }>()
const CACHE_TTL = 5 * 60 * 1000

export async function translateText(chineseText: string): Promise<Result> {
  if (!chineseText || chineseText.length > 2000)
    return { ok: false, error: '输入文本必须在 1-2000 字之间' }

  const ip = headers().get('x-forwarded-for') ?? 'unknown'
  if (!checkRateLimit(ip)) return { ok: false, error: '请求过于频繁，请稍候再试' }

  const hash = createHash('sha256').update(chineseText).digest('hex')
  const cached = cache.get(hash)
  if (cached && cached.expiresAt > Date.now()) return { ok: true, text: cached.translation }

  try {
    const translation = await translateToEnglish(chineseText)
    cache.set(hash, { translation, expiresAt: Date.now() + CACHE_TTL })
    return { ok: true, text: translation }
  } catch (err) {
    return { ok: false, error: `翻译失败：${err instanceof Error ? err.message : String(err)}` }
  }
}
