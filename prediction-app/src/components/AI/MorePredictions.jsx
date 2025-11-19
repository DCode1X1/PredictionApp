import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function MorePredictions() {
  const [symbol, setSymbol] = useState("BTC-USD");
  const [model, setModel] = useState("prophet");
  const [data, setData] = useState(null);
  const [allData, setAllData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const models = ["prophet", "xgboost", "lstm", "ensemble", "all"];
  const symbols = ["BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD"];

  const fetchPredictions = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    setAllData(null);

    try {
      if (model === "all") {
        const modelList = ["prophet", "xgboost", "lstm", "ensemble"];
        const results = await Promise.all(
          modelList.map(async (m) => {
            const res = await fetch(`http://127.0.0.1:5000/predict/${m}?symbol=${symbol}`);
            if (!res.ok) throw new Error(`Server error (${m}): ${res.status}`);
            const json = await res.json();
            return { model: m, data: json };
          })
        );
        setAllData(results);
      } else {
        const res = await fetch(`http://127.0.0.1:5000/predict/${model}?symbol=${symbol}`);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const json = await res.json();
        if (!json || json.error) throw new Error(json?.error || "Invalid response from server");
        setData(json);
      }
    } catch (err) {
      if (err.message.includes("Failed to fetch"))
        setError("⚠️ Could not connect to backend. Is it running?");
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPredictions();
  }, [symbol, model]);

const getDirection = (predictions) => {
  if (!predictions?.length) return "N/A";
  const y = predictions.map((p) => p.yhat);
  const x = [...Array(y.length).keys()];

  const n = y.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, _, i) => acc + x[i] * y[i], 0);
  const sumX2 = x.reduce((acc, val) => acc + val * val, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX ** 2);
  if (slope > 0.5) return "STRONG UP";
  if (slope > 0.1) return "UP";
  if (slope < -0.5) return "STRONG DOWN";
  if (slope < -0.1) return "DOWN";
  return "FLAT";
};



  // Format predictions for display
  const formatData = (preds) =>
    preds.map((p, i) => ({
      name: i + 1,
      yhat: Number(p.yhat.toFixed(2)),
    }));

  // Different colors for each model
  const modelColors = {
    prophet: "#3b82f6",
    xgboost: "#f59e0b",
    lstm: "#a855f7",
    ensemble: "#10b981",
  };

  return (
    <div className="p-6 text-white">
      <h2 className="text-2xl font-bold mb-4">More AI Predictions</h2>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-6">
        <select
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
        >
          {symbols.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        >
          {models.map((m) => (
            <option key={m} value={m}>
              {m === "all" ? "ALL MODELS" : m.toUpperCase()}
            </option>
          ))}
        </select>

        <button
          onClick={fetchPredictions}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
        >
          Refresh
        </button>
      </div>

      {/* Loading/Error */}
      {loading && <p className="text-gray-400">Fetching predictions...</p>}
      {error && <p className="text-red-400">Error: {error}</p>}

      {/* Single Model View */}
      {data && !loading && !error && model !== "all" && (
        <div className="bg-gray-800 rounded-xl p-5 max-w-xl shadow-lg mb-4">
          <h3 className="text-lg font-semibold mb-2">
            {symbol} — {model.toUpperCase()} Forecast
          </h3>

          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={formatData(data.predictions)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" tick={{ fill: "#888", fontSize: 10 }} />
              <YAxis tick={{ fill: "#888", fontSize: 10 }} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1f2937", border: "none" }}
                formatter={(value) => [value, "yhat"]}
              />
              <Line
                type="monotone"
                dataKey="yhat"
                stroke={modelColors[model]}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>

          <p>
            <span className="text-gray-400">Trend:</span>{" "}
            <span
              className={
                getDirection(data.predictions).includes("UP")
                  ? "text-green-400 font-bold"
                  : getDirection(data.predictions).includes("DOWN")
                  ? "text-red-400 font-bold"
                  : "text-gray-400 font-bold"
              }
            >
              {getDirection(data.predictions)}
            </span>

          </p>

          <p>
            <span className="text-gray-400">Confidence:</span> {data.confidence}%
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Model version: {data?.meta?.model_version || "N/A"}
          </p>
        </div>
      )}

      {/* All Models View */}
      {allData && !loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allData.map(({ model, data }) => (
            <div key={model} className="bg-gray-800 rounded-xl p-5 shadow-lg">
              <h3 className="text-lg font-semibold mb-2">
                {symbol} — {model.toUpperCase()} Forecast
              </h3>

              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={formatData(data.predictions)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="name" tick={{ fill: "#888", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#888", fontSize: 10 }} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1f2937", border: "none" }}
                    formatter={(value) => [value, "yhat"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="yhat"
                    stroke={modelColors[model]}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>

              <p>
                <span className="text-gray-400">Trend:</span>{" "}
                <span
                  className={
                    getDirection(data.predictions).includes("UP")
                      ? "text-green-400 font-bold"
                      : getDirection(data.predictions).includes("DOWN")
                      ? "text-red-400 font-bold"
                      : "text-gray-400 font-bold"
                  }
                >
                  {getDirection(data.predictions)}
                </span>
              </p>

              <p>
                <span className="text-gray-400">Confidence:</span> {data.confidence}%
              </p>
              <p className="text-gray-500 text-sm mt-2">
                Model version: {data?.meta?.model_version || "N/A"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
