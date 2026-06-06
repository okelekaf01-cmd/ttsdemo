# 口播翻译工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js 14 web tool that translates Chinese voiceover scripts to English, generates natural audio via ElevenLabs, supports multi-voice comparison, sentence-by-sentence highlight playback, and persists history in IndexedDB.

**Architecture:** App Router + Server Action for translation (pure text). Two API Routes for audio (bypass Server Action 4.5MB limit). `useVoiceoverTask` hook manages state machine (idle→translating→generating→done). History in IndexedDB with FIFO cleanup.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, DeepL API, ElevenLabs `eleven_turbo_v2_5`, IndexedDB

---

## File Map

| File | Responsibility |
|------|---------------|
| `types/index.ts` | All shared TypeScript interfaces |
| `lib/voices.config.ts` | Voice ID/name registry (single source of truth) |
| `lib/rate-limiter.ts` | In-memory per-IP rate limiter |
| `lib/deepl.ts` | DeepL REST API call |
| `lib/elevenlabs.ts` | ElevenLabs TTS (with-timestamps + standard) |
| `lib/sentences.ts` | Sentence splitting + alignment mapping + sanity check |
| `lib/history.ts` | IndexedDB CRUD + FIFO cleanup + quota fallback |
| `app/actions.ts` | Server Action: translateText (DeepL + cache + rate limit) |
| `app/api/tts-with-timestamps/route.ts` | API Route: primary voice audio + alignment JSON |
| `app/api/tts-multi/route.ts` | API Route: parallel multi-voice audio |
| `hooks/useVoiceoverTask.ts` | State machine hook wiring all async steps |
| `components/InputPanel.tsx` | Chinese textarea + char count + submit |
| `components/HighlightPlayer.tsx` | Audio player + sentence highlight sync |
| `components/ResultPanel.tsx` | English text + copy + download + HighlightPlayer |
| `components/VoiceComparison.tsx` | Four-voice side-by-side listen + download |
| `components/HistoryPanel.tsx` | Left sidebar: history list + load on click |
| `app/page.tsx` | Page assembly (C-layout: sidebar + main) |
| `app/layout.tsx` | Root layout + metadata |

---

### Task 1: Scaffold Project

**Files:** `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `.env.example`, `.gitignore`

- [ ] **Step 1: Scaffold Next.js 14**

Run in `d:/interview`:
```bash
npx create-next-app@14 . --typescript --tailwind --app --eslint --no-git --no-src-dir --import-alias "@/*"
```
Expected: Next.js files created. Existing `docs/` and `.git/` are untouched.

- [ ] **Step 2: Install test dependency (sentences.ts only)**

```bash
npm install -D jest jest-environment-jsdom @types/jest
```

- [ ] **Step 3: Add jest config to package.json**

In `package.json`, add to `scripts`:
```json
"test": "jest --testPathPattern=sentences"
```

And add at root level:
```json
"jest": {
  "testEnvironment": "node",
  "moduleNameMapper": { "^@/(.*)$": "<rootDir>/$1" },
  "transform": { "^.+\\.tsx?$": ["ts-jest", {}] }
}
```

Also install ts-jest:
```bash
npm install -D ts-jest
```

- [ ] **Step 4: Create .env.example**

```
# DeepL API — https://www.deepl.com/pro-api (free tier key ends with :fx)
DEEPL_API_KEY=your_deepl_api_key_here

# ElevenLabs API — https://elevenlabs.io
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

- [ ] **Step 5: Create .env.local with real keys**

```
DEEPL_API_KEY=<your actual DeepL key>
ELEVENLABS_API_KEY=<your actual ElevenLabs key>
```

- [ ] **Step 6: Add to .gitignore**

```
.env.local
.superpowers/
```

- [ ] **Step 7: Verify dev server starts**

