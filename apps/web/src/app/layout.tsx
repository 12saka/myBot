import type { Metadata } from 'next';
import './globals.css';
import { Inter, Outfit, JetBrains_Mono } from 'next/font/google';
import { QueryProvider } from '@/providers/QueryProvider';
import { Toaster } from 'react-hot-toast';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
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
            position="top-right"
            toastOptions={{
              className: 'glass-card !bg-surface-2 !text-slate-100 !border !border-white/10 !shadow-2xl',
              duration: 4000,
              style: {
                fontFamily: 'var(--font-inter)',
                fontSize: '13px',
              },
            }}
          />
        </QueryProvider>
      </body>
    </html>
  );
}
