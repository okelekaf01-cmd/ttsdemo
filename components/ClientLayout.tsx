'use client'

import { AuthProvider } from '@/components/AuthProvider'

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