```bash
npm run dev
```
Expected: server on port 3000. Open http://localhost:3000 and see default Next.js page. Stop with Ctrl+C.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 14 project"
```

---

### Task 2: Types & Voice Config

**Files:**
- Create: `types/index.ts`
- Create: `lib/voices.config.ts`

- [ ] **Step 1: Create types/index.ts**

```ts
export interface AlignmentData {
  characters: string[]
  character_start_times_seconds: number[]
  character_end_times_seconds: number[]
}

export interface SpeechResult {
  audioBase64: string
  alignment: AlignmentData
}

export interface MultiVoiceResult {
  voiceId: string
  voiceName: string
  audioBase64: string | null
  error?: string
}

export interface HistoryRecord {
  id: string
  createdAt: number
  chineseText: string
  englishText: string
  audioBlob: Blob
  voiceId: string
  alignment: AlignmentData
}

export interface SentenceWithTimestamps {
  text: string
  startTime: number
  endTime: number
}

export type TaskState = 'idle' | 'translating' | 'generating' | 'done' | 'error'
```

- [ ] **Step 2: Create lib/voices.config.ts**

```ts
export const VOICES = {
  primary: { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
  comparison: [
    { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh' },
    { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli' },
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam' },
  ],
} as const
```

- [ ] **Step 3: Commit**

```bash
git add types/index.ts lib/voices.config.ts
git commit -m "feat: add shared types and voice config"
```

---

### Task 3: Rate Limiter

**Files:**
- Create: `lib/rate-limiter.ts`

- [ ] **Step 1: Create lib/rate-limiter.ts**

```ts
interface RateEntry { count: number; resetAt: number }

const LIMIT = 10
const WINDOW_MS = 60_000
let store = new Map<string, RateEntry>()

export function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = store.get(ip)
  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (entry.count >= LIMIT) return false
  entry.count++
  return true
}

export function resetForTesting(): void {
  store = new Map()
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/rate-limiter.ts
git commit -m "feat: add in-memory rate limiter"
```

---

### Task 4: Sentences Library (with tests)

**Files:**
- Create: `lib/sentences.ts`
- Create: `__tests__/sentences.test.ts`

- [ ] **Step 1: Create lib/sentences.ts**

```ts
import type { AlignmentData, SentenceWithTimestamps } from '@/types'

// Lookbehind on [.!?] + space + uppercase avoids splitting "Dr. Smith", "3.5mm"
const SENTENCE_BOUNDARY = /(?<=[.!?])\s+(?=[A-Z])/

export function splitSentences(text: string): string[] {
  return text.split(SENTENCE_BOUNDARY).filter(s => s.trim().length > 0)
}

export function buildEvenTimestamps(
  sentences: string[],
  audioDuration: number
): SentenceWithTimestamps[] {
  const step = audioDuration / sentences.length
  return sentences.map((text, i) => ({
    text,
    startTime: i * step,
    endTime: (i + 1) * step,
  }))
}

export function buildTimestampsFromAlignment(
  sentences: string[],
  alignment: AlignmentData
): SentenceWithTimestamps[] {
  const rawChars = alignment.characters.join('')
  const normalizedText = sentences.join(' ').replace(/\s+/g, '')
  const deviation =
    Math.abs(rawChars.length - normalizedText.length) / (normalizedText.length || 1)
  const audioDuration =
    alignment.character_end_times_seconds[alignment.character_end_times_seconds.length - 1] ?? 0

  if (deviation > 0.05) {
    return buildEvenTimestamps(sentences, audioDuration)
  }

  let charIdx = 0
  return sentences.map((sentence, i) => {
    const startCharIdx = charIdx
    charIdx += sentence.replace(/\s+/g, '').length
    const endCharIdx = Math.min(charIdx - 1, alignment.character_end_times_seconds.length - 1)
    const safeStart = Math.min(startCharIdx, alignment.character_start_times_seconds.length - 1)

    return {
      text: sentence,
      startTime: alignment.character_start_times_seconds[safeStart],
      endTime:
        i === sentences.length - 1
          ? audioDuration
          : alignment.character_end_times_seconds[endCharIdx],
    }
  })
}
```

- [ ] **Step 2: Create __tests__/sentences.test.ts**

```ts
import {
  splitSentences,
  buildEvenTimestamps,
  buildTimestampsFromAlignment,
} from '../lib/sentences'
import type { AlignmentData } from '../types'

describe('splitSentences', () => {
  test('splits on sentence boundaries', () => {
    expect(splitSentences('Hello world. How are you? Fine thanks.')).toEqual([
      'Hello world.',
      'How are you?',
      'Fine thanks.',
    ])
  })

  test('does not split on decimal points like 3.5mm', () => {
    const result = splitSentences('The robot costs 3.5mm. It weighs 10kg.')
    expect(result).toEqual(['The robot costs 3.5mm.', 'It weighs 10kg.'])
  })

  test('does not split on Dr. abbreviation', () => {
    const result = splitSentences('Dr. Smith is here. He is ready.')
    expect(result.length).toBe(2)
    expect(result[0]).toContain('Dr. Smith')
  })
})

describe('buildEvenTimestamps', () => {
  test('divides duration evenly', () => {
    const result = buildEvenTimestamps(['First.', 'Second.', 'Third.'], 9)
    expect(result[0]).toEqual({ text: 'First.', startTime: 0, endTime: 3 })
    expect(result[2]).toEqual({ text: 'Third.', startTime: 6, endTime: 9 })
  })
})

describe('buildTimestampsFromAlignment', () => {
  function makeAlignment(chars: string, duration: number): AlignmentData {
    const arr = chars.split('')
    const step = duration / arr.length
    return {
      characters: arr,
      character_start_times_seconds: arr.map((_, i) => i * step),
      character_end_times_seconds: arr.map((_, i) => (i + 1) * step),
    }
  }

  test('falls back to even timestamps when alignment deviates >5%', () => {
    const sentences = ['Hello.', 'World.']
    const result = buildTimestampsFromAlignment(sentences, makeAlignment('XXXXXXXXXX', 10))
    expect(result[0].startTime).toBe(0)
    expect(result[0].endTime).toBe(5)
  })

  test('maps alignment to sentences when chars match', () => {
    const sentences = ['Hi.', 'Bye.']
    const result = buildTimestampsFromAlignment(sentences, makeAlignment('HiBye', 10))
    expect(result[0].text).toBe('Hi.')
    expect(result[1].text).toBe('Bye.')
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm test
```
Expected: PASS (5 tests)

- [ ] **Step 4: Commit**

```bash
git add lib/sentences.ts __tests__/sentences.test.ts
git commit -m "feat: add sentence splitting with alignment mapping"
```

---

### Task 5: DeepL + ElevenLabs Libraries

**Files:**
- Create: `lib/deepl.ts`
- Create: `lib/elevenlabs.ts`

- [ ] **Step 1: Create lib/deepl.ts**

```ts
export async function translateToEnglish(text: string): Promise<string> {
  // Free tier keys end with :fx and use api-free subdomain
  const endpoint = process.env.DEEPL_API_KEY?.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate'

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: [text], source_lang: 'ZH', target_lang: 'EN' }),
  })

  if (!res.ok) throw new Error(`DeepL ${res.status}: ${await res.text().catch(() => '')}`)
  const data = await res.json()
  return data.translations[0].text as string
}
```

- [ ] **Step 2: Create lib/elevenlabs.ts**

```ts
import type { AlignmentData, SpeechResult } from '@/types'

const MODEL_ID = 'eleven_turbo_v2_5'
const VOICE_SETTINGS = {
  stability: 0.35,
  similarity_boost: 0.75,
  style: 0.45,
  use_speaker_boost: true,
}

function authHeaders() {
  return {
    'xi-api-key': process.env.ELEVENLABS_API_KEY!,
    'Content-Type': 'application/json',
  }
}

export async function generateSpeechWithTimestamps(
  text: string,
  voiceId: string
): Promise<SpeechResult> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ text, model_id: MODEL_ID, voice_settings: VOICE_SETTINGS }),
    }
  )
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text().catch(() => '')}`)
  const data = await res.json()
  return { audioBase64: data.audio_base64 as string, alignment: data.alignment as AlignmentData }
}

export async function generateSpeech(text: string, voiceId: string): Promise<string> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { ...authHeaders(), Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: MODEL_ID, voice_settings: VOICE_SETTINGS }),
  })
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text().catch(() => '')}`)
  const buffer = await res.arrayBuffer()
  return Buffer.from(buffer).toString('base64')
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/deepl.ts lib/elevenlabs.ts
git commit -m "feat: add DeepL and ElevenLabs API libraries"
```

---

### Task 6: History Library (IndexedDB)

**Files:**
- Create: `lib/history.ts`

- [ ] **Step 1: Create lib/history.ts**

```ts
import type { HistoryRecord } from '@/types'

