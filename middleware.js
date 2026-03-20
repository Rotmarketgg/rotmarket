import { NextResponse } from 'next/server'

// Passthrough middleware — all auth is handled client-side per page.
// Keeping this minimal to avoid Edge Runtime compatibility issues on Vercel.
export function middleware() {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|css)).*)',
  ],
}
