import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';

export default function BTCChartWithIndicators() {
  const chartRef = useRef();
  const rsiChartRef = useRef();
  const macdChartRef = useRef();
  const [prediction, setPrediction] = useState('Loading...');

  useEffect(() => {
    // === Chart Setup ===
    const mainChart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: 400,
      layout: { background: { color: '#000' }, textColor: '#fff' },
      grid: { vertLines: { color: '#444' }, horzLines: { color: '#444' } },
    });
    const candleSeries = mainChart.addCandlestickSeries();

    const rsiChart = createChart(rsiChartRef.current, {
      width: rsiChartRef.current.clientWidth,
      height: 150,
      layout: { background: { color: '#111' }, textColor: '#fff' },
      grid: { vertLines: { color: '#444' }, horzLines: { color: '#444' } },
      timeScale: { visible: false },
    });
    const rsiLine = rsiChart.addLineSeries({ color: 'orange' });

    const macdChart = createChart(macdChartRef.current, {
      width: macdChartRef.current.clientWidth,
      height: 150,
      layout: { background: { color: '#111' }, textColor: '#fff' },
      grid: { vertLines: { color: '#444' }, horzLines: { color: '#444' } },
      timeScale: { visible: true },
    });
    const macdLine = macdChart.addLineSeries({ color: 'cyan' });
    const signalLine = macdChart.addLineSeries({ color: 'magenta' });
    const histogramSeries = macdChart.addHistogramSeries({
      color: 'gray',
      priceFormat: { type: 'price', precision: 2 },
      base: 0,
    });

    const fetchData = async () => {
      try {
        const res = await fetch(
          'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100'
        );
        const data = await res.json();

        const candles = data.map((c) => ({
          time: Math.floor(c[0] / 1000),
          open: parseFloat(c[1]),
          high: parseFloat(c[2]),
          low: parseFloat(c[3]),
          close: parseFloat(c[4]),
        }));

        candleSeries.setData(candles);

        // === RSI Calculation ===
        const closes = candles.map((c) => c.close);
        const rsi = computeRSI(closes, 14);
        const rsiPoints = rsi.map((val, i) => ({
          time: candles[i + (candles.length - rsi.length)].time,
          value: val,
        }));
        rsiLine.setData(rsiPoints);

        // === MACD Calculation ===
        const { macd, signal, histogram } = computeMACD(closes);
        const offset = candles.length - macd.length;

        macdLine.setData(
          macd.map((val, i) => ({
            time: candles[i + offset].time,
            value: val,
          }))
        );
        signalLine.setData(
          signal.map((val, i) => ({
            time: candles[i + offset].time,
            value: val,
          }))
        );
        histogramSeries.setData(
          histogram.map((val, i) => ({
            time: candles[i + offset].time,
            value: val,
            color: val > 0 ? 'green' : 'red',
          }))
        );

        // Prediction logic
        const latestRSI = rsi[rsi.length - 1];
        const latestMACD = macd[macd.length - 1];
        const latestSignal = signal[signal.length - 1];

        let forecast = 'Flat';
        if (latestRSI < 30 && latestMACD > latestSignal) forecast = 'Buy';
        else if (latestRSI > 70 && latestMACD < latestSignal) forecast = 'Sell';

        setPrediction(`${forecast} (RSI ${latestRSI.toFixed(1)}, MACD ${latestMACD.toFixed(2)})`);
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 20000); // every 20 seconds
    return () => clearInterval(interval);
  }, []);

  // === Indicator Functions ===
  function computeEMA(data, period) {
    const k = 2 / (period + 1);
    const emaArray = [];
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    emaArray.push(ema);
    for (let i = period; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
      emaArray.push(ema);
    }
    return emaArray;
  }

  function computeMACD(data) {
    const ema12 = computeEMA(data, 12);
    const ema26 = computeEMA(data, 26);
    const macd = ema12.slice(ema12.length - ema26.length).map((val, i) => val - ema26[i]);
    const signal = computeEMA(macd, 9);
    const histogram = macd.slice(signal.length * -1).map((val, i) => val - signal[i]);
    return { macd: macd.slice(-histogram.length), signal, histogram };
  }

  function computeRSI(data, period) {
    const rsi = [];
    for (let i = period; i < data.length; i++) {
      let gains = 0, losses = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const diff = data[j] - data[j - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
      }
      const rs = gains / (losses || 1);
      rsi.push(100 - 100 / (1 + rs));
    }
    return rsi;
  }

  return (
    <div className="p-4 bg-black text-white min-h-screen">
      <h1 className="text-xl font-bold mb-4">BTC/USD Live Chart + Indicators (Binance)</h1>
      <div ref={chartRef} className="mb-2" />
      <div ref={rsiChartRef} className="mb-2" />
      <div ref={macdChartRef} className="mb-2" />
      <div className="mt-4 text-lg">1-Min Forecast: <span className="font-bold">{prediction}</span></div>
    </div>
  );
}
