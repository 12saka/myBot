import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/providers/QueryProvider';
import { Toaster } from 'react-hot-toast';
import PWAInstallPrompt from '@/components/pwa/PWAInstallPrompt';

const inter = { variable: 'font-sans' };
const outfit = { variable: 'font-display' };
const jetbrainsMono = { variable: 'font-mono' };

export const metadata: Metadata = {
  manifest: '/manifest.json',
  title: {
    default: 'TradeMind AI — Intelligent Autonomous Trading Platform',
    template: '%s | TradeMind AI',
  },
  description:
    'Enterprise-grade AI-powered trading platform. Real-time signals, autonomous execution, portfolio intelligence, and institutional analytics — powered by next-generation machine learning.',
  keywords: ['AI trading', 'algorithmic trading', 'portfolio management', 'crypto trading', 'forex AI', 'stock signals'],
  authors: [{ name: 'TradeMind AI' }],
  creator: 'TradeMind AI',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'TradeMind AI — Intelligent Autonomous Trading Platform',
    description: 'Enterprise-grade AI-powered trading platform with real-time signals and autonomous execution.',
    siteName: 'TradeMind AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TradeMind AI',
    description: 'Enterprise-grade AI-powered trading platform.',
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
