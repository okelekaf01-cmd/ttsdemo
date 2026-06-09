import {
  createPrivateKey,
  createPublicKey,
  privateDecrypt,
  createDecipheriv,
  constants,
} from 'crypto'
import type { NextRequest } from 'next/server'

let _pubKeyPem: string | null = null

export function getPublicKeyPem(): string {
  if (_pubKeyPem) return _pubKeyPem
  const raw = process.env.ENCRYPTION_PRIVATE_KEY
  if (!raw) throw new Error('ENCRYPTION_PRIVATE_KEY not set')
  const pem = raw.startsWith('-----') ? raw.replace(/\\n/g, '\n') : Buffer.from(raw, 'base64').toString('utf8')
  const priv = createPrivateKey(pem)
  _pubKeyPem = createPublicKey(priv).export({ type: 'spki', format: 'pem' }) as string
  return _pubKeyPem
}

export async function decryptBody(req: NextRequest): Promise<Record<string, unknown>> {
  const raw = process.env.ENCRYPTION_PRIVATE_KEY
  if (!raw) throw new Error('ENCRYPTION_PRIVATE_KEY not set')

  const body = (await req.json()) as {
    encryptedKey: string
    iv: string
    ciphertext: string
  }

  const pem = raw.startsWith('-----') ? raw.replace(/\\n/g, '\n') : Buffer.from(raw, 'base64').toString('utf8')
  const priv = createPrivateKey(pem)
  const encKeyBuf = Buffer.from(body.encryptedKey, 'base64')
  const ivBuf = Buffer.from(body.iv, 'base64')
  const ciphertextBuf = Buffer.from(body.ciphertext, 'base64')

  const aesKey = privateDecrypt(
    { key: priv, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    encKeyBuf
  )

  const authTag = ciphertextBuf.subarray(-16)
  const encrypted = ciphertextBuf.subarray(0, -16)

  const decipher = createDecipheriv('aes-256-gcm', aesKey, ivBuf)
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()])

  return JSON.parse(plaintext.toString('utf8')) as Record<string, unknown>
}
