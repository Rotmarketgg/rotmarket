export const metadata = {
  title: 'Messages — RotMarket',
  description: 'View your RotMarket conversations and trade messages.',
  alternates: { canonical: 'https://rotmarket.net/messages' },
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

export default function MessagesLayout({ children }) {
  return children
}
