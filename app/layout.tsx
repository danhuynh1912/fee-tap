import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import '../src/index.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://feetap.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'SPOFUND — The fund engine for sports clubs',
  description:
    'Forecast court & shuttlecock costs, track the club fund, and split the bill fairly — connected to your PollTap roster.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    siteName: 'SPOFUND',
    type: 'website',
    url: SITE_URL,
    title: 'SPOFUND — The fund engine for sports clubs',
    description: 'Forecast costs, track the fund, split the bill fairly.',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SPOFUND — The fund engine for sports clubs',
    description: 'Forecast costs, track the fund, split the bill fairly.',
    images: ['/og.png'],
  },
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Telegram Mini App SDK — only active inside Telegram WebView */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
        {children}
      </body>
    </html>
  )
}