const DB_NAME = 'voiceover-history'
const STORE_NAME = 'records'
const MAX_RECORDS = 20

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = e => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function saveRecord(record: HistoryRecord): Promise<void> {
  let db: IDBDatabase
  try {
    db = await openDB()
  } catch {
    // Fallback: sessionStorage text-only
    const key = 'voh-fallback'
    const existing = JSON.parse(sessionStorage.getItem(key) ?? '[]')
    const slim = { id: record.id, createdAt: record.createdAt, chineseText: record.chineseText, englishText: record.englishText }
    sessionStorage.setItem(key, JSON.stringify([slim, ...existing].slice(0, MAX_RECORDS)))
    return
  }

  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  await req(store.put(record))

  // FIFO: delete oldest if over limit
  const allKeys = await req(store.index('createdAt').getAllKeys())
  if (allKeys.length > MAX_RECORDS) {
    for (const key of allKeys.slice(0, allKeys.length - MAX_RECORDS)) {
      store.delete(key)
    }
  }
  await txDone(tx)
}

export async function getAllRecords(): Promise<Omit<HistoryRecord, 'audioBlob'>[]> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const all = await req(tx.objectStore(STORE_NAME).index('createdAt').getAll()) as HistoryRecord[]
    return all
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(({ audioBlob: _b, ...rest }) => rest)
  } catch {
    const key = 'voh-fallback'
    return JSON.parse(sessionStorage.getItem(key) ?? '[]')
  }
}

