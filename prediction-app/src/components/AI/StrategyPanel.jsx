import React, { useEffect, useState, useRef } from "react";

export default function StrategyPanel() {
  const [symbol, setSymbol] = useState("BTC-USD");
  const [strategy, setStrategy] = useState("momentum");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const prevSignal = useRef(null);
  const [toast, setToast] = useState(null);

  const symbols = ["BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD"];
  const strategies = [
    { value: "momentum", label: "AI + Momentum" },
    { value: "breakout", label: "AI + Volatility Breakout" },
    { value: "ensemble_confirm", label: "Ensemble Confirmation" },
  ];

  const fetchStrategy = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://127.0.0.1:5000/strategy/${strategy}?symbol=${symbol}`);
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error || "Invalid response");
      setResult(json);

      // Alert if signal changed
      if (prevSignal.current && prevSignal.current !== json.signal) {
        setToast(`Signal changed: ${prevSignal.current} → ${json.signal}`);
        setTimeout(() => setToast(null), 5000);
      }
      prevSignal.current = json.signal;
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStrategy();
    const interval = setInterval(fetchStrategy, 30_000); // refresh every 30s
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, strategy]);

  return (
    <div className="p-6 bg-gray-800 rounded-xl text-white max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Strategy Signals</h3>
        <div className="flex gap-2">
          <select className="bg-gray-700 rounded px-2 py-1" value={symbol} onChange={e => setSymbol(e.target.value)}>
            {symbols.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="bg-gray-700 rounded px-2 py-1" value={strategy} onChange={e => setStrategy(e.target.value)}>
            {strategies.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button onClick={fetchStrategy} className="bg-green-600 hover:bg-green-500 px-3 py-1 rounded">Refresh</button>
        </div>
      </div>

      {toast && <div className="bg-yellow-500 text-black p-2 rounded mb-3">{toast}</div>}
      {loading && <div className="text-gray-300">Fetching signal...</div>}
      {error && <div className="text-red-400">{error}</div>}

      {result && !loading && !error && (
        <div className="space-y-3">
          <div className="p-4 bg-gray-900 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-400">Strategy</div>
                <div className="font-semibold">{result.strategy || strategy}</div>
              </div>

              <div>
                <div className="text-xs text-gray-400">Signal</div>
                <div className={
                  result.signal === "BUY" ? "text-green-400 font-bold" :
                  result.signal === "SELL" ? "text-red-400 font-bold" : "text-gray-300 font-bold"
                } style={{fontSize: 20}}>
                  {result.signal}
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-300">
              {result.last_price && <div>Price: <span className="text-white font-medium">{Number(result.last_price).toFixed(2)}</span></div>}
              {result.ema20 && <div>EMA20: <span className="text-white font-medium">{Number(result.ema20).toFixed(2)}</span></div>}
              {result.confidence !== undefined && <div>Confidence: <span className="text-white font-medium">{result.confidence}%</span></div>}
              {result.avg_confidence !== undefined && <div>Avg Conf: <span className="text-white font-medium">{result.avg_confidence}%</span></div>}
            </div>

            {result.model_results && (
              <div className="mt-3">
                <div className="text-sm text-gray-400 mb-1">Model breakdown:</div>
                <div className="flex gap-2 flex-wrap">
                  {result.model_results.map(m => (
                    <div key={m.model} className="px-2 py-1 bg-gray-700 rounded text-xs">
                      {m.model.toUpperCase()}: <span className={m.trend.includes("UP") ? "text-green-300" : m.trend.includes("DOWN") ? "text-red-300" : "text-gray-300"}>{m.trend}</span>
                      {" "}({m.confidence}%)
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
