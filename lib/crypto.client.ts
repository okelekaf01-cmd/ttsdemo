import type { HistoryRecord, AlignmentData, MultiVoiceResult } from '@/types'

// ─── 工具函数 ─────────────────────────────────────────────────

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < arr.length; i += chunk) {
    binary += String.fromCharCode(...Array.from(arr.subarray(i, i + chunk)))
  }
  return btoa(binary)
}

// ─── 传输加密 ────────────────────────────────────────────────

let _cachedPublicKey: CryptoKey | null = null

async function getPublicKey(): Promise<CryptoKey> {
  if (_cachedPublicKey) return _cachedPublicKey
  const res = await fetch('/api/pubkey')
  if (!res.ok) throw new Error('获取公钥失败')
  const pem = await res.text()
  const b64 = pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n|\r/g, '')
  const der = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  _cachedPublicKey = await crypto.subtle.importKey(
    'spki',
    der,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  )
  return _cachedPublicKey
}

export async function encryptedFetch<T>(
  url: string,
  payload: Record<string, unknown>
): Promise<T> {
  const publicKey = await getPublicKey()

  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt']
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const plaintext = new TextEncoder().encode(JSON.stringify(payload))
  const ciphertextBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext)

  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey)
  const encryptedKeyBuf = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawAesKey)

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      encryptedKey: toBase64(encryptedKeyBuf),
      iv: toBase64(iv),
      ciphertext: toBase64(ciphertextBuf),
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ─── 存储加密 ────────────────────────────────────────────────

const DEVICE_KEY_STORAGE = 'voh-enc-key'

async function getDeviceKey(): Promise<CryptoKey> {
  let raw = localStorage.getItem(DEVICE_KEY_STORAGE)
  if (!raw) {
    const keyBytes = crypto.getRandomValues(new Uint8Array(32))
    raw = toBase64(keyBytes)
    localStorage.setItem(DEVICE_KEY_STORAGE, raw)
  }
  const keyBytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0))
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export interface StoredRecord {
  id: string
  createdAt: number
  iv: string
  ciphertext: string
}

export async function encryptRecord(record: HistoryRecord): Promise<StoredRecord> {
  const key = await getDeviceKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const audioBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(record.audioBlob)
  })

  const plaintext = new TextEncoder().encode(
    JSON.stringify({
      chineseText: record.chineseText,
      englishText: record.englishText,
      audioBase64,
      voiceId: record.voiceId,
      alignment: record.alignment,
      multiVoiceResults: record.multiVoiceResults,
    })
  )

  const ciphertextBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)

  return {
    id: record.id,
    createdAt: record.createdAt,
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertextBuf),
  }
}

export async function decryptRecord(stored: StoredRecord): Promise<HistoryRecord | null> {
  try {
    const key = await getDeviceKey()
    const iv = Uint8Array.from(atob(stored.iv), c => c.charCodeAt(0))
    const ciphertextBuf = Uint8Array.from(atob(stored.ciphertext), c => c.charCodeAt(0))

    const plaintextBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertextBuf)
    const data = JSON.parse(new TextDecoder().decode(plaintextBuf)) as {
      chineseText: string
      englishText: string
      audioBase64: string
      voiceId: string
      alignment: AlignmentData
      multiVoiceResults?: MultiVoiceResult[]
    }

    const bytes = Uint8Array.from(atob(data.audioBase64), c => c.charCodeAt(0))
    const audioBlob = new Blob([bytes], { type: 'audio/mpeg' })

    return {
      id: stored.id,
      createdAt: stored.createdAt,
      chineseText: data.chineseText,
      englishText: data.englishText,
      audioBlob,
      voiceId: data.voiceId,
      alignment: data.alignment,
      multiVoiceResults: data.multiVoiceResults,
    }
  } catch {
    return null
  }
}
