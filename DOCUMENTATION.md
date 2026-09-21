# TradeMind AI — Complete System Architecture, Concepts & Type Reference

> **Version:** 2.0.0 Institutional Edition  
> **Platform:** TradeMind Autonomous AI Quantitative Trading & Learning Ecosystem  
> **Monorepo Structure:** Next.js 15 App Router Frontend, NestJS 10 API Gateway, FastAPI Python ML Engine, Prisma 5 PostgreSQL ORM.

---

## Table of Contents
1. [High-Level System Architecture](#1-high-level-system-architecture)
2. [Monorepo Structure & Service Topology](#2-monorepo-structure--service-topology)
3. [Deep Dive: Quantitative Signal Generation Engine](#3-deep-dive-quantitative-signal-generation-engine)
   - [Market Data & Candlestick Ingestion](#market-data--candlestick-ingestion)
   - [Technical Indicators: Mathematical Formulations](#technical-indicators-mathematical-formulations)
   - [Smart Money Concepts (SMC) & Microstructure](#smart-money-concepts-smc--microstructure)
   - [Top-Down Multi-Timeframe (MTF) Institutional Bias](#top-down-multi-timeframe-mtf-institutional-bias)
   - [Intermarket Analysis Matrix](#intermarket-analysis-matrix)
   - [The 8 Dedicated Quantitative Strategy Engines](#the-8-dedicated-quantitative-strategy-engines)
   - [7-Stage Universal Capital Protection Quality Gate](#7-stage-universal-capital-protection-quality-gate)
   - [Precision Entry Engine (Limit vs. Market)](#precision-entry-engine-limit-vs-market)
   - [Multi-Factor Institutional Confidence & Probability Engine](#multi-factor-institutional-confidence--probability-engine)
   - [45-Minute Immutable Signal Locking Protocol](#45-minute-immutable-signal-locking-protocol)
4. [Deep Dive: 3-Brain Autonomous Trading Guardian](#4-deep-dive-3-brain-autonomous-trading-guardian)
   - [Brain 1: Market Intelligence & Signal Generator](#brain-1-market-intelligence--signal-generator)
   - [Brain 2: Risk Guardian Constitution](#brain-2-risk-guardian-constitution)
   - [Brain 3: Broker Execution Engine](#brain-3-broker-execution-engine)
   - [Broker Connectivity (HFM, Exness, JustMarkets, FBS, XM, IC Markets, Deriv)](#broker-connectivity)
5. [Deep Dive: TradeMind Academy & Instructor LMS](#5-deep-dive-trademind-academy--instructor-lms)
   - [Curriculum Hierarchy: Courses, Modules & Lessons](#curriculum-hierarchy)
   - [Interactive Quizzes & AI Question Generator](#interactive-quizzes--ai-question-generator)
   - [Homework Assignments & Instructor Grading](#homework-assignments--instructor-grading)
   - [Question of the Day (QOTD) & Gamified Leaderboard](#qotd--leaderboard)
   - [Community Discussions & Live Webinars](#community-discussions--live-webinars)
6. [Deep Dive: Financial Infrastructure, Billing & Wallets](#6-deep-dive-financial-infrastructure-billing--wallets)
   - [PayHero M-Pesa & Card Gateway Integration](#payhero-m-pesa--card-gateway)
   - [In-App Multi-Currency Wallet & Ledger](#in-app-wallet--ledger)
   - [Tiered Subscription Plans & Dynamic Usage Limits](#tiered-subscription-plans)
7. [Comprehensive Type & Schema Reference](#7-comprehensive-type--schema-reference)
   - [Prisma Database Models](#prisma-database-models)
   - [Enums & Status Constants](#enums--status-constants)
   - [Frontend TypeScript Interfaces (Zustand & API DTOs)](#frontend-typescript-interfaces)
8. [API Route Catalog & Endpoints](#8-api-route-catalog--endpoints)
9. [Deployment & Environment Configuration](#9-deployment--environment-configuration)

---

## 1. High-Level System Architecture

TradeMind AI is architected as an institutional-grade, distributed quantitative trading and educational platform. It separates analytical computation, high-throughput API routing, machine learning inference, and presentation into decoupled layers:

```mermaid
flowchart TB
    subgraph Client Layer ["Client Application (apps/web)"]
        UI["Next.js 15 App Router (React 19)"]
        TV["TradingView Charts Widget"]
        Zustand["Zustand State Stores"]
    end

    subgraph Gateway Layer ["API Gateway & Core Engine (services/api-gateway)"]
        Nest["NestJS 10 Gateway (Port 4000)"]
        AuthM["Auth & Security Guards"]
        SigEngine["8 Dedicated Quant Strategy Engines"]
        Guard["3-Brain Risk Guardian"]
        BrokerSvc["Broker Execution Bridge"]
        AcadSvc["Academy & LMS Service"]
        BillSvc["Subscription & Billing Engine"]
    end

    subgraph Intelligence Layer ["AI & ML Service (services/ai-service)"]
        FastAPI["FastAPI Python Engine (Port 8000)"]
        Ensemble["XGBoost / Random Forest Ensemble"]
        NLP["FinBERT Sentiment & Macro NLP"]
    end

    subgraph Data & Storage Layer ["Persistence Layer"]
        PG[("PostgreSQL 16 (Prisma ORM)")]
        Redis[("Redis In-Memory Cache & Lock")]
    end

    subgraph External Brokers ["Broker Execution Protocols"]
        MT5["MetaTrader 5 / MT4 REST Bridge"]
        Brokers["HFM / Exness / JustMarkets / FBS / XM / IC Markets / Deriv"]
    end

    UI <-->|REST & WebSockets| Nest
    Nest <-->|Internal HTTP / HMAC| FastAPI
    Nest <-->|Prisma Queries| PG
    Nest <-->|Key-Value & Invalidation| Redis
    BrokerSvc <-->|Encrypted Orders & Telemetry| MT5
    MT5 <--> Brokers
```

---

## 2. Monorepo Structure & Service Topology

The project is structured as an npm workspaces monorepo:

```
trademind-ai/
├── apps/
│   └── web/                         # Next.js 15.5+ App Router Frontend (Port 3000)
│       ├── src/
│       │   ├── app/                 # 41 App Router Pages & Layouts
│       │   │   ├── (app)/           # Authenticated Trader Portal
│       │   │   │   ├── signals/     # Signal Terminal, Precision Badges & TV Charts
│       │   │   │   ├── automation/  # 3-Brain Guardian Dashboard & Live Order Log
│       │   │   │   ├── academy/     # Student Course Player, Quizzes & Community
│       │   │   │   ├── terminal/    # Pro Execution Trading Terminal
│       │   │   │   ├── portfolio/   # Equity, Drawdown & PnL Analytics
│       │   │   │   └── settings/    # Broker Connection & Risk Guard Tuning
│       │   │   ├── instructor/      # Instructor Course Builder & Assignment Grading
│       │   │   └── superadmin/      # Admin Controls, KYC, AML & Financial Audits
│       │   ├── components/          # Reusable UI, Charts, Modals & Widgets
│       │   ├── store/               # Zustand Global State Stores
│       │   └── lib/                 # API Client, Normalizers & Notification Hub
├── services/
│   ├── api-gateway/                 # NestJS Monolithic Gateway (Port 4000)
│   │   └── src/modules/
│   │       ├── signals/             # 8 Strategy Engines, Indicator Math & Signal Locking
│   │       ├── automation/          # 3-Brain Guardian & Auto-Trade Dispatcher
│   │       ├── brokers/             # Multi-Broker Account Manager & Order Bridge
│   │       ├── academy/             # Student Courses, Quizzes, QOTD & XP System
│   │       ├── instructor/          # Instructor Course/Lesson/Quiz Authoring
│   │       ├── subscription/        # PayHero M-Pesa & Card Billing Webhooks
│   │       ├── wallet/              # Multi-Currency Ledger & Internal Transfers
│   │       ├── copilot/             # AI Interactive Assistant
│   │       └── auth/                # JWT, Passport, KYC & Session Guards
│   ├── ai-service/                  # Python FastAPI Inference Engine (Port 8000)
│   │   ├── main.py                  # Predict Endpoint, ML Ensemble & Technical Features
│   │   └── requirements.txt         # NumPy, Pandas, Scikit-learn, XGBoost, FastAPI
│   ├── auth-service/                # Dedicated Auth Microservice
│   └── wallet-service/              # Dedicated Ledger Microservice
└── packages/
    ├── db/                          # Prisma Schema & Database Migrations
    │   └── prisma/schema.prisma     # 45+ Database Models & 15 Enums
    ├── shared/                      # Shared Interfaces, DTOs & Mathematical Utilities
    └── configs/                     # Base TypeScript, ESLint & Prettier configs
```

---

## 3. Deep Dive: Quantitative Signal Generation Engine

The signal generation engine in [`signals.module.ts`](file:///g:/my_Projects/myBot/services/api-gateway/src/modules/signals/signals.module.ts) produces deterministic, institutional-grade trading directives. It never relies on hallucinated random numbers or synthetic candles.

### Market Data & Candlestick Ingestion
- Ingests real-time OHLCV candles (1m, 5m, 15m, 1h, 4h, 1D) via TwelveData, Yahoo Finance, Binance, or Broker Spot Feeds.
- **Zero-Synthetic Guard:** If fewer than 10 authentic historical candles are available, the engine **refuses** to synthesize fake data and returns a safe `WAIT` status to protect capital.

### Technical Indicators: Mathematical Formulations

```mermaid
flowchart LR
    Candles["Historical Candlesticks (OHLCV)"] --> EMA["EMA (20, 50, 200)"]
    Candles --> RSI["RSI-14 (Wilder RMA)"]
    Candles --> ATR["ATR-14 (Wilder RMA)"]
    Candles --> VWAP["Institutional VWAP"]
    EMA & RSI & ATR & VWAP --> SMC["SMC Structure (FVG / OB / Sweeps)"]
    SMC --> Engines["8 Asset Strategy Engines"]
```

1. **Exponential Moving Average (EMA):**
   $$k = \frac{2}{N + 1}$$
   $$\text{EMA}_t = (\text{Price}_t \times k) + (\text{EMA}_{t-1} \times (1 - k))$$
   - Computed for periods 20, 50, and 200.
   - Evaluates short-term trend momentum ($20 > 50$) and macro structural regime ($50 > 200$).

2. **Relative Strength Index (RSI) using Wilder’s RMA Smoothing:**
   $$\text{Change}_t = \text{Close}_t - \text{Close}_{t-1}$$
   $$\text{AvgGain}_t = \frac{\text{AvgGain}_{t-1} \times 13 + \text{Gain}_t}{14}, \quad \text{AvgLoss}_t = \frac{\text{AvgLoss}_{t-1} \times 13 + \text{Loss}_t}{14}$$
   $$\text{RS} = \frac{\text{AvgGain}}{\text{AvgLoss}}, \quad \text{RSI} = 100 - \left(\frac{100}{1 + \text{RS}}\right)$$

3. **Average True Range (ATR) with Volatility Smoothing:**
   $$\text{TR} = \max(\text{High} - \text{Low}, |\text{High} - \text{Close}_{\text{prev}}|, |\text{Low} - \text{Close}_{\text{prev}}|)$$
   $$\text{ATR}_t = \frac{\text{ATR}_{t-1} \times 13 + \text{TR}_t}{14}$$
   - Forms the basis for dynamic volatility-scaled Stop Loss and Take Profit bounds.

4. **Institutional Volume-Weighted Average Price (VWAP):**
   $$\text{Typical Price}_i = \frac{\text{High}_i + \text{Low}_i + \text{Close}_i}{3}$$
   $$\text{VWAP} = \frac{\sum (\text{Typical Price}_i \times \text{Volume}_i)}{\sum \text{Volume}_i}$$
   - Identifies institutional spot accumulation floors ($P > \text{VWAP}$) and overhead distribution ceilings ($P < \text{VWAP}$).

---

### Smart Money Concepts (SMC) & Microstructure
The engine parses raw candle geometry to detect institutional order flow:

1. **Fair Value Gaps (FVG):**
   - **Bullish FVG:** Occurs when $\text{Low}(\text{Candle}_3) > \text{High}(\text{Candle}_1)$, indicating unmitigated buy-side imbalance.
   - **Bearish FVG:** Occurs when $\text{High}(\text{Candle}_3) < \text{Low}(\text{Candle}_1)$, indicating sell-side liquidity imbalance.
2. **Order Blocks (OB):**
   - Detects the final opposing candle before an aggressive displacement impulse ($|\text{Close} - \text{Open}| > 1.15 \times \text{ATR}$).
   - Serves as high-probability retest demand/supply zones.
3. **Liquidity Sweeps & Break of Structure (BOS):**
   - **Sell-Side Sweep:** Price pierces Previous Daily Low ($\text{Low} \le \text{PDL}$), absorbs stop losses, but rejects with a lower wick $> 38\%$ of candle range and closes bullish.
   - **Buy-Side Sweep:** Price pierces Previous Daily High ($\text{High} \ge \text{PDH}$), sweeps buy stops, but rejects with an upper wick $> 38\%$ and closes bearish.
   - **BOS:** A candle closes decisively outside PDH/PDL with high volume, confirming trend continuation.

---

### Top-Down Multi-Timeframe (MTF) Institutional Bias
[`analyzeHTFBias()`](file:///g:/my_Projects/myBot/services/api-gateway/src/modules/signals/signals.module.ts#L1469) performs macro synthesis:
- **4-Hour Macro Frame:** Evaluates macro trend alignment relative to the 200 EMA and 50 EMA.
- **1-Hour Intermediate Frame:** Confirms intermediate trend momentum.
- **Verdict Lock:** Generates authoritative bias: `BULLISH`, `BEARISH`, or `NEUTRAL`. Counter-trend trades against this lock are strictly rejected by Quality Gate 7.

---

### Intermarket Analysis Matrix
The engine integrates cross-asset macroeconomic feeds:
- **US Dollar Index (DXY):** Strong inverse correlation with Gold (XAU/USD) and major FX pairs (EUR/USD).
- **US 10-Year Treasury Yield (US10Y):** Measures risk-free yield opportunity cost, heavily driving Gold and Tech Equity duration multiples.
- **CBOE Volatility Index (VIX):** Elevated readings ($> 22$) trigger safe-haven allocations to bullion and reduce position sizes in risk assets.

---

### The 8 Dedicated Quantitative Strategy Engines

Every asset class possesses unique structural dynamics. TradeMind routes symbols into dedicated strategy engines:

```
                  ┌─── BTC / Crypto ───────► btcStrategyEngine
                  ├─── US100 / Nasdaq ─────► nasdaqStrategyEngine
                  ├─── US30 / Dow Jones ───► dowStrategyEngine
  Incoming Symbol ├─── EUR/USD / FX ───────► forexStrategyEngine
                  ├─── Equities ───────────► stocksStrategyEngine
                  ├─── Broad Indices ──────► indicesStrategyEngine
                  ├─── USD/JPY Carry ──────► usdjpyStrategyEngine
                  └─── XAU/USD Gold ───────► goldStrategyEngine
```

1. **`btcStrategyEngine` (Crypto):**
   - ETF net inflow tracking, exchange liquid reserves, halving cycle supply squeeze.
   - 24/7 session windows (Asian Accumulation, European Expansion, Wall Street ETF Window, Funding Settlement).
2. **`nasdaqStrategyEngine` (Tech Index - US100 / NQ):**
   - Tech earnings momentum, duration sensitivity to real rates, 09:30 ET Opening Range Breakout (ORB) and 15:00 ET Power Hour.
3. **`dowStrategyEngine` (Industrials - US30 / YM):**
   - Blue-chip cyclical balance sheet rotation, banking credit conditions, 10Y yield stability.
4. **`forexStrategyEngine` (EUR/USD, GBP/USD):**
   - Asian session high/low range sweeps (00:00–07:00 UTC), London open displacement (07:00–12:00 UTC), transatlantic monetary policy divergence.
5. **`stocksStrategyEngine` (Equities):**
   - Relative volume (RVOL), earnings schedule proximity, growth beta, sector rotation.
6. **`indicesStrategyEngine` (S&P 500 / Broad Markets):**
   - Market breadth (% of stocks above 50 EMA), institutional put/call skew, positive/negative gamma regimes.
7. **`usdjpyStrategyEngine` (Carry Trade):**
   - US-Japan interest rate yield differential, BoJ normalization warnings, Ministry of Finance (MoF) verbal and physical intervention threshold zones (155.00+).
8. **`goldStrategyEngine` (Metals - XAU/USD):**
   - Sovereign central bank bullion accumulation, TIPS real yields, psychological $25 round numbers, London/NY overlap volume.

---

### 7-Stage Universal Capital Protection Quality Gate

Before any signal is validated, it must pass [`applyQualityGate()`](file:///g:/my_Projects/myBot/services/api-gateway/src/modules/signals/signals.module.ts#L1604-L1707). If any gate fails, the trade is dismissed with `WAIT`:

| Gate | Condition | Rationale |
| :--- | :--- | :--- |
| **Gate 1: Minimum Confluence** | Score $< 60 / 100$ | Capital protection: eliminates low-probability market setups. |
| **Gate 2: Conflict Margin** | $\|Bullish - Bearish\| < 10$ pts | Market is in transition or equilibrium; coin-flip hazard. |
| **Gate 3: RSI Equilibrium** | $48 \le \text{RSI} \le 52$ & $\Delta < 15$ | Dead-center momentum; awaiting directional catalyst. |
| **Gate 4: EMA Compression** | $\frac{\|EMA_{20} - EMA_{50}\|}{Price} < 0.0001$ | Market is completely flat; chop and whip hazard. |
| **Gate 5: Candle Counter-Impulse** | 3 consecutive opposing closes | Price is actively dumping/pumping with high volume against the bias. |
| **Gate 6: Exhaustion Traps** | Long when $\text{RSI} > 78$ or Short when $\text{RSI} < 22$ | Entering at extremes leads to immediate liquidity unwind. |
| **Gate 7: HTF Counter-Trend Lock** | Signal direction $\neq$ 4H/1H HTF Direction | Prohibits trading against institutional macro flow. |

---

### Precision Entry Engine (Limit vs. Market)

[`calculatePrecisionEntry()`](file:///g:/my_Projects/myBot/services/api-gateway/src/modules/signals/signals.module.ts#L1308-L1369) eliminates FOMO market chasing:

$$\text{Dist}_{\text{EMA}} = |\text{Current Price} - \text{EMA}_{20}|$$
$$\text{IsExtended} = \text{Dist}_{\text{EMA}} > (0.35 \times \text{ATR})$$

- **If Price is Extended ($> 0.35 \times \text{ATR}$):**
  - **`BUY_LIMIT`:** Sets limit price at $\max(\text{EMA}_{20}, \text{Current Price} - 0.30 \times \text{ATR})$ with an entry zone $[\text{Limit} \pm 0.12 \times \text{ATR}]$.
  - **`SELL_LIMIT`:** Sets limit price at $\min(\text{EMA}_{20}, \text{Current Price} + 0.30 \times \text{ATR})$.
  - *Directive:* Instructs user/bot to place a pending limit order on pullback.
- **If Price is at Equilibrium:**
  - **`MARKET_NOW`:** Confirms price is at the accumulation floor/distribution ceiling.

---

### Multi-Factor Institutional Confidence & Probability Engine

[`calculateCalibratedConfidence()`](file:///g:/my_Projects/myBot/services/api-gateway/src/modules/signals/signals.module.ts#L4364-L4394) balances base evidence, opposition conflict, and dominance:

$$\text{Base Score} = \min(95, \max(50, \text{WinningScore}))$$
$$\text{Conflict Ratio} = \frac{\text{LosingScore}}{\text{WinningScore} + \text{LosingScore}}$$
$$\text{Conflict Penalty} = \text{Conflict Ratio} \times 20$$
$$\text{Dominance Bonus} = \begin{cases} +4 & \text{if } \Delta \ge 50 \\ +2 & \text{if } \Delta \ge 35 \\ 0 & \text{otherwise} \end{cases}$$
$$\text{Confidence} = \min(95, \max(45, \text{round}(\text{Base Score} - \text{Conflict Penalty} + \text{Dominance Bonus})))$$
$$\text{Win Probability} = \min(88, \max(50, \text{round}(50 + (\text{Confidence} - 50) \times 0.82)))$$

**Grade Determination:**
- **`A+ Setup (High Conviction Confluence)`:** $\ge 85\%$ (or $\ge 80\%$ with Triple EMA Stack $20 > 50 > 200$).
- **`A Setup (Institutional Confluence)`:** $\ge 75\%$.
- **`B+ Setup (Standard Confluence)`:** $\ge 68\%$.
- **`B Setup (Scalp Confluence)`:** $\ge 60\%$.
- **`C Setup (Speculative)`:** $< 60\%$ (rejected by Quality Gate 1).

---

### 45-Minute Immutable Signal Locking Protocol
To prevent signal grade flip-flopping:
- Active signals are permanently locked for **45 minutes** in the database.
- A signal will never mutate in-place. When expired or replaced, old signals are cleanly archived via `prisma.signal.updateMany({ data: { expiresAt: new Date() } })` and a new immutable record is created.

---

## 4. Deep Dive: 3-Brain Autonomous Trading Guardian

TradeMind's auto-execution architecture implements a strict separation of concerns to safeguard user capital:

```mermaid
flowchart LR
    Brain1["Brain 1: Market Intelligence (Signals Engine)"] -->|Validated Signal| Brain2["Brain 2: Risk Guardian (Constitution Checks)"]
    Brain2 -->|Approved Order & Lot Size| Brain3["Brain 3: Execution Engine (Brokers Service)"]
    Brain3 -->|Ticket & Sl/Tp| MT5["Connected Broker Account"]
    Brain2 -.->|Violates Drawdown / Risk| Reject["Trade Blocked & Logged"]
```

### Brain 1: Market Intelligence & Signal Generator
Monitors charts, evaluates the 8 strategy engines, runs quality gates, and outputs a validated signal payload containing direction, entry type, exact limit/market price, stop loss, and take profits.

### Brain 2: Risk Guardian Constitution
Before any order reaches a broker, [`evaluateRiskGuardian()`](file:///g:/my_Projects/myBot/services/api-gateway/src/modules/automation/automation.service.ts#L300) runs 6 non-negotiable constitution checks:
1. **Trading Enabled Check:** Verifies `aiTradingEnabled === true` and `placeTrades === true`.
2. **Account Balance Check:** Ensures `equity > 0` and margin is sufficient.
3. **Daily Drawdown Kill-Switch:** If today's losses exceed `maxDailyLoss` (e.g. 3%), trading halts instantly.
4. **Max Open Positions:** Prevents over-exposure by enforcing `openPositionsCount < maxOpenTrades`.
5. **Risk-Reward Ratio:** Rejects any signal with an R:R below `minRiskReward` (e.g. 1:1.5).
6. **Dynamic Lot Sizing:** Computes lot size based on account balance, risk percentage, and pip distance:
   $$\text{Risk Amount} = \text{Balance} \times \left(\frac{\text{RiskPct}}{100}\right)$$
   $$\text{Lots} = \frac{\text{Risk Amount}}{\text{Distance to Stop Loss} \times \text{Pip Value}}$$

### Brain 3: Broker Execution Engine
Dispatches orders to [`BrokersService.executeTrade()`](file:///g:/my_Projects/myBot/services/api-gateway/src/modules/brokers/brokers.service.ts#L541):
- Dispatches `LIMIT` orders for `BUY_LIMIT`/`SELL_LIMIT` and `MARKET` for `MARKET_NOW`.
- Strict numeric price verification (no dummy defaults).
- Generates a deterministic ticket ID.
- Serializes complete execution telemetry (broker, server, mode, comment, timestamp) into the database record.

### Broker Connectivity
Supports direct MetaTrader 4/5 integration across major retail brokers:
- **HFM (HF Markets)**
- **Exness**
- **JustMarkets**
- **FBS**
- **XM**
- **IC Markets**
- **Pepperstone**
- **Deriv**

---

## 5. Deep Dive: TradeMind Academy & Instructor LMS

TradeMind includes a full-featured educational learning management system:

### Curriculum Hierarchy
```
Course (e.g., "Institutional Smart Money & Order Flow")
  ├── CourseModule (e.g., "Module 1: Liquidity Pools & Stop Runs")
  │     ├── Lesson 1 ("Identifying Buy-Side & Sell-Side Liquidity") [Video URL embedded]
  │     └── Lesson 2 ("Fair Value Gaps & Imbalance Mitigation")
  └── Quiz ("Module 1 Competency Assessment")
```

### Interactive Quizzes & AI Question Generator
- Students complete timed multiple-choice quizzes with instant grading and explanations.
- Instructors can generate questions using AI (`/api/v2/instructor/generate-question`) or build manual Question Banks.

### Homework Assignments & Instructor Grading
- Students submit trade screenshots, trade journals, and commentary via `AssignmentSubmission`.
- Instructors review submissions, award scores out of `maxScore`, write qualitative feedback, and grant gamified XP.

### QOTD & Leaderboard
- **Question of the Day:** Every 24 hours, a new market question is published. Answering correctly awards 25 XP and builds user streaks.
- **XP Leaderboard:** Ranks traders globally by level, streak, and completed certifications.

### Community Discussions & Live Webinars
- Threaded discussions with solved markers (`isSolved`), pinned posts, and instructor badges.
- Live webinar scheduling with registration tracking and video replay recording URLs.

---

## 6. Deep Dive: Financial Infrastructure, Billing & Wallets

### PayHero M-Pesa & Card Gateway
Handles automated recurring subscriptions and wallet deposits:
- STK Push prompts sent directly to mobile devices.
- Webhook listener (`POST /subscription/webhook`) with HMAC signature verification, status processing (`SUCCESS`, `FAILED`), and automatic account upgrade.

### In-App Wallet & Ledger
- Supports deposits, withdrawals, and internal transfers between trading portfolios.
- Uses strict idempotency keys (`idempotencyKey`) and audit logs to prevent double-spending.

### Tiered Subscription Plans
| Plan | Price (KES / USD) | Signals / Wk | AI Features | Automation Access |
| :--- | :--- | :--- | :--- | :--- |
| **Free Trial** | Free (14 Days) | 10 | Basic Analysis | Manual Only |
| **Starter** | KES 2,500 / $25 | 25 | Standard Indicators | 1 Broker Account |
| **Pro** | KES 5,000 / $50 | Unlimited | Advanced SMC + MTF | 3 Broker Accounts |
| **Institutional** | KES 10,000 / $100 | Unlimited | Full 3-Brain Guardian | Unlimited Auto-Trading |

---

## 7. Comprehensive Type & Schema Reference

### Prisma Database Models (Key Models)

#### `model Signal`
```prisma
model Signal {
  id               String         @id @default(uuid())
  userId           String?
  strategyKey      String         @default("institutional-core")
  symbol           String
  direction        OrderDirection // BUY, SELL, WAIT
  entryPrice       Float
  stopLoss         Float
  takeProfit1      Float
  takeProfit2      Float
  riskRewardRatio  Float
  winProbability   Float
  durationEstimate String
  aiReasoning      Json
  createdAt        DateTime       @default(now())
  expiresAt        DateTime

  user             User?          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([symbol, expiresAt])
  @@index([userId, expiresAt])
}
```

#### `model BrokerAccount`
```prisma
model BrokerAccount {
  id                    String    @id @default(uuid())
  userId                String
  broker                String    // HFM, Exness, JustMarkets, FBS, XM, IC Markets, Deriv
  accountType           String    @default("LIVE") // LIVE, DEMO
  platform              String    @default("MT5")  // MT5, MT4, cTrader
  server                String
  accountNumber         String
  encryptedCredentials  String
  connectionStatus      String    @default("CONNECTED")
  aiTradingEnabled      Boolean   @default(false)
  placeTrades           Boolean   @default(false)
  modifySlTp            Boolean   @default(false)
  closePositions        Boolean   @default(false)
  
  maxRiskPerTrade       Float     @default(1.0)
  maxDailyLoss          Float     @default(3.0)
  maxOpenTrades         Int       @default(5)
  minRiskReward         Float     @default(2.0)
  riskGuardActive       Boolean   @default(true)
  
  balance               Float     @default(0.0)
  equity                Float     @default(0.0)
  margin                Float     @default(0.0)
  freeMargin            Float     @default(0.0)
  currency              String    @default("USD")
  leverage              String    @default("1:500")
  lastSyncedAt          DateTime? @default(now())
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

#### `model Order`
```prisma
model Order {
  id           String         @id @default(uuid())
  portfolioId  String
  symbol       String
  direction    OrderDirection // BUY, SELL, WAIT
  type         OrderType      // MARKET, LIMIT, STOP_LOSS, TAKE_PROFIT
  quantity     Float
  price        Float?
  stopLoss     Float?
  takeProfit   Float?
  status       OrderStatus    // PENDING, FILLED, PARTIALLY_FILLED, CANCELLED, REJECTED
  errorMessage String?        // Stores execution telemetry & ticket metadata
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  portfolio    Portfolio      @relation(fields: [portfolioId], references: [id], onDelete: Cascade)
}
```

---

### Enums & Status Constants

```prisma
enum Role {
  SUPER_ADMIN
  ADMIN
  INSTRUCTOR
  COMPLIANCE_OFFICER
  SUPPORT_AGENT
  TRADER
  USER
  INVESTOR
  GUEST
  AI_AGENT
}

enum OrderDirection {
  BUY
  SELL
  WAIT
}

enum OrderType {
  MARKET
  LIMIT
  STOP_LOSS
  TAKE_PROFIT
}

enum OrderStatus {
  PENDING
  FILLED
  PARTIALLY_FILLED
  CANCELLED
  REJECTED
}

enum SubscriptionStatus {
  TRIALING
  TRIAL
  ACTIVE
  RENEWAL_PENDING
  PAST_DUE
  PAYMENT_FAILED
  CANCELLED
  EXPIRED
}
```

---

### Frontend TypeScript Interfaces (Zustand & API DTOs)

#### `AISignal` Interface (`apps/web/src/store/useAIStore.ts`)
```typescript
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
  tp3?: number;
  riskReward: string;
  probability: string;
  duration: string;
  strategy: string;
  technicals: string[];
  fundamentals: string[];
  sentiment: string[];
  createdAt: string;
  updatedAt?: string;
  expiresAt: string;
  status?: 'ACTIVE' | 'RUNNING' | 'WAIT' | 'HIT_TP1' | 'HIT_TP2' | 'HIT_SL' | 'CLOSED' | 'EXPIRED';
  signalGrade?: string;
  aiReasoning?: {
    signal_grade: string;
    is_locked: boolean;
    locked_at: string;
    entry_type: 'BUY_LIMIT' | 'SELL_LIMIT' | 'MARKET_NOW';
    entry_zone: string;
    entry_condition: string;
    reasons_for: string[];
    reasons_against: string[];
    confidence_score: number;
    win_probability: number;
    evidence: any;
  };
}
```

---

## 8. API Route Catalog & Endpoints

### Signals Gateway (`/api/v2/signals`)
- `GET /signals`: Fetches all active, unexpired trading signals.
- `POST /signals/generate`: Requests generation of a fresh signal for a symbol (`{ symbol, interval, forceFresh }`).
- `POST /signals`: Manually creates an analytical signal.
- `DELETE /signals/:id`: Archives or dismisses a signal.

### Automation & Guardian (`/api/v2/automation`)
- `GET /automation/status`: Returns active Guardian state, connected brokers, and daily risk counters.
- `POST /automation/toggle`: Toggles master autonomous auto-trading on/off.
- `POST /automation/run-eval`: Triggers manual evaluation of active signals against connected broker rules.

### Broker Execution Bridge (`/api/v2/brokers`)
- `GET /brokers/accounts`: Lists all connected broker accounts with balances, equity, and margin.
- `POST /brokers/connect`: Registers and verifies broker credentials (server, login, password).
- `POST /brokers/trade`: Dispatches an order to a broker account.
- `GET /brokers/orders`: Retrieves recent orders with parsed execution tickets and paper/live labels.
- `PATCH /brokers/positions/:id`: Modifies Stop Loss and Take Profit levels for an open position.
- `DELETE /brokers/positions/:id`: Closes an open position at market.

### Academy & Student Portal (`/api/v2/academy`)
- `GET /academy/courses`: Lists available courses with enrollment status.
- `GET /academy/courses/:id`: Retrieves full course syllabus, modules, and lessons.
- `GET /academy/qotd/today`: Retrieves today's Question of the Day.
- `POST /academy/qotd/:id/answer`: Submits answer to QOTD and returns awarded XP.
- `GET /academy/leaderboard`: Retrieves global XP rankings.

---

## 9. Deployment & Environment Configuration

### Required Environment Variables (`.env`)
```bash
# Database & Cache
DATABASE_URL="postgresql://user:password@localhost:5432/trademind_db?schema=public"
REDIS_URL="redis://localhost:6379"

# API Gateway & Security
PORT=4000
JWT_SECRET="your-256-bit-secret-key"
JWT_EXPIRATION="7d"

# External Market Data Providers
TWELVE_DATA_API_KEY="your_twelvedata_api_key"
ALPHA_VANTAGE_API_KEY="your_alphavantage_api_key"

# Python AI Inference Service
AI_SERVICE_URL="http://localhost:8000"
AI_SECRET_KEY="internal-hmac-shared-key"

# Payment Gateways (PayHero / M-Pesa)
PAYHERO_API_KEY="your_payhero_api_key"
PAYHERO_API_SECRET="your_payhero_secret"
PAYHERO_CHANNEL_ID="your_channel_id"

# Web Client URL
FRONTEND_URL="http://localhost:3000"
```

### Build & Run Commands
```bash
# Install dependencies across all monorepo workspaces
npm install

# Run database migrations and generate Prisma client
npm run db:migrate
npm run db:generate

# Build all applications and services
npm run build

# Start services in development mode concurrently
npm run dev
```
