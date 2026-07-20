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
    
    # 2. RSI 14
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / (loss + 1e-9)
    df['rsi14'] = 100 - (100 / (1 + rs))
    
    # 3. MACD
    ema12 = df['close'].ewm(span=12, adjust=False).mean()
    ema26 = df['close'].ewm(span=26, adjust=False).mean()
    df['macd'] = ema12 - ema26
    df['macd_signal'] = df['macd'].ewm(span=9, adjust=False).mean()
    df['macd_hist'] = df['macd'] - df['macd_signal']
    
    # 4. ATR
    df['tr'] = np.maximum(
        df['high'] - df['low'],
        np.maximum(
            abs(df['high'] - df['close'].shift(1)),
            abs(df['low'] - df['close'].shift(1))
        )
    )
    df['atr'] = df['tr'].rolling(window=14).mean()
    
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
    
    # 8. Volume Trend
    vol_sma20 = df['volume'].rolling(window=20).mean()
    last_row = df.iloc[-1]
    volume_trend = "increasing" if last_row['volume'] > vol_sma20.iloc[-1] else "decreasing"
    
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
        "trend": trend
    }

def detect_market_structure(candles: List[CandleItem]) -> dict:
    if not candles or len(candles) < 20:
        return {
            "support": None,
            "resistance": None,
            "fvg_detected": False,
            "order_block_detected": False,
            "liquidity_sweep": False
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
        
    fvg_detected = False
    for i in range(len(df) - 3, len(df)):
        if i < 2: continue
        if df['low'].iloc[i] > df['high'].iloc[i-2] + (df['close'].iloc[i-1] * 0.0005):
            fvg_detected = True
            break
        if df['high'].iloc[i] < df['low'].iloc[i-2] - (df['close'].iloc[i-1] * 0.0005):
            fvg_detected = True
            break
            
    order_block_detected = False
    for i in range(len(df) - 5, len(df)):
        if i < 2: continue
        body_size = abs(df['close'].iloc[i] - df['open'].iloc[i])
        avg_body = abs(df['close'] - df['open']).rolling(10).mean().iloc[i]
        if body_size > avg_body * 1.5:
            order_block_detected = True
            break

    liquidity_sweep = False
    recent_candles = df.tail(5)
    for idx, row in recent_candles.iterrows():
        prev_low = df['low'].iloc[:idx].tail(15).min()
        prev_high = df['high'].iloc[:idx].tail(15).max()
        if row['low'] < prev_low and row['close'] > prev_low:
            liquidity_sweep = True
            break
        if row['high'] > prev_high and row['close'] < prev_high:
            liquidity_sweep = True
            break
            
    return {
        "support": support,
        "resistance": resistance,
        "fvg_detected": fvg_detected,
        "order_block_detected": order_block_detected,
        "liquidity_sweep": liquidity_sweep
    }

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
    
    # Base fallback values
    direction = "BUY"
    confidence = 0.82
    
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
    
    if indicators["trend"] == "Bearish":
        direction = "SELL"
        confidence = 0.76

    entry = current_price
    stop_loss = entry * (0.99 if direction == "BUY" else 1.01)
    tp1 = entry * (1.02 if direction == "BUY" else 0.98)
    tp2 = entry * (1.05 if direction == "BUY" else 0.95)

    detected_signals = []
    if indicators["trend"] != "Neutral":
        detected_signals.append(f"Price trending {indicators['trend']}")
    if indicators["rsi14"]:
        if indicators["rsi14"] > 70:
            detected_signals.append("RSI Overbought (>70)")
        elif indicators["rsi14"] < 30:
            detected_signals.append("RSI Oversold (<30)")
    if indicators["macd"] and indicators["macd_signal"]:
        if indicators["macd"] > indicators["macd_signal"]:
            detected_signals.append("Bullish MACD crossover")
        else:
            detected_signals.append("Bearish MACD crossover")
            
    if structure["fvg_detected"]:
        detected_signals.append("Fair Value Gap (FVG) imbalance")
    if structure["order_block_detected"]:
        detected_signals.append("Institutional Order Block respected")
    if structure["liquidity_sweep"]:
        detected_signals.append("Liquidity sweep reversal")

    if not detected_signals:
        detected_signals = ["MA stability breakout", "Consolidation pattern bounce"]

    ai_explanation = f"Technical indicators suggest a {direction} setup based on alignment rules."
    category_scores = {
        "technical": 0.50,
        "fundamental": 0.50,
        "sentiment": 0.50,
        "correlation": 0.50,
        "volume": 0.50,
        "on_chain": 0.50
    }
    macro_context = "Macroeconomic forces are currently neutral. Monitor central bank actions."
    correlation_analysis = "Cross-asset relationships are within normal parameters."

    # Gemini generation integration (new SDK)
    if gemini_client:
        try:
            news_context = ""
            if req.news:
                news_context = "\nRecent News Feed & Market Sentiment Updates:\n"
                for idx, n in enumerate(req.news):
                    news_context += f"{idx+1}. [{n.source}] {n.headline} - {n.summary}\n"

            # Detect asset class and apply corresponding macro & correlation guidance
            symbol_upper = symbol.upper()
            is_crypto = any(c in symbol_upper for c in ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'])
            is_forex = '/' in symbol_upper or any(f in symbol_upper for f in ['EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF'])
            is_index = any(idx in symbol_upper for idx in ['US30', 'NAS100', 'SPX500', 'DAX40', 'FTSE100', 'NIKKEI'])
            is_commodity = any(com in symbol_upper for com in ['XAU', 'XAG', 'WTI', 'BRENT', 'OIL', 'GAS', 'COPPER'])
            
            if is_forex:
                asset_class = "forex"
                asset_guidance = """
                Forex Specifics: Check US Dollar Index (DXY) strength and interest rate path bias.
                Correlations: EURUSD and GBPUSD move inverse to DXY. USDJPY moves positive with US 10-Year bond yields.
                """
            elif is_index:
                asset_class = "indices"
                asset_guidance = """
                Indices Specifics: Check Corporate earnings trends, VIX volatility levels, and NASDAQ tech sector weights.
                Correlations: Positive correlation with general market liquidity and risk-on sentiment, inverse to bond yields.
                """
            elif is_commodity:
                asset_class = "commodities"
                asset_guidance = """
                Commodities Specifics: Gold (XAU/USD) is highly sensitive to real yields, safe-haven flows, and USD trend. Crude Oil (WTI) is driven by inventory changes and OPEC production cues.
                Correlations: Gold moves inverse to USD/yields. Crude Oil is inverse to USDCAD.
                """
            elif is_crypto:
                asset_class = "crypto"
                asset_guidance = """
                Crypto Specifics: Bitcoin (BTC) drives the crypto market. Evaluate on-chain trends like exchange reserves, whale accumulation, and stablecoin inflows.
                Correlations: Highly correlated with NASDAQ (NAS100) and general global liquidity expansions.
                """
            else:
                asset_class = "stocks"
                asset_guidance = """
                Stocks Specifics: Assess sector momentum, earnings results, and interest rate environment.
                """

            session_str = f"Current Market Session Context: {req.session}" if req.session else "Current Market Session Context: Active global session"

            prompt = f"""You are TradeMind AI, a professional trading signal analyst used by retail traders.
Perform an in-depth market analysis for {symbol} on the {timeframe} timeframe.

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
  "direction": "BUY" or "SELL" or "WAIT",
  "confidence": float between 0.50 and 0.98,
  "entry": float,
  "stop_loss": float,
  "tp1": float,
  "tp2": float,
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
                direction = res_json.get("direction", direction)
                confidence = res_json.get("confidence", confidence)
                entry = res_json.get("entry", entry)
                stop_loss = res_json.get("stop_loss", stop_loss)
                tp1 = res_json.get("tp1", tp1)
                tp2 = res_json.get("tp2", tp2)
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
                category_scores = {}
                macro_context = ""
                correlation_analysis = ""
        except Exception as e:
            print(f"[AI-Service] ERROR: Gemini signal generation failed entirely, using heuristic: {str(e)}")
            indicator_verdicts = {}
            market_structure_analysis = ""
            tradingview_idea = ""
            category_scores = {}
            macro_context = ""
            correlation_analysis = ""

    # Deterministic Rule Validation Engine
    # Checks if indicators align with the suggested trade direction
    rule_direction = "WAIT"
    close = current_price
    ema50 = indicators.get("ema50")
    ema200 = indicators.get("ema200")
    rsi = indicators.get("rsi14")
    macd_hist = indicators.get("macd_hist")

    is_bullish_aligned = (
        (ema50 is None or close > ema50) and
        (ema200 is None or close > ema200) and
        (rsi is None or rsi > 45) and
        (macd_hist is None or macd_hist > 0)
    )

    is_bearish_aligned = (
        (ema50 is None or close < ema50) and
        (ema200 is None or close < ema200) and
        (rsi is None or rsi < 55) and
        (macd_hist is None or macd_hist < 0)
    )

    if direction == "BUY" and confidence >= 0.80 and is_bullish_aligned:
        rule_direction = "BUY"
    elif direction == "SELL" and confidence >= 0.80 and is_bearish_aligned:
        rule_direction = "SELL"
    else:
        # Default to WAIT as requested so users can examine the state
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
            
    if 'tradingview_idea' not in dir() or not tradingview_idea:
        tradingview_idea = f"Trade idea for {symbol}: Looking for a potential {rule_direction} setup. Target TP1 at {tp1:.2f} and stop-loss at {stop_loss:.2f}. Invalidation is confirmed below the key support/resistance levels."

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
