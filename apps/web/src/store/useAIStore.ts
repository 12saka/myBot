'use client';
import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AISignal {
  id: string;
  symbol: string;
  type: 'crypto' | 'forex' | 'stocks';
  direction: 'BUY' | 'SELL';
  confidence: number;
  entry: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  riskReward: string;
  probability: string;
  duration: string;
  strategy: string;
  technicals: string[];
  fundamentals: string[];
  sentiment: string[];
  createdAt: string;
  expiresAt: string;
}

interface AIState {
  signals: AISignal[];
  copilotMessages: ChatMessage[];
  isTyping: boolean;
  aiMode: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | 'CUSTOM';
  autonomousActive: boolean;
  addMessage: (msg: ChatMessage) => void;
  setTyping: (typing: boolean) => void;
  setAIMode: (mode: AIState['aiMode']) => void;
  setAutonomous: (active: boolean) => void;
}

const MOCK_SIGNALS: AISignal[] = [
  {
    id: 'sig-1', symbol: 'BTC/USD', type: 'crypto', direction: 'BUY', confidence: 91,
    entry: 64200, stopLoss: 63500, tp1: 66000, tp2: 68500,
    riskReward: '1:3.2', probability: '88%', duration: '4–8 hours', strategy: 'Trend Following AI',
    technicals: ['Breakout confirmed above EMA-200', 'RSI bullish momentum at 62', 'Volume surge +34%'],
    fundamentals: ['BTC ETF inflows accelerating', 'US dollar index softening', 'Positive macro sentiment'],
    sentiment: ['Social sentiment 82% positive', 'Whale accumulation trend active', 'Derivatives funding rate neutral'],
    createdAt: '2026-07-02T06:00:00Z', expiresAt: '2026-07-02T14:00:00Z',
  },
  {
    id: 'sig-2', symbol: 'EUR/USD', type: 'forex', direction: 'BUY', confidence: 84,
    entry: 1.0850, stopLoss: 1.0810, tp1: 1.0920, tp2: 1.0970,
    riskReward: '1:2.8', probability: '79%', duration: '1 day', strategy: 'Smart Money AI',
    technicals: ['Double bottom confirmation on 1H', 'MACD bullish crossover', 'Price above VWAP'],
    fundamentals: ['ECB hawkish remarks expected', 'Eurozone CPI matching expectations'],
    sentiment: ['Retail sentiment 70% short (contrarian buy)'],
    createdAt: '2026-07-02T05:30:00Z', expiresAt: '2026-07-03T05:30:00Z',
  },
  {
    id: 'sig-3', symbol: 'AAPL', type: 'stocks', direction: 'SELL', confidence: 76,
    entry: 197.34, stopLoss: 200.50, tp1: 191.00, tp2: 185.00,
    riskReward: '1:2.5', probability: '72%', duration: '3 days', strategy: 'Swing Trading AI',
    technicals: ['Bearish engulfing on Daily', 'RSI overbought at 74', 'VWAP rejection confirmed'],
    fundamentals: ['Institutional selling detected', 'Supply chain headwinds'],
    sentiment: ['Options put/call ratio elevated'],
    createdAt: '2026-07-02T07:00:00Z', expiresAt: '2026-07-05T07:00:00Z',
  },
  {
    id: 'sig-4', symbol: 'SOL/USD', type: 'crypto', direction: 'BUY', confidence: 88,
    entry: 182.00, stopLoss: 174.00, tp1: 196.00, tp2: 212.00,
    riskReward: '1:3.5', probability: '84%', duration: '2–3 days', strategy: 'Breakout AI',
    technicals: ['Ascending triangle breakout', 'Volume profile support', 'Weekly bullish engulfing'],
    fundamentals: ['Solana DeFi TVL growing 28%', 'NFT volume resurgence'],
    sentiment: ['Developer activity at 12-month high'],
    createdAt: '2026-07-02T08:00:00Z', expiresAt: '2026-07-05T08:00:00Z',
  },
];

export const useAIStore = create<AIState>()((set) => ({
  signals: MOCK_SIGNALS,
  copilotMessages: [
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I am TradeMind Copilot, your AI-powered trading assistant. I can analyze markets, explain signals, optimize your portfolio, or discuss any trading strategy. What would you like to explore today?',
      timestamp: new Date(),
    },
  ],
  isTyping: false,
  aiMode: 'BALANCED',
  autonomousActive: false,
  addMessage: (msg) => set((s) => ({ copilotMessages: [...s.copilotMessages, msg] })),
  setTyping: (typing) => set({ isTyping: typing }),
  setAIMode: (mode) => set({ aiMode: mode }),
  setAutonomous: (active) => set({ autonomousActive: active }),
}));
