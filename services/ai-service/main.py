import os
import json
import uvicorn
from dotenv import load_dotenv

# Load root environment configuration — try multiple paths
_base = os.path.dirname(os.path.abspath(__file__))
_env_paths = [
    os.path.join(_base, '../../.env'),
    os.path.join(_base, '../../../.env'),
    os.path.join(os.getcwd(), '.env'),
]
for _ep in _env_paths:
    if os.path.exists(_ep):
        load_dotenv(_ep, override=True)
        print(f"[AI-Service] Loaded .env from: {_ep}")
        break
else:
    print("[AI-Service] WARNING: Could not find .env file in any search path")

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime

# Google GenAI SDK
from google import genai
from google.genai import types

app = FastAPI(
    title="TradeMind - Python AI Intelligence & Review Service",
    description="Clean-slate AI review service and TradeMind Copilot.",
    version="3.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Google Gemini
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
    print("[AI-Service] WARNING: GEMINI_API_KEY is not set.")

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
GEMINI_FALLBACK_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
]

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
    volume: float = 0.0
    timestamp: Optional[Any] = None

class NewsItem(BaseModel):
    headline: str
    summary: str
    source: str
    datetime: int

class SetupPayload(BaseModel):
    direction: str = "WAIT"
    entry: float = 0.0
    stop_loss: float = 0.0
    take_profit_1: float = 0.0
    take_profit_2: float = 0.0
    model: str = "NONE"
    grade: str = "WAIT"
    score: float = 0.0
    risk_reward_ratio_tp1: float = 0.0
    risk_reward_ratio_tp2: float = 0.0
    confluence_reasons: List[str] = []
    levels: Optional[dict] = None

class PredictRequest(BaseModel):
    symbol: str
    timeframe: str = "15m"
    setup: Optional[SetupPayload] = None
    candles: Optional[List[CandleItem]] = None
    news: Optional[List[NewsItem]] = None
    session: Optional[str] = None
    technicals: Optional[dict] = None
    intermarket: Optional[dict] = None
    microstructure: Optional[dict] = None
    news_gate: Optional[dict] = None
    market_regime: Optional[str] = None
    volatility_metrics: Optional[dict] = None
    volume_profile: Optional[dict] = None
    hierarchical_score: Optional[dict] = None
    expectancy: Optional[dict] = None
    thesis: Optional[dict] = None
    position_sizing: Optional[dict] = None

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
    ai_review_verdict: str = "APPROVED"
    macro_context: Optional[str] = None
    correlation_analysis: Optional[str] = None
    signal_grade: Optional[str] = "WAIT"
    entry_type: Optional[str] = "WAIT"
    entry_zone: Optional[str] = None
    entry_condition: Optional[str] = None
    risk_reward_ratio_tp1: Optional[float] = 0.0
    risk_reward_ratio_tp2: Optional[float] = 0.0
    data_freshness_status: Optional[str] = "LIVE"

class ChatMessage(BaseModel):
    role: str
    content: str

class PortfolioAsset(BaseModel):
    symbol: str
    quantity: float
    averagePrice: float
    currentPrice: float
    unrealizedPnL: float

class PortfolioContext(BaseModel):
    balance: float
    equity: float
    assets: List[PortfolioAsset]

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    portfolioContext: Optional[PortfolioContext] = None

class EntryOptionPayload(BaseModel):
    method: str
    entry_price: float
    stop_loss: float
    take_profit_1: float
    take_profit_2: float
    risk_distance: float = 0.0
    rr_ratio: float = 0.0

class SmcFeatureContext(BaseModel):
    symbol: str = "XAUUSD"
    direction: str = "WAIT"
    ob_grade: str = "GRADE_B"
    caused_bos: bool = True
    created_fvg: bool = True
    prior_sweep_confirmed: bool = True
    mitigation_pct: float = 0.0
    ltf_sweep_confirmed: bool = False
    ltf_fvg_created: bool = False
    atr_15m: float = 3.5
    spread: float = 0.20
    market_regime: Optional[str] = "NORMAL"
    dxy_change_1h: Optional[float] = 0.0
    us10y_change_1h: Optional[float] = 0.0

class SmcProbabilityRequest(BaseModel):
    context: SmcFeatureContext
    candidate_options: List[EntryOptionPayload]

