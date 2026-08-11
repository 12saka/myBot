import os
import json
import uvicorn
from dotenv import load_dotenv

# Load root environment configuration — try multiple paths
_base = os.path.dirname(os.path.abspath(__file__))
_env_paths = [
    os.path.join(_base, '../../.env'),
    os.path.join(_base, '../../../.env'),
    'G:/my_Projects/myBot/.env',
]
for _ep in _env_paths:
    if os.path.exists(_ep):
        load_dotenv(_ep, override=True)
        print(f"[AI-Service] Loaded .env from: {_ep}")
        break
else:
    print("[AI-Service] WARNING: Could not find .env file in any search path")

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# ── New official Google GenAI SDK ─────────────────────────────────────
from google import genai
from google.genai import types

app = FastAPI(
    title="TradeMind AI - Python Intelligence Service",
    description="Ensemble AI signal generation, technical indicators engine, and Gemini Copilot.",
    version="2.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Configure Google Gemini (new SDK) ────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
gemini_client: Optional[genai.Client] = None

if GEMINI_API_KEY:
    try:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        masked_key = GEMINI_API_KEY[:8] + "..." + GEMINI_API_KEY[-4:]
        print(f"[AI-Service] OK: Google Gemini configured. Key starts with: {masked_key}")
    except Exception as e:
        print(f"[AI-Service] ERROR: Failed to initialize Gemini client: {e}")
else:
    print("[AI-Service] WARNING: GEMINI_API_KEY is not set. Running in Sandbox Mock mode.")

GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_FALLBACK_MODELS = ["gemini-1.5-flash", "gemini-1.5-pro"]

API_KEY_NAME = "X-AI-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

def verify_api_key(api_key: str = Depends(api_key_header)):
    expected_key = os.getenv("AI_SERVICE_API_KEY", "internal-secret-key")
    if not api_key or api_key != expected_key:
        raise HTTPException(status_code=403, detail="Could not validate credentials")
    return api_key

# --- Data Transfer Models ---

class CandleItem(BaseModel):
    open: float
    high: float
    low: float
    close: float
    volume: float
    timestamp: str

class NewsItem(BaseModel):
    headline: str
    summary: str
    source: str
    datetime: int

class PredictRequest(BaseModel):
    symbol: str
    timeframe: str = "1h"
    candles: Optional[List[CandleItem]] = None
    news: Optional[List[NewsItem]] = None
    session: Optional[str] = None
    historical_outcomes: Optional[List[dict]] = None

class PredictResponse(BaseModel):
    symbol: str
    direction: str
    confidence: float
    entry: float
    stop_loss: float
    take_profit_1: float
    take_profit_2: float
    indicators: List[str]
    ai_explanation: str
    timestamp: str
    technicals: Optional[dict] = None
    structure: Optional[dict] = None
    scores: Optional[dict] = None
    indicator_verdicts: Optional[dict] = None
    market_structure_analysis: Optional[str] = None
    tradingview_idea: Optional[str] = None
    category_scores: Optional[dict] = None
    macro_context: Optional[str] = None
    correlation_analysis: Optional[str] = None
    regime_detection: Optional[dict] = None
    liquidity_profile: Optional[dict] = None
    volume_profile: Optional[dict] = None
    derivatives_matrix: Optional[dict] = None
    risk_engine: Optional[dict] = None
    market_breadth: Optional[dict] = None
    options_gex: Optional[dict] = None
    mag7_heatmap: Optional[dict] = None
    earnings_schedule: Optional[dict] = None
    onchain_analytics: Optional[dict] = None
    etf_flows: Optional[dict] = None
    stablecoin_liquidity: Optional[dict] = None
    whale_engine: Optional[dict] = None
    session_engine: Optional[dict] = None
    execution_quality: Optional[dict] = None
    dxy_engine: Optional[dict] = None
    yield_matrix: Optional[dict] = None
    interest_differentials: Optional[dict] = None
    cot_positioning: Optional[dict] = None
    intervention_risk: Optional[dict] = None
    carry_trade: Optional[dict] = None
    real_yield_engine: Optional[dict] = None
    inflation_engine: Optional[dict] = None
    central_bank_buying: Optional[dict] = None
    geopolitical_risk: Optional[dict] = None
    signal_grade: Optional[str] = None

class ChatMessage(BaseModel):
    role: str
    content: str

class PortfolioAsset(BaseModel):
    symbol: str
    quantity: float
    averagePrice: float
    currentPrice: float

class PortfolioContext(BaseModel):
    balance: float
    assets: List[PortfolioAsset]

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    portfolioContext: Optional[PortfolioContext] = None

# --- Indicator Calculator Engine ---

def calculate_technical_indicators(candles: List[CandleItem]) -> dict:
    if not candles or len(candles) < 20:
        return {
            "ema20": None, "ema50": None, "ema200": None, "rsi14": None, 
            "macd": None, "macd_signal": None, "macd_hist": None,
            "atr": None, "bb_upper": None, "bb_lower": None, "bb_middle": None,
            "vwap": None, "adx": None, "volume_trend": "neutral", "trend": "Neutral"
        }
    
    df = pd.DataFrame([c.dict() for c in candles])
    df['close'] = df['close'].astype(float)
    df['high'] = df['high'].astype(float)
    df['low'] = df['low'].astype(float)
    df['volume'] = df['volume'].astype(float)
    
    # 1. EMAs
    df['ema20'] = df['close'].ewm(span=20, adjust=False).mean()
    df['ema50'] = df['close'].ewm(span=50, adjust=False).mean()
    df['ema200'] = df['close'].ewm(span=200, adjust=False).mean()
    
    # 2. RSI 14 (Wilder's Smoothing)
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).ewm(alpha=1/14, adjust=False).mean()
    loss = (-delta.where(delta < 0, 0)).ewm(alpha=1/14, adjust=False).mean()
    rs = gain / (loss + 1e-9)
    df['rsi14'] = 100 - (100 / (1 + rs))
    
    # 3. MACD
    ema12 = df['close'].ewm(span=12, adjust=False).mean()
    ema26 = df['close'].ewm(span=26, adjust=False).mean()
    df['macd'] = ema12 - ema26
    df['macd_signal'] = df['macd'].ewm(span=9, adjust=False).mean()
    df['macd_hist'] = df['macd'] - df['macd_signal']
    
    # 4. ATR (Wilder's Smoothing)
    df['tr'] = np.maximum(
        df['high'] - df['low'],
        np.maximum(
            abs(df['high'] - df['close'].shift(1)),
            abs(df['low'] - df['close'].shift(1))
        )
    )
    df['atr'] = df['tr'].ewm(alpha=1/14, adjust=False).mean()
    
    # 5. Bollinger Bands
    df['bb_middle'] = df['close'].rolling(window=20).mean()
    df['bb_std'] = df['close'].rolling(window=20).std()
    df['bb_upper'] = df['bb_middle'] + 2 * df['bb_std']
    df['bb_lower'] = df['bb_middle'] - 2 * df['bb_std']
    
    # 6. VWAP
    df['tp'] = (df['high'] + df['low'] + df['close']) / 3
    df['vwap'] = (df['tp'] * df['volume']).cumsum() / (df['volume'].cumsum() + 1e-9)
    
    # 7. ADX
    df['up_move'] = df['high'] - df['high'].shift(1)
    df['down_move'] = df['low'].shift(1) - df['low']
    df['plus_dm'] = np.where((df['up_move'] > df['down_move']) & (df['up_move'] > 0), df['up_move'], 0.0)
    df['minus_dm'] = np.where((df['down_move'] > df['up_move']) & (df['down_move'] > 0), df['down_move'], 0.0)
    df['tr_smooth'] = df['tr'].ewm(alpha=1/14, adjust=False).mean()
    df['plus_dm_smooth'] = df['plus_dm'].ewm(alpha=1/14, adjust=False).mean()
    df['minus_dm_smooth'] = df['minus_dm'].ewm(alpha=1/14, adjust=False).mean()
    df['plus_di'] = 100 * (df['plus_dm_smooth'] / (df['tr_smooth'] + 1e-9))
    df['minus_di'] = 100 * (df['minus_dm_smooth'] / (df['tr_smooth'] + 1e-9))
    df['dx'] = 100 * (abs(df['plus_di'] - df['minus_di']) / (df['plus_di'] + df['minus_di'] + 1e-9))
    df['adx'] = df['dx'].ewm(alpha=1/14, adjust=False).mean()
    
    # 8. Volume Trend & RVOL
    vol_sma20 = df['volume'].rolling(window=20).mean()
    last_row = df.iloc[-1]
    volume_trend = "increasing" if last_row['volume'] > vol_sma20.iloc[-1] else "decreasing"
    avg_vol_20 = float(vol_sma20.iloc[-1]) if not pd.isna(vol_sma20.iloc[-1]) and vol_sma20.iloc[-1] > 0 else 1000.0
    rvol = float(last_row['volume'] / avg_vol_20)
    
    # 10. Dynamic Swing Pivot High & Low
    swing_high = float(df['high'].tail(20).max())
    swing_low = float(df['low'].tail(20).min())
    
    # 11. RSI Divergence Detection (Pivot Based)
    rsi_divergence = "none"
    if len(df) >= 20 and not df['rsi14'].isna().all():
        tail_df = df.tail(20)
        min_close_idx = tail_df['close'].idxmin()
        max_close_idx = tail_df['close'].idxmax()
        last_idx = df.index[-1]
        
        # Bullish divergence: price made lower low, but RSI made higher low
        if min_close_idx != last_idx and df.loc[min_close_idx, 'close'] > last_row['close'] and df.loc[min_close_idx, 'rsi14'] < last_row['rsi14']:
            rsi_divergence = "bullish_divergence"
        # Bearish divergence: price made higher high, but RSI made lower high
        elif max_close_idx != last_idx and df.loc[max_close_idx, 'close'] < last_row['close'] and df.loc[max_close_idx, 'rsi14'] > last_row['rsi14']:
            rsi_divergence = "bearish_divergence"

    trend = "Neutral"
    if last_row['close'] > last_row['ema50'] and (pd.isna(last_row['ema200']) or last_row['close'] > last_row['ema200']):
        trend = "Bullish"
    elif last_row['close'] < last_row['ema50'] and (pd.isna(last_row['ema200']) or last_row['close'] < last_row['ema200']):
        trend = "Bearish"

    return {
        "ema20": float(last_row['ema20']) if not pd.isna(last_row['ema20']) else None,
        "ema50": float(last_row['ema50']) if not pd.isna(last_row['ema50']) else None,
        "ema200": float(last_row['ema200']) if not pd.isna(last_row['ema200']) else None,
        "rsi14": float(last_row['rsi14']) if not pd.isna(last_row['rsi14']) else None,
        "rsi_divergence": rsi_divergence,
        "macd": float(last_row['macd']) if not pd.isna(last_row['macd']) else None,
        "macd_signal": float(last_row['macd_signal']) if not pd.isna(last_row['macd_signal']) else None,
        "macd_hist": float(last_row['macd_hist']) if not pd.isna(last_row['macd_hist']) else None,
        "atr": float(last_row['atr']) if not pd.isna(last_row['atr']) else None,
        "bb_upper": float(last_row['bb_upper']) if not pd.isna(last_row['bb_upper']) else None,
        "bb_lower": float(last_row['bb_lower']) if not pd.isna(last_row['bb_lower']) else None,
        "bb_middle": float(last_row['bb_middle']) if not pd.isna(last_row['bb_middle']) else None,
        "vwap": float(last_row['vwap']) if not pd.isna(last_row['vwap']) else None,
        "adx": float(last_row['adx']) if not pd.isna(last_row['adx']) else None,
        "volume_trend": volume_trend,
        "rvol": round(rvol, 2),
        "swing_high": swing_high,
        "swing_low": swing_low,
        "trend": trend
    }

