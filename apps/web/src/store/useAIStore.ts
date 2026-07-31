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
  type: 'crypto' | 'forex' | 'stocks' | 'indices' | 'commodities';
  direction: 'BUY' | 'SELL' | 'WAIT';
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
  status?: 'ACTIVE' | 'CLOSED' | 'EXPIRED';
  aiReasoning?: any;
  reasoning?: string;
  indicatorVerdicts?: Record<string, string>;
  tradingviewIdea?: string;
  categoryScores?: Record<string, number>;
  marketBreadth?: Record<string, any>;
  optionsGex?: Record<string, any>;
  mag7Heatmap?: Record<string, any>;
  earningsSchedule?: Record<string, any>;
  onchainAnalytics?: Record<string, any>;
  etfFlows?: Record<string, any>;
  stablecoinLiquidity?: Record<string, any>;
  whaleEngine?: Record<string, any>;
  sessionEngine?: Record<string, any>;
  executionQuality?: Record<string, any>;
  dxyEngine?: Record<string, any>;
  yieldMatrix?: Record<string, any>;
  interestDifferentials?: Record<string, any>;
  cotPositioning?: Record<string, any>;
  interventionRisk?: Record<string, any>;
  carryTrade?: Record<string, any>;
  realYieldEngine?: Record<string, any>;
  inflationEngine?: Record<string, any>;
  centralBankBuying?: Record<string, any>;
  geopoliticalRisk?: Record<string, any>;
  signalGrade?: string;
}

interface AIState {
  signals: AISignal[];
  copilotMessages: ChatMessage[];
  isTyping: boolean;
  aiMode: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | 'CUSTOM';
  autonomousActive: boolean;
  allocation: number;
  riskLimit: number;
  maxDrawdown: number;
  addMessage: (msg: ChatMessage) => void;
  setTyping: (typing: boolean) => void;
  setAIMode: (mode: AIState['aiMode']) => void;
  setAutonomous: (active: boolean) => void;
  setAllocation: (pct: number) => void;
  setRiskLimit: (pct: number) => void;
  setMaxDrawdown: (pct: number) => void;
  setSignals: (signals: AISignal[]) => void;
}

export const useAIStore = create<AIState>((set) => ({
  signals: [],
  copilotMessages: [
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hello Timothy! 👋 I'm TradeMind AI. I monitor live market structure, SMC order blocks, liquidity sweeps, and quantitative indicators across BTC, ETH, Gold, EUR/USD, USD/JPY, US100, and US30. How can I assist your trading today?",
      timestamp: new Date(),
    },
  ],
  isTyping: false,
  aiMode: 'BALANCED',
  autonomousActive: false,
  allocation: 50,
  riskLimit: 2,
  maxDrawdown: 10,
  addMessage: (msg) => set((state) => ({ copilotMessages: [...state.copilotMessages, msg] })),
  setTyping: (isTyping) => set({ isTyping }),
  setAIMode: (aiMode) => set({ aiMode }),
  setAutonomous: (autonomousActive) => set({ autonomousActive }),
  setAllocation: (allocation) => set({ allocation }),
  setRiskLimit: (riskLimit) => set({ riskLimit }),
  setMaxDrawdown: (maxDrawdown) => set({ maxDrawdown }),
  setSignals: (signals) => set({ signals }),
}));
