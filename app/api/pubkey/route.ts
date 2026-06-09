import { NextResponse } from 'next/server'
import { getPublicKeyPem } from '@/lib/crypto.server'

export async function GET() {
  try {
    return new NextResponse(getPublicKeyPem(), {
      headers: { 'Content-Type': 'text/plain' },
    })
  } catch {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
}