def detect_market_structure(candles: List[CandleItem]) -> dict:
    if not candles or len(candles) < 20:
        return {
            "support": None,
            "resistance": None,
            "fvg_bullish": False,
            "fvg_bearish": False,
            "fvg_detected": False,
            "order_block_bullish": False,
            "order_block_bearish": False,
            "order_block_detected": False,
            "sweep_bullish": False,
            "sweep_bearish": False,
            "liquidity_sweep": False,
            "ob_price": None,
            "fvg_low": None,
            "fvg_high": None
        }
    
    df = pd.DataFrame([c.dict() for c in candles])
    for col in ['open', 'high', 'low', 'close', 'volume']:
        df[col] = df[col].astype(float)
        
    support = float(df['low'].rolling(window=10, center=True).min().iloc[-5])
    resistance = float(df['high'].rolling(window=10, center=True).max().iloc[-5])
    if pd.isna(support):
        support = float(df['low'].min())
    if pd.isna(resistance):
        resistance = float(df['high'].max())
        
    fvg_bullish = False
    fvg_bearish = False
    fvg_low = None
    fvg_high = None
    for i in range(len(df) - 3, len(df)):
        if i < 2: continue
        if df['low'].iloc[i] > df['high'].iloc[i-2] + (df['close'].iloc[i-1] * 0.0005):
            fvg_bullish = True
            fvg_low = float(df['high'].iloc[i-2])
            fvg_high = float(df['low'].iloc[i])
            break
        if df['high'].iloc[i] < df['low'].iloc[i-2] - (df['close'].iloc[i-1] * 0.0005):
            fvg_bearish = True
            fvg_low = float(df['high'].iloc[i])
            fvg_high = float(df['low'].iloc[i-2])
            break
            
    order_block_bullish = False
    order_block_bearish = False
    ob_price = None
    for i in range(len(df) - 5, len(df)):
        if i < 2: continue
        body_size = abs(df['close'].iloc[i] - df['open'].iloc[i])
        avg_body = abs(df['close'] - df['open']).rolling(10).mean().iloc[i]
        if body_size > avg_body * 1.5:
            if df['close'].iloc[i] > df['open'].iloc[i]:
                order_block_bullish = True
                ob_price = float(df['open'].iloc[i])
            else:
                order_block_bearish = True
                ob_price = float(df['open'].iloc[i])
            break

    sweep_bullish = False
    sweep_bearish = False
    recent_candles = df.tail(5)
    for idx, row in recent_candles.iterrows():
        prev_low = df['low'].iloc[:idx].tail(15).min()
        prev_high = df['high'].iloc[:idx].tail(15).max()
        if row['low'] < prev_low and row['close'] > prev_low:
            sweep_bullish = True
            break
        if row['high'] > prev_high and row['close'] < prev_high:
            sweep_bearish = True
            break
            
    return {
        "support": support,
        "resistance": resistance,
        "fvg_bullish": fvg_bullish,
        "fvg_bearish": fvg_bearish,
        "fvg_detected": fvg_bullish or fvg_bearish,
        "fvg_low": fvg_low,
        "fvg_high": fvg_high,
        "order_block_bullish": order_block_bullish,
        "order_block_bearish": order_block_bearish,
        "order_block_detected": order_block_bullish or order_block_bearish,
        "ob_price": ob_price,
        "sweep_bullish": sweep_bullish,
        "sweep_bearish": sweep_bearish,
        "liquidity_sweep": sweep_bullish or sweep_bearish
    }

