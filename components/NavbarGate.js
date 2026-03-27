'use client'

import { usePathname } from 'next/navigation'
import Navbar from '@/components/Navbar'

export default function NavbarGate() {
  const pathname = usePathname()
  if (pathname?.startsWith('/auth/')) return null
  return <Navbar />
}
