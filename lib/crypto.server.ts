import {
  createPrivateKey,
  createPublicKey,
  privateDecrypt,
  createDecipheriv,
  constants,
} from 'crypto'
import type { NextRequest } from 'next/server'

const FALLBACK_KEY = 'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JSUV2Z0lCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktnd2dnU2tBZ0VBQW9JQkFRRHVuVmFOdDhqV0JoMS8KbHE5QzlOUy8yTWRqMUJjSGNnQVk2YlFXbE5lK2MyQkI5elQxb0NwZ2IxQ2J3NzR4andIZmZFN0oyZzBFdzVFSwptUHFadTV1RnJNeGtBYWhkMWVneXBaL2JDc1ZiVi9yUGFJaGt1RSs3UUlEc0RnK25yYUNyYU5saUNrTzcxbjBmCmlxTDNsZURNeFVFamZjRkU1dzNLWGd3MnRNOHBDYm9DR2JSeVdnbFNYdTdLMXVOT1JQWVUwTTF6MWhBdVFITVEKMXNOc3JmV0p6REt3ZEluWFp6SzEyZmQwWVUwUmh6YzRTcVY2S1pVbVpQZ2pJUWdCYnl0VmpZNXVabEFBODJrRQpaKzNUN2ZJM0tCL01OZWNCb0ZnOHdNbWNKZmZQenpJUE5Idmw4T2I4bEtaY21aN1dTQ3N3MmNQaVRiVUtaY2F6CkVvbW8vNUJ4QWdNQkFBRUNnZ0VBTWROdkFIYlJIRWY0bnV6ak9oTVAzZU94ZHhvUm1QOW9IOHVsVEZYV1d6R1MKZHhQYzNqR014OGhXeDcvdkZrQXJmdlJoSzJzNTdyVzdzci9SRElzTlpiTjRscVYxOStvejYyZUVZdVB6NUNnUgorbjkwZzd1dEFvZnNvOTRuekxiSDV5TWt5WUVsTmJNTE82dmliZHJCTDJFOVFlRC9tNWkzMjNzYUI4NW50OFNsCjZ5VkVYb0dyWkpDM3NKZDluTTdGb3U5RCtZb25LM2VQTXZGUkhBeUxySmxKRkJoSjdnSDZ5TFp0SEpaSVpRNHgKWCs4Yk4rU1g5L3RQOURjak55clVETzQwVWU2VlZ3R2c5M3hMc1pqeVM5UXhjWkVTOGs2UFFQZE5LQ2h3bHQyVQpqY3dPenovelllc1NGVzR0RGI4NVIxaXByMXBscUQ0cFZYeC9ZQVlvTlFLQmdRRCsxTlNvTDJ6bmFXK0tCQzFRCnNJdkFncW8weU1TMVdlTlNoTnpIY2ZjczRzaXAxNGtVYnVsL2N3SzZBUzVJdFgwOVJhTkQyVFBpTG9hWFpqcmsKNVBwYmdUTGJBWDg3RkhwblFzWHhXNEdDTjJDMmpqbnlhSHdGZ2o5c1RQWlJJbC9hMUp3UHNOK0NNZmN0UVUyawpsRVk4allnTkUyRm81RnlKMmJuSk1Lcm5Qd0tCZ1FEdnRYZ1dyMnlHd0x1SXZqanE3S2grOW1IMFFtdXMvd0JQCnFNc3l0VU5Ha0Z4ZzJISDZPRFlBYm4rQ1lqVFFMakpmNVlOR1ZmZnRnbGswNnNqYWJpV3lqdVJTSEcyNkVzalAKVFhEcVdIK0ZMZUd3Vk8xeXY1eW0vZk4wTGMxb256YjRTU2dLYkEwWkcyRytLWDJBN1ozb1RmRjhsOC9UWjNUZApZSVlaYVFUTVR3S0JnR3VIVnl5WXhuVm5jaDlrMzlJNmpOM3d4TzE5QWpRYjkrWXNGaFU2cTdnUEFlbFkvNGpWCnZFV0JQRmRNaEVFK0E5akU5NzE3ZTM4bmJyZTlYYVg4VVFBbnBsUHZiOFo0UDZZdThPT0ZYMEtaSjRBZ3g2YlkKRyswZkpyQUdVYkd1dFkvYlF2Y0VCV3drdFU0dFRodnlUU2pqOTlLOHFNL2YvSVJXa1NTcUdwTjFBb0dCQUpiVgpJMGx5L09FVjZXc3o5dkNzRmFJK09vak9PcDdTbmttQnRzcWprRCtZbXVnOWlncWUwQ3daVzVhWllRNFY0NURBCkJJaC9rOUFaa3pSZkFCK2g2NHFkcTBHWHJkdkY4aUd2WXZ1eTBCcm5NZm9ZbG9qNzFRQ25EMGZ0Z2pEdzdrL3gKQ0liMlVvK1gwVHN0TkZHcU14QjM2eG94Rkk2N3JLZVlFd2x1TVp5MUFvR0JBSXNtbEhEN0RheTF5WWNGNHE0UgpDUjFUdUtmb3Ard2YzZFVRb0tqZSszeFZJQlFjYjFLZEU3YUhqNEVoRTlFTmhmdUd3MExlRHFzalhHWG9tenR3CnYvd1dXM0g1OTVydE91TVB6VmFPc2Z0U0NFeGVpMzQ0N2tpejNIdzlTS1l0MkpMTW91VWkvY21MSVZIa3d0TisKeXdZZkpsM2NKMFR5Nis4Z3pQZUQ3aXNxCi0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS0K'

let _pubKeyPem: string | null = null

export function getPublicKeyPem(): string {
  if (_pubKeyPem) return _pubKeyPem
  const raw = process.env.ENCRYPTION_PRIVATE_KEY || FALLBACK_KEY
  if (!raw) throw new Error('ENCRYPTION_PRIVATE_KEY not set')
  const pem = raw.startsWith('-----') ? raw.replace(/\\n/g, '\n') : Buffer.from(raw, 'base64').toString('utf8')
  const priv = createPrivateKey(pem)
  _pubKeyPem = createPublicKey(priv).export({ type: 'spki', format: 'pem' }) as string
  return _pubKeyPem
}

export async function decryptBody(req: NextRequest): Promise<Record<string, unknown>> {
  const raw = process.env.ENCRYPTION_PRIVATE_KEY || FALLBACK_KEY

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
