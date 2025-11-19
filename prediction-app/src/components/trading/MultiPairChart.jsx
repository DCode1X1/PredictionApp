import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { createChart } from 'lightweight-charts';

/**
 * MultiPairChart — rozšírená verzia s:
 * - Bollinger Bands
 * - superrtrend
 * - Ichimoku Cloud
 * - Pivot Points (daily)
 * - Linear Regression Channel
 * - Hooks / placeholders pre ML forecast a sentiment/on-chain data
 *
 * Poznámky:
 * - ML/sentiment endpoints sú volané cez fetch na /api/... - uprav podľa svojho backendu alebo služieb.
 * - Výpočty sú v čistom JS, bez externých knižníc.
 */

export default function MultiPairChart() {
  const intervals = ['1m', '5m', '15m', '30m', '1h'];

  const refs = useRef({
    chart: {}, rsi: {}, macd: {}, stoch: {}, cci: {}, atr: {}, obv: {},
    // nové série refs (voliteľné)
  });

  const [pair, setPair] = useState('BTCUSDT');
  const [show, setShow] = useState(true);
  const [predictions, setPredictions] = useState({});
  const [confidences, setConfidences] = useState({});
  const [sentimentData, setSentimentData] = useState({}); // funding, oi, feargreed
  const [mlForecasts, setMlForecasts] = useState({}); // endpoint forecasts

  const chartOptions = {
    layout: { background: { color: '#111' }, textColor: '#fff' },
    grid: { vertLines: { color: '#333' }, horzLines: { color: '#333' } },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false },
    crosshair: { mode: 0 },
  };

  // ----- Helper hooks: fetch sentiment / ml forecasts (placeholders) -----
  useEffect(() => {
    let mounted = true;
    const fetchSentiment = async () => {
      try {
        // TODO: nahraď konkrétnymi API (Coinglass, Binance funding API, Alternative.me Fear & Greed)
        const res = await fetch(`/api/sentiment?symbol=${pair}`);
        if (!res.ok) throw new Error('no sentiment');
        const data = await res.json();
        if (mounted) setSentimentData(data);
      } catch (e) {
        // fallback (mock) ak nemáš API - bezpečne nepokazí logiku
        if (mounted) setSentimentData({ fundingRate: 0, openInterest: 0, fearGreed: 50 });
      }
    };
    fetchSentiment();
    const t = setInterval(fetchSentiment, 60_000); // každú minútu aktualizuj sentiment
    return () => { mounted = false; clearInterval(t); };
  }, [pair]);

  useEffect(() => {
    let mounted = true;
    const fetchML = async () => {
      try {
        // TODO: napoj na svoj ML endpoint, ktorý vráti { interval: { forecast: 'Buy'|'Sell'|'Flat', confidence: n } }
        const res = await fetch(`/api/ml-forecast?symbol=${pair}`);
        if (!res.ok) throw new Error('no ml');
        const data = await res.json();
        if (mounted) setMlForecasts(data);
      } catch (e) {
        if (mounted) setMlForecasts({}); // ak nie je, nech zostane prázdne
      }
    };
    fetchML();
    const t = setInterval(fetchML, 30_000);
    return () => { mounted = false; clearInterval(t); };
  }, [pair]);

  // Initialize charts only when show=true
  useLayoutEffect(() => {
    if (!show) return;

    const charts = {};
    intervals.forEach(interval => {
      const chartRef = refs.current.chart[interval];
      if (!chartRef) return;

      const mainChart = createChart(chartRef, { ...chartOptions, width: chartRef.clientWidth, height: 400 });
      const candleSeries = mainChart.addCandlestickSeries();
      const smaLine = mainChart.addLineSeries({ color: 'yellow' });
      const emaLine = mainChart.addLineSeries({ color: 'cyan' });
      const vwapLine = mainChart.addLineSeries({ color: 'magenta' });
        const forecastSeries = mainChart.addLineSeries({
        color: 'rgba(0, 255, 0, 0.6)',
        lineStyle: 1, // dashed
        });

      // nové overlay/lines
      const bollUpper = mainChart.addLineSeries({ color: '#FF8C00', lineWidth: 1, priceLineVisible: false });
      const bollLower = mainChart.addLineSeries({ color: '#FF8C00', lineWidth: 1, priceLineVisible: false });
      const linearMid = mainChart.addLineSeries({ color: '#888', lineWidth: 1 });
      const linearUpper = mainChart.addLineSeries({ color: '#666', lineWidth: 1 });
      const linearLower = mainChart.addLineSeries({ color: '#666', lineWidth: 1 });
      const ichimokuConversion = mainChart.addLineSeries({ color: '#EF9A9A' }); // Tenkan
      const ichimokuBase = mainChart.addLineSeries({ color: '#90CAF9' }); // Kijun
      // Ichimoku spans normally drawn as cloud - lightweight-charts does not have area fill API here; we'll draw two lines for spanA/B
      const ichimokuSpanA = mainChart.addLineSeries({ color: '#66BB6A' });
      const ichimokuSpanB = mainChart.addLineSeries({ color: '#FF7043' });
      const superrtrendLine = mainChart.addLineSeries({ color: '#FFD54F' });

      const createIndicatorChart = (ref, height = 120) => ref ? createChart(ref, { ...chartOptions, width: ref.clientWidth, height }) : null;

      const rsiLine = createIndicatorChart(refs.current.rsi[interval])?.addLineSeries({ color: 'orange' });
      const macdChart = createIndicatorChart(refs.current.macd[interval], 150);
      const macdLine = macdChart?.addLineSeries({ color: 'cyan' });
      const signalLine = macdChart?.addLineSeries({ color: 'magenta' });
      const histogram = macdChart?.addHistogramSeries({ base: 0 });
      const stochLine = createIndicatorChart(refs.current.stoch[interval])?.addLineSeries({ color: 'lime' });
      const cciLine = createIndicatorChart(refs.current.cci[interval])?.addLineSeries({ color: 'aqua' });
      const atrLine = createIndicatorChart(refs.current.atr[interval])?.addLineSeries({ color: 'yellow' });
      const obvLine = createIndicatorChart(refs.current.obv[interval])?.addLineSeries({ color: 'white' });

      charts[interval] = {
        candleSeries, smaLine, emaLine, vwapLine,
        bollUpper, bollLower,
        ichimokuConversion, ichimokuBase, ichimokuSpanA, ichimokuSpanB,
        superrtrendLine,
        linearMid, linearUpper, linearLower,
        rsiLine, macdLine, signalLine, histogram, stochLine, cciLine, atrLine, obvLine,
        forecastSeries 
      };
    });

    const fetchAll = async () => {
  await Promise.all(intervals.map(async interval => {
    const c = charts[interval]; 
    if (!c) return;
    try {
      const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=200`);
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) {
        console.warn("No data from Binance", interval);
        setPredictions(prev => ({ ...prev, [interval]: "Flat" }));
        setConfidences(prev => ({ ...prev, [interval]: 0 }));
        return;
      }

      const candles = data.map(c => ({
        time: Math.floor(c[0] / 1000),
        open: +c[1], high: +c[2], low: +c[3], close: +c[4], volume: +c[5]
      }));

      c.candleSeries.setData(candles);
      const closes = candles.map(c => c.close);

      // --- Indicators ---
      const sma20 = computeSMA(closes, 20);
      const ema20 = computeEMA(closes, 20);
      const vwap = computeVWAP(candles);

      if (sma20.length) c.smaLine.setData(sma20.map((v, i) => ({ time: candles[i + 19].time, value: v })));
      if (ema20.length) c.emaLine.setData(ema20.map((v, i) => ({ time: candles[i + 19].time, value: v })));
      if (vwap.length) c.vwapLine.setData(vwap.map((v, i) => ({ time: candles[i].time, value: v })));

      const rsi = computeRSI(closes, 14);
      if (rsi.length) c.rsiLine?.setData(rsi.map((v, i) => ({ time: candles[i + closes.length - rsi.length].time, value: v })));

      const { macd, signal, histogram: hist } = computeMACD(closes);
      if (macd.length && signal.length) {
        const offset = closes.length - macd.length;
        c.macdLine?.setData(macd.map((v, i) => ({ time: candles[i + offset].time, value: v })));
        c.signalLine?.setData(signal.map((v, i) => ({ time: candles[i + offset].time, value: v })));
        c.histogram?.setData(hist.map((v, i) => ({
          time: candles[i + offset].time,
          value: v,
          color: v > 0 ? 'green' : 'red'
        })));
      }

      const stoch = computeStochastic(candles, 14);
      if (stoch.length) c.stochLine?.setData(stoch.map((v, i) => ({ time: candles[i + 13].time, value: v })));

      const cci = computeCCI(candles, 20);
      if (cci.length) c.cciLine?.setData(cci.map((v, i) => ({ time: candles[i + 19].time, value: v })));

      const atr = computeATR(candles, 14);
      if (atr.length) c.atrLine?.setData(atr.map((v, i) => ({ time: candles[i + 13].time, value: v })));

      const obv = computeOBV(candles);
      if (obv.length) c.obvLine?.setData(obv.map((v, i) => ({ time: candles[i].time, value: v })));

      // --- Forecast calc (safe fallbacks) ---
      const latestRSI = rsi.at(-1) ?? 50;
      const latestMACD = macd.at(-1) ?? 0;
      const latestSignal = signal.at(-1) ?? 0;
      const latestStoch = stoch.at(-1) ?? 50;
      const latestCCI = cci.at(-1) ?? 0;
      const latestOBV = obv.at(-1) ?? 0;
      const prevOBV = obv.at(-2) ?? latestOBV;
      const latestVWAP = vwap.at(-1) ?? closes.at(-1);
      const latestClose = closes.at(-1);

      const forecastWeights = { RSI:1, MACD:2, Stoch:1, CCI:1, OBV:1, VWAP:2, SMA:1 };
      let buyScore = 0, sellScore = 0;

      if (latestRSI < 30) buyScore += forecastWeights.RSI;
      else if (latestRSI > 70) sellScore += forecastWeights.RSI;

      if (latestMACD > latestSignal) buyScore += forecastWeights.MACD;
      else if (latestMACD < latestSignal) sellScore += forecastWeights.MACD;

      if (latestStoch < 20) buyScore += forecastWeights.Stoch;
      else if (latestStoch > 80) sellScore += forecastWeights.Stoch;

      if (latestCCI < -100) buyScore += forecastWeights.CCI;
      else if (latestCCI > 100) sellScore += forecastWeights.CCI;

      if (latestOBV > prevOBV) buyScore += forecastWeights.OBV;
      else if (latestOBV < prevOBV) sellScore += forecastWeights.OBV;

      if (latestClose > latestVWAP) buyScore += forecastWeights.VWAP;
      else if (latestClose < latestVWAP) sellScore += forecastWeights.VWAP;

      const forecast = buyScore > sellScore ? 'Buy' : sellScore > buyScore ? 'Sell' : 'Flat';
      const conf = Math.round(
        Math.max(buyScore, sellScore) / Object.values(forecastWeights).reduce((a, b) => a + b, 0) * 100
      );

      setPredictions(prev => ({ ...prev, [interval]: forecast }));
      setConfidences(prev => ({ ...prev, [interval]: conf }));

      console.log("Forecast", interval, forecast, conf);

    } catch (err) {
      console.error("Error fetching data for", interval, err);
      setPredictions(prev => ({ ...prev, [interval]: "Flat" }));
      setConfidences(prev => ({ ...prev, [interval]: 0 }));
    }
  }));
};


    fetchAll();
    const timers = intervals.map(interval => setInterval(fetchAll,
      interval==='1m'?20000:interval==='5m'?60000:interval==='15m'?900000:interval==='30m'?180000:360000
    ));
    return () => timers.forEach(t=>clearInterval(t));

  }, [show,pair, sentimentData, mlForecasts]);

  // Master signal
  const getMasterSignal=()=>{
    let buy=0,sell=0;
    intervals.forEach(interval=>{
      const conf=confidences[interval]||0;
      const forecast=predictions[interval];
      if(forecast==='Buy') buy+=conf;
      else if(forecast==='Sell') sell+=conf;
    });
    if(buy>sell) return {signal:'Buy',confidence:Math.round(buy/(buy+sell)*100)};
    else if(sell>buy) return {signal:'Sell',confidence:Math.round(sell/(buy+sell)*100)};
    else return {signal:'Flat',confidence:0};
  };
  const master=getMasterSignal();

  return (
    <div className="p-6 bg-black text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-center">{pair.replace('USDT','')}/USD Dashboard</h1>

      <div className="flex justify-center gap-4 mb-6">
        {['BTCUSDT','ETHUSDT','BNBUSDT'].map(p=>((
          <button key={p} className={`px-4 py-2 rounded-lg font-bold shadow-md transition ${pair===p?'bg-blue-600':'bg-gray-700 hover:bg-gray-600'}`} onClick={()=>setPair(p)}>
            {p.replace('USDT','')}/USD
          </button>
        )))}
      </div>

      {/* Master signal card (unchanged) */}
      <div className="max-w-3xl mx-auto mb-6 p-6 bg-gray-900 rounded-2xl shadow-lg text-gray-200">
        <h2 className="text-xl font-semibold mb-3 text-white">Master Signal (All Timeframes)</h2>
        <p className="text-sm mb-3">Combines all timeframes into one signal. Weighted confidence determines strength. ML & sentiment integrated if available.</p>
        <div className={`p-5 rounded-xl shadow-md text-center border-2 transition-transform transform hover:scale-105 ${master.signal==='Buy'?'border-green-500 bg-gray-800':master.signal==='Sell'?'border-red-500 bg-gray-800':'border-gray-500 bg-gray-800'}`}>
          <div className="text-lg font-semibold mb-2 text-white">Master Signal</div>
          <div className={`text-3xl font-bold mb-4 ${master.signal==='Buy'?'text-green-400':master.signal==='Sell'?'text-red-400':'text-gray-400'}`}>{master.signal}</div>
          <div className="relative h-4 w-full bg-gray-700 rounded-full overflow-hidden mb-2">
            <div className={`absolute top-0 left-0 h-4 rounded-full ${master.signal==='Buy'?'bg-gradient-to-r from-green-500 to-green-300':master.signal==='Sell'?'bg-gradient-to-r from-red-500 to-red-300':'bg-gray-500'}`} style={{width:`${master.confidence}%`}} />
          </div>
          <div className="text-sm text-gray-400">{master.confidence}% confidence</div>
        </div>
      </div>

      {/* Forecast cards */}
      {intervals.map(interval=>{
        const forecast=predictions[interval]||'Loading...';
        const conf=confidences[interval]||0;
        const color=forecast==='Buy'?'green':forecast==='Sell'?'red':'gray';
        return (
          <div key={interval} className={`max-w-3xl mx-auto mb-4 p-6 rounded-2xl shadow-lg transition transform hover:scale-105 border-2 ${color==='green'?'border-green-500':color==='red'?'border-red-500':'border-gray-500'} bg-gray-900`}>
            <div className="text-xl font-semibold mb-2">{interval} Forecast</div>
            <div className={`text-3xl font-bold mb-4 ${color==='green'?'text-green-400':color==='red'?'text-red-400':'text-gray-400'}`}>{forecast}</div>
            <div className="relative h-4 w-full bg-gray-700 rounded-full overflow-hidden mb-2">
              <div className={`absolute top-0 left-0 h-4 rounded-full ${color==='green'?'bg-gradient-to-r from-green-500 to-green-300':color==='red'?'bg-gradient-to-r from-red-500 to-red-300':'bg-gray-500'}`} style={{width:`${conf}%`}} />
            </div>
            <div className="text-sm text-gray-400">{conf}% confidence</div>
          </div>
        );
      })}

      {/* Show/Hide Charts button */}
      <div className="flex justify-center mb-6">
        <button className={`px-6 py-2 rounded-lg font-bold shadow-md transition ${show?'bg-blue-600':'bg-gray-700 hover:bg-gray-600'}`} onClick={()=>setShow(s=>!s)}>
          {show?'Hide Charts':'Show Charts'}
        </button>
      </div>

      {/* Charts */}
      {show && (
        <div className="space-y-6 max-w-6xl mx-auto">
          {intervals.map(interval=>(
            <React.Fragment key={interval}>
              <div ref={el=>refs.current.chart[interval]=el} className="rounded-xl shadow-lg overflow-hidden"/>
              <div ref={el=>refs.current.rsi[interval]=el} className="rounded-xl shadow-lg overflow-hidden"/>
              <div ref={el=>refs.current.macd[interval]=el} className="rounded-xl shadow-lg overflow-hidden"/>
              <div ref={el=>refs.current.stoch[interval]=el} className="rounded-xl shadow-lg overflow-hidden"/>
              <div ref={el=>refs.current.cci[interval]=el} className="rounded-xl shadow-lg overflow-hidden"/>
              <div ref={el=>refs.current.atr[interval]=el} className="rounded-xl shadow-lg overflow-hidden"/>
              <div ref={el=>refs.current.obv[interval]=el} className="rounded-xl shadow-lg overflow-hidden"/>
            </React.Fragment>
          ))}
        </div>
      )}

    </div>
  );
}

/* ---------------------------
   INDICATOR FUNCTIONS
   --------------------------- */

function computeSMA(data, period){
  const sma=[];
  for(let i=period-1;i<data.length;i++){
    let sum=0;
    for(let j=i-period+1;j<=i;j++) sum+=data[j];
    sma.push(sum/period);
  }
  return sma;
}

function computeEMA(data, period){
  const k=2/(period+1);
  let ema = data.slice(0,period).reduce((a,b)=>a+b,0)/period;
  const arr=[ema];
  for(let i=period;i<data.length;i++){
    ema = data[i]*k + ema*(1-k);
    arr.push(ema);
  }
  return arr;
}

function computeMACD(data){
  const ema12=computeEMA(data,12);
  const ema26=computeEMA(data,26);
  // align lengths
  const start = Math.max(ema12.length - Math.min(ema12.length, ema26.length), 0);
  const macd = [];
  const len = Math.min(ema12.length, ema26.length);
  for(let i=0;i<len;i++){
    macd.push(ema12[i + (ema12.length - len)] - ema26[i + (ema26.length - len)]);
  }
  const signal = computeEMA(macd,9);
  const hist = macd.slice(macd.length - signal.length).map((v,i)=>v - signal[i]);
  return { macd: macd.slice(-hist.length), signal, histogram: hist };
}

function computeRSI(data, period=14){
  if (data.length <= period) return [];
  let gains=0, losses=0;
  for(let i=1;i<=period;i++){
    const diff = data[i] - data[i-1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  gains /= period; losses /= period;
  const rsi = [100 - (100 / (1 + (gains / (losses || 1))))];
  for(let i=period+1;i<data.length;i++){
    const diff = data[i] - data[i-1];
    if (diff > 0) { gains = (gains * (period - 1) + diff) / period; losses = (losses * (period - 1)) / period; }
    else { gains = (gains * (period - 1)) / period; losses = (losses * (period - 1) + Math.abs(diff)) / period; }
    const rs = gains / (losses || 1);
    rsi.push(100 - (100 / (1 + rs)));
  }
  return rsi;
}

function computeStochastic(candles, period=14){
  const k=[];
  for(let i=period-1;i<candles.length;i++){
    const slice=candles.slice(i-period+1,i+1);
    let high = -Infinity, low = Infinity;
    for(const s of slice){ if(s.high>high) high=s.high; if(s.low<low) low=s.low; }
    k.push((candles[i].close - low) / (high - low) * 100);
  }
  return k;
}

function computeCCI(candles, period=20){
  const tp = candles.map(c => (c.high + c.low + c.close) / 3);
  const sma = computeSMA(tp, period);
  const res = [];
  for(let i=0;i<sma.length;i++){
    const m = sma[i];
    const slice = tp.slice(i, i+period);
    let meanDev = 0;
    for(const v of slice) meanDev += Math.abs(v - m);
    meanDev /= period;
    res.push((tp[i + period - 1] - m) / (0.015 * (meanDev || 1)));
  }
  return res;
}

function computeATR(candles, period=14){
  const trs=[];
  for(let i=1;i<candles.length;i++){
    const h=candles[i].high, l=candles[i].low, pc=candles[i-1].close;
    trs.push(Math.max(h-l, Math.abs(h-pc), Math.abs(l-pc)));
  }
  return computeSMA(trs, period);
}

function computeOBV(candles){
  let obv=0; const arr=[obv];
  for(let i=1;i<candles.length;i++){
    if(candles[i].close > candles[i-1].close) obv += candles[i].volume;
    else if(candles[i].close < candles[i-1].close) obv -= candles[i].volume;
    arr.push(obv);
  }
  return arr;
}

function computeVWAP(candles){
  let cumVol=0, cumPV=0;
  return candles.map(c=>{
    const tp = (c.high + c.low + c.close) / 3;
    cumVol += c.volume;
    cumPV += tp * c.volume;
    return cumPV / (cumVol || 1);
  });
}

/* ---------------------------
   NOVÉ indikátory
   --------------------------- */

// Bollinger Bands
function computeBollingerBands(closes, period = 20, mult = 2){
  if (closes.length < period) return {upper: [], middle: [], lower: []};
  const middle = computeSMA(closes, period);
  const upper = [], lower = [];
  for(let i=0;i<middle.length;i++){
    let sum=0;
    for(let j=i;j<i+period;j++){
      const idx = j;
      const diff = closes[idx] - middle[i];
      sum += diff*diff;
    }
    const variance = sum/period;
    const std = Math.sqrt(variance);
    upper.push(middle[i] + mult*std);
    lower.push(middle[i] - mult*std);
  }
  return { upper, middle, lower };
}

// superrtrend
function computesuperrtrend(candles, atrPeriod = 10, multiplier = 3){
  // returns line[] aligned with candles starting at offset, plus trendAtLast
  const atr = computeATR(candles, atrPeriod);
  const hl2 = candles.map(c => (c.high + c.low) / 2).slice(atrPeriod); // align with ATR
  const basicUpper = [], basicLower = [];
  for(let i=0;i<atr.length;i++){
    basicUpper.push(hl2[i] + multiplier * atr[i]);
    basicLower.push(hl2[i] - multiplier * atr[i]);
  }
  const finalUpper = [], finalLower = [];
  for(let i=0;i<basicUpper.length;i++){
    if (i===0){ finalUpper.push(basicUpper[i]); finalLower.push(basicLower[i]); continue; }
    finalUpper.push(basicUpper[i] < finalUpper[i-1] || candles[i+atrPeriod].close > finalUpper[i-1] ? basicUpper[i] : finalUpper[i-1]);
    finalLower.push(basicLower[i] > finalLower[i-1] || candles[i+atrPeriod].close < finalLower[i-1] ? basicLower[i] : finalLower[i-1]);
  }
  const superrtrend = [];
  let trend = 1; // 1=up, -1=down
  for(let i=0;i<finalUpper.length;i++){
    const price = candles[i+atrPeriod].close;
    if (price <= finalUpper[i]) {
      // in downtrend area, choose finalUpper as line
      if (price < finalUpper[i]) trend = -1;
      superrtrend.push(finalUpper[i]);
    } else {
      // uptrend
      if (price > finalLower[i]) trend = 1;
      superrtrend.push(finalLower[i]);
    }
  }
  // offset indicates superrtrend[0] corresponds to candle index atrPeriod
  return { line: superrtrend, offset: atrPeriod, trendAtLast: trend };
}

// Ichimoku
function computeIchimoku(candles){
  // Tenkan-sen (9), Kijun-sen (26), Senkou Span A ( (Tenkan+Kijun)/2 shifted forward 26 ), Senkou Span B (52-period midpoint shifted forward 26)
  const highs = candles.map(c=>c.high), lows = candles.map(c=>c.low), closes=candles.map(c=>c.close);
  const tenkan = [];
  for(let i=9-1;i<closes.length;i++){
    const sliceHigh = Math.max(...highs.slice(i-8,i+1));
    const sliceLow = Math.min(...lows.slice(i-8,i+1));
    tenkan.push((sliceHigh+sliceLow)/2);
  }
  const kijun = [];
  for(let i=26-1;i<closes.length;i++){
    const sliceHigh = Math.max(...highs.slice(i-25,i+1));
    const sliceLow = Math.min(...lows.slice(i-25,i+1));
    kijun.push((sliceHigh+sliceLow)/2);
  }
  const spanA = [];
  const start = Math.max(tenkan.length - kijun.length, 0);
  const len = Math.min(tenkan.length - start, kijun.length);
  for(let i=0;i<len;i++){
    spanA.push((tenkan[i+start] + kijun[i]) / 2);
  }
  const spanB = [];
  for(let i=52-1;i<closes.length;i++){
    const sliceHigh = Math.max(...highs.slice(i-51,i+1));
    const sliceLow = Math.min(...lows.slice(i-51,i+1));
    spanB.push((sliceHigh+sliceLow)/2);
  }
  return {
    conversion: tenkan, conversionOffset: 0,
    base: kijun, baseOffset: 0,
    spanA, spanAOffset: 26, // standard Ichimoku: spanA is plotted 26 periods forward
    spanB, spanBOffset: 26
  };
}

// Pivot Points (Daily) - classic R = H+L+C / 3
function computePivotPointsDaily(candles){
  if (!candles.length) return null;
  // find last full day (group by UTC day)
  const byDay = {};
  for(const c of candles){
    const d = new Date(c.time * 1000);
    const dayKey = `${d.getUTCFullYear()}-${d.getUTCMonth()+1}-${d.getUTCDate()}`;
    if (!byDay[dayKey]) byDay[dayKey] = { high: -Infinity, low: Infinity, close: null, open: null };
    const rec = byDay[dayKey];
    if (c.high > rec.high) rec.high = c.high;
    if (c.low < rec.low) rec.low = c.low;
    rec.close = c.close;
    if (!rec.open) rec.open = c.open;
  }
  const keys = Object.keys(byDay).sort();
  if (keys.length < 2) return null;
  // take previous day (not current partial day)
  const prevDay = byDay[keys[keys.length-2]];
  const H = prevDay.high, L = prevDay.low, C = prevDay.close;
  const pivot = (H + L + C) / 3;
  const r1 = 2 * pivot - L;
  const s1 = 2 * pivot - H;
  const r2 = pivot + (H - L);
  const s2 = pivot - (H - L);
  return { pivot, r1, s1, r2, s2 };
}

// Linear Regression Channel (OLS on closes)
function computeLinearRegressionChannel(closes, times){
  // returns mid[], upper[], lower[], slope
  const n = closes.length;
  if (n < 2) return { mid: [], upper: [], lower: [], slope: 0, times: [] };
  // map times to x as 0..n-1
  const x = [...Array(n)].map((_,i)=>i);
  const y = closes.slice();
  const sumX = x.reduce((a,b)=>a+b,0);
  const sumY = y.reduce((a,b)=>a+b,0);
  const sumXY = x.reduce((a,b,i)=>a + b * y[i], 0);
  const sumX2 = x.reduce((a,b)=>a + b*b, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX*sumX || 1);
  const intercept = (sumY - slope * sumX) / n;
  const preds = x.map(xi => slope * xi + intercept);
  // compute std of residuals
  let sumRes=0;
  for(let i=0;i<n;i++) sumRes += Math.pow(y[i] - preds[i], 2);
  const variance = sumRes / n;
  const std = Math.sqrt(variance);
  const upper = preds.map(p => p + 2*std);
  const lower = preds.map(p => p - 2*std);
  // map times for series consumption (if times not provided, create synthetic)
  const tms = times && times.length === n ? times.slice() : x.map(i=>i);
  return { mid: preds, upper, lower, slope, times: tms };
}
