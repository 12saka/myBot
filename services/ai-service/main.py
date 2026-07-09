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

class PredictRequest(BaseModel):
    symbol: str
    timeframe: str = "1h"
    candles: Optional[List[CandleItem]] = None

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
            "sma20": None, "ema50": None, "rsi14": None, 
            "macd": None, "signal": None, "trend": "Neutral"
        }
    
    df = pd.DataFrame([c.dict() for c in candles])
    df['close'] = df['close'].astype(float)
    
    # 1. SMA 20
    df['sma20'] = df['close'].rolling(window=20).mean()
    
    # 2. EMA 50
    df['ema50'] = df['close'].ewm(span=50, adjust=False).mean()
    
    # 3. RSI 14
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / (loss + 1e-9)
    df['rsi14'] = 100 - (100 / (1 + rs))
    
    # 4. MACD
    ema12 = df['close'].ewm(span=12, adjust=False).mean()
    ema26 = df['close'].ewm(span=26, adjust=False).mean()
    df['macd'] = ema12 - ema26
    df['macd_signal'] = df['macd'].ewm(span=9, adjust=False).mean()

    last_row = df.iloc[-1]
    
    trend = "Neutral"
    if last_row['close'] > last_row['sma20'] and last_row['close'] > last_row['ema50']:
        trend = "Bullish"
    elif last_row['close'] < last_row['sma20'] and last_row['close'] < last_row['ema50']:
        trend = "Bearish"

    return {
        "sma20": float(last_row['sma20']) if not pd.isna(last_row['sma20']) else None,
        "ema50": float(last_row['ema50']) if not pd.isna(last_row['ema50']) else None,
        "rsi14": float(last_row['rsi14']) if not pd.isna(last_row['rsi14']) else None,
        "macd": float(last_row['macd']) if not pd.isna(last_row['macd']) else None,
        "macd_signal": float(last_row['macd_signal']) if not pd.isna(last_row['macd_signal']) else None,
        "trend": trend
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
    indicators = calculate_technical_indicators(req.candles or [])
    
    # Base fallback values
    direction = "BUY"
    confidence = 0.82
    current_price = req.candles[-1].close if req.candles else 64200.0
    
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
            detected_signals.append("Bearish MACD signal line crossover")
        else:
            detected_signals.append("Bullish MACD signal line crossover")

    if not detected_signals:
        detected_signals = ["MA stability breakout", "Consolidation pattern bounce"]

    ai_explanation = f"Heuristic signals model triggered a {direction} position based on MA alignments."

    # Gemini generation integration (new SDK)
    if gemini_client:
        try:
            prompt = f"""You are TradeMind AI signal generator.
Perform a professional market signal analysis for asset: {symbol}.

Recent technical indicators:
- Current Price: {current_price}
- Trend: {indicators['trend']}
- RSI (14): {indicators['rsi14']}
- MACD Value: {indicators['macd']}, MACD Signal Line: {indicators['macd_signal']}

Output ONLY a valid JSON object with exactly this structure (no markdown, no extra text):
{{
  "direction": "BUY" or "SELL",
  "confidence": float between 0.5 and 0.98,
  "entry": float entry price,
  "stop_loss": float stop loss,
  "tp1": float target 1,
  "tp2": float target 2,
  "explanation": "2-3 sentences summarizing the technical reasons and support thresholds"
}}"""
            
            response = gemini_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )
            clean_text = response.text.replace("```json", "").replace("```", "").strip()
            res_json = json.loads(clean_text)
            
            direction = res_json.get("direction", direction)
            confidence = res_json.get("confidence", confidence)
            entry = res_json.get("entry", entry)
            stop_loss = res_json.get("stop_loss", stop_loss)
            tp1 = res_json.get("tp1", tp1)
            tp2 = res_json.get("tp2", tp2)
            ai_explanation = res_json.get("explanation", ai_explanation)
        except Exception as e:
            print(f"[AI-Service] ERROR: Gemini signal generation failed, using heuristic: {str(e)}")

    return PredictResponse(
        symbol=symbol,
        direction=direction,
        confidence=confidence,
        entry=float(entry),
        stop_loss=float(stop_loss),
        take_profit_1=float(tp1),
        take_profit_2=float(tp2),
        indicators=detected_signals,
        ai_explanation=ai_explanation,
        timestamp=datetime.utcnow().isoformat()
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
    if "btc" in user_query.lower() or "bitcoin" in user_query.lower():
        reply = "Bitcoin is consolidating near moving averages. Target entries are solid at $64,200 support levels."
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

            response = gemini_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=history_contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.7,
                    max_output_tokens=1024,
                )
            )
            reply = response.text.strip()
            print(f"[AI-Service] Gemini replied successfully to: '{user_query[:60]}...'")
        except Exception as e:
            import traceback
            print(f"[AI-Service] ERROR: Gemini Chat generation failed:\n{traceback.format_exc()}")

    return {
        "reply": reply,
        "timestamp": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
