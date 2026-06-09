import { type NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-secret-change-in-production'
)

const PUBLIC_PATHS = ['/login', '/api/auth', '/api/pubkey', '/_next', '/favicon.ico']
const STATIC_EXTS = /\.(css|js|png|jpg|svg|ico|woff2?)$/

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname

  if (STATIC_EXTS.test(path)) return NextResponse.next()
  if (PUBLIC_PATHS.some(p => path.startsWith(p))) return NextResponse.next()

  const token = req.cookies.get('token')?.value
  if (!token) return NextResponse.redirect(new URL('/login', req.url))

  try {
    await jwtVerify(token, JWT_SECRET)
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/login', req.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