export async function getRecord(id: string): Promise<HistoryRecord | null> {
  try {
    const db = await openDB()
    const result = await req(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id))
    return result ?? null
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/history.ts
git commit -m "feat: add IndexedDB history library with FIFO cleanup"
```

---

### Task 7: Server Action + API Routes

**Files:**
- Create: `app/actions.ts`
- Create: `app/api/tts-with-timestamps/route.ts`
- Create: `app/api/tts-multi/route.ts`

- [ ] **Step 1: Create app/actions.ts**

```ts
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
```

- [ ] **Step 2: Create app/api/tts-with-timestamps/route.ts**

```ts
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
```

- [ ] **Step 3: Create app/api/tts-multi/route.ts**

```ts
import { type NextRequest, NextResponse } from 'next/server'
import { generateSpeech } from '@/lib/elevenlabs'
import { checkRateLimit } from '@/lib/rate-limiter'
import { VOICES } from '@/lib/voices.config'

const ALLOWED = new Set(VOICES.comparison.map(v => v.id))

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  const host = req.headers.get('host')
  if (origin && host && !origin.includes(host))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!checkRateLimit(req.headers.get('x-forwarded-for') ?? 'unknown'))
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { text, voiceIds } = await req.json().catch(() => ({}))
  if (typeof text !== 'string' || text.length < 1 || text.length > 2000)
    return NextResponse.json({ error: 'Invalid text' }, { status: 400 })
  if (!Array.isArray(voiceIds) || !voiceIds.every((id: unknown) => ALLOWED.has(id as string)))
    return NextResponse.json({ error: 'Invalid voiceIds' }, { status: 400 })

  const results = await Promise.allSettled(
    voiceIds.map(async (voiceId: string) => ({
      voiceId,
      voiceName: VOICES.comparison.find(v => v.id === voiceId)?.name ?? voiceId,
      audioBase64: await generateSpeech(text, voiceId),
      error: undefined,
    }))
  )

  return NextResponse.json(
    results.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : {
            voiceId: voiceIds[i],
            voiceName: VOICES.comparison.find(v => v.id === voiceIds[i])?.name ?? voiceIds[i],
            audioBase64: null,
            error: 'Generation failed',
          }
    )
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/actions.ts app/api/tts-with-timestamps/route.ts app/api/tts-multi/route.ts
git commit -m "feat: add Server Action and API Routes for translation and TTS"
```

---

### Task 8: useVoiceoverTask Hook

**Files:**
- Create: `hooks/useVoiceoverTask.ts`

- [ ] **Step 1: Create hooks/useVoiceoverTask.ts**

```ts
'use client'

