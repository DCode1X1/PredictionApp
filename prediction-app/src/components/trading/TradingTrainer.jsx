import React, { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";

export default function TradingTrainer() {
    const chartContainerRef = useRef(null);
    const [lastPrice, setLastPrice] = useState(null);
    const [wallet, setWallet] = useState(100000);
    const [wsStatus, setWsStatus] = useState("disconnected");
    const [quantity, setQuantity] = useState(1);
    const [position, setPosition] = useState(null);
    
    // Default price range boundaries
    const fixedMinPrice = 66000;
    const fixedMaxPrice = 68000;

    useEffect(() => {
        if (!chartContainerRef.current) return;

        // 🧱 Create chart
        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: 420,
            layout: {
                background: { color: "#0d1117" },
                textColor: "#d1d4dc",
            },
            grid: {
                vertLines: { color: "#1e2329" },
                horzLines: { color: "#1e2329" },
            },
            timeScale: {
                borderColor: "#485c7b",
                timeVisible: true,
                secondsVisible: false,
            },
            rightPriceScale: {
                borderColor: "#485c7b",
                autoScale: false, // Disable auto scaling
                scaleMargins: {
                    top: 0.05, // 5% margin above the candles
                    bottom: 0.05, // 5% margin below the candles
                },
            },
            crosshair: { mode: 1 },
        });

        const candleSeries = chart.addCandlestickSeries({
            upColor: "#26a69a",
            borderUpColor: "#26a69a",
            wickUpColor: "#26a69a",
            downColor: "#ef5350",
            borderDownColor: "#ef5350",
            wickDownColor: "#ef5350",
        });

        // 📊 Fetch historical data
        fetch("http://localhost:5000/api/historical?symbol=BTC-USD")
            .then((r) => r.json())
            .then((data) => {
                const formatted = data
                    .map((d) => ({
                        time: typeof d.ts === "number" ? (d.ts > 1e12 ? Math.floor(d.ts / 1000) : d.ts) : Math.floor(Date.now() / 1000),
                        open: parseFloat(d.open),
                        high: parseFloat(d.high),
                        low: parseFloat(d.low),
                        close: parseFloat(d.close),
                    }))
                    .filter((d) => !isNaN(d.time) && !isNaN(d.open) && !isNaN(d.high) && !isNaN(d.low) && !isNaN(d.close));

                candleSeries.setData(formatted);

                // Apply a fixed vertical price scale (this should be a valid range based on the data)
                chart.priceScale().applyOptions({
                    minValue: fixedMinPrice,
                    maxValue: fixedMaxPrice,
                });

                candleSeries.priceScale().applyOptions({
                    autoScale: false, // Prevent auto-scaling
                });

                // Initial zoom and price scaling
                if (formatted.length > 100) {
                    chart.timeScale().setVisibleRange({
                        from: formatted[formatted.length - 100].time,
                        to: formatted[formatted.length - 1].time,
                    });
                } else {
                    chart.timeScale().fitContent();
                }

                chart.timeScale().scrollToRealTime();
            })
            .catch((err) => console.error("Historical fetch error:", err));

        // 📈 Prophet predictions overlay
        const lineSeries = chart.addLineSeries({
            color: "#f1c40f",
            lineWidth: 2,
        });

        fetch("http://localhost:5000/predict/prophet?symbol=BTC-USD")
            .then((r) => r.json())
            .then((data) => {
                const formattedPreds = (data.predictions || [])
                    .filter((p) => p.yhat !== undefined)
                    .map((p, i) => ({
                        time: p.ds ? Math.floor(new Date(p.ds).getTime() / 1000) : Math.floor(Date.now() / 1000) + i * 3600,
                        value: parseFloat(p.yhat),
                    }));
                if (formattedPreds.length > 0) {
                    lineSeries.setData(formattedPreds);
                }
            })
            .catch((err) => console.error("Prophet fetch error:", err));

        // 🔄 WebSocket for live updates
        const ws = new WebSocket("ws://localhost:5000/realtime");
        ws.onopen = () => setWsStatus("connected");
        ws.onmessage = (e) => {
            const tick = JSON.parse(e.data);
            const timeInSeconds = typeof tick.ts === "number" ? (tick.ts > 1e12 ? Math.floor(tick.ts / 1000) : tick.ts) : Math.floor(Date.now() / 1000);
            setLastPrice(tick.price);

            // ✅ Generate realistic candle shape
            const variance = tick.price * 0.001;
            const open = tick.price - variance * (Math.random() - 0.5);
            const close = tick.price + variance * (Math.random() - 0.5);
            const high = Math.max(open, close) + variance;
            const low = Math.min(open, close) - variance;

            candleSeries.update({ time: timeInSeconds, open, high, low, close });

            // Prevent price scale from resetting
            const scrollPos = chart.timeScale().scrollPosition();
            const isNearRightEdge = scrollPos < 3;
            if (isNearRightEdge) {
                chart.timeScale().scrollToRealTime();
            }
        };
        ws.onclose = () => setWsStatus("disconnected");

        // 📐 Handle resize
        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        window.addEventListener("resize", handleResize);

        return () => {
            ws.close();
            chart.remove();
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    // 🧮 Trading logic
    const handleTrade = (side) => {
        if (!lastPrice) return;
        if (position) return alert("Close current trade first.");
        if (quantity <= 0) return alert("Quantity must be positive.");
        setPosition({ side, entry: lastPrice, qty: quantity });
    };

    const handleClose = () => {
        if (!position) return;
        const pnl = position.side === "long" ? (lastPrice - position.entry) * position.qty : (position.entry - lastPrice) * position.qty;
        setWallet((w) => w + pnl);
        setPosition(null);
    };

    // 💻 UI
    return (
        <div className="min-h-screen bg-[#010409] text-white p-6">
            <div className="max-w-5xl mx-auto bg-[#0d1117] p-5 rounded-2xl shadow-lg border border-gray-800">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-xl font-semibold">Trading Trainer — BTC/USD</h1>
                    <div className="text-right">
                        <div> Wallet: <span className="text-green-400 font-semibold"> ${wallet.toFixed(2)} </span> </div>
                        <div> Last: <span className="text-yellow-400 font-semibold"> ${lastPrice?.toFixed(2) || "—"} </span> </div>
                        <div> WS: <span className={wsStatus === "connected" ? "text-green-500" : "text-red-500"}> {wsStatus} </span> </div>
                    </div>
                </div>
                <div ref={chartContainerRef} className="w-full rounded-lg border border-gray-700" />
                
                {position && (
                    <div className="mt-6 bg-[#161b22] p-4 rounded-lg border border-gray-800">
                        <div className="flex justify-between items-center">
                            <div>
                                <div> Entry Price: ${position.entry.toFixed(2)} </div>
                                <div> Quantity: {position.qty} </div>
                                <div> Side: <span className={position.side === "long" ? "text-green-400" : "text-red-400"}> {position.side} </span> </div>
                            </div>
                            <div>
                                <div> PnL: <span className={position.side === "long" ? (lastPrice - position.entry) >= 0 ? "text-green-400" : "text-red-400" : (position.entry - lastPrice) >= 0 ? "text-green-400" : "text-red-400"}> 
                                    {((position.side === "long" ? lastPrice - position.entry : position.entry - lastPrice) * position.qty).toFixed(2)} </span> </div>
                            </div>
                        </div>
                        <button onClick={handleClose} className="bg-blue-500 hover:bg-blue-700 px-4 py-2 rounded mt-4">Close Position</button>
                    </div>
                )}
                
                <div className="flex justify-between items-center mt-6 bg-[#161b22] p-4 rounded-lg border border-gray-800">
                    <div className="flex items-center space-x-2">
                        <input
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                            className="w-20 px-2 py-1 rounded-md text-black"
                        />
                        <button onClick={() => handleTrade("long")} className="bg-green-500 hover:bg-green-700 px-4 py-2 rounded">Buy (Long)</button>
                        <button onClick={() => handleTrade("short")} className="bg-red-500 hover:bg-red-700 px-4 py-2 rounded">Sell (Short)</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
