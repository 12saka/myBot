import os
import uvicorn
from fastapi import FastAPI, HTTPException, Depends, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta

app = FastAPI(
    title="TradeMind AI - Python Intelligence Service",
    description="Ensemble AI signal generation, sentiment analysis, and strategy execution models.",
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

API_KEY_NAME = "X-AI-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

def verify_api_key(api_key: str = Depends(api_key_header)):
    expected_key = os.getenv("AI_SERVICE_API_KEY", "internal-secret-key")
    if not api_key or api_key != expected_key:
        raise HTTPException(status_code=403, detail="Could not validate credentials")
    return api_key

class PredictRequest(BaseModel):
    symbol: str
    timeframe: str = "4h"

class PredictResponse(BaseModel):
    symbol: str
    direction: str
    confidence: float
    entry: float
    stop_loss: float
    take_profit_1: float
    take_profit_2: float
    indicators: List[str]
    timestamp: str

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

@app.get("/health")
def health_check():
    return {
        "status": "UP",
        "service": "ai-service",
        "version": "2.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/ai/predict", response_model=PredictResponse)
def get_prediction(req: PredictRequest, api_key: str = Depends(verify_api_key)):
    symbol = req.symbol.upper()
    # Mocking neural ensemble logic
    if "BTC" in symbol:
        return PredictResponse(
            symbol=symbol,
            direction="BUY",
            confidence=0.91,
            entry=64200.0,
            stop_loss=63500.0,
            take_profit_1=66000.0,
            take_profit_2=68500.0,
            indicators=["EMA-200 breakout", "RSI divergence", "Bullish volume surge"],
            timestamp=datetime.utcnow().isoformat()
        )
    elif "ETH" in symbol:
        return PredictResponse(
            symbol=symbol,
            direction="SELL",
            confidence=0.78,
            entry=3250.0,
            stop_loss=3320.0,
            take_profit_1=3120.0,
            take_profit_2=2980.0,
            indicators=["RSI Overbought on Daily", "MACD bearish cross"],
            timestamp=datetime.utcnow().isoformat()
        )
    else:
        return PredictResponse(
            symbol=symbol,
            direction="BUY",
            confidence=0.84,
            entry=1.0850,
            stop_loss=1.0810,
            take_profit_1=1.0920,
            take_profit_2=1.0970,
            indicators=["Order Block bounce", "Double Bottom 1H"],
            timestamp=datetime.utcnow().isoformat()
        )

@app.post("/ai/chat")
def chat_copilot(req: ChatRequest, api_key: str = Depends(verify_api_key)):
    # Simulates AI Copilot backend response
    user_query = req.messages[-1].content.lower() if req.messages else ""
    
    if "btc" in user_query or "bitcoin" in user_query:
        reply = "BTC is showing strong bullish momentum above the EMA-200. I recommend looking at a BUY signal around the $64,200 support line."
    elif "risk" in user_query or "portfolio" in user_query:
        reply = "Your portfolio risk is low, but you are 68% weighted in cryptocurrency. I suggest diversifying into stock assets like NVIDIA or Apple."
    else:
        reply = f"I've received your request. Market sentiment is 84% bullish today. Let me know if you would like me to analyze a specific pair."
        
    return {
        "reply": reply,
        "timestamp": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