import { useCallback, useState } from 'react'
import { translateText } from '@/app/actions'
import { saveRecord } from '@/lib/history'
import { VOICES } from '@/lib/voices.config'
import type { HistoryRecord, MultiVoiceResult, SpeechResult, TaskState } from '@/types'

interface TaskData {
  state: TaskState
  chineseText: string
  englishText: string
  speechResult: SpeechResult | null
  multiVoiceResults: MultiVoiceResult[]
  error: string | null
}

const INITIAL: TaskData = {
  state: 'idle', chineseText: '', englishText: '',
  speechResult: null, multiVoiceResults: [], error: null,
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export function useVoiceoverTask() {
  const [data, setData] = useState<TaskData>(INITIAL)

  const generate = useCallback(async (chineseText: string) => {
    setData({ ...INITIAL, state: 'translating', chineseText })

    const translateResult = await translateText(chineseText)
    if (!translateResult.ok) {
      setData(d => ({ ...d, state: 'error', error: translateResult.error }))
      return
    }

    const englishText = translateResult.text
    setData(d => ({ ...d, state: 'generating', englishText }))

    const [speechRes, multiRes] = await Promise.allSettled([
      fetch('/api/tts-with-timestamps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: englishText, voiceId: VOICES.primary.id }),
      }).then(async r => {
        if (!r.ok) throw new Error(`TTS ${r.status}`)
        return r.json() as Promise<SpeechResult>
      }),
      fetch('/api/tts-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: englishText, voiceIds: VOICES.comparison.map(v => v.id) }),
      }).then(async r => {
        if (!r.ok) throw new Error(`Multi TTS ${r.status}`)
        return r.json() as Promise<MultiVoiceResult[]>
      }),
    ])

    const speechResult = speechRes.status === 'fulfilled' ? speechRes.value : null
    const multiVoiceResults = multiRes.status === 'fulfilled' ? multiRes.value : []

    if (!speechResult) {
      setData(d => ({ ...d, state: 'error', error: `语音生成失败：${speechRes.status === 'rejected' ? speechRes.reason : ''}` }))
      return
    }

    setData(d => ({ ...d, state: 'done', speechResult, multiVoiceResults }))

    // Fire-and-forget: save to history
    const bytes = Uint8Array.from(atob(speechResult.audioBase64), c => c.charCodeAt(0))
    const audioBlob = new Blob([bytes], { type: 'audio/mpeg' })
    saveRecord({
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      chineseText, englishText,
      audioBlob,
      voiceId: VOICES.primary.id,
      alignment: speechResult.alignment,
    })
      .then(() => window.dispatchEvent(new Event('history-updated')))
      .catch(console.error)
  }, [])

  const loadFromHistory = useCallback(async (record: HistoryRecord) => {
    const audioBase64 = await blobToBase64(record.audioBlob)
    setData({
      state: 'done',
      chineseText: record.chineseText,
      englishText: record.englishText,
      speechResult: { audioBase64, alignment: record.alignment },
      multiVoiceResults: [],
      error: null,
    })
  }, [])

  return { ...data, generate, loadFromHistory }
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/useVoiceoverTask.ts
git commit -m "feat: add useVoiceoverTask state machine hook"
```

---

### Task 9: Components

**Files:**
- Create: `components/InputPanel.tsx`
- Create: `components/HighlightPlayer.tsx`
- Create: `components/ResultPanel.tsx`
- Create: `components/VoiceComparison.tsx`
- Create: `components/HistoryPanel.tsx`

- [ ] **Step 1: Create components/InputPanel.tsx**

```tsx
'use client'
import { useState } from 'react'

