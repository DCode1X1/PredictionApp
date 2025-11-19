import React, { useEffect, useState } from "react";

export default function Predictions() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signal, setSignal] = useState("N/A");

  useEffect(() => {
    async function fetchPrediction() {
      try {
        const res = await fetch("http://127.0.0.1:5000/predict/prophet?symbol=BTC-USD");
        if (!res.ok) throw new Error("Failed to fetch predictions");
        const json = await res.json();
        setData(json);

        // Once fetched, derive trading signal
        if (json?.predictions?.length > 2) {
          const preds = json.predictions.map((p) => p.yhat);
          const last = preds[preds.length - 1];
          const secondLast = preds[preds.length - 2];

          const change = ((last - secondLast) / secondLast) * 100;
          if (change > 0.5) setSignal("BUY ✅");
          else if (change < -0.5) setSignal("SELL ❌");
          else setSignal("HOLD ⚪");
        } else {
          setSignal("N/A");
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchPrediction();
  }, []);

  if (loading) return <div className="p-4">🔄 Loading predictions...</div>;
  if (error) return <div className="p-4 text-red-400">⚠️ {error}</div>;
  if (!data || !data.predictions || !Array.isArray(data.predictions))
    return <div className="p-4 text-gray-400">No prediction data available.</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-2">AI Predictions ({data.symbol})</h2>

      <div className="flex items-center gap-6 mb-4">
        <p className="text-gray-400">
          Confidence:{" "}
          <span className="font-semibold text-green-400">{data.confidence}%</span>
        </p>
        <p className="text-gray-400">
          Signal:{" "}
          <span
            className={`font-semibold ${
              signal.includes("BUY")
                ? "text-green-400"
                : signal.includes("SELL")
                ? "text-red-400"
                : "text-yellow-400"
            }`}
          >
            {signal}
          </span>
        </p>
      </div>

      <table className="min-w-full border border-gray-700 text-sm rounded-xl overflow-hidden">
        <thead>
          <tr className="bg-gray-800 text-gray-300">
            <th className="px-3 py-2 text-left">Date</th>
            <th className="px-3 py-2 text-left">Predicted</th>
            <th className="px-3 py-2 text-left">Lower</th>
            <th className="px-3 py-2 text-left">Upper</th>
          </tr>
        </thead>
        <tbody>
          {data.predictions.map((p, i) => (
            <tr key={i} className="border-t border-gray-700 hover:bg-gray-800">
              <td className="px-3 py-2">{new Date(p.ds).toLocaleString()}</td>
              <td className="px-3 py-2">{p.yhat?.toFixed(2)}</td>
              <td className="px-3 py-2 text-red-400">{p.yhat_lower?.toFixed(2)}</td>
              <td className="px-3 py-2 text-green-400">{p.yhat_upper?.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