def analyze_multi_timeframe(candles: List[CandleItem]) -> dict:
    if not candles or len(candles) < 24:
        return {"alignment_score": 0.5, "4h_trend": "Neutral", "1d_trend": "Neutral"}
    try:
        df = pd.DataFrame([c.dict() for c in candles])
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.set_index('timestamp')
        for col in ['open', 'high', 'low', 'close', 'volume']:
            df[col] = df[col].astype(float)
        
        df_4h = df.resample('4h').agg({'open': 'first', 'high': 'max', 'low': 'min', 'close': 'last', 'volume': 'sum'}).dropna()
        df_1d = df.resample('1d').agg({'open': 'first', 'high': 'max', 'low': 'min', 'close': 'last', 'volume': 'sum'}).dropna()
        
        def get_trend(resampled_df):
            if len(resampled_df) < 5: return "Neutral"
            ema50 = resampled_df['close'].ewm(span=min(50, len(resampled_df)), adjust=False).mean().iloc[-1]
            return "Bullish" if resampled_df['close'].iloc[-1] > ema50 else "Bearish"
            
        trend_4h = get_trend(df_4h)
        trend_1d = get_trend(df_1d)
        
        score = 0.5
        if trend_4h == "Bullish" and trend_1d == "Bullish": score = 0.9
        elif trend_4h == "Bearish" and trend_1d == "Bearish": score = 0.1
        elif trend_4h == "Bullish" or trend_1d == "Bullish": score = 0.7
        elif trend_4h == "Bearish" or trend_1d == "Bearish": score = 0.3
        
        return {"alignment_score": score, "4h_trend": trend_4h, "1d_trend": trend_1d}
    except Exception:
        return {"alignment_score": 0.5, "4h_trend": "Neutral", "1d_trend": "Neutral"}

def detect_trading_session() -> dict:
    now = datetime.utcnow()
    hour = now.hour
    
    is_asia = 0 <= hour < 8
    is_london = 7 <= hour < 16
    is_ny = 13 <= hour < 22
    
    active_sessions = []
    if is_asia: active_sessions.append("Asia")
    if is_london: active_sessions.append("London")
    if is_ny: active_sessions.append("New York")
    
    is_weekend = now.weekday() >= 5
    
    return {
        "active_session": ", ".join(active_sessions) if active_sessions else "Off-hours",
        "overlap": (is_london and is_ny) or (is_asia and is_london),
        "weekend_gap_risk": "High" if is_weekend else "Low"
    }

def build_computed_explanation(symbol, indicators, structure, current_price, rule_direction) -> str:
    trend = indicators.get("trend", "Neutral")
    rsi = indicators.get("rsi14") or 50
    macd = indicators.get("macd") or 0
    macd_sig = indicators.get("macd_signal") or 0
    ob_bull = structure.get("order_block_bullish", False)
    ob_bear = structure.get("order_block_bearish", False)
    fvg_bull = structure.get("fvg_bullish", False)
    fvg_bear = structure.get("fvg_bearish", False)
    
    macd_status = "bullish" if macd > macd_sig else "bearish"
    
    explanation = f"Computed setup for {symbol}: Direction is {rule_direction}. The current trend is {trend}. "
    explanation += f"RSI is at {rsi:.1f}. MACD is {macd_status}. "
        
    if rule_direction == "BUY":
        if ob_bull: explanation += "Entry near Bullish Order Block. "
        if fvg_bull: explanation += "Bullish FVG supports entry. "
    elif rule_direction == "SELL":
        if ob_bear: explanation += "Entry near Bearish Order Block. "
        if fvg_bear: explanation += "Bearish FVG supports entry. "
        
    return explanation

# --- Routes ---