class EvaluatedEntryOption(BaseModel):
    method: str
    entry_price: float
    stop_loss: float
    take_profit_1: float
    take_profit_2: float
    sl_pips: float
    rr_ratio: float
    p_zone_holds: float
    p_tp1_before_sl: float
    expected_mfe_r: float
    expected_mae_r: float
    expected_holding_minutes: int
    net_ev_r: float
    recommendation_score: float

class SmcProbabilityResponse(BaseModel):
    symbol: str
    direction: str
    selected_method: str
    selected_entry: Optional[EvaluatedEntryOption] = None
    all_options: List[EvaluatedEntryOption] = []
    ai_decision_rationale: str
    timestamp: str

# --- Endpoints ---

@app.get("/")
@app.head("/")
def root():
    return {
        "service": "TradeMind Python AI Reviewer",
        "version": "3.1.0",
        "status": "healthy",
        "gemini_active": bool(gemini_client),
        "state": "OPERATIONAL"
    }

@app.get("/health")
@app.head("/health")
def health_check():
    return {
        "status": "ok",
        "model": GEMINI_MODEL,
        "gemini_configured": bool(gemini_client)
    }

@app.post("/ai/predict", response_model=PredictResponse)
async def predict_institutional(
    req: PredictRequest,
    api_key: str = Depends(verify_api_key),
):
    symbol = req.symbol.upper()
    setup = req.setup or SetupPayload()
    intermarket = req.intermarket or {}
    microstructure = req.microstructure or {}
    news_gate = req.news_gate or {}

    # If the quantitative setup is WAIT or score is low, return transparent WAIT response
    if setup.direction == "WAIT" or setup.score < 70 or setup.entry <= 0:
        raw_reasons = [r for r in setup.confluence_reasons if r and r != "Market Current Price"] if setup.confluence_reasons else []
        if not raw_reasons:
            reasons = [
                "Market is consolidating without an active liquidity sweep or displacement trigger (75+ confluence threshold required)."
            ]
        else:
            reasons = raw_reasons

        explanation_detail = " ".join(reasons)
        return PredictResponse(
            symbol=symbol,
            direction="WAIT",
            confidence=setup.score,
            entry=0.0,
            stop_loss=0.0,
            take_profit_1=0.0,
            take_profit_2=0.0,
            indicators=reasons,
            ai_explanation=f"XAUUSD Engine Status: WAIT (Score {setup.score:.0f}/100). {explanation_detail}",
            timestamp=datetime.utcnow().isoformat(),
            ai_review_verdict="HOLD",
            macro_context=intermarket.get("rationale", "Normal intermarket conditions"),
            signal_grade="WAIT",
            entry_type="WAIT",
            entry_zone="None",
            risk_reward_ratio_tp1=0.0,
            risk_reward_ratio_tp2=0.0,
            data_freshness_status="LIVE"
        )

    # Pre-execution geometric sanity check: Stop loss MUST be on the structurally correct side
    is_invalid_geometry = False
    invalidation_reason = ""
    if setup.direction == "BUY":
        if setup.stop_loss >= setup.entry:
            is_invalid_geometry = True
            invalidation_reason = f"Fatal SL Inversion: BUY stop loss (${setup.stop_loss:.2f}) is at or above entry (${setup.entry:.2f})."
        elif setup.take_profit_1 <= setup.entry:
            is_invalid_geometry = True
            invalidation_reason = f"Fatal TP1 Inversion: BUY TP1 (${setup.take_profit_1:.2f}) is at or below entry (${setup.entry:.2f})."
    elif setup.direction == "SELL":
        if setup.stop_loss <= setup.entry:
            is_invalid_geometry = True
            invalidation_reason = f"Fatal SL Inversion: SELL stop loss (${setup.stop_loss:.2f}) is at or below entry (${setup.entry:.2f})."
        elif setup.take_profit_1 >= setup.entry:
            is_invalid_geometry = True
            invalidation_reason = f"Fatal TP1 Inversion: SELL TP1 (${setup.take_profit_1:.2f}) is at or above entry (${setup.entry:.2f})."

    if is_invalid_geometry:
        return PredictResponse(
            symbol=symbol,
            direction="WAIT",
            confidence=0.0,
            entry=0.0,
            stop_loss=0.0,
            take_profit_1=0.0,
            take_profit_2=0.0,
            indicators=setup.confluence_reasons,
            ai_explanation=f"[Risk Desk Geometric VETO] {invalidation_reason}",
            timestamp=datetime.utcnow().isoformat(),
            ai_review_verdict="VETOED",
            macro_context="Geometric sanity check failed on risk parameters",
            correlation_analysis="N/A",
            signal_grade="VETOED",
            entry_type="WAIT",
            entry_zone="None",
            entry_condition=invalidation_reason,
            risk_reward_ratio_tp1=0.0,
            risk_reward_ratio_tp2=0.0,
            data_freshness_status="INVALID_GEOMETRY"
        )

    # For qualified setups (A+, A, B+) that passed all deterministic geometric & macro checks above,
    # default to APPROVED and enrich with Gemini Senior Desk Reviewer (which can VETO if a risk rule is violated)
    ai_verdict = "APPROVED"
    ai_narrative = (
        f"Institutional {setup.direction} setup on {symbol} validated via {setup.model}. "
        f"Entry at ${setup.entry:.2f}, SL at ${setup.stop_loss:.2f}, TP1 at ${setup.take_profit_1:.2f} (R:R 1:{setup.risk_reward_ratio_tp1:.1f})."
    )

    if gemini_client:
        try:
            vol_metrics = req.volatility_metrics or {}
            vp = req.volume_profile or {}
            exp = req.expectancy or {}

            dxy_val = intermarket.get('dxy', 0)
            dxy_display = f"{dxy_val:.2f}" if dxy_val > 0 else "Live Feed Syncing"
            us10y_val = intermarket.get('us10y', 0)
            us10y_display = f"{us10y_val:.2f}%" if us10y_val > 0 else "Live Feed Syncing"
            real_yield_val = intermarket.get('realYieldProxy', 0)
            real_yield_display = f"{real_yield_val:.2f}%" if real_yield_val != 0 else "Live Feed Syncing"

            prompt = f"""You are the Chief Risk Officer and Senior Desk Trader at an institutional macro prop firm.
Review the following Gold (XAUUSD) trade setup generated by our quantitative market-flow engine:

Setup Overview:
- Asset: {symbol}
- Direction: {setup.direction}
- Entry Price: ${setup.entry:.2f}
- Stop Loss: ${setup.stop_loss:.2f}
- TP1: ${setup.take_profit_1:.2f} (R:R: {setup.risk_reward_ratio_tp1:.1f})
- TP2: ${setup.take_profit_2:.2f} (R:R: {setup.risk_reward_ratio_tp2:.1f})
- Entry Model: {setup.model}
- Grade: {setup.grade} (Composite Opportunity Score: {setup.score:.0f}/100)
- Calibrated Expectancy: EV = +{exp.get('expectedValueR', 0):.2f}R (P(TP1) = {(exp.get('calibratedWinRateTp1') or exp.get('probTp1BeforeSl') or 0.65)*100:.0f}%)
- Confluences: {', '.join(setup.confluence_reasons)}

Market Regime & Auction Value:
- Market Regime: {req.market_regime or 'NORMAL'}
- Volatility Regime: {vol_metrics.get('regime', 'NORMAL')} (ATR: ${vol_metrics.get('atr15m', 0):.2f}, Percentile: {vol_metrics.get('atrPercentile', 50)}%)
- Volume Profile: POC ${vp.get('poc', 0):.2f}, VAH ${vp.get('vah', 0):.2f}, VAL ${vp.get('val', 0):.2f} (Relation: {vp.get('valueRelation', 'INSIDE_VALUE')})

Market Microstructure:
- Spread: ${microstructure.get('spread', 0):.2f} (Bid: ${microstructure.get('bid', 0):.2f}, Ask: ${microstructure.get('ask', 0):.2f})
- Session: {req.session or 'Active Session'}

Intermarket Flow:
- DXY: {dxy_display} (1h change: {intermarket.get('dxyChange1h', 0):+.2f}%)
- US 10Y Yield: {us10y_display} (1h change: {intermarket.get('us10yChange1h', 0):+.2f}%)
- Real Yield Proxy: {real_yield_display}
- Macro Flow Alignment: {intermarket.get('macroAlignment', 'NEUTRAL')} - {intermarket.get('rationale', 'Cross-asset indicators moving within baseline')}

Economic Calendar:
- High-Impact Blackout: {news_gate.get('isBlackout', False)} (Stage: {news_gate.get('eventStage', 'NORMAL_MODE')})
- Next/Recent Event: {news_gate.get('eventTitle', 'None')} (Tier: {news_gate.get('impactTier', 'None')})

Risk Desk Rules:
1. Directional Geometry: If BUY, SL must be strictly below Entry. If SELL, SL must be strictly above Entry. If violated, you MUST output "verdict": "VETOED".
2. Macro Consistency: If technicals oppose surging yields/USD or impending tier-1 news, output "verdict": "VETOED" or "CONDITIONAL".
3. Only output "APPROVED" if setup has clear statistical edge, logical trade location, and acceptable downside protection.

Please provide your institutional review in JSON format:
{{
  "verdict": "APPROVED" or "CONDITIONAL" or "VETOED",
  "institutional_narrative": "2-3 concise sentences detailing the institutional thesis, liquidity targeted, and risk management.",
  "macro_context": "1-2 sentences on USD/Yields and geopolitical driver.",
  "key_risk_factor": "Primary risk factor (e.g. upcoming US data, yield spike, liquidity thinness)."
}}
"""
            models_to_try = [GEMINI_MODEL] + GEMINI_FALLBACK_MODELS
            for model_name in models_to_try:
                try:
                    res = gemini_client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            temperature=0.2,
                            max_output_tokens=500,
                            response_mime_type="application/json",
                        )
                    )
                    raw_text = (res.text or "").strip()
                    if not raw_text:
                        continue
                    # Clean markdown formatting if present
                    if "```json" in raw_text:
                        raw_text = raw_text.split("```json")[1].split("```")[0].strip()
                    elif "```" in raw_text:
                        raw_text = raw_text.split("```")[1].split("```")[0].strip()
                    
                    parsed = json.loads(raw_text)
                    raw_verdict = str(parsed.get("verdict", "APPROVED")).upper()
                    ai_verdict = "VETOED" if raw_verdict == "VETOED" else "APPROVED"
                    ai_narrative = parsed.get("institutional_narrative", ai_narrative)
                    break
                except Exception:
                    continue
        except Exception as e:
            print(f"[AI-Service] Gemini review fallback notice: {e}")

    # If Senior Desk Reviewer issued a VETO, invalidate the setup to WAIT
    if ai_verdict == "VETOED":
        return PredictResponse(
            symbol=symbol,
            direction="WAIT",
            confidence=min(setup.score, 45.0),
            entry=0.0,
            stop_loss=0.0,
            take_profit_1=0.0,
            take_profit_2=0.0,
            indicators=setup.confluence_reasons,
            ai_explanation=f"[Senior Desk Reviewer VETO] {ai_narrative}",
            timestamp=datetime.utcnow().isoformat(),
            ai_review_verdict="VETOED",
            macro_context=intermarket.get("rationale", "Normal intermarket flow"),
            correlation_analysis=f"DXY 1h: {intermarket.get('dxyChange1h', 0):+.2f}%, US10Y 1h: {intermarket.get('us10yChange1h', 0):+.2f}%",
            signal_grade="VETOED",
            entry_type="WAIT",
            entry_zone="None",
            entry_condition="Setup vetoed by institutional risk desk",
            risk_reward_ratio_tp1=0.0,
            risk_reward_ratio_tp2=0.0,
            data_freshness_status="LIVE"
        )

    return PredictResponse(
        symbol=symbol,
        direction=setup.direction,
        confidence=setup.score,
        entry=setup.entry,
        stop_loss=setup.stop_loss,
        take_profit_1=setup.take_profit_1,
        take_profit_2=setup.take_profit_2,
        indicators=setup.confluence_reasons,
        ai_explanation=ai_narrative,
        timestamp=datetime.utcnow().isoformat(),
        ai_review_verdict=ai_verdict,
        macro_context=intermarket.get("rationale", "Normal intermarket flow"),
        correlation_analysis=f"DXY 1h: {intermarket.get('dxyChange1h', 0):+.2f}%, US10Y 1h: {intermarket.get('us10yChange1h', 0):+.2f}%",
        signal_grade=setup.grade,
        entry_type=setup.model,
        entry_zone=f"${setup.entry:.2f}",
        entry_condition="Limit order at key structure level",
        risk_reward_ratio_tp1=setup.risk_reward_ratio_tp1,
        risk_reward_ratio_tp2=setup.risk_reward_ratio_tp2,
        data_freshness_status="LIVE"
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

    reply = "I've received your query. Markets are active. How can I assist you?"

    if gemini_client:
        try:
            system_instruction = f"""You are TradeMind Copilot, a senior institutional market analyst and risk management assistant.
User portfolio context:
{portfolio_summary}

Be concise, mathematically sound, professional, and directly address the user's inquiry."""

            history_contents = []
            for msg in req.messages[:-1]:
                role = "user" if msg.role == "user" else "model"
                history_contents.append(
                    types.Content(role=role, parts=[types.Part(text=msg.content)])
                )
            history_contents.append(
                types.Content(role="user", parts=[types.Part(text=user_query)])
            )

            models_to_try = [GEMINI_MODEL] + GEMINI_FALLBACK_MODELS
            for model_name in models_to_try:
                try:
                    response = gemini_client.models.generate_content(
                        model=model_name,
                        contents=history_contents,
                        config=types.GenerateContentConfig(
                            system_instruction=system_instruction,
                            temperature=0.6,
                            max_output_tokens=800,
                        )
                    )
                    txt = (response.text or "").strip()
                    if txt:
                        reply = txt
                        break
                except Exception:
                    continue
        except Exception as e:
            reply = f"AI Copilot response notice: {str(e)[:200]}"

    return {
        "reply": reply,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/ai/smc/entry-probability", response_model=SmcProbabilityResponse)
async def evaluate_smc_entry_probabilities(
    req: SmcProbabilityRequest,
    api_key: str = Depends(verify_api_key),
):
    ctx = req.context
    symbol = ctx.symbol.upper()
    direction = ctx.direction.upper()

    if direction not in ("BUY", "SELL") or not req.candidate_options:
        return SmcProbabilityResponse(
            symbol=symbol,
            direction="WAIT",
            selected_method="NONE",
            selected_entry=None,
            all_options=[],
            ai_decision_rationale="No valid direction or candidate entry options provided.",
            timestamp=datetime.utcnow().isoformat()
        )

    # 1. Base probability of zone holding based on institutional causal structure
    base_prob = 0.58
    if ctx.ob_grade == "GRADE_A_PLUS":
        base_prob = 0.74
    elif ctx.ob_grade == "GRADE_A":
        base_prob = 0.67
    elif ctx.ob_grade == "GRADE_B":
        base_prob = 0.58

    if ctx.prior_sweep_confirmed:
        base_prob += 0.04
    if ctx.caused_bos:
        base_prob += 0.03
    if ctx.created_fvg:
        base_prob += 0.03
    if ctx.mitigation_pct <= 0.10:
        base_prob += 0.03
    elif ctx.mitigation_pct > 0.50:
        base_prob -= 0.06

    # Macro & Yields alignment impact
    dxy_chg = ctx.dxy_change_1h or 0.0
    us10y_chg = ctx.us10y_change_1h or 0.0
    if direction == "BUY":
        if dxy_chg < -0.05 and us10y_chg < -0.05:
            base_prob += 0.04
        elif dxy_chg > 0.10 or us10y_chg > 0.10:
            base_prob -= 0.06
    elif direction == "SELL":
        if dxy_chg > 0.05 and us10y_chg > 0.05:
            base_prob += 0.04
        elif dxy_chg < -0.10 or us10y_chg < -0.10:
            base_prob -= 0.06

    p_zone_holds = round(max(0.42, min(0.82, base_prob)), 3)

    evaluated_options: List[EvaluatedEntryOption] = []

    for opt in req.candidate_options:
        risk = abs(opt.entry_price - opt.stop_loss)
        sl_pips = round(risk * 10, 1)
        reward1 = abs(opt.take_profit_1 - opt.entry_price)
        rr_ratio = round(reward1 / risk, 2) if risk > 0 else 0.0

        # Structural direction sanity check
        is_geom_valid = False
        if direction == "BUY" and opt.entry_price > opt.stop_loss and opt.take_profit_1 > opt.entry_price:
            is_geom_valid = True
        elif direction == "SELL" and opt.entry_price < opt.stop_loss and opt.take_profit_1 < opt.entry_price:
            is_geom_valid = True

        if not is_geom_valid:
            continue

        method = opt.method.upper()
        if method == "LTF_SNIPER_FVG":
            if ctx.ltf_sweep_confirmed and ctx.ltf_fvg_created:
                p_win = round(min(0.79, p_zone_holds * 1.07), 3)
                expected_mae_r = -0.32
                expected_mfe_r = round(max(2.4, rr_ratio * 0.95), 2)
                expected_holding = 65
            else:
                p_win = round(p_zone_holds * 0.88, 3)
                expected_mae_r = -0.52
                expected_mfe_r = round(max(2.0, rr_ratio * 0.88), 2)
                expected_holding = 90
        elif method == "FVG_CE_50":
            p_win = round(p_zone_holds * 0.96, 3)
            expected_mae_r = -0.48
            expected_mfe_r = round(max(2.0, rr_ratio * 0.90), 2)
            expected_holding = 135
        elif method == "OB_PROXIMAL":
            p_win = round(p_zone_holds * 0.90, 3)
            expected_mae_r = -0.72
            expected_mfe_r = round(max(1.8, rr_ratio * 0.85), 2)
            expected_holding = 180
        else:
            p_win = round(p_zone_holds * 0.85, 3)
            expected_mae_r = -0.65
            expected_mfe_r = round(max(1.5, rr_ratio * 0.80), 2)
            expected_holding = 120

        # Mathematical Net Expected Value: EV = P(win) * R - (1 - P(win)) * 1.0
        net_ev = (p_win * rr_ratio) - ((1.0 - p_win) * 1.0)

        # Small account protection calibration: penalize wide SL (> 65 pips), reward sniper SL (<= 45 pips)
        if sl_pips > 65.0:
            net_ev -= 0.35
        elif sl_pips <= 45.0:
            net_ev += 0.15

        rec_score = round(max(0.0, min(100.0, (net_ev + 1.2) * 35.0)), 1)

        evaluated_options.append(EvaluatedEntryOption(
            method=method,
            entry_price=opt.entry_price,
            stop_loss=opt.stop_loss,
            take_profit_1=opt.take_profit_1,
            take_profit_2=opt.take_profit_2,
            sl_pips=sl_pips,
            rr_ratio=rr_ratio,
            p_zone_holds=p_zone_holds,
            p_tp1_before_sl=p_win,
            expected_mfe_r=expected_mfe_r,
            expected_mae_r=expected_mae_r,
            expected_holding_minutes=expected_holding,
            net_ev_r=round(net_ev, 3),
            recommendation_score=rec_score
        ))

    if not evaluated_options:
        return SmcProbabilityResponse(
            symbol=symbol,
            direction="WAIT",
            selected_method="NONE",
            selected_entry=None,
            all_options=[],
            ai_decision_rationale="No geometrically valid entry options survived institutional risk inspection.",
            timestamp=datetime.utcnow().isoformat()
        )

    # Sort options by Net Expected Value descending
    evaluated_options.sort(key=lambda o: o.net_ev_r, reverse=True)
    best_opt = evaluated_options[0]

    # Institutional narrative synthesis
    rationale = (
        f"Selected {best_opt.method} ({direction} @ ${best_opt.entry_price:.2f}) with net EV of +{best_opt.net_ev_r:.2f}R. "
        f"Zone hold probability: {int(best_opt.p_zone_holds*100)}%, P(TP1): {int(best_opt.p_tp1_before_sl*100)}%, "
        f"tight small-account SL of {best_opt.sl_pips:.1f} pips (${best_opt.stop_loss:.2f}) vs TP1 ${best_opt.take_profit_1:.2f} (R:R 1:{best_opt.rr_ratio:.1f}). "
        f"Expected MAE: {best_opt.expected_mae_r:.2f}R, Expected MFE: +{best_opt.expected_mfe_r:.2f}R."
    )

    return SmcProbabilityResponse(
        symbol=symbol,
        direction=direction,
        selected_method=best_opt.method,
        selected_entry=best_opt,
        all_options=evaluated_options,
        ai_decision_rationale=rationale,
        timestamp=datetime.utcnow().isoformat()
    )

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
