import type { Metadata, Viewport } from 'next';
import './globals.css';
import { QueryProvider } from '@/providers/QueryProvider';
import { Toaster } from 'react-hot-toast';
import PWAInstallPrompt from '@/components/pwa/PWAInstallPrompt';

const inter = { variable: 'font-sans' };
const outfit = { variable: 'font-display' };
const jetbrainsMono = { variable: 'font-mono' };

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  manifest: '/manifest.json',
  title: {
    default: 'TradeMind — Intelligent Autonomous Trading Platform',
    template: '%s | TradeMind',
  },
  description:
    'Enterprise-grade quantitative trading platform. Real-time signals, autonomous execution, portfolio intelligence, and institutional analytics.',
  keywords: ['quantitative trading', 'algorithmic trading', 'portfolio management', 'crypto trading', 'forex signals', 'stock signals'],
  authors: [{ name: 'TradeMind' }],
  creator: 'TradeMind',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'TradeMind — Intelligent Autonomous Trading Platform',
    description: 'Enterprise-grade quantitative trading platform with real-time signals and autonomous execution.',
    siteName: 'TradeMind',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TradeMind',
    description: 'Enterprise-grade quantitative trading platform.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable} ${jetbrainsMono.variable}`}
    >
      <body className="gradient-bg min-h-screen text-slate-100 antialiased font-sans">
        <QueryProvider>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              className: 'glass-card !bg-surface-2 !text-slate-100 !border !border-white/10 !shadow-2xl !max-w-[90vw] md:!max-w-md',
              duration: 4000,
              style: {
                fontFamily: 'var(--font-inter)',
                fontSize: '13px',
              },
            }}
          />
          <PWAInstallPrompt />
        </QueryProvider>
      </body>
    </html>
  );
}