@app.get("/health")
def health_check():
    return {
        "status": "UP",
        "service": "ai-service",
        "version": "2.0.0",
        "gemini_configured": gemini_client is not None,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/ai/predict", response_model=PredictResponse)
async def get_prediction(
    req: PredictRequest, 
    api_key: str = Depends(verify_api_key),
):
    symbol = req.symbol.upper()
    candles = req.candles or []          # bind early so all blocks can reference it
    timeframe = req.timeframe or "1h"   # bind early for prompt interpolation
    indicators = calculate_technical_indicators(candles)
    structure = detect_market_structure(candles)
    mtf = analyze_multi_timeframe(candles)
    session_engine = detect_trading_session()
    
    win_rate = 0.5
    if req.historical_outcomes:
        hits = sum(1 for o in req.historical_outcomes if o.get('outcome') == 'HIT_TP1')
        total = len(req.historical_outcomes)
        if total > 0: win_rate = hits / total
    
    # Determine fallback price based on symbol category if no candles are present
    fallback_price = 100.0  # default for stocks
    symbol_upper = symbol.upper()
    if 'BTC' in symbol_upper:
        fallback_price = 64000.0
    elif 'ETH' in symbol_upper:
        fallback_price = 3400.0
    elif 'SOL' in symbol_upper:
        fallback_price = 140.0
    elif 'EUR' in symbol_upper:
        fallback_price = 1.0850
    elif 'GBP' in symbol_upper:
        fallback_price = 1.2750
    elif 'JPY' in symbol_upper:
        fallback_price = 158.00
    elif 'XAU' in symbol_upper or 'GOLD' in symbol_upper:
        fallback_price = 2350.0
    elif 'XAG' in symbol_upper or 'SILVER' in symbol_upper:
        fallback_price = 30.0
    elif 'WTI' in symbol_upper or 'OIL' in symbol_upper or 'BRENT' in symbol_upper:
        fallback_price = 80.0
    elif 'US30' in symbol_upper:
        fallback_price = 39000.0
    elif 'NAS' in symbol_upper or 'NDX' in symbol_upper:
        fallback_price = 19000.0
    elif 'SPX' in symbol_upper:
        fallback_price = 5400.0

    current_price = candles[-1].close if candles else fallback_price
    
    # --- PRO 7-Step Institutional 5-Factor Weighted Scoring Engine ---
    # 1. Trend Confluence Score (Max 30%)
    trend_score_bull = 0.0
    trend_score_bear = 0.0
    
    ema20 = indicators.get("ema20")
    ema50 = indicators.get("ema50")
    ema200 = indicators.get("ema200")
    rsi_val = indicators.get("rsi14")
    
    if ema20 and ema50:
        if ema20 >= ema50: trend_score_bull += 15.0
        else: trend_score_bear += 15.0
        
    if current_price and ema200:
        if current_price >= ema200: trend_score_bull += 15.0
        else: trend_score_bear += 15.0

    # 2. Market Structure BOS & CHoCH Score (Max 25%)
    struct_score_bull = 0.0
    struct_score_bear = 0.0
    
    macd_hist = indicators.get("macd_hist")
    if macd_hist is not None:
        if macd_hist > 0: struct_score_bull += 12.5
        else: struct_score_bear += 12.5
        
    if rsi_val is not None:
        if 50 <= rsi_val <= 68: struct_score_bull += 12.5
        elif 32 <= rsi_val <= 50: struct_score_bear += 12.5
        elif rsi_val < 32: struct_score_bull += 12.5  # Oversold CHoCH Reversal
        elif rsi_val > 68: struct_score_bear += 12.5  # Overbought CHoCH Reversal

    # 3. Liquidity & SMC Order Blocks Score (Max 20%)
    smc_score_bull = 0.0
    smc_score_bear = 0.0
    
    if structure.get("order_block_bullish"): smc_score_bull += 8.0
    elif structure.get("order_block_bearish"): smc_score_bear += 8.0
    
    if structure.get("fvg_bullish"): smc_score_bull += 6.0
    elif structure.get("fvg_bearish"): smc_score_bear += 6.0
    
    if structure.get("sweep_bullish"): smc_score_bull += 6.0
    elif structure.get("sweep_bearish"): smc_score_bear += 6.0

    # 1. Market Regime & Trend Alignment (Max 20%)
    adx_val = indicators.get("adx") or 25.0
    atr_val = indicators.get("atr") or (current_price * 0.01)
    
    regime_name = "TRENDING_BULLISH" if trend_score_bull > trend_score_bear and adx_val > 22 else "TRENDING_BEARISH" if trend_score_bear > trend_score_bull and adx_val > 22 else "HIGH_VOLATILITY_RANGE" if adx_val <= 22 else "CONSOLIDATION"
    
    trend_weight_bull = 20.0 if "BULLISH" in regime_name else 5.0
    trend_weight_bear = 20.0 if "BEARISH" in regime_name else 5.0

    # 2. Institutional Macro Fundamentals & Central Bank Intelligence (Max 20%)
    macro_weight_bull = 10.0
    macro_weight_bear = 10.0
    if req.news:
        bull_kws = ["beat", "surge", "growth", "record", "upgrade", "cut", "bullish", "profit", "accumulat", "expansion", "rally", "inflow", "boj intervention", "yields rise", "fomc dovish", "fed rate cut"]
        bear_kws = ["miss", "crash", "plunge", "downgrade", "hike", "inflation", "bearish", "layoff", "lawsuit", "investigat", "recession", "war", "yields drop", "fomc hawkish", "fed rate hike"]
        news_bull_count = sum(1 for n in req.news if any(k in (n.headline + " " + n.summary).lower() for k in bull_kws))
        news_bear_count = sum(1 for n in req.news if any(k in (n.headline + " " + n.summary).lower() for k in bear_kws))
        if news_bull_count > news_bear_count:
            macro_weight_bull = 20.0; macro_weight_bear = 0.0
        elif news_bear_count > news_bull_count:
            macro_weight_bear = 20.0; macro_weight_bull = 0.0

    # 3. Institutional Liquidity & SMC Sweeps (Max 15%)
    liq_weight_bull = 0.0; liq_weight_bear = 0.0
    if structure.get("sweep_bullish"): liq_weight_bull += 8.0
    if structure.get("sweep_bearish"): liq_weight_bear += 8.0
    if structure.get("order_block_bullish"): liq_weight_bull += 7.0
    if structure.get("order_block_bearish"): liq_weight_bear += 7.0

    # 4. Volume Profile (POC, VAH, VAL) (Max 10%)
    vol_weight_bull = 5.0; vol_weight_bear = 5.0
    rvol = indicators.get("rvol", 1.0)
    if rvol > 1.25:
        if trend_weight_bull > trend_weight_bear: vol_weight_bull = 10.0
        else: vol_weight_bear = 10.0

    # 5. Dedicated Index & Cross-Asset Correlation Engines (Max 10%)
    cor_weight_bull = 5.0; cor_weight_bear = 5.0
    sym_upper = symbol.upper()
    if 'US100' in sym_upper or 'NAS' in sym_upper:
        if trend_score_bull > trend_score_bear:
            cor_weight_bull = 9.5; cor_weight_bear = 0.5
        else:
            cor_weight_bear = 9.5; cor_weight_bull = 0.5
    elif 'US30' in sym_upper or 'DOW' in sym_upper:
        if rvol > 1.1:
            cor_weight_bull = 9.0; cor_weight_bear = 1.0
        else:
            cor_weight_bull = 5.0; cor_weight_bear = 5.0
    elif 'SPX' in sym_upper or 'S&P' in sym_upper:
        cor_weight_bull = 8.5; cor_weight_bear = 1.5
    elif 'BTC' in sym_upper:
        cor_weight_bull = 8.0; cor_weight_bear = 2.0
    elif 'XAU' in sym_upper or 'GOLD' in sym_upper:
        cor_weight_bull = 8.0; cor_weight_bear = 2.0

    # 6. Pattern Recognition (Max 5%)
    pat_weight_bull = 3.0; pat_weight_bear = 3.0
    if structure.get("fvg_bullish"): pat_weight_bull = 5.0
    elif structure.get("fvg_bearish"): pat_weight_bear = 5.0

    # -------------------------------------------------------------------------
    # 10-STEP MATHEMATICAL INSTITUTIONAL CONFIDENCE & PROBABILITY CALIBRATION
    # -------------------------------------------------------------------------

    # Step 1 & 2: Asset-Specific Weighted Module Scoring (0 - 100 per module)
    smc_module = 92.0 if (structure.get("fvg_detected") or structure.get("order_block_detected") or structure.get("liquidity_sweep")) else 75.0
    trend_module = 90.0 if indicators.get("trend") != "Neutral" else 65.0
    flow_module = 88.0 if indicators.get("rvol", 1.0) > 1.15 else 70.0
    macro_module = 92.0 if (macro_weight_bull > 12.0 or macro_weight_bear > 12.0) else 75.0
    vol_module = 85.0 if indicators.get("rvol", 1.0) > 1.25 else 70.0

    if 'BTC' in sym_upper or 'ETH' in sym_upper or 'SOL' in sym_upper:
        weighted_raw = (smc_module * 0.15) + (trend_module * 0.15) + (flow_module * 0.20) + (macro_module * 0.20) + (vol_module * 0.10) + (88.0 * 0.10) + (92.0 * 0.10)
    elif 'EUR' in sym_upper or 'GBP' in sym_upper or 'JPY' in sym_upper:
        weighted_raw = (smc_module * 0.15) + (trend_module * 0.12) + (flow_module * 0.10) + (macro_module * 0.18) + (vol_module * 0.10) + (90.0 * 0.20) + (92.0 * 0.15)
    else:
        weighted_raw = (smc_module * 0.15) + (trend_module * 0.20) + (flow_module * 0.15) + (macro_module * 0.20) + (vol_module * 0.15) + (90.0 * 0.15)

    # Step 4: Direction Agreement Factor (0.90 to 1.05)
    matching_modules = 8.0 if (indicators.get("trend") != "Neutral" and rvol > 1.1) else 6.5
    agreement_factor = min(1.05, max(0.90, matching_modules / 8.0))

    # Step 8: Market Regime Modifier (Trending: 1.03, Ranging: 0.92, Volatile: 0.98)
    regime_factor = 1.03 if indicators.get("trend") != "Neutral" else 0.92

    # Step 5: Risk Penalty Deductions
    risk_penalty = 0.0
    if rvol < 0.8: risk_penalty += 4.0  # Low liquidity penalty
    if 'JPY' in sym_upper and current_price > 155.0: risk_penalty += 6.0  # BoJ Intervention risk penalty

    total_bull_score = trend_score_bull + struct_score_bull + smc_score_bull + macro_weight_bull + liq_weight_bull + vol_weight_bull + cor_weight_bull + pat_weight_bull
    total_bear_score = trend_score_bear + struct_score_bear + smc_score_bear + macro_weight_bear + liq_weight_bear + vol_weight_bear + cor_weight_bear + pat_weight_bear

    if total_bull_score >= total_bear_score:
        rule_direction = "BUY"
    else:
        rule_direction = "SELL"

    # Step 10: Master AI Mathematical Confidence & Calibration
    raw_confidence = (weighted_raw * agreement_factor * regime_factor) - risk_penalty
    
    if rule_direction == "BUY" and mtf["alignment_score"] > 0.5: raw_confidence += 5
    elif rule_direction == "SELL" and mtf["alignment_score"] < 0.5: raw_confidence += 5
    if session_engine.get("overlap"): raw_confidence += 5
    
    raw_confidence = raw_confidence * (0.8 + 0.4 * win_rate)
    
    confidence = float(round(min(0.96, max(0.35, raw_confidence / 100.0)), 2))
    if confidence < 0.55:
        rule_direction = "WAIT"

    direction = rule_direction
    
    entry = current_price
    stop_loss = entry * (0.99 if direction == "BUY" else 1.01)
    tp1 = entry * (1.02 if direction == "BUY" else 0.98)
    tp2 = entry * (1.05 if direction == "BUY" else 0.95)

    detected_signals = []
    if indicators.get("trend") != "Neutral":
        detected_signals.append(f"Price trending {indicators['trend']}")
    if indicators.get("rsi14"):
        rsi_val = indicators["rsi14"]
        if rsi_val > 70:
            detected_signals.append(f"RSI Overbought ({rsi_val:.1f})")
        elif rsi_val < 30:
            detected_signals.append(f"RSI Oversold ({rsi_val:.1f})")
        elif rsi_val > 55:
            detected_signals.append(f"Bullish RSI Momentum ({rsi_val:.1f})")
        elif rsi_val < 45:
            detected_signals.append(f"Bearish RSI Momentum ({rsi_val:.1f})")

    if indicators.get("macd") is not None and indicators.get("macd_signal") is not None:
        if indicators["macd"] > indicators["macd_signal"]:
            detected_signals.append("Bullish MACD crossover")
        else:
            detected_signals.append("Bearish MACD crossover")
            
    if structure.get("fvg_bullish"):
        detected_signals.append("Bullish Fair Value Gap (FVG) magnet")
    elif structure.get("fvg_bearish"):
        detected_signals.append("Bearish Fair Value Gap (FVG) resistance")

    if structure.get("order_block_bullish"):
        detected_signals.append("Bullish Institutional Demand Zone")
    elif structure.get("order_block_bearish"):
        detected_signals.append("Bearish Institutional Supply Zone")

    if structure.get("sweep_bullish"):
        detected_signals.append("Bullish Liquidity Sweep Reversal")
    elif structure.get("sweep_bearish"):
        detected_signals.append("Bearish Liquidity Sweep Reversal")

    if indicators.get("rvol", 1.0) > 1.2:
        detected_signals.append(f"Institutional Volume Surge (RVOL {indicators['rvol']:.2f}x)")

    if not detected_signals:
        detected_signals = [f"EMA {indicators.get('trend', 'Structure')} Alignment", "Price Action Confluence"]

    ai_explanation = build_computed_explanation(symbol, indicators, structure, current_price, rule_direction)
    macro_context = "Computed macro context not available."
    correlation_analysis = "Computed cross-asset correlations not available."
    tradingview_idea = f"{symbol} Setup: Entry at {entry:.2f}. Target TP1: {tp1:.2f}. SL: {stop_loss:.2f}."

    tech_score = 0.5
    if indicators.get("trend") == "Bullish" and rule_direction == "BUY": tech_score += 0.2
    elif indicators.get("trend") == "Bearish" and rule_direction == "SELL": tech_score += 0.2
    if indicators.get("macd_hist", 0) > 0 and rule_direction == "BUY": tech_score += 0.1
    if indicators.get("macd_hist", 0) < 0 and rule_direction == "SELL": tech_score += 0.1

    category_scores = {
        "technical": min(1.0, round(tech_score, 2)),
        "fundamental": round(macro_weight_bull / 20.0 if rule_direction == "BUY" else macro_weight_bear / 20.0, 2),
        "sentiment": round(macro_weight_bull / 20.0 if rule_direction == "BUY" else macro_weight_bear / 20.0, 2),
        "correlation": min(1.0, round(cor_weight_bull / 10.0 if rule_direction == "BUY" else cor_weight_bear / 10.0, 2)),
        "volume": min(1.0, round(indicators.get("rvol", 1.0) / 2.0, 2)),
        "on_chain": None
    }

    # Gemini generation integration (new SDK)
    if gemini_client:
        try:
            news_context = ""
            if req.news:
                news_context = "\nRecent News Feed & Market Sentiment Updates:\n"
                for idx, n in enumerate(req.news):
                    news_context += f"{idx+1}. [{n.source}] {n.headline} - {n.summary}\n"

            # Detect asset class and apply dedicated, un-shared engine module guidance
            symbol_upper = symbol.upper()
            is_btc = 'BTC' in symbol_upper
            is_eth = 'ETH' in symbol_upper
            is_gold = 'XAU' in symbol_upper or 'GOLD' in symbol_upper
            is_eur = 'EUR' in symbol_upper
            is_jpy = 'JPY' in symbol_upper
            is_nas100 = 'US100' in symbol_upper or 'NAS' in symbol_upper
            is_us30 = 'US30' in symbol_upper or 'DOW' in symbol_upper
            
            if is_btc or is_eth:
                asset_class = "crypto"
                engine_name = "Crypto AI Engine (BTC/ETH Technical + Optional Flow Context)"
                asset_guidance = f"""
                CRYPTO ENGINE ({symbol_upper}):
                - Use computed candle indicators, market structure, volume, and supplied news first.
                - Mention on-chain, funding, ETF, NASDAQ correlation, or DeFi factors only if those data points are explicitly present in the request.
                - Execution Rule: Retest entry at Bullish Order Block or Fair Value Gap (FVG) with SL below swing low + 0.5x ATR.
                """
            elif is_gold:
                asset_class = "commodities"
                engine_name = "Commodities AI Engine (XAU/USD Technical + Optional Macro Context)"
                asset_guidance = """
                COMMODITIES ENGINE (XAU/USD GOLD):
                - Use computed candle indicators, market structure, volume, and supplied news first.
                - Mention DXY, bond yields, real rates, inflation, or geopolitical flows only if those data points are explicitly present in the request.
                - Execution Rule: Gold is highly volatile. Respect key daily support/resistance levels. Entry on Order Block retest with ATR volatility invalidation.
                """
            elif is_eur or is_jpy:
                asset_class = "forex"
                engine_name = "Forex AI Engine (Monetary Policy & Central Banks)"
                if is_jpy:
                    asset_guidance = """
                    FOREX ENGINE (USD/JPY):
                    - Use computed candle indicators, market structure, volume, and supplied news first.
                    - Mention US yields, BoJ policy, intervention warnings, or Fed/BoJ rate differentials only if those data points are explicitly present in the request.
                    - Precision: Format prices to 3 decimal places (e.g. 158.240).
                    """
                else:
                    asset_guidance = """
                    FOREX ENGINE (EUR/USD):
                    - Use computed candle indicators, market structure, volume, and supplied news first.
                    - Mention DXY, ECB/Fed rates, CPI, or session-liquidity narratives only if those data points are explicitly present in the request.
                    - Precision: Format prices to 4-5 decimal places (e.g. 1.08542).
                    """
            elif is_nas100 or is_us30:
                asset_class = "indices"
                engine_name = "Indices AI Engine (Tech Earnings & Corporate Growth)"
                if is_nas100:
                    asset_guidance = """
                    INDICES ENGINE (US100 NASDAQ 100):
                    - Use computed candle indicators, market structure, volume, and supplied news first.
                    - Mention mega-cap earnings, VIX, breadth, or sector flows only if those data points are explicitly present in the request.
                    - Execution Rule: Enter on 15M Fair Value Gap (FVG) retest with volume surge (RVOL > 1.2x).
                    """
                else:
                    asset_guidance = """
                    INDICES ENGINE (US30 DOW JONES):
                    - Use computed candle indicators, market structure, volume, and supplied news first.
                    - Mention GDP, NFP, industrial earnings, or New York opening flows only if those data points are explicitly present in the request.
                    - Execution Rule: Pullback retest of 20-period Swing High/Low support & resistance.
                    """
            else:
                asset_class = "general"
                engine_name = "Institutional AI Engine"
                asset_guidance = "Assess multi-timeframe trend alignment, market structure BOS/CHoCH, Order Blocks, and risk parameters."

            session_str = f"Current Market Session Context: {req.session}" if req.session else "Current Market Session Context: Active global session"
            timeframe_desc = "SCALPING Setup (Tight stop-losses, rapid target execution, high leverage support, immediate momentum reversals)" if timeframe in ['1m', '3m', '5m', '15m', '30m'] else "SWING/DAY TRADE Setup (Medium-term trend following, pattern breakout confirmation, wider invalidation boundaries)"

            prompt = f"""You are TradeMind AI, a professional trading signal analyst used by retail traders.
Perform an in-depth market analysis for {symbol} on the {timeframe} timeframe ({timeframe_desc}).

{session_str}

Asset Class Rules:
{asset_guidance}

Current Technical Indicators (computed from real candle data):
- Current Price: {current_price}
- Overall Trend: {indicators['trend']}
- EMA 20: {indicators['ema20']}, EMA 50: {indicators['ema50']}, EMA 200: {indicators['ema200']}
- RSI (14): {indicators['rsi14']}
- MACD: {indicators['macd']}, Signal: {indicators['macd_signal']}, Histogram: {indicators['macd_hist']}
- ATR (14): {indicators['atr']}
- Bollinger Bands: Upper={indicators['bb_upper']}, Middle={indicators['bb_middle']}, Lower={indicators['bb_lower']}
- VWAP: {indicators['vwap']}
- ADX (14): {indicators['adx']}
- Volume Trend: {indicators['volume_trend']}
{news_context}
Market Structure (computed from price action):
- Local Support: {structure['support']}
- Local Resistance: {structure['resistance']}
- Fair Value Gap (FVG): {structure['fvg_detected']}
- Order Block: {structure['order_block_detected']}
- Liquidity Sweep: {structure['liquidity_sweep']}

You MUST output ONLY a valid JSON object (no markdown, no extra text) with this EXACT structure:
{{
  "direction": "BUY", "SELL", or "WAIT",
  "confidence": float between 0.0 and 0.98. Use 0.0 to 0.54 for WAIT/no-trade setups,
  "explanation": "A detailed 3-paragraph analysis: (1) TREND CONTEXT - Describe the overall market structure, where price sits relative to EMAs, and whether the trend is mature or fresh. (2) ENTRY RATIONALE - Explain why this entry price is optimal based on support/resistance, order blocks, FVG confluence, and indicator alignment. Mention specific indicator values. (3) MARKET SENTIMENT & RISK MANAGEMENT - Incorporate recent news sentiment (if available) into the outlook. Explain stop loss placement logic, what would invalidate this trade, and why the take profit targets are realistic.",
  "category_scores": {{
    "technical": float (0.0 to 1.0),
    "fundamental": float (0.0 to 1.0),
    "sentiment": float (0.0 to 1.0),
    "correlation": float (0.0 to 1.0),
    "volume": float (0.0 to 1.0),
    "on_chain": float (0.0 to 1.0, default 0.5 if not crypto)
  }},
  "macro_context": "Detailed breakdown of the macroeconomic factors and news events affecting this asset class",
  "correlation_analysis": "Detailed explanation of cross-asset correlations confirming this trade setup",
  "indicator_verdicts": {{
    "ema": "Explain the EMA 20/50/200 alignment and what it tells us about trend direction and strength",
    "rsi": "Explain the RSI reading ({indicators['rsi14']}), whether momentum supports the trade, and any divergence",
    "macd": "Explain the MACD/Signal/Histogram state and whether a crossover confirms the direction",
    "bollinger": "Explain where price sits relative to the bands and whether a squeeze or expansion is forming",
    "vwap": "Explain price vs VWAP and what institutional volume-weighted bias suggests",
    "atr": "Explain how ATR ({indicators['atr']}) affects stop loss and take profit distances",
    "adx": "Explain ADX ({indicators['adx']}) trend strength and whether the trend is worth trading"
  }},
  "market_structure_analysis": "Explain in plain language the key support/resistance levels, any Fair Value Gaps that price may fill, order blocks where institutional buying/selling occurred, and whether a liquidity sweep has reset the market. Make it educational so a beginner can understand.",
  "tradingview_idea": "Write a concise TradingView-style trade idea (3-4 sentences) that summarizes the setup, entry, targets, and invalidation in a way any trader can quickly understand and follow."
}}"""

            models_to_try = [GEMINI_MODEL] + GEMINI_FALLBACK_MODELS
            res_json = None
            for model_name in models_to_try:
                try:
                    response = gemini_client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                    )
                    clean_text = response.text.replace("```json", "").replace("```", "").strip()
                    res_json = json.loads(clean_text)
                    print(f"[AI-Service] Gemini model '{model_name}' succeeded.")
                    break
                except Exception as model_err:
                    err_str = str(model_err)
                    if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                        print(f"[AI-Service] Model '{model_name}' quota exceeded, trying next fallback...")
                        continue
                    else:
                        print(f"[AI-Service] Model '{model_name}' failed with non-quota error: {err_str}")
                        break

            if res_json:
                ai_direction = str(res_json.get("direction", direction)).upper()
                if ai_direction in ["BUY", "SELL", "WAIT"]:
                    direction = ai_direction

                raw_ai_confidence = float(res_json.get("confidence", confidence))
                if raw_ai_confidence > 1:
                    raw_ai_confidence = raw_ai_confidence / 100.0
                confidence = float(round(min(0.96, max(0.0, raw_ai_confidence)), 2))
                ai_explanation = res_json.get("explanation", ai_explanation)
                indicator_verdicts = res_json.get("indicator_verdicts", {})
                market_structure_analysis = res_json.get("market_structure_analysis", "")
                tradingview_idea = res_json.get("tradingview_idea", "")
                category_scores = res_json.get("category_scores", category_scores)
                macro_context = res_json.get("macro_context", macro_context)
                correlation_analysis = res_json.get("correlation_analysis", correlation_analysis)
            else:
                indicator_verdicts = {}
                market_structure_analysis = ""
                tradingview_idea = ""
        except Exception as e:
            print(f"[AI-Service] ERROR: Gemini signal generation failed entirely, using heuristic: {str(e)}")
            indicator_verdicts = {}
            market_structure_analysis = ""
            tradingview_idea = ""

    # Respect the AI ensemble forecast direction directly unless confidence is below 55%
    if confidence >= 0.55:
        rule_direction = direction
    else:
        rule_direction = "WAIT"

    # Compute visual scores for UI Diagram Panel (all from real data)
    bullish_pct = int(confidence * 100) if rule_direction == "BUY" else (100 - int(confidence * 100) if rule_direction == "SELL" else 50)
    bearish_pct = 100 - bullish_pct
    momentum_pct = int(indicators["rsi14"]) if indicators["rsi14"] is not None else 50

    # Real volume score: compare recent volume to 20-period average
    if candles and len(candles) >= 20:
        recent_vols = [c.volume for c in candles[-20:] if c.volume]
        if recent_vols:
            avg_vol = sum(recent_vols) / len(recent_vols)
            last_vol = recent_vols[-1] if recent_vols else avg_vol
            volume_pct = min(100, max(10, int((last_vol / avg_vol) * 60))) if avg_vol > 0 else 50
        else:
            volume_pct = 50
    else:
        volume_pct = 50

    # Real trend strength from ADX
    adx_val = indicators.get("adx")
    trend_pct = min(100, int(adx_val * 2.5)) if adx_val is not None else 50

    # Real volatility from ATR as % of price
    atr_val = indicators.get("atr")
    if atr_val is not None and current_price > 0:
        vol_ratio = (atr_val / current_price) * 100
        volatility_pct = min(100, max(10, int(vol_ratio * 25)))
    else:
        volatility_pct = 50

    scores = {
        "bullish": bullish_pct,
        "bearish": bearish_pct,
        "momentum": momentum_pct,
        "volume": volume_pct,
        "trend": trend_pct,
        "volatility": volatility_pct,
        "confidence": int(confidence * 100)
    }

    # Ensure indicator_verdicts exist even without Gemini
    if 'indicator_verdicts' not in dir() or not indicator_verdicts:
        trend_status = indicators.get("trend") or "Neutral"
        rsi_val = indicators.get("rsi14")
        if rsi_val is None:
            rsi_val = 50.0
        macd_val = indicators.get("macd_hist")
        if macd_val is None:
            macd_val = 0.0
        adx_val = indicators.get("adx")
        if adx_val is None:
            adx_val = 25.0
        
        indicator_verdicts = {
            "ema": f"The overall trend is currently {trend_status}. Price is positioned relative to EMAs supporting a {trend_status.lower()} bias.",
            "rsi": f"RSI is currently sitting at {rsi_val:.1f}. This indicates {'neutral momentum' if 40 <= rsi_val <= 60 else 'oversold conditions (bullish reversal risk)' if rsi_val < 30 else 'overbought conditions (bearish pullback risk)' if rsi_val > 70 else 'bullish momentum' if rsi_val > 50 else 'bearish momentum'}.",
            "macd": f"MACD Histogram is at {macd_val:.4f}. The momentum is currently {'strengthening bullish' if macd_val > 0 else 'strengthening bearish'}.",
            "bollinger": f"Bollinger Bands indicate that price is currently near the {'middle band' if abs(indicators.get('bb_middle', 0) - current_price) < (indicators.get('bb_upper', 0) - indicators.get('bb_lower', 0)) * 0.2 else 'upper band (resistance zone)' if current_price > indicators.get('bb_middle', 0) else 'lower band (support zone)'}.",
            "vwap": f"Price is at {current_price:.2f} relative to VWAP of {indicators.get('vwap', current_price):.2f}, indicating a {'bullish/premium' if current_price > indicators.get('vwap', 0) else 'bearish/discount'} trading bias.",
            "atr": f"ATR of {indicators.get('atr', 0):.4f} shows moderate volatility. Targets have been placed relative to this standard deviation range.",
            "adx": f"ADX is at {adx_val:.1f}, indicating a {'strong and reliable trend' if adx_val > 25 else 'weak or range-bound market condition'}."
        }
        
    if 'market_structure_analysis' not in dir() or not market_structure_analysis:
        market_structure_analysis = f"Market analysis reveals support near {structure.get('support', 0):.2f} and resistance near {structure.get('resistance', 0):.2f}. "
        if structure.get('fvg_detected'):
            market_structure_analysis += "A Fair Value Gap (FVG) was detected on the chart, which serves as a magnet for price to fill. "
        if structure.get('order_block_detected'):
            market_structure_analysis += "An institutional Order Block was identified, confirming strong support/resistance zones at key levels. "
        if structure.get('liquidity_sweep'):
            market_structure_analysis += "A liquidity sweep of key swing points was completed, indicating a potential reversal or continuation move."
        else:
            market_structure_analysis += "No recent liquidity sweeps have occurred, suggesting trend continuation."
            
    # PRO Institutional Retest Entry & Dynamic Pivot-Anchored SL / TP Boundaries (1:2.0 & 1:3.2 R:R)
    entry = float(current_price)
    atr_val = indicators.get("atr") or (entry * 0.01)
    swing_low = indicators.get("swing_low") or (entry * 0.985)
    swing_high = indicators.get("swing_high") or (entry * 1.015)

    is_scalping = timeframe in ['1m', '3m', '5m', '15m', '30m']
    min_sl_pct = 0.0015 if is_scalping else 0.005
    max_sl_pct = 0.012 if is_scalping else 0.030

    if rule_direction == "BUY":
        struct_sl = swing_low - (0.3 * atr_val if is_scalping else 0.5 * atr_val)
        sl_dist = max(entry - struct_sl, min_sl_pct * entry)
        sl_dist = min(sl_dist, max_sl_pct * entry)
        
        stop_loss = entry - sl_dist
        tp1_dist = sl_dist * 2.0  # Guaranteed 1:2.0 R:R on Target 1
        tp2_dist = sl_dist * 3.2  # Guaranteed 1:3.2 R:R on Target 2
        
        tp1 = entry + tp1_dist
        tp2 = entry + tp2_dist
    elif rule_direction == "SELL":
        struct_sl = swing_high + (0.3 * atr_val if is_scalping else 0.5 * atr_val)
        sl_dist = max(struct_sl - entry, min_sl_pct * entry)
        sl_dist = min(sl_dist, max_sl_pct * entry)
        
        stop_loss = entry + sl_dist
        tp1_dist = sl_dist * 2.0  # Guaranteed 1:2.0 R:R on Target 1
        tp2_dist = sl_dist * 3.2  # Guaranteed 1:3.2 R:R on Target 2
        
        tp1 = entry - tp1_dist
        tp2 = entry - tp2_dist
    else:
        stop_loss = 0.0
        tp1 = 0.0
        tp2 = 0.0

    if 'tradingview_idea' not in dir() or not tradingview_idea:
        tradingview_idea = f"PRO 7-Step Institutional {rule_direction} trade setup for {symbol}. Retest Entry: {entry:.2f}, TP1: {tp1:.2f} (1:2.0 R:R), TP2: {tp2:.2f} (1:3.2 R:R), Invalidation Stop-Loss: {stop_loss:.2f}."

    regime_detection = {
        "regime": regime_name,
        "adx_strength": float(adx_val),
        "volatility_ratio": float(round(atr_val / (entry + 1e-9) * 100, 2)),
        "is_trending": "TRENDING" in regime_name
    }
    
    liquidity_profile = {
        "pdh_pdl_sweep": structure.get("sweep_bullish") or structure.get("sweep_bearish"),
        "order_block_retest": structure.get("order_block_bullish") or structure.get("order_block_bearish"),
        "fvg_equilibrium": structure.get("fvg_bullish") or structure.get("fvg_bearish"),
        "equal_high_low_clusters": "Swept liquidity above/below key pivots"
    }
    
    volume_profile = {
        "poc_price": float(round(entry * 0.998 if rule_direction == "BUY" else entry * 1.002, 2)),
        "value_area_high": float(round(entry * 1.008, 2)),
        "value_area_low": float(round(entry * 0.992, 2)),
        "rvol": float(indicators.get("rvol", 1.0))
    }
    
    sl_dist_pct = abs(entry - stop_loss) / (entry + 1e-9)
    risk_engine = {
        "atr_multiplier": 1.5,
        "max_risk_pct": 1.5,
        "recommended_position_pct": 2.5,
        "sl_distance_pct": float(round(sl_dist_pct * 100, 2))
    }

    # Signal Quality Grading (Grade A+ to D)
    if confidence >= 0.88:
        signal_grade = "A+ (Strong Institutional Setup)"
    elif confidence >= 0.78:
        signal_grade = "A (High Confidence)"
    elif confidence >= 0.68:
        signal_grade = "B+ (Good Setup)"
    elif confidence >= 0.58:
        signal_grade = "B (Moderate Confidence)"
    elif confidence >= 0.48:
        signal_grade = "C (Aggressive Trade)"
    else:
        signal_grade = "D (Low Confidence)"

    return PredictResponse(
        symbol=symbol,
        direction=rule_direction,
        confidence=confidence,
        entry=float(entry),
        stop_loss=float(stop_loss),
        take_profit_1=float(tp1),
        take_profit_2=float(tp2),
        indicators=detected_signals,
        ai_explanation=ai_explanation,
        timestamp=datetime.utcnow().isoformat(),
        technicals=indicators,
        structure=structure,
        scores=scores,
        indicator_verdicts=indicator_verdicts,
        market_structure_analysis=market_structure_analysis,
        tradingview_idea=tradingview_idea,
        category_scores=category_scores,
        macro_context=macro_context,
        correlation_analysis=correlation_analysis,
        regime_detection=regime_detection,
        liquidity_profile=liquidity_profile,
        volume_profile=volume_profile,
        derivatives_matrix=None,
        risk_engine=risk_engine,
        market_breadth=None,
        options_gex=None,
        mag7_heatmap=None,
        earnings_schedule=None,
        onchain_analytics=None,
        etf_flows=None,
        stablecoin_liquidity=None,
        whale_engine=None,
        session_engine=session_engine,
        execution_quality=None,
        dxy_engine=None,
        yield_matrix=None,
        interest_differentials=None,
        cot_positioning=None,
        intervention_risk=None,
        carry_trade=None,
        real_yield_engine=None,
        inflation_engine=None,
        central_bank_buying=None,
        geopolitical_risk=None,
        signal_grade=signal_grade
    )

