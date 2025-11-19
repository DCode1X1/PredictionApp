# main.py
import time
import random
import json
import logging
from typing import List, Dict, Any

import pandas as pd
import yfinance as yf
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import asyncio, random, time

# --- App / CORS / Logging ---
app = FastAPI(title="Trading App Backend - Safe & Fixed")

# Adjust allow_origins for production to specific origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("trading-backend")


# --- Utilities ---
def to_serializable(data: Any) -> Any:
    """Ensure JSON serializability (for numpy/pandas/timestamps)."""
    try:
        return json.loads(json.dumps(data, default=str))
    except Exception:
        return str(data)


def compute_slope_trend(predictions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Return slope-based trend string and numeric slope using list of dicts with 'yhat'."""
    if not predictions or len(predictions) < 2:
        return {"trend": "N/A", "slope": 0.0}
    try:
        y = [float(p.get("yhat", 0.0)) for p in predictions]
    except Exception:
        return {"trend": "N/A", "slope": 0.0}

    x = list(range(len(y)))
    n = len(y)
    sumX = sum(x)
    sumY = sum(y)
    sumXY = sum(x[i] * y[i] for i in range(n))
    sumX2 = sum(xi * xi for xi in x)
    denom = (n * sumX2 - sumX * sumX) or 1e-8
    slope = (n * sumXY - sumX * sumY) / denom

    if slope > 0.5:
        trend = "STRONG UP"
    elif slope > 0.1:
        trend = "UP"
    elif slope < -0.5:
        trend = "STRONG DOWN"
    elif slope < -0.1:
        trend = "DOWN"
    else:
        trend = "FLAT"

    return {"trend": trend, "slope": float(slope)}


# --- Dummy model placeholders (replace with real model calls) ---
def ensemble_predict(symbol: str):
    return {"predictions": [{"yhat": 100}, {"yhat": 101}, {"yhat": 103}], "confidence": 75.0}


def prophet_predict(symbol: str):
    return {"predictions": [{"yhat": 100}, {"yhat": 99}, {"yhat": 98}], "confidence": 72.5}


def xgboost_predict(symbol: str):
    return {"predictions": [{"yhat": 100}, {"yhat": 101}, {"yhat": 100.5}], "confidence": 70.2}


def lstm_predict(symbol: str):
    return {"predictions": [{"yhat": 100}, {"yhat": 101.5}, {"yhat": 102}], "confidence": 68.4}


# --- Historical data endpoint ---
@app.get("/api/historical")
def get_historical(symbol: str = "BTC-USD", hours: int = 24):
    try:
        if hours <= 0:
            return JSONResponse({"error": "hours must be > 0"}, status_code=400)

        period = "1d" if hours <= 24 else f"{(hours // 24) + 1}d"
        df = yf.download(symbol, period=period, interval="1m", progress=False)

        if df is None or df.empty:
            logger.warning("yfinance returned no data, generating fallback synthetic candles")
            now = int(time.time() * 1000)
            candles = []
            price = 67000.0
            total_minutes = hours * 60
            for i in range(total_minutes):
                ts = now - (total_minutes - i) * 60 * 1000
                open_ = price
                close = open_ + random.uniform(-100, 100)
                high = max(open_, close) + random.uniform(0, 50)
                low = min(open_, close) - random.uniform(0, 50)
                price = close
                candles.append({
                    "ts": int(ts),
                    "open": round(open_, 2),
                    "high": round(high, 2),
                    "low": round(low, 2),
                    "close": round(close, 2),
                    "volume": round(random.random() * 5, 4)
                })
            return JSONResponse(candles)

        if not isinstance(df.index, pd.DatetimeIndex):
            df = df.reset_index().set_index(df.columns[0])
        df = df.tz_localize(None) if df.index.tzinfo is not None else df
        needed = hours * 60
        if len(df) > needed:
            df = df.tail(needed)

        candles = []
        for idx, row in df.iterrows():
            ts = int(pd.Timestamp(idx).timestamp() * 1000)
            candles.append({
                "ts": ts,
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"]),
                "volume": float(row.get("Volume", 0.0)),
            })
        return JSONResponse(candles)
    except Exception as e:
        logger.exception("Failed to get historical data")
        return JSONResponse({"error": str(e)}, status_code=500)


# --- WebSocket realtime feed ---
@app.websocket("/realtime")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket client connected")
    try:
        price = 67000.0
        while True:
            price += random.uniform(-50, 50)
            tick = {"ts": int(time.time() * 1000), "price": round(price, 2)}
            await websocket.send_json(tick)
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception:
        logger.exception("WebSocket error")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


# --- Strategy implementations ---
def ai_momentum_strategy_backend(symbol: str):
    """Momentum-based AI strategy combining ensemble model + EMA."""
    try:
        ensemble = ensemble_predict(symbol)
        df = yf.download(symbol, period="7d", interval="1h", progress=False)
        if df is None or df.empty:
            return {"error": "No price data for momentum strategy"}

        if not isinstance(df.index, pd.DatetimeIndex):
            df = df.reset_index().set_index(df.columns[0])

        closes = df["Close"].astype(float)
        ema20 = closes.ewm(span=20, adjust=False).mean().iloc[-1]
        last_price = float(closes.iloc[-1])

        trend_info = compute_slope_trend(ensemble.get("predictions", []))
        direction = trend_info["trend"]
        confidence = float(ensemble.get("confidence", 50.0))
        min_conf = 60.0

        if direction.startswith("UP") and last_price > float(ema20) and confidence >= min_conf:
            signal = "BUY"
        elif direction.startswith("DOWN") and last_price < float(ema20) and confidence >= min_conf:
            signal = "SELL"
        else:
            signal = "HOLD"

        return to_serializable({
            "strategy": "ai_momentum",
            "symbol": symbol,
            "signal": signal,
            "direction": direction,
            "slope": trend_info["slope"],
            "confidence": confidence,
            "ema20": float(ema20),
            "last_price": last_price,
            "model_used": "ensemble"
        })
    except Exception as e:
        logger.exception("Momentum strategy failed")
        return {"error": f"Momentum strategy failed: {str(e)}"}


def ai_volatility_breakout_backend(symbol: str, window: int = 14):
    """Volatility breakout strategy using Prophet model + recent highs/lows."""
    try:
        prophet = prophet_predict(symbol)
        df = yf.download(symbol, period=f"{max(14, window)+2}d", interval="1h", progress=False)
        if df is None or df.empty:
            return {"error": "No price data for breakout strategy"}

        if not isinstance(df.index, pd.DatetimeIndex):
            df = df.reset_index().set_index(df.columns[0])

        # ensure enough rows
        if len(df) < window + 2:
            return {"error": "Not enough data for breakout calculation"}

        recent_high = float(df["High"].rolling(window).max().iloc[-2])
        recent_low = float(df["Low"].rolling(window).min().iloc[-2])
        last_price = float(df["Close"].iloc[-1])

        trend_info = compute_slope_trend(prophet.get("predictions", []))
        direction = trend_info["trend"]
        confidence = float(prophet.get("confidence", 50.0))
        min_conf = 70.0

        if direction.startswith("UP") and last_price > recent_high and confidence >= min_conf:
            signal = "BUY"
        elif direction.startswith("DOWN") and last_price < recent_low and confidence >= min_conf:
            signal = "SELL"
        else:
            signal = "HOLD"

        return to_serializable({
            "strategy": "ai_volatility_breakout",
            "symbol": symbol,
            "signal": signal,
            "direction": direction,
            "slope": trend_info["slope"],
            "confidence": confidence,
            "recent_high": recent_high,
            "recent_low": recent_low,
            "last_price": last_price,
            "model_used": "prophet",
            "window": window
        })
    except Exception as e:
        logger.exception("Volatility breakout failed")
        return {"error": f"Volatility breakout failed: {str(e)}"}


def ensemble_confirmation_backend(symbol: str):
    """Ask all models and require 3/4 agreement on direction."""
    try:
        models = ["prophet", "xgboost", "lstm", "ensemble"]
        results = []
        for m in models:
            r = {
                "prophet": prophet_predict,
                "xgboost": xgboost_predict,
                "lstm": lstm_predict,
                "ensemble": ensemble_predict
            }[m](symbol)
            trend = compute_slope_trend(r.get("predictions", []))["trend"]
            results.append({"model": m, "trend": trend, "confidence": float(r.get("confidence", 0.0))})

        ups = sum(1 for r in results if "UP" in r["trend"])
        downs = sum(1 for r in results if "DOWN" in r["trend"])

        if ups >= 3:
            signal = "BUY"
        elif downs >= 3:
            signal = "SELL"
        else:
            signal = "HOLD"

        avg_conf = float(sum(r["confidence"] for r in results) / max(len(results), 1))

        return to_serializable({
            "strategy": "ensemble_confirmation",
            "symbol": symbol,
            "signal": signal,
            "avg_confidence": round(avg_conf, 2),
            "model_results": results
        })
    except Exception as e:
        logger.exception("Ensemble confirmation failed")
        return {"error": f"Ensemble confirmation failed: {str(e)}"}


# --- Strategy route ---
@app.get("/strategy/{name}")
def run_strategy(name: str, symbol: str = "BTC-USD", window: int = 14):
    try:
        if name == "momentum":
            return ai_momentum_strategy_backend(symbol)
        elif name == "breakout":
            return ai_volatility_breakout_backend(symbol, window=window)
        elif name == "ensemble_confirm":
            return ensemble_confirmation_backend(symbol)
        else:
            return JSONResponse({"error": "Unknown strategy. Valid: momentum, breakout, ensemble_confirm"}, status_code=404)
    except Exception as e:
        logger.exception("Strategy route error")
        return JSONResponse({"error": f"Strategy failed: {str(e)}"}, status_code=500)


# --- Predict endpoints for frontend compatibility ---
@app.get("/predict/prophet")
def predict_prophet(symbol: str = "BTC-USD"):
    try:
        return JSONResponse(prophet_predict(symbol))
    except Exception as e:
        logger.exception("Prophet predict failed")
        return JSONResponse({"error": f"Prophet model failed: {str(e)}"}, status_code=500)


@app.get("/predict/xgboost")
def predict_xgboost(symbol: str = "BTC-USD"):
    try:
        return JSONResponse(xgboost_predict(symbol))
    except Exception as e:
        logger.exception("XGBoost predict failed")
        return JSONResponse({"error": f"XGBoost model failed: {str(e)}"}, status_code=500)


@app.get("/predict/lstm")
def predict_lstm(symbol: str = "BTC-USD"):
    try:
        return JSONResponse(lstm_predict(symbol))
    except Exception as e:
        logger.exception("LSTM predict failed")
        return JSONResponse({"error": f"LSTM model failed: {str(e)}"}, status_code=500)


@app.get("/predict/ensemble")
def predict_ensemble(symbol: str = "BTC-USD"):
    try:
        return JSONResponse(ensemble_predict(symbol))
    except Exception as e:
        logger.exception("Ensemble predict failed")
        return JSONResponse({"error": f"Ensemble model failed: {str(e)}"}, status_code=500)


# Optional: run with `python main.py` for quick local dev (uvicorn recommended)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
