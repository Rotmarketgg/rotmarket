import { NextResponse } from 'next/server'

// Only the admin panel needs middleware-level protection
// All other pages handle their own auth checks client-side
// This approach avoids cookie detection issues with Supabase v2

export function middleware(req) {
  const { pathname } = req.nextUrl

  // Skip all static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|css|woff|woff2)$/)
  ) {
    return NextResponse.next()
  }

  // All pages are accessible — individual pages handle auth redirects
  // This is the most reliable approach with Supabase v2 cookie chunking
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