interface InputPanelProps { onGenerate: (text: string) => void; isLoading: boolean }

export function InputPanel({ onGenerate, isLoading }: InputPanelProps) {
  const [text, setText] = useState('')
  const MAX = 2000

  return (
    <form onSubmit={e => { e.preventDefault(); if (text.trim() && !isLoading) onGenerate(text.trim()) }}
      className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-3">
      <label className="block text-sm font-medium text-gray-400">中文输入</label>
      <textarea
        value={text} onChange={e => setText(e.target.value)}
        maxLength={MAX} rows={6} placeholder="请输入中文口播文本..."
        className="w-full resize-none rounded border border-gray-700 bg-gray-950 p-3 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
      />
      <div className="flex items-center justify-between">
        <span className={`text-xs ${text.length > MAX * 0.9 ? 'text-red-400' : 'text-gray-500'}`}>
          {text.length} / {MAX} 字
        </span>
        <button type="submit" disabled={isLoading || !text.trim()}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
          {isLoading ? '生成中...' : '▶ 生成翻译 + 语音'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Create components/HighlightPlayer.tsx**

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { splitSentences, buildTimestampsFromAlignment } from '@/lib/sentences'
import type { SentenceWithTimestamps, SpeechResult } from '@/types'

interface HighlightPlayerProps { englishText: string; speechResult: SpeechResult }

export function HighlightPlayer({ englishText, speechResult }: HighlightPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [audioUrl, setAudioUrl] = useState('')
  const [activeIdx, setActiveIdx] = useState(-1)
  const sentencesRef = useRef<SentenceWithTimestamps[]>([])

  useEffect(() => {
    const bytes = Uint8Array.from(atob(speechResult.audioBase64), c => c.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }))
    setAudioUrl(url)
    sentencesRef.current = buildTimestampsFromAlignment(splitSentences(englishText), speechResult.alignment)
    return () => URL.revokeObjectURL(url)
  }, [speechResult, englishText])

  const onTimeUpdate = () => {
    const t = audioRef.current?.currentTime ?? 0
    setActiveIdx(sentencesRef.current.findIndex(s => t >= s.startTime && t < s.endTime))
  }

  return (
    <div className="space-y-3">
      <audio ref={audioRef} src={audioUrl} controls onTimeUpdate={onTimeUpdate}
        onEnded={() => setActiveIdx(-1)} className="w-full" />
      <div className="text-sm leading-loose">
        {splitSentences(englishText).map((s, i) => (
          <span key={i} className={`rounded px-0.5 transition-colors ${i === activeIdx ? 'bg-blue-600 text-white' : 'text-gray-300'}`}>
            {s}{' '}
          </span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create components/ResultPanel.tsx**

```tsx
'use client'
import { useState } from 'react'
import { HighlightPlayer } from './HighlightPlayer'
import type { SpeechResult, TaskState } from '@/types'

interface ResultPanelProps {
  englishText: string; speechResult: SpeechResult | null
  state: TaskState; error: string | null
}

export function ResultPanel({ englishText, speechResult, state, error }: ResultPanelProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(englishText)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const download = () => {
    if (!speechResult) return
    const bytes = Uint8Array.from(atob(speechResult.audioBase64), c => c.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }))
    Object.assign(document.createElement('a'), { href: url, download: 'voiceover.mp3' }).click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-400">英文结果</label>
        {state === 'translating' && <span className="text-xs text-blue-400 animate-pulse">翻译中...</span>}
        {state === 'generating' && <span className="text-xs text-blue-400 animate-pulse">生成语音中...</span>}
      </div>
      {error && <div className="rounded border border-red-700 bg-red-900/30 p-3 text-sm text-red-400">{error}</div>}
      {englishText && (
        <>
          <div className="flex gap-2">
            <button onClick={copy} className="rounded border border-gray-700 px-3 py-1.5 text-xs hover:bg-gray-800">
              {copied ? '✓ 已复制' : '📋 复制'}
            </button>
            {speechResult && (
              <button onClick={download} className="rounded border border-gray-700 px-3 py-1.5 text-xs hover:bg-gray-800">
                ⬇ 下载音频
              </button>
            )}
          </div>
          {speechResult
            ? <HighlightPlayer englishText={englishText} speechResult={speechResult} />
            : <p className="text-sm leading-relaxed text-gray-300">{englishText}</p>}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create components/VoiceComparison.tsx**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { VOICES } from '@/lib/voices.config'
import type { MultiVoiceResult, SpeechResult } from '@/types'

interface Props { primarySpeechResult: SpeechResult; multiVoiceResults: MultiVoiceResult[] }

export function VoiceComparison({ primarySpeechResult, multiVoiceResults }: Props) {
  const allVoices = [
    { voiceId: VOICES.primary.id, voiceName: VOICES.primary.name, audioBase64: primarySpeechResult.audioBase64 },
    ...multiVoiceResults,
  ]
  const [urls, setUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    const map: Record<string, string> = {}
    for (const v of allVoices) {
      if (v.audioBase64) {
        const bytes = Uint8Array.from(atob(v.audioBase64), c => c.charCodeAt(0))
        map[v.voiceId] = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }))
      }
    }
    setUrls(map)
    return () => { for (const u of Object.values(map)) URL.revokeObjectURL(u) }
  }, [primarySpeechResult, multiVoiceResults]) // eslint-disable-line

  const download = (voiceId: string, voiceName: string) => {
    const url = urls[voiceId]; if (!url) return
    Object.assign(document.createElement('a'), { href: url, download: `voiceover-${voiceName}.mp3` }).click()
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-4">
      <label className="text-sm font-medium text-gray-400">多音色对比</label>
      <div className="grid grid-cols-2 gap-3">
        {allVoices.map(v => (
          <div key={v.voiceId} className="rounded border border-gray-700 bg-gray-950 p-3 space-y-2">
            <div className="text-sm font-medium text-gray-200">{v.voiceName}</div>
            {'error' in v && v.error
              ? <p className="text-xs text-red-400">{v.error}</p>
              : urls[v.voiceId]
                ? <>
                    <audio src={urls[v.voiceId]} controls className="h-8 w-full" />
                    <button onClick={() => download(v.voiceId, v.voiceName)}
                      className="w-full rounded border border-gray-700 py-1 text-xs hover:bg-gray-800">
                      ⬇ 下载 {v.voiceName}
                    </button>
                  </>
                : <p className="text-xs text-gray-500">生成中...</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create components/HistoryPanel.tsx**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { getAllRecords, getRecord } from '@/lib/history'
import type { HistoryRecord } from '@/types'

type ListItem = Omit<HistoryRecord, 'audioBlob' | 'alignment' | 'voiceId'>

interface Props { onSelect: (record: HistoryRecord) => void }

export function HistoryPanel({ onSelect }: Props) {
  const [items, setItems] = useState<ListItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const refresh = () => getAllRecords().then(setItems)
  useEffect(() => {
    refresh()
    window.addEventListener('history-updated', refresh)
    return () => window.removeEventListener('history-updated', refresh)
  }, [])

  const handleSelect = async (id: string) => {
    setSelectedId(id)
    const record = await getRecord(id)
    if (record) onSelect(record)
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col overflow-hidden border-r border-gray-800">
      <div className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">历史记录</div>
      <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-2">
        {items.length === 0 && <p className="px-2 py-4 text-xs text-gray-600">暂无历史记录</p>}
        {items.map(item => (
          <button key={item.id} onClick={() => handleSelect(item.id)}
            className={`w-full rounded px-3 py-2 text-left text-xs hover:bg-gray-800 ${selectedId === item.id ? 'bg-gray-800' : ''}`}>
            <div className="truncate font-medium text-gray-300">
              {item.chineseText.slice(0, 20)}{item.chineseText.length > 20 ? '...' : ''}
            </div>
            <div className="mt-0.5 text-gray-600">{new Date(item.createdAt).toLocaleDateString('zh-CN')}</div>
          </button>
        ))}
      </div>
    </aside>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add components/
git commit -m "feat: add all UI components"
```

---

### Task 10: Main Page + Deploy

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Create: `vercel.json`

- [ ] **Step 1: Update app/layout.tsx**

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '口播翻译工具',
  description: '中文口播文本转英文翻译 + 语音生成',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className={`${inter.className} bg-gray-950 text-gray-100`}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Replace app/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 3: Replace app/page.tsx**

```tsx
'use client'
import { InputPanel } from '@/components/InputPanel'
import { ResultPanel } from '@/components/ResultPanel'
import { VoiceComparison } from '@/components/VoiceComparison'
import { HistoryPanel } from '@/components/HistoryPanel'
import { useVoiceoverTask } from '@/hooks/useVoiceoverTask'

export default function Home() {
  const task = useVoiceoverTask()
  const isLoading = task.state === 'translating' || task.state === 'generating'

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b border-gray-800 px-6 py-4">
        <h1 className="text-lg font-semibold">🎙️ 口播翻译工具</h1>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <HistoryPanel onSelect={task.loadFromHistory} />
        <main className="flex-1 space-y-6 overflow-y-auto p-6">
          <InputPanel onGenerate={task.generate} isLoading={isLoading} />
          {task.state !== 'idle' && (
            <ResultPanel englishText={task.englishText} speechResult={task.speechResult}
              state={task.state} error={task.error} />
          )}
          {task.state === 'done' && task.speechResult && task.multiVoiceResults.length > 0 && (
            <VoiceComparison primarySpeechResult={task.speechResult} multiVoiceResults={task.multiVoiceResults} />
          )}
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create vercel.json**

```json
{
  "functions": {
    "app/api/tts-with-timestamps/route.ts": { "maxDuration": 60 },
    "app/api/tts-multi/route.ts": { "maxDuration": 60 }
  }
}
```

- [ ] **Step 5: Build check**

```bash
npm run build
```
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 6: Smoke test locally**

```bash
npm run dev
```
Open http://localhost:3000 and verify:
1. Page loads with left sidebar + right work area
2. Paste: `还在为割草头疼吗？太阳底下忙活大半天，又累又费劲儿，清理碎草还麻烦！`
3. Click "生成翻译 + 语音" — button disables, "翻译中..." appears
4. English text appears, then "生成语音中..."
5. Rachel audio player appears — play and verify sentence highlighting tracks speech
6. Multi-voice panel shows Josh / Elli / Adam — play each
7. History sidebar shows the new entry — click to reload it
8. Submit same text again — translation returns instantly (cached)

- [ ] **Step 7: Commit and deploy**

```bash
git add app/layout.tsx app/page.tsx app/globals.css vercel.json
git commit -m "feat: assemble main page and add Vercel config"
npx vercel --prod
```
Set env vars when prompted: `DEEPL_API_KEY`, `ELEVENLABS_API_KEY`
