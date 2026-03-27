export const metadata = {
  title: 'Settings — RotMarket',
  description: 'Manage your RotMarket account settings and profile.',
  alternates: { canonical: 'https://rotmarket.net/settings' },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
}

export default function SettingsLayout({ children }) {
  return children
}