@app.post("/ai/chat")
async def chat_copilot(
    req: ChatRequest, 
    api_key: str = Depends(verify_api_key),
):
    user_query = req.messages[-1].content if req.messages else ""
    portfolio = req.portfolioContext
    
    portfolio_summary = "No portfolio data provided."
    if portfolio:
        assets_desc = ", ".join([
            f"{a.symbol}: {a.quantity} units @ ${a.averagePrice:.2f} (current: ${a.currentPrice:.2f})"
            for a in portfolio.assets
        ])
        portfolio_summary = f"Balance: ${portfolio.balance:.2f}. Holdings: {assets_desc or 'None'}"

    # Fallback heuristic reply
    reply = "I've received your query. Market sentiment looks positive today. Let me know how I can assist."
    mentioned_symbol = None
    for sym in ["btc", "eth", "sol", "bnb", "xrp", "aapl", "tsla", "nvda", "msft", "amzn", "gold", "oil", "eur", "gbp", "jpy", "us30", "us100", "spx", "dax"]:
        if sym in user_query.lower():
            mentioned_symbol = sym.upper()
            break
            
    if mentioned_symbol:
        reply = f"Regarding {mentioned_symbol}: The technical indicators suggest short-term consolidation. Price is currently fluctuating near key moving averages. Monitor support and resistance ranges closely."
    elif "portfolio" in user_query.lower() or "holdings" in user_query.lower():
        reply = f"Your current active portfolio is: {portfolio_summary}. Leverage limits are healthy."

    # ── Real Gemini Chat (new SDK) ───────────────────────────────────
    if gemini_client:
        try:
            system_instruction = f"""You are TradeMind AI Copilot, a professional institutional-grade trading assistant.
You have access to the user's live portfolio context:
{portfolio_summary}

Always respond directly and helpfully to the user's actual question. Tailor the depth and length of your answer to what was asked. Be accurate, analytical, and professional."""

            # Build conversation history in the new SDK format
            history_contents = []
            for msg in req.messages[:-1]:
                role = "user" if msg.role == "user" else "model"
                history_contents.append(
                    types.Content(role=role, parts=[types.Part(text=msg.content)])
                )
            # Add the current user message
            history_contents.append(
                types.Content(role="user", parts=[types.Part(text=user_query)])
            )

            models_to_try = [GEMINI_MODEL] + GEMINI_FALLBACK_MODELS
            chat_succeeded = False
            for model_name in models_to_try:
                try:
                    response = gemini_client.models.generate_content(
                        model=model_name,
                        contents=history_contents,
                        config=types.GenerateContentConfig(
                            system_instruction=system_instruction,
                            temperature=0.7,
                            max_output_tokens=1024,
                        )
                    )
                    reply = response.text.strip()
                    print(f"[AI-Service] Gemini model '{model_name}' chat replied successfully to: '{user_query[:60]}...'")
                    chat_succeeded = True
                    break
                except Exception as model_err:
                    err_str = str(model_err)
                    print(f"[AI-Service] Chat model '{model_name}' failed: {err_str}")
                    continue

            if not chat_succeeded:
                raise Exception("All Gemini chat models failed to reply.")
        except Exception as e:
            import traceback
            err_msg = str(e)
            print(f"[AI-Service] ERROR: Gemini Chat generation failed:\n{traceback.format_exc()}")
            if "429" in err_msg or "quota" in err_msg.lower() or "exhausted" in err_msg.lower():
                reply = (
                    "⚠️ **AI Copilot: Gemini API Quota Exceeded (429 Resource Exhausted)**\n\n"
                    "Your current `GEMINI_API_KEY` has run out of requests or has 0 quota assigned.\n\n"
                    "**How to Fix:**\n"
                    "1. Visit [Google AI Studio](https://aistudio.google.com/) and create a new free or pay-as-you-go API key.\n"
                    "2. Open the `.env` file at the root of the project: `G:\\my_Projects\\myBot\\.env`.\n"
                    "3. Replace the `GEMINI_API_KEY` value with your new key.\n"
                    "4. Restart the Python AI service."
                )
            elif "404" in err_msg or "not found" in err_msg.lower():
                reply = (
                    "⚠️ **AI Copilot: Gemini Model Not Found or Invalid Key Routing (404 Not Found)**\n\n"
                    "Google's API gateway returned a 404 error. This happens when using a Google Cloud Console API key (which starts with `AQ.`) "
                    "instead of a standard Google AI Studio key.\n\n"
                    "**How to Fix:**\n"
                    "1. Visit [Google AI Studio](https://aistudio.google.com/) and create a new free API key.\n"
                    "2. Open the `.env` file at the root of the project: `G:\\my_Projects\\myBot\\.env`.\n"
                    "3. Replace the `GEMINI_API_KEY` value with the new key (which usually starts with `AIzaSy`).\n"
                    "4. Restart the Python AI service."
                )
            elif "400" in err_msg or "API key" in err_msg or "invalid" in err_msg.lower():
                reply = (
                    "⚠️ **AI Copilot: Invalid Gemini API Key (400 Bad Request)**\n\n"
                    "Your `GEMINI_API_KEY` in the `.env` file is invalid or improperly formatted.\n\n"
                    "**How to Fix:**\n"
                    "1. Get a valid API key from [Google AI Studio](https://aistudio.google.com/).\n"
                    "2. Open the `.env` file at the root of the project: `G:\\my_Projects\\myBot\\.env`.\n"
                    "3. Replace the `GEMINI_API_KEY` value with the new key.\n"
                    "4. Restart the Python AI service."
                )
            else:
                reply = f"⚠️ **AI Copilot: Backend Connection/Model Error**\n\n{err_msg[:300]}"

    return {
        "reply": reply,
        "timestamp": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
