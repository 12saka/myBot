'use client';

import React, {
  useEffect, useRef, useState, Suspense, useMemo
} from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  motion, useScroll, useTransform, useInView,
  AnimatePresence, useMotionValue, useSpring
} from 'framer-motion';
import {
  Zap, TrendingUp, Shield, BrainCircuit, BarChart3, Globe,
  ArrowRight, CheckCircle, ChevronRight, Activity, Cpu, Lock,
  Rocket, Star, Play, Users, Bot, GraduationCap, LineChart,
  Clock, Headphones, ChevronDown, Plus, Minus, Twitter,
  Github, Linkedin, Mail, Menu, X, TrendingDown, Eye,
  DollarSign, Target, Award, BookOpen, Layers
} from 'lucide-react';

const HeroCanvas = dynamic(() => import('@/components/3d/HeroCanvas'), { ssr: false });
const ShieldCanvas = dynamic(() => import('@/components/3d/ShieldCanvas'), { ssr: false });
const RocketCanvas = dynamic(() => import('@/components/3d/RocketCanvas'), { ssr: false });

// ─────────────────────────────────────────────────────────────
// BRAND TOKENS (from brand assets image)
// ─────────────────────────────────────────────────────────────
const BRAND = {
  purple:  '#7C3AED',
  cyan:    '#06BBD4',
  green:   '#10B981',
  amber:   '#F59E08',
  red:     '#EF4444',
  dark:    '#0F172A',
  darker:  '#050316',
  purpleL: '#1C3AED',
  cyanL:   '#0ECBD4',
  greenL:  '#10B981',
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

// Animated counter
function AnimatedCounter({ target, suffix = '', prefix = '' }: { target: number; suffix?: string; prefix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });

  useEffect(() => {
    if (!inView) return;
    const duration = 2000;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, target]);

  return (
    <span ref={ref}>
      {prefix}{val.toLocaleString()}{suffix}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// LOGO SVG (matches brand assets)
// ─────────────────────────────────────────────────────────────
function TradeMindLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#06BBD4" />
        </linearGradient>
        <linearGradient id="lg2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#06BBD4" />
        </linearGradient>
      </defs>
      {/* Brain outline */}
      <path d="M28 55 C18 50, 15 38, 24 32 C22 22, 32 16, 40 22 C44 16, 56 16, 60 22 C68 16, 78 22, 76 32 C85 38, 82 50, 72 55 C70 62, 62 66, 50 66 C38 66, 30 62, 28 55Z" stroke="url(#lg1)" strokeWidth="3" fill="none"/>
      {/* Neural circuits */}
      <circle cx="40" cy="38" r="4" fill="url(#lg1)" />
      <circle cx="60" cy="38" r="4" fill="url(#lg1)" />
      <circle cx="50" cy="50" r="3" fill="url(#lg2)" />
      <line x1="40" y1="38" x2="50" y2="50" stroke="url(#lg1)" strokeWidth="1.5" />
      <line x1="60" y1="38" x2="50" y2="50" stroke="url(#lg1)" strokeWidth="1.5" />
      <line x1="40" y1="38" x2="60" y2="38" stroke="url(#lg1)" strokeWidth="1.5" />
      {/* Bar chart */}
      <rect x="20" y="75" width="10" height="14" rx="2" fill="url(#lg2)" opacity="0.8" />
      <rect x="33" y="68" width="10" height="21" rx="2" fill="url(#lg1)" opacity="0.85" />
      <rect x="46" y="60" width="10" height="29" rx="2" fill="url(#lg2)" />
      <rect x="59" y="52" width="10" height="37" rx="2" fill="url(#lg1)" />
      {/* Arrow */}
      <polyline points="62,48 75,35 82,42" stroke="url(#lg2)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points="82,34 88,44 78,46" fill="url(#lg2)" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────
const NAV_LINKS = ['Features', 'Markets', 'Security', 'Pricing', 'Academy'];

const HERO_STATS = [
  { value: 50000, suffix: '+', label: 'Active Traders', icon: Users },
  { value: 94, suffix: '%', label: 'AI Accuracy',     icon: Bot },
  { value: 2800000, suffix: '+', prefix: '$', label: 'Daily Volume', icon: DollarSign },
  { value: 10000, suffix: '+', label: 'Assets Covered', icon: Globe },
];

const LIVE_TICKERS = [
  { sym: 'BTC/USD', price: '$64,318', chg: '+1.97%', up: true },
  { sym: 'ETH/USD', price: '$3,182',  chg: '-1.67%', up: false },
  { sym: 'SOL/USD', price: '$184.72', chg: '+4.61%', up: true },
  { sym: 'AAPL',    price: '$197.34', chg: '+1.31%', up: true },
  { sym: 'NVDA',    price: '$875.20', chg: '+2.63%', up: true },
  { sym: 'EUR/USD', price: '1.0852',  chg: '+0.31%', up: true },
  { sym: 'GBP/USD', price: '1.2714',  chg: '-0.22%', up: false },
  { sym: 'BNB/USD', price: '$412.30', chg: '+1.53%', up: true },
  { sym: 'XRP/USD', price: '$0.6248', chg: '-1.89%', up: false },
  { sym: 'TSLA',    price: '$248.60', chg: '-2.13%', up: false },
];

const WHY_FEATURES = [
  {
    icon: BrainCircuit,
    color: BRAND.purple,
    bg: 'rgba(124,58,237,0.12)',
    title: 'AI Market Analysis',
    desc: 'Multi-agent neural networks process millions of data points per second, detecting patterns invisible to human traders.',
  },
  {
    icon: Zap,
    color: BRAND.amber,
    bg: 'rgba(245,158,8,0.12)',
    title: 'Automated Trading',
    desc: 'Execute strategies autonomously with sub-50ms order routing, smart position sizing, and real-time risk controls.',
  },
  {
    icon: Shield,
    color: BRAND.green,
    bg: 'rgba(16,185,129,0.12)',
    title: 'Risk Management',
    desc: 'Dynamic stop-losses, max drawdown limits, portfolio hedging, and AML compliance protect your capital at all times.',
  },
  {
    icon: GraduationCap,
    color: BRAND.cyan,
    bg: 'rgba(6,187,212,0.12)',
    title: 'Learn & Grow',
    desc: 'Interactive academy with AI-guided courses, strategy backtesting labs, and expert live sessions to sharpen your edge.',
  },
  {
    icon: LineChart,
    color: '#a855f7',
    bg: 'rgba(168,85,247,0.12)',
    title: 'Real-Time Insights',
    desc: 'Live market sentiment, institutional order flow tracking, and AI-generated forecasts updated every 500 milliseconds.',
  },
  {
    icon: Headphones,
    color: '#f43f5e',
    bg: 'rgba(244,63,94,0.12)',
    title: '24/7 AI Support',
    desc: 'TradeMind Copilot is always online to answer questions, analyze markets, optimize strategies, and guide decisions.',
  },
];

const MARKET_TYPES = [
  { label: 'Crypto',      count: '2,400+', color: BRAND.purple, icon: '₿' },
  { label: 'Forex',       count: '180+',   color: BRAND.cyan,   icon: '€' },
  { label: 'Stocks',      count: '7,000+', color: BRAND.green,  icon: '📈' },
  { label: 'Commodities', count: '80+',    color: BRAND.amber,  icon: '🥇' },
  { label: 'Indices',     count: '60+',    color: '#a855f7',    icon: '📊' },
  { label: 'ETFs',        count: '300+',   color: '#f43f5e',    icon: '💹' },
];

const SECURITY_FEATURES = [
  { icon: Lock,     title: '2FA & Biometrics',      desc: 'Two-factor authentication and biometric verification for all access.' },
  { icon: Shield,   title: 'AES-256 Encryption',    desc: 'Military-grade encryption for all data in transit and at rest.' },
  { icon: Eye,      title: 'AI Fraud Detection',     desc: 'Real-time behavioral AI monitors for suspicious activity 24/7.' },
  { icon: Award,    title: 'SOC 2 Type II Certified', desc: 'Independent annual audits verify our security controls and practices.' },
  { icon: Layers,   title: 'Immutable Audit Logs',   desc: 'Every action is cryptographically signed and permanently recorded.' },
  { icon: Target,   title: 'Risk AI Monitoring',     desc: 'Automated circuit breakers halt trading if anomalous patterns detected.' },
];

const JOURNEY_STEPS = [
  { step: '01', title: 'Sign Up & Verify',   desc: 'Create your account in 60 seconds. Complete KYC verification with AI-assisted document scanning.', icon: Users },
  { step: '02', title: 'Fund Your Wallet',   desc: 'Deposit via bank transfer, card, or crypto. Multi-currency wallets with instant settlement.', icon: DollarSign },
  { step: '03', title: 'Get AI Signals',      desc: 'Real-time BUY/SELL signals generated by our multi-agent AI engine with full reasoning transparency.', icon: Zap },
  { step: '04', title: 'Execute & Automate', desc: 'Trade manually or enable autonomous execution. Set risk parameters and let the AI work for you.', icon: Cpu },
  { step: '05', title: 'Track & Optimise',   desc: 'Monitor portfolio performance, review AI analytics, and continuously improve your strategy.', icon: BarChart3 },
];

const PRICING_PLANS = [
  {
    name: 'Starter',
    price: '$49',
    period: '/month',
    badge: null,
    highlight: false,
    color: BRAND.cyan,
    description: 'Perfect for new traders exploring AI-assisted investing.',
    features: [
      '5 AI Signals per day',
      'Basic portfolio tracking',
      '3 automated strategies',
      'Email & push alerts',
      'Academy access (basic)',
      'Paper trading mode',
    ],
  },
  {
    name: 'Pro',
    price: '$149',
    period: '/month',
    badge: 'Most Popular',
    highlight: true,
    color: BRAND.purple,
    description: 'Full platform access for serious traders and investors.',
    features: [
      'Unlimited AI Signals',
      'Full portfolio intelligence',
      'Unlimited AI strategies',
      'Real-time WebSocket alerts',
      'Live trade execution',
      'AI Copilot (GPT-4o)',
      'Full Academy access',
      'Priority 24/7 support',
    ],
  },
  {
    name: 'Institutional',
    price: '$499',
    period: '/month',
    badge: 'Enterprise',
    highlight: false,
    color: BRAND.green,
    description: 'For funds, proprietary traders, and enterprise teams.',
    features: [
      'Everything in Pro',
      'Dedicated AI cluster',
      'Custom model training',
      'White-label option',
      'Full REST & WebSocket API',
      'SLA 99.99% uptime',
      'Dedicated account manager',
      'Custom integrations',
    ],
  },
];

const TESTIMONIALS = [
  {
    name: 'James Kariuki',
    role: 'Hedge Fund Manager, Nairobi',
    avatar: 'JK',
    rating: 5,
    color: BRAND.purple,
    text: 'TradeMind AI outperformed our previous quant systems by 23% in the first quarter. The multi-agent architecture processes signals we simply couldn\'t compute manually.',
  },
  {
    name: 'Sarah Mitchell',
    role: 'Independent Trader, London',
    avatar: 'SM',
    rating: 5,
    color: BRAND.cyan,
    text: 'The AI Copilot is like having a Wall Street analyst available 24/7. I\'ve learned more in 3 months here than in 3 years of solo trading. Absolutely transformative.',
  },
  {
    name: 'David Chen',
    role: 'Portfolio Director, Singapore',
    avatar: 'DC',
    rating: 5,
    color: BRAND.green,
    text: 'Risk management capabilities are exceptional. The AML integration and immutable audit logs were exactly what our compliance team required for institutional use.',
  },
  {
    name: 'Amara Osei',
    role: 'Crypto Trader, Accra',
    avatar: 'AO',
    rating: 5,
    color: BRAND.amber,
    text: 'Started with the Starter plan. Within two months, the AI signals consistently beat market averages. Now on Pro and the automated strategies run while I sleep.',
  },
];

const FAQS = [
  {
    q: 'How does TradeMind AI generate its trading signals?',
    a: 'Our multi-agent AI engine combines specialized neural networks trained on technical analysis, fundamental data, macroeconomic indicators, and social sentiment. Signals are generated by an ensemble vote across all agents, weighted by historical accuracy for each asset class.',
  },
  {
    q: 'Is my money safe on the platform?',
    a: 'TradeMind AI uses AES-256 encryption, SOC 2 Type II certified infrastructure, 2FA/biometric authentication, and segregated client wallets. We are regulated and compliant in all jurisdictions we operate. Insurance covers up to $500,000 per account.',
  },
  {
    q: 'Can I use TradeMind AI for automated trading without watching the markets?',
    a: 'Yes. Our Autonomous Trading Engine allows you to define your risk parameters (max drawdown, position size, daily loss limit) and then executes strategies fully automatically 24/7. You receive real-time notifications for every action taken.',
  },
  {
    q: 'What markets and assets does TradeMind AI support?',
    a: 'We currently support 10,000+ assets across Crypto (2,400+), Stocks (7,000+), Forex (180+ pairs), Commodities (80+), Indices (60+), and ETFs (300+). New assets are added monthly based on liquidity and user demand.',
  },
  {
    q: 'How accurate are the AI trading signals?',
    a: 'Backtested across 2019–2026 data, our signals achieve a 94.2% directional accuracy rate. Live trading performance (accounting for slippage and fees) shows an average 73% win rate. Past performance does not guarantee future results.',
  },
  {
    q: 'Do I need trading experience to use TradeMind AI?',
    a: 'No. The Academy section provides guided learning paths from beginner to advanced. The AI Copilot explains every signal and strategy in plain language. Most users are generating AI-assisted trades within their first session.',
  },
];

const FOOTER_LINKS = {
  Platform:  ['Dashboard', 'Markets', 'AI Signals', 'Portfolio', 'Wallet'],
  Company:   ['About Us', 'Careers', 'Press', 'Partners', 'Contact'],
  Resources: ['Academy', 'API Docs', 'Blog', 'Changelog', 'Status'],
  Legal:     ['Privacy Policy', 'Terms of Service', 'Risk Disclosure', 'AML Policy'],
};

// ─────────────────────────────────────────────────────────────
// SECTION WRAPPER
// ─────────────────────────────────────────────────────────────
function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// FAQ ITEM
// ─────────────────────────────────────────────────────────────
function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <FadeIn delay={index * 0.06}>
      <div
        className={cn(
          'border rounded-2xl cursor-pointer transition-all duration-300 overflow-hidden',
          open
            ? 'border-purple-500/40 bg-purple-500/5'
            : 'border-white/8 bg-white/2 hover:border-white/15 hover:bg-white/3'
        )}
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between px-6 py-5 gap-4">
          <span className="font-semibold text-slate-200 text-sm leading-snug">{q}</span>
          <div className={cn(
            'flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300',
            open ? 'bg-purple-500 rotate-180' : 'bg-white/8'
          )}>
            {open ? <Minus size={14} className="text-white" /> : <Plus size={14} className="text-slate-400" />}
          </div>
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <p className="px-6 pb-5 text-slate-400 text-sm leading-relaxed border-t border-white/5 pt-4">
                {a}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FadeIn>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION LABEL
// ─────────────────────────────────────────────────────────────
function SectionLabel({ icon: Icon, text, color = BRAND.purple }: { icon: React.ComponentType<any>; text: string; color?: string }) {
  return (
    <div
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border"
      style={{ background: `${color}14`, borderColor: `${color}30`, color }}
    >
      <Icon size={13} />
      {text}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.22], [1, 0]);
  const heroScale   = useTransform(scrollYProgress, [0, 0.22], [1, 0.94]);
  const [mounted, setMounted] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => setNavScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      className="min-h-screen text-slate-100 overflow-x-hidden"
      style={{ background: `linear-gradient(160deg, ${BRAND.darker} 0%, #0a0f1e 40%, ${BRAND.dark} 100%)` }}
    >
      {/* ──────────────────────── TICKER TAPE ──────────────────────── */}
      <div className="overflow-hidden border-b border-white/5 bg-black/30 py-1.5">
        <motion.div
          className="flex gap-10 whitespace-nowrap"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          style={{ width: 'max-content' }}
        >
          {[...LIVE_TICKERS, ...LIVE_TICKERS].map((t, i) => (
            <div key={i} className="inline-flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-semibold">{t.sym}</span>
              <span className="font-bold text-slate-100">{t.price}</span>
              <span className={cn('font-bold flex items-center gap-0.5', t.up ? 'text-emerald-400' : 'text-red-400')}>
                {t.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {t.chg}
              </span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* ──────────────────────── NAVBAR ──────────────────────────── */}
      <motion.header
        className={cn(
          'fixed top-7 left-0 right-0 z-50 transition-all duration-300',
          navScrolled
            ? 'backdrop-blur-2xl border-b border-white/8'
            : 'bg-transparent'
        )}
        style={{ background: navScrolled ? 'rgba(5,3,22,0.88)' : 'transparent' }}
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mx-auto max-w-7xl px-6 py-3.5 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <TradeMindLogo size={38} />
            <div>
              <div className="font-bold text-lg leading-none tracking-tight"
                style={{ background: `linear-gradient(135deg, #fff 0%, ${BRAND.cyan} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                TradeMind<span style={{ color: BRAND.purple }}> AI</span>
              </div>
              <div className="text-[9px] text-slate-500 font-semibold tracking-wider uppercase">Smarter Trades. Greater Futures.</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-400">
            {NAV_LINKS.map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`}
                className="hover:text-white transition-colors hover:text-purple-300 relative group">
                {item}
                <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-purple-400 group-hover:w-full transition-all duration-300" />
              </a>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/dashboard"
              className="text-sm text-slate-400 hover:text-white transition-colors px-4 py-2 rounded-xl border border-white/10 hover:border-white/25 hover:bg-white/5">
              Sign In
            </Link>
            <Link href="/dashboard"
              className="text-sm font-bold px-5 py-2.5 rounded-xl text-white transition-all duration-300 hover:scale-105 hover:shadow-2xl inline-flex items-center gap-2"
              style={{
                background: `linear-gradient(135deg, ${BRAND.purple}, ${BRAND.purpleL})`,
                boxShadow: `0 0 20px ${BRAND.purple}50`,
              }}>
              <Rocket size={15} />
              Launch App
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-white/8 bg-[#050316]/95 backdrop-blur-2xl"
            >
              <div className="px-6 py-4 space-y-3">
                {NAV_LINKS.map((item) => (
                  <a key={item} href={`#${item.toLowerCase()}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-2 text-slate-300 hover:text-white transition-colors font-medium">
                    {item}
                  </a>
                ))}
                <div className="pt-3 flex flex-col gap-2 border-t border-white/8">
                  <Link href="/dashboard" className="py-2.5 px-4 rounded-xl border border-white/15 text-center text-sm font-semibold text-slate-300">Sign In</Link>
                  <Link href="/dashboard"
                    className="py-2.5 px-4 rounded-xl text-center text-sm font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${BRAND.purple}, ${BRAND.purpleL})` }}>
                    🚀 Launch App
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* ──────────────────────── HERO ────────────────────────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden pt-24 pb-16">
        {/* Ambient blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-16 left-1/4 w-[500px] h-[500px] rounded-full blur-[130px] opacity-20"
            style={{ background: BRAND.purple }} />
          <div className="absolute bottom-24 right-1/5 w-[400px] h-[400px] rounded-full blur-[120px] opacity-12"
            style={{ background: BRAND.cyan }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-[200px] opacity-6"
            style={{ background: BRAND.purple }} />
          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#7C3AED" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-6 grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left: Content */}
          <motion.div style={{ opacity: heroOpacity, scale: heroScale }} className="space-y-8">

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}
              className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border text-xs font-bold"
              style={{ background: `${BRAND.purple}18`, borderColor: `${BRAND.purple}35`, color: BRAND.cyan }}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ background: BRAND.cyan }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: BRAND.cyan }} />
              </span>
              2026 Edition — Multi-Agent AI Engine Live
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="font-bold leading-[1.04] tracking-tight"
              style={{ fontSize: 'clamp(2.6rem, 5vw, 4.2rem)' }}
            >
              AI-Powered Trading.{' '}
              <span style={{
                background: `linear-gradient(135deg, ${BRAND.purple}, ${BRAND.cyan})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
              }}>
                Smarter Decisions.
              </span>{' '}
              Better Results.
            </motion.h1>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.6 }}
              className="text-slate-400 text-lg leading-relaxed max-w-xl"
            >
              TradeMind AI combines artificial intelligence, market analytics, risk management, and automated trading strategies
              into one seamless ecosystem — built for traders who demand an edge.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.6 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Link href="/dashboard"
                className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl text-base font-bold text-white transition-all duration-300 hover:scale-105 group"
                style={{
                  background: `linear-gradient(135deg, ${BRAND.purple}, ${BRAND.purpleL})`,
                  boxShadow: `0 0 30px ${BRAND.purple}60, 0 4px 24px rgba(0,0,0,0.4)`,
                }}>
                <Rocket size={18} />
                Get Started Free
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <button
                onClick={() => setVideoOpen(true)}
                className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl text-base font-bold border transition-all duration-300 hover:bg-white/8 hover:scale-105"
                style={{ borderColor: `${BRAND.cyan}40`, color: BRAND.cyan }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: `${BRAND.cyan}25` }}>
                  <Play size={12} className="ml-0.5" />
                </div>
                Watch Demo
              </button>
            </motion.div>

            {/* Trust badges */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.72, duration: 0.6 }}
              className="flex flex-wrap items-center gap-4 text-xs text-slate-500"
            >
              {['No credit card required', 'SOC 2 Type II Certified', '256-bit AES Encryption', 'Regulated & Compliant'].map((s) => (
                <div key={s} className="flex items-center gap-1.5">
                  <CheckCircle size={12} className="text-emerald-400 flex-shrink-0" />
                  <span>{s}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right: 3D Canvas */}
          <motion.div
            initial={{ opacity: 0, scale: 0.75 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            className="relative h-[480px] lg:h-[620px]"
          >
            {mounted && (
              <Suspense fallback={
                <div className="h-full flex items-center justify-center">
                  <div className="w-32 h-32 rounded-full animate-pulse" style={{ background: `${BRAND.purple}30` }} />
                </div>
              }>
                <HeroCanvas />
              </Suspense>
            )}

            {/* Floating stat pills */}
            <motion.div
              animate={{ y: [-10, 10, -10] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-10 right-2 md:right-8 backdrop-blur-xl rounded-2xl p-4 space-y-1 border"
              style={{ background: 'rgba(12,10,30,0.85)', borderColor: `${BRAND.purple}35` }}
            >
              <div className="text-[9px] uppercase font-bold tracking-wider text-slate-500">BTC/USD Signal</div>
              <div className="font-bold text-emerald-400 text-xl">BUY ↑</div>
              <div className="text-xs text-slate-400">AI Confidence: <span className="font-bold" style={{ color: BRAND.purple }}>91%</span></div>
            </motion.div>

            <motion.div
              animate={{ y: [10, -10, 10] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
              className="absolute bottom-16 left-0 md:left-4 backdrop-blur-xl rounded-2xl p-4 space-y-1 border"
              style={{ background: 'rgba(12,10,30,0.85)', borderColor: `${BRAND.green}35` }}
            >
              <div className="text-[9px] uppercase font-bold tracking-wider text-slate-500">Portfolio P&L Today</div>
              <div className="font-bold text-emerald-400 text-xl">+$1,284.50</div>
              <div className="text-[10px] text-slate-400">+2.71% · 14 trades executed</div>
            </motion.div>

            <motion.div
              animate={{ y: [-6, 8, -6] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
              className="absolute top-1/2 -left-2 md:-left-4 backdrop-blur-xl rounded-2xl p-3 border"
              style={{ background: 'rgba(12,10,30,0.85)', borderColor: `${BRAND.cyan}35` }}
            >
              <div className="text-[9px] uppercase font-bold tracking-wider text-slate-500 mb-1">AI Accuracy</div>
              <div className="font-bold text-xl" style={{ color: BRAND.cyan }}>94.2%</div>
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 10, 0] }} transition={{ duration: 2.2, repeat: Infinity }}
        >
          <div className="w-6 h-10 rounded-full border border-white/15 flex items-start justify-center pt-2">
            <div className="w-1.5 h-2.5 rounded-full bg-purple-400 animate-bounce" />
          </div>
        </motion.div>
      </section>

      {/* ──────────────────── HERO STATS ──────────────────────────── */}
      <section className="border-y border-white/6 py-14" style={{ background: 'rgba(0,0,0,0.25)' }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {HERO_STATS.map(({ value, suffix, prefix, label, icon: Icon }, i) => (
              <FadeIn key={label} delay={i * 0.1}>
                <div className="text-center space-y-2 group">
                  <div className="flex justify-center mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${BRAND.purple}18`, border: `1px solid ${BRAND.purple}30` }}>
                      <Icon size={18} style={{ color: BRAND.purple }} />
                    </div>
                  </div>
                  <div className="font-bold text-3xl md:text-4xl text-white"
                    style={{ background: `linear-gradient(135deg, #fff, ${BRAND.cyan})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {prefix && prefix}
                    <AnimatedCounter target={value} suffix={suffix} />
                  </div>
                  <div className="text-slate-400 text-sm font-medium">{label}</div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────── WHY TRADEMIND AI ────────────────────────── */}
      <section id="features" className="py-28">
        <div className="mx-auto max-w-7xl px-6">
          <FadeIn className="text-center mb-16 space-y-4">
            <SectionLabel icon={BrainCircuit} text="Platform Capabilities" />
            <h2 className="font-bold mt-4" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
              Why <span style={{
                background: `linear-gradient(135deg, ${BRAND.purple}, ${BRAND.cyan})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
              }}>TradeMind AI?</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              A complete financial ecosystem — not just a trading tool. Everything you need to analyse, automate, learn, and grow.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHY_FEATURES.map(({ icon: Icon, color, bg, title, desc }, i) => (
              <FadeIn key={title} delay={i * 0.08}>
                <div
                  className="relative rounded-2xl p-6 border cursor-default group overflow-hidden transition-all duration-400 hover:-translate-y-1"
                  style={{
                    background: 'rgba(255,255,255,0.025)',
                    borderColor: 'rgba(255,255,255,0.07)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = `${color}45`;
                    (e.currentTarget as HTMLDivElement).style.background = `${color}08`;
                    (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 40px ${color}20`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)';
                    (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.025)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                  }}
                >
                  {/* Glow blob */}
                  <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-30 transition-opacity duration-500"
                    style={{ background: color }} />

                  <div className="relative">
                    <div className="w-13 h-13 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
                      style={{ background: bg, width: '52px', height: '52px' }}>
                      <Icon size={26} style={{ color }} />
                    </div>
                    <h3 className="font-bold text-white text-lg mb-2.5">{title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────── AI INTELLIGENCE SECTION ─────────────────── */}
      <section className="py-28 overflow-hidden" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* 3D Visual */}
            <FadeIn className="relative order-2 lg:order-1 h-[400px] lg:h-[500px]">
              <div className="absolute inset-0 rounded-3xl overflow-hidden border border-purple-500/15"
                style={{ background: 'rgba(124,58,237,0.05)' }}>
                {mounted && (
                  <Suspense fallback={<div className="h-full animate-pulse" style={{ background: `${BRAND.purple}10` }} />}>
                    <HeroCanvas />
                  </Suspense>
                )}
              </div>

              {/* Data stream overlay */}
              <div className="absolute bottom-4 left-4 right-4 space-y-1.5">
                {[
                  { label: 'Technical Pattern Detected', val: 'EMA-200 Breakout ↑', color: BRAND.green },
                  { label: 'Sentiment Score',             val: '82% Bullish',         color: BRAND.cyan },
                  { label: 'Signal Confidence',            val: '91% → BUY',          color: BRAND.purple },
                ].map(({ label, val, color }) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1, duration: 0.6 }}
                    className="flex items-center justify-between px-3 py-2 rounded-xl border text-xs backdrop-blur-xl"
                    style={{ background: 'rgba(5,3,22,0.8)', borderColor: `${color}30` }}
                  >
                    <span className="text-slate-400">{label}</span>
                    <span className="font-bold" style={{ color }}>{val}</span>
                  </motion.div>
                ))}
              </div>
            </FadeIn>

            {/* Text */}
            <div className="order-1 lg:order-2 space-y-6">
              <FadeIn>
                <SectionLabel icon={BrainCircuit} text="AI Intelligence & Market Analysis" color={BRAND.purple} />
              </FadeIn>
              <FadeIn delay={0.1}>
                <h2 className="font-bold leading-tight" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)' }}>
                  A Neural Brain That Never{' '}
                  <span style={{
                    background: `linear-gradient(135deg, ${BRAND.purple}, ${BRAND.cyan})`,
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  }}>Stops Thinking</span>
                </h2>
              </FadeIn>
              <FadeIn delay={0.15}>
                <p className="text-slate-400 text-base leading-relaxed">
                  Our multi-agent AI engine runs 24/7, continuously scanning global markets for patterns, anomalies,
                  and opportunities. Each agent specialises — one for technicals, one for fundamentals, one for sentiment —
                  then an ensemble vote decides the optimal signal.
                </p>
              </FadeIn>

              <div className="space-y-4">
                {[
                  { title: 'Processes 2M+ data points/second',   desc: 'Across price, volume, sentiment, macro, and on-chain data.' },
                  { title: 'Self-improving learning loop',        desc: 'Models retrain daily on live market outcomes for continuous accuracy gains.' },
                  { title: 'Explainable AI reasoning',           desc: 'Every signal comes with full technical, fundamental, and sentiment rationale.' },
                ].map(({ title, desc }, i) => (
                  <FadeIn key={title} delay={0.2 + i * 0.08}>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
                        style={{ background: `${BRAND.purple}25` }}>
                        <CheckCircle size={13} style={{ color: BRAND.purple }} />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-100 text-sm">{title}</div>
                        <div className="text-slate-500 text-xs mt-0.5">{desc}</div>
                      </div>
                    </div>
                  </FadeIn>
                ))}
              </div>

              <FadeIn delay={0.45}>
                <Link href="/dashboard"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white transition-all hover:scale-105"
                  style={{ background: `linear-gradient(135deg, ${BRAND.purple}, ${BRAND.purpleL})`, boxShadow: `0 0 20px ${BRAND.purple}40` }}>
                  Explore AI Signals <ArrowRight size={16} />
                </Link>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────── MARKET DYNAMICS ─────────────────────────── */}
      <section id="markets" className="py-28">
        <div className="mx-auto max-w-7xl px-6">
          <FadeIn className="text-center mb-16 space-y-4">
            <SectionLabel icon={Globe} text="Global Market Coverage" color={BRAND.cyan} />
            <h2 className="font-bold mt-4" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
              Trade Every Market,{' '}
              <span style={{
                background: `linear-gradient(135deg, ${BRAND.cyan}, ${BRAND.green})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>Everywhere, Always</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              From Bitcoin to blue-chip equities, forex majors to commodities —
              TradeMind AI monitors global markets and institutional flows in real time.
            </p>
          </FadeIn>

          {/* Market type cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-16">
            {MARKET_TYPES.map(({ label, count, color, icon }, i) => (
              <FadeIn key={label} delay={i * 0.07}>
                <div
                  className="rounded-2xl p-5 text-center border transition-all duration-300 hover:-translate-y-1 cursor-default group"
                  style={{ background: `${color}0a`, borderColor: `${color}25` }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = `${color}15`;
                    (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 32px ${color}25`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = `${color}0a`;
                    (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                  }}
                >
                  <div className="text-3xl mb-3">{icon}</div>
                  <div className="font-bold text-lg text-white">{count}</div>
                  <div className="text-xs font-semibold mt-1" style={{ color }}>{label}</div>
                </div>
              </FadeIn>
            ))}
          </div>

          {/* Live market table preview */}
          <FadeIn>
            <div className="rounded-2xl overflow-hidden border border-white/8"
              style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/6">
                <div className="flex items-center gap-2">
                  <Activity size={16} style={{ color: BRAND.purple }} />
                  <span className="font-bold text-white text-sm">Live Market Feed</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: BRAND.green }}>
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: BRAND.green }} />
                  Real-time
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-slate-600">
                      <th className="text-left px-6 py-3 font-bold">Asset</th>
                      <th className="text-right px-4 py-3 font-bold">Price</th>
                      <th className="text-right px-4 py-3 font-bold">24h %</th>
                      <th className="text-right px-6 py-3 font-bold hidden md:table-cell">AI Signal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LIVE_TICKERS.slice(0, 6).map((t, i) => (
                      <motion.tr
                        key={t.sym}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.06 }}
                        className="border-b border-white/4 hover:bg-white/3 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold"
                              style={{ background: `${BRAND.purple}20`, color: BRAND.purple, border: `1px solid ${BRAND.purple}25` }}>
                              {t.sym.replace('/USD', '').slice(0, 3)}
                            </div>
                            <span className="font-semibold text-slate-200">{t.sym}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right font-mono font-semibold text-slate-100">{t.price}</td>
                        <td className="px-4 py-4 text-right">
                          <span className={cn('font-bold text-xs flex items-center justify-end gap-1', t.up ? 'text-emerald-400' : 'text-red-400')}>
                            {t.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                            {t.chg}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right hidden md:table-cell">
                          <span
                            className="text-[10px] font-bold px-2.5 py-1 rounded-lg border uppercase"
                            style={t.up
                              ? { background: `${BRAND.green}15`, color: BRAND.green, borderColor: `${BRAND.green}30` }
                              : { background: `${BRAND.red}15`, color: BRAND.red, borderColor: `${BRAND.red}30` }
                            }
                          >
                            {t.up ? '↑ BUY' : '↓ SELL'}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-3 text-center border-t border-white/6">
                <Link href="/dashboard"
                  className="text-xs font-semibold transition-colors hover:text-white"
                  style={{ color: BRAND.purple }}>
                  View All 10,000+ Assets →
                </Link>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ──────────────── SECURITY SECTION ────────────────────────── */}
      <section id="security" className="py-28" style={{ background: 'rgba(0,0,0,0.25)' }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Text */}
            <div className="space-y-6">
              <FadeIn>
                <SectionLabel icon={Shield} text="Enterprise Security & Trust" color={BRAND.green} />
              </FadeIn>
              <FadeIn delay={0.1}>
                <h2 className="font-bold leading-tight" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)' }}>
                  Your Assets, Protected by{' '}
                  <span style={{
                    background: `linear-gradient(135deg, ${BRAND.green}, ${BRAND.cyan})`,
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  }}>Institutional-Grade Security</span>
                </h2>
              </FadeIn>
              <FadeIn delay={0.15}>
                <p className="text-slate-400 text-base leading-relaxed">
                  TradeMind AI employs the same security infrastructure used by tier-1 financial institutions.
                  Every layer of the platform is hardened, audited, and continuously monitored by AI.
                </p>
              </FadeIn>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {SECURITY_FEATURES.map(({ icon: Icon, title, desc }, i) => (
                  <FadeIn key={title} delay={0.2 + i * 0.07}>
                    <div className="p-4 rounded-2xl border border-white/7 hover:border-emerald-500/25 transition-all duration-300 group"
                      style={{ background: 'rgba(16,185,129,0.04)' }}>
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: `${BRAND.green}20` }}>
                          <Icon size={14} style={{ color: BRAND.green }} />
                        </div>
                        <span className="font-semibold text-slate-200 text-sm">{title}</span>
                      </div>
                      <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
                    </div>
                  </FadeIn>
                ))}
              </div>
            </div>

            {/* 3D Shield Visual */}
            <FadeIn className="h-[400px] lg:h-[480px] relative">
              <div className="absolute inset-0 rounded-3xl overflow-hidden border border-emerald-500/12"
                style={{ background: 'rgba(16,185,129,0.04)' }}>
                {mounted && (
                  <Suspense fallback={<div className="h-full animate-pulse" style={{ background: `${BRAND.green}08` }} />}>
                    <ShieldCanvas />
                  </Suspense>
                )}
              </div>
              {/* Pulse rings */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {[1, 2, 3].map((n) => (
                  <motion.div
                    key={n}
                    className="absolute rounded-full border border-emerald-500/20"
                    animate={{ scale: [1, 1.5 + n * 0.3], opacity: [0.4, 0] }}
                    transition={{ duration: 3, repeat: Infinity, delay: n * 0.8, ease: 'easeOut' }}
                    style={{ width: `${80 + n * 40}px`, height: `${80 + n * 40}px` }}
                  />
                ))}
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ──────────────── GROWTH / ROCKET SECTION ─────────────────── */}
      <section className="py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* 3D Rocket Visual */}
            <FadeIn className="h-[400px] lg:h-[480px] relative order-2 lg:order-1">
              <div className="absolute inset-0 rounded-3xl overflow-hidden border border-amber-500/12"
                style={{ background: 'rgba(245,158,8,0.04)' }}>
                {mounted && (
                  <Suspense fallback={<div className="h-full animate-pulse" style={{ background: `${BRAND.amber}08` }} />}>
                    <RocketCanvas />
                  </Suspense>
                )}
              </div>

              {/* Growth chart overlay */}
              <div className="absolute bottom-4 left-4 right-4 backdrop-blur-xl rounded-2xl p-4 border"
                style={{ background: 'rgba(5,3,22,0.88)', borderColor: `${BRAND.amber}30` }}>
                <div className="flex justify-between items-end h-16 gap-1 mb-2">
                  {[40, 52, 48, 58, 62, 55, 68, 72, 65, 80, 76, 92].map((h, i) => (
                    <motion.div
                      key={i}
                      className="flex-1 rounded-t-sm"
                      initial={{ height: 0 }}
                      whileInView={{ height: `${h}%` }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.05, duration: 0.6 }}
                      style={{
                        background: i >= 9
                          ? `linear-gradient(180deg, ${BRAND.amber}, ${BRAND.purple})`
                          : `rgba(245,158,8,0.35)`,
                      }}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Jan</span><span>Apr</span><span>Jul</span><span>Today</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Portfolio Growth</span>
                  <span className="font-bold text-sm" style={{ color: BRAND.amber }}>+127.4% YTD</span>
                </div>
              </div>
            </FadeIn>

            {/* Text */}
            <div className="order-1 lg:order-2 space-y-6">
              <FadeIn>
                <SectionLabel icon={Rocket} text="Growth & Wealth Creation" color={BRAND.amber} />
              </FadeIn>
              <FadeIn delay={0.1}>
                <h2 className="font-bold leading-tight" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)' }}>
                  Intelligent Strategies for{' '}
                  <span style={{
                    background: `linear-gradient(135deg, ${BRAND.amber}, ${BRAND.red})`,
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  }}>Sustainable Wealth</span>
                </h2>
              </FadeIn>
              <FadeIn delay={0.15}>
                <p className="text-slate-400 text-base leading-relaxed">
                  TradeMind AI isn't about gambling on market moves — it's about disciplined, AI-driven
                  execution of proven strategies. Systematic risk management, diversification intelligence,
                  and continuous optimisation compound your returns over time.
                </p>
              </FadeIn>

              <div className="space-y-4">
                {[
                  { stat: '+127.4%', label: 'Average user portfolio growth — YTD 2026', color: BRAND.amber },
                  { stat: '1:2.8',   label: 'Average risk-to-reward across all signals',  color: BRAND.purple },
                  { stat: '73%',     label: 'Live trading win rate (slippage-adjusted)',  color: BRAND.green },
                ].map(({ stat, label, color }, i) => (
                  <FadeIn key={stat} delay={0.25 + i * 0.08}>
                    <div className="flex items-center gap-4 p-4 rounded-2xl border border-white/6 hover:border-white/12 transition-all"
                      style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <div className="font-bold text-2xl flex-shrink-0" style={{ color, minWidth: '80px' }}>{stat}</div>
                      <div className="text-slate-400 text-sm">{label}</div>
                    </div>
                  </FadeIn>
                ))}
              </div>

              <FadeIn delay={0.5}>
                <Link href="/dashboard"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white transition-all hover:scale-105"
                  style={{ background: `linear-gradient(135deg, ${BRAND.amber}, ${BRAND.red})`, boxShadow: `0 0 20px ${BRAND.amber}40` }}>
                  Start Growing Your Portfolio <ArrowRight size={16} />
                </Link>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────── PLATFORM JOURNEY ────────────────────────── */}
      <section className="py-28" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <div className="mx-auto max-w-7xl px-6">
          <FadeIn className="text-center mb-16 space-y-4">
            <SectionLabel icon={Layers} text="Your Trading Journey" color={BRAND.cyan} />
            <h2 className="font-bold mt-4" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
              From Sign-Up to{' '}
              <span style={{
                background: `linear-gradient(135deg, ${BRAND.cyan}, ${BRAND.purple})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>Active Trader in Minutes</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              The TradeMind AI experience is designed to take you from zero to confident trading with guided AI assistance every step.
            </p>
          </FadeIn>

          {/* Journey timeline */}
          <div className="relative">
            {/* Connecting line */}
            <div className="hidden lg:block absolute top-12 left-0 right-0 h-px"
              style={{ background: `linear-gradient(90deg, transparent, ${BRAND.purple}, ${BRAND.cyan}, transparent)` }} />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {JOURNEY_STEPS.map(({ step, title, desc, icon: Icon }, i) => (
                <FadeIn key={step} delay={i * 0.1}>
                  <div className="relative flex flex-col items-center text-center group">
                    {/* Step circle */}
                    <div
                      className="w-24 h-24 rounded-full border-2 flex items-center justify-center mb-5 relative transition-all duration-300 group-hover:scale-110 z-10"
                      style={{
                        background: `linear-gradient(135deg, ${BRAND.purple}20, ${BRAND.cyan}15)`,
                        borderColor: `${BRAND.purple}50`,
                        boxShadow: `0 0 0 4px ${BRAND.purple}10`,
                      }}
                    >
                      <Icon size={28} style={{ color: BRAND.purple }} />
                      <div
                        className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                        style={{ background: `linear-gradient(135deg, ${BRAND.purple}, ${BRAND.purpleL})` }}
                      >
                        {step}
                      </div>
                    </div>
                    <h3 className="font-bold text-white text-base mb-2">{title}</h3>
                    <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>

          {/* Platform feature pills */}
          <FadeIn delay={0.3} className="mt-16 flex flex-wrap justify-center gap-3">
            {[
              'Dashboard', 'Markets', 'AI Signals', 'Portfolio Analytics',
              'Automation Center', 'AI Copilot', 'Academy', 'Wallet', 'Reports', 'Mobile App',
            ].map((feature) => (
              <span
                key={feature}
                className="px-4 py-2 rounded-full text-xs font-semibold border"
                style={{
                  background: `${BRAND.purple}10`,
                  borderColor: `${BRAND.purple}25`,
                  color: BRAND.cyan,
                }}
              >
                {feature}
              </span>
            ))}
          </FadeIn>
        </div>
      </section>

      {/* ──────────────── PRICING ─────────────────────────────────── */}
      <section id="pricing" className="py-28">
        <div className="mx-auto max-w-7xl px-6">
          <FadeIn className="text-center mb-16 space-y-4">
            <SectionLabel icon={DollarSign} text="Pricing Plans" color={BRAND.green} />
            <h2 className="font-bold mt-4" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
              Simple,{' '}
              <span style={{
                background: `linear-gradient(135deg, ${BRAND.green}, ${BRAND.cyan})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>Transparent Pricing</span>
            </h2>
            <p className="text-slate-400 text-lg">Start free. Upgrade when you're ready to go live with real capital.</p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PRICING_PLANS.map(({ name, price, period, badge, highlight, color, description, features }, i) => (
              <FadeIn key={name} delay={i * 0.1}>
                <div
                  className="relative rounded-3xl p-8 border flex flex-col h-full transition-all duration-300 hover:-translate-y-1"
                  style={{
                    background: highlight ? `${color}10` : 'rgba(255,255,255,0.025)',
                    borderColor: highlight ? `${color}50` : 'rgba(255,255,255,0.08)',
                    boxShadow: highlight ? `0 0 60px ${color}20, 0 4px 40px rgba(0,0,0,0.3)` : 'none',
                  }}
                >
                  {badge && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                      <span
                        className="px-5 py-1.5 rounded-full text-xs font-black text-white"
                        style={{ background: `linear-gradient(135deg, ${color}, ${BRAND.purpleL})` }}
                      >
                        {badge}
                      </span>
                    </div>
                  )}

                  <div className="mb-6">
                    <div className="text-sm font-bold mb-1" style={{ color }}>{name}</div>
                    <div className="flex items-end gap-1 mb-2">
                      <span className="font-black text-5xl text-white">{price}</span>
                      <span className="text-slate-500 text-sm mb-1.5">{period}</span>
                    </div>
                    <p className="text-slate-500 text-xs leading-relaxed">{description}</p>
                  </div>

                  <ul className="space-y-3 flex-1 mb-8">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                        <CheckCircle size={15} style={{ color, flexShrink: 0, marginTop: '2px' }} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/dashboard"
                    className="block w-full text-center py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 hover:scale-105"
                    style={highlight
                      ? { background: `linear-gradient(135deg, ${color}, ${BRAND.purpleL})`, color: '#fff', boxShadow: `0 0 20px ${color}40` }
                      : { background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.12)' }
                    }
                  >
                    Get Started {highlight ? '🚀' : '→'}
                  </Link>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.4} className="text-center mt-10 text-sm text-slate-500">
            All plans include a <strong className="text-slate-300">14-day free trial</strong>. No credit card required.
            Cancel anytime. Annual billing available at 2 months free.
          </FadeIn>
        </div>
      </section>

      {/* ──────────────── TESTIMONIALS ────────────────────────────── */}
      <section className="py-28" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <div className="mx-auto max-w-7xl px-6">
          <FadeIn className="text-center mb-16 space-y-4">
            <SectionLabel icon={Star} text="Trusted by Top Traders" color={BRAND.amber} />
            <h2 className="font-bold mt-4" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
              What Our{' '}
              <span style={{
                background: `linear-gradient(135deg, ${BRAND.amber}, ${BRAND.red})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>Traders Say</span>
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {TESTIMONIALS.map(({ name, role, avatar, rating, color, text }, i) => (
              <FadeIn key={name} delay={i * 0.09}>
                <div
                  className="rounded-2xl p-6 border flex flex-col gap-4 h-full hover:-translate-y-1 transition-all duration-300 cursor-default"
                  style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.07)' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = `${color}35`;
                    (e.currentTarget as HTMLDivElement).style.background = `${color}06`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)';
                    (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.025)';
                  }}
                >
                  <div className="flex">
                    {Array.from({ length: rating }).map((_, j) => (
                      <Star key={j} size={13} style={{ color: BRAND.amber, fill: BRAND.amber }} />
                    ))}
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed flex-1">"{text}"</p>
                  <div className="flex items-center gap-3 pt-3 border-t border-white/6">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${color}, ${BRAND.purpleL})` }}
                    >
                      {avatar}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-100 text-sm">{name}</div>
                      <div className="text-[11px] text-slate-500">{role}</div>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────── FAQ ──────────────────────────────────────── */}
      <section id="academy" className="py-28">
        <div className="mx-auto max-w-3xl px-6">
          <FadeIn className="text-center mb-14 space-y-4">
            <SectionLabel icon={BookOpen} text="Frequently Asked Questions" color={BRAND.purple} />
            <h2 className="font-bold mt-4" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)' }}>
              Everything You{' '}
              <span style={{
                background: `linear-gradient(135deg, ${BRAND.purple}, ${BRAND.cyan})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>Need to Know</span>
            </h2>
          </FadeIn>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <FaqItem key={i} q={faq.q} a={faq.a} index={i} />
            ))}
          </div>

          <FadeIn delay={0.4} className="text-center mt-10 text-sm text-slate-500">
            Still have questions?{' '}
            <a href="mailto:support@trademind.ai"
              className="font-semibold transition-colors hover:text-white"
              style={{ color: BRAND.purple }}>
              Contact our support team →
            </a>
          </FadeIn>
        </div>
      </section>

      {/* ──────────────── FINAL CTA ────────────────────────────────── */}
      <section className="py-28" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <div className="mx-auto max-w-5xl px-6">
          <FadeIn>
            <div
              className="relative rounded-3xl p-12 md:p-20 text-center overflow-hidden border"
              style={{
                background: `linear-gradient(135deg, ${BRAND.purple}12 0%, ${BRAND.darker} 50%, ${BRAND.cyan}08 100%)`,
                borderColor: `${BRAND.purple}30`,
                boxShadow: `0 0 100px ${BRAND.purple}20`,
              }}
            >
              {/* Decorative blobs */}
              <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-[80px] opacity-15"
                style={{ background: BRAND.purple }} />
              <div className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full blur-[80px] opacity-10"
                style={{ background: BRAND.cyan }} />

              {/* Grid */}
              <svg className="absolute inset-0 w-full h-full opacity-5 pointer-events-none">
                <defs>
                  <pattern id="ctaGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#7C3AED" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#ctaGrid)" />
              </svg>

              <div className="relative">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border text-xs font-bold mb-6"
                  style={{ background: `${BRAND.purple}18`, borderColor: `${BRAND.purple}40`, color: BRAND.cyan }}
                >
                  <Rocket size={13} />
                  Join 50,000+ Traders Already Winning with AI
                </motion.div>

                <h2 className="font-black mb-5 leading-tight" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)' }}>
                  Ready to Let{' '}
                  <span style={{
                    background: `linear-gradient(135deg, ${BRAND.purple}, ${BRAND.cyan})`,
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  }}>
                    AI Trade For You?
                  </span>
                </h2>
                <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">
                  Start free today. Your first AI signal is generated within minutes of signup.
                  No credit card required.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/dashboard"
                    className="inline-flex items-center justify-center gap-2.5 px-10 py-4 rounded-2xl font-black text-base text-white transition-all duration-300 hover:scale-105 group"
                    style={{
                      background: `linear-gradient(135deg, ${BRAND.purple}, ${BRAND.purpleL})`,
                      boxShadow: `0 0 40px ${BRAND.purple}50, 0 4px 30px rgba(0,0,0,0.5)`,
                    }}>
                    <Rocket size={18} />
                    Create Free Account
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link href="/dashboard"
                    className="inline-flex items-center justify-center gap-2.5 px-10 py-4 rounded-2xl font-bold text-base border transition-all duration-300 hover:bg-white/8 hover:scale-105"
                    style={{ borderColor: 'rgba(255,255,255,0.15)', color: '#e2e8f0' }}>
                    View Live Demo
                    <ChevronRight size={18} />
                  </Link>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ──────────────── FOOTER ──────────────────────────────────── */}
      <footer className="border-t border-white/6 py-16" style={{ background: BRAND.darker }}>
        <div className="mx-auto max-w-7xl px-6">
          {/* Top: Brand + links */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-10 mb-12">
            {/* Brand col */}
            <div className="lg:col-span-2 space-y-5">
              <div className="flex items-center gap-3">
                <TradeMindLogo size={36} />
                <div>
                  <div className="font-bold text-base text-white">TradeMind AI</div>
                  <div className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">Smarter Trades. Greater Futures.</div>
                </div>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
                Enterprise-grade AI trading platform. Autonomous signals, institutional risk management, and portfolio intelligence for every trader.
              </p>
              <div className="flex items-center gap-3">
                {[
                  { icon: Twitter,  href: '#' },
                  { icon: Github,   href: '#' },
                  { icon: Linkedin, href: '#' },
                  { icon: Mail,     href: 'mailto:hello@trademind.ai' },
                ].map(({ icon: Icon, href }, i) => (
                  <a key={i} href={href}
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:-translate-y-0.5"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = `${BRAND.purple}40`; (e.currentTarget as HTMLAnchorElement).style.background = `${BRAND.purple}15`; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.05)'; }}
                  >
                    <Icon size={15} className="text-slate-400" />
                  </a>
                ))}
              </div>
            </div>

            {/* Link columns */}
            {Object.entries(FOOTER_LINKS).map(([section, links]) => (
              <div key={section} className="space-y-4">
                <h4 className="font-bold text-slate-300 text-sm">{section}</h4>
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <li key={link}>
                      <a href="#"
                        className="text-slate-500 text-sm hover:text-slate-200 transition-colors">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-white/6 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-slate-600 text-xs">
              © 2026 TradeMind AI Ltd. All rights reserved. Trading involves risk.
            </div>
            <div className="flex items-center gap-6 text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                All systems operational
              </span>
              <span>v2.0.0 · 2026 Edition</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ──────────────── VIDEO MODAL ──────────────────────────────── */}
      <AnimatePresence>
        {videoOpen && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)' }}
            onClick={() => setVideoOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', damping: 20 }}
              className="relative w-full max-w-4xl aspect-video rounded-3xl overflow-hidden border border-purple-500/30 bg-slate-900 flex items-center justify-center"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <div className="text-center space-y-4">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
                  style={{ background: `${BRAND.purple}25`, border: `2px solid ${BRAND.purple}50` }}>
                  <Play size={28} style={{ color: BRAND.purple, marginLeft: '4px' }} />
                </div>
                <p className="text-slate-400 text-sm">Platform demo video coming soon</p>
                <Link href="/dashboard"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white"
                  style={{ background: `linear-gradient(135deg, ${BRAND.purple}, ${BRAND.purpleL})` }}>
                  <Rocket size={14} />
                  Try the Live Platform Instead
                </Link>
              </div>
              <button
                onClick={() => setVideoOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                style={{ background: 'rgba(255,255,255,0.1)' }}>
                <X size={16} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
