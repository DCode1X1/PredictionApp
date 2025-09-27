import React, { useLayoutEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';

export default function MultiPairChart() {
  const intervals = ['1m', '5m', '30m', '1h'];

  // --- Refs dictionary
  const refs = useRef({
    chart: {},
    rsi: {},
    macd: {},
    stoch: {},
    cci: {},
    atr: {},
    obv: {},
  });

  const [pair, setPair] = useState('BTCUSDT');
  const [predictions, setPredictions] = useState({});
  const [confidences, setConfidences] = useState({});

  const chartOptions = {
    layout: { background: { color: '#111' }, textColor: '#fff' },
    grid: { vertLines: { color: '#333' }, horzLines: { color: '#333' } },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false },
    crosshair: { mode: 0 },
  };

  useLayoutEffect(() => {
    // --- Initialize charts for all intervals
    const charts = {};
    intervals.forEach(interval => {
      const chartRef = refs.current.chart[interval];
      if (!chartRef) return;

      const mainChart = createChart(chartRef, { ...chartOptions, width: chartRef.clientWidth, height: 400 });
      const candleSeries = mainChart.addCandlestickSeries();
      const smaLine = mainChart.addLineSeries({ color: 'yellow' });
      const emaLine = mainChart.addLineSeries({ color: 'cyan' });
      const vwapLine = mainChart.addLineSeries({ color: 'magenta' });

      const createIndicatorChart = (ref, height = 120) => {
        if (!ref) return null;
        return createChart(ref, { ...chartOptions, width: ref.clientWidth, height });
      };

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
        candleSeries,
        smaLine,
        emaLine,
        vwapLine,
        rsiLine,
        macdLine,
        signalLine,
        histogram,
        stochLine,
        cciLine,
        atrLine,
        obvLine,
      };
    });

    // --- Fetch data once per interval globally ---
    const fetchAll = () => {
      intervals.forEach(async interval => {
        const c = charts[interval];
        if (!c) return;

        try {
          const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=200`);
          const data = await res.json();
          const candles = data.map(c => ({
            time: Math.floor(c[0] / 1000),
            open: +c[1],
            high: +c[2],
            low: +c[3],
            close: +c[4],
            volume: +c[5],
          }));

          c.candleSeries.setData(candles);
          const closes = candles.map(c => c.close);

          // --- Overlays
          const sma = computeSMA(closes, 20);
          const ema = computeEMA(closes, 20);
          const vwap = computeVWAP(candles);

          c.smaLine.setData(sma.map((v, i) => ({ time: candles[i + 19].time, value: v })));
          c.emaLine.setData(ema.map((v, i) => ({ time: candles[i + 19].time, value: v })));
          c.vwapLine.setData(vwap.map((v, i) => ({ time: candles[i].time, value: v })));

          // --- Indicators
          const rsi = computeRSI(closes, 14);
          c.rsiLine?.setData(rsi.map((v, i) => ({ time: candles[i + closes.length - rsi.length].time, value: v })));

          const { macd, signal, histogram: hist } = computeMACD(closes);
          const offset = candles.length - macd.length;
          c.macdLine?.setData(macd.map((v, i) => ({ time: candles[i + offset].time, value: v })));
          c.signalLine?.setData(signal.map((v, i) => ({ time: candles[i + offset].time, value: v })));
          c.histogram?.setData(hist.map((v, i) => ({ time: candles[i + offset].time, value: v, color: v > 0 ? 'green' : 'red' })));

          const stoch = computeStochastic(candles, 14);
          c.stochLine?.setData(stoch.map((v, i) => ({ time: candles[i + 13].time, value: v })));

          const cci = computeCCI(candles, 20);
          c.cciLine?.setData(cci.map((v, i) => ({ time: candles[i + 19].time, value: v })));

          const atr = computeATR(candles, 14);
          c.atrLine?.setData(atr.map((v, i) => ({ time: candles[i + 13].time, value: v })));

          const obv = computeOBV(candles);
          c.obvLine?.setData(obv.map((v, i) => ({ time: candles[i].time, value: v })));

          // --- Forecast
          const latestRSI = rsi.at(-1);
          const latestMACD = macd.at(-1);
          const latestSignal = signal.at(-1);
          const latestStoch = stoch.at(-1);
          const latestCCI = cci.at(-1);
          const latestOBV = obv.at(-1);
          const latestVWAP = vwap.at(-1);
          const latestClose = closes.at(-1);

          let signals = [];
          if (latestRSI < 30) signals.push('Buy'); else if (latestRSI > 70) signals.push('Sell');
          if (latestMACD > latestSignal) signals.push('Buy'); else if (latestMACD < latestSignal) signals.push('Sell');
          if (latestStoch < 20) signals.push('Buy'); else if (latestStoch > 80) signals.push('Sell');
          if (latestCCI < -100) signals.push('Buy'); else if (latestCCI > 100) signals.push('Sell');
          if (latestOBV > obv[obv.length - 2]) signals.push('Buy'); else if (latestOBV < obv[obv.length - 2]) signals.push('Sell');
          if (latestClose > latestVWAP) signals.push('Buy'); else if (latestClose < latestVWAP) signals.push('Sell');

          const buyVotes = signals.filter(s => s === 'Buy').length;
          const sellVotes = signals.filter(s => s === 'Sell').length;
          let forecast = 'Flat';
          if (buyVotes > sellVotes) forecast = 'Buy';
          else if (sellVotes > buyVotes) forecast = 'Sell';
          const conf = Math.round((Math.max(buyVotes, sellVotes) / signals.length) * 100);

          setPredictions(prev => ({ ...prev, [interval]: forecast }));
          setConfidences(prev => ({ ...prev, [interval]: conf }));
        } catch (err) {
          console.error(err);
        }
      });
    };

    fetchAll();
    const timers = intervals.map(interval => setInterval(fetchAll, interval === '1m' ? 20000 : interval === '5m' ? 60000 : interval === '30m' ? 180000 : 360000));
    return () => timers.forEach(t => clearInterval(t));
  }, [pair]);

  // --- Indicator functions (same as before) ---
  // ... copy computeSMA, computeEMA, computeMACD, etc. from previous version ...
// --- Indicator functions ---
function computeSMA(data, period){ const sma=[]; for(let i=period-1;i<data.length;i++){ sma.push(data.slice(i-period+1,i+1).reduce((a,b)=>a+b,0)/period); } return sma; }
function computeEMA(data, period){ const k=2/(period+1); let ema=data.slice(0,period).reduce((a,b)=>a+b,0)/period; const arr=[ema]; for(let i=period;i<data.length;i++){ ema=data[i]*k+ema*(1-k); arr.push(ema); } return arr; }
function computeMACD(data){ const ema12=computeEMA(data,12); const ema26=computeEMA(data,26); const macd=ema12.slice(ema12.length-ema26.length).map((v,i)=>v-ema26[i]); const signal=computeEMA(macd,9); const histogram=macd.slice(-signal.length).map((v,i)=>v-signal[i]); return { macd:macd.slice(-histogram.length), signal, histogram }; }
function computeRSI(data, period=14){ let gains=0, losses=0; for(let i=1;i<=period;i++){ const diff=data[i]-data[i-1]; if(diff>=0) gains+=diff; else losses-=diff; } gains/=period; losses/=period; const rsi=[100-100/(1+gains/(losses||1))]; for(let i=period+1;i<data.length;i++){ const diff=data[i]-data[i-1]; if(diff>=0){ gains=(gains*(period-1)+diff)/period; losses=(losses*(period-1))/period;}else{ gains=(gains*(period-1))/period; losses=(losses*(period-1)-diff)/period;} const rs=gains/(losses||1); rsi.push(100-100/(1+rs)); } return rsi; }
function computeStochastic(candles, period=14){ const k=[]; for(let i=period-1;i<candles.length;i++){ const slice=candles.slice(i-period+1,i+1); const high=Math.max(...slice.map(c=>c.high)); const low=Math.min(...slice.map(c=>c.low)); k.push((candles[i].close-low)/(high-low)*100); } return k; }
function computeCCI(candles, period=20){ const tp=candles.map(c=>(c.high+c.low+c.close)/3); const sma=computeSMA(tp,period); return sma.map((m,i)=>{ const slice=tp.slice(i,i+period); const meanDev=slice.reduce((s,v)=>s+Math.abs(v-m),0)/period; return (tp[i+period-1]-m)/(0.015*meanDev); }); }
function computeATR(candles, period=14){ const trs=[]; for(let i=1;i<candles.length;i++){ const h=candles[i].high, l=candles[i].low, pc=candles[i-1].close; trs.push(Math.max(h-l,Math.abs(h-pc),Math.abs(l-pc))); } return computeSMA(trs,period); }
function computeOBV(candles){ let obv=0; const arr=[obv]; for(let i=1;i<candles.length;i++){ if(candles[i].close>candles[i-1].close) obv+=candles[i].volume; else if(candles[i].close<candles[i-1].close) obv-=candles[i].volume; arr.push(obv); } return arr; }
function computeVWAP(candles){ let cumVol=0, cumPV=0; return candles.map(c=>{ const tp=(c.high+c.low+c.close)/3; cumVol+=c.volume; cumPV+=tp*c.volume; return cumPV/cumVol; }); }

  return (
    <div className="p-6 bg-black text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-center">{pair.replace('USDT', '')}/USD Dashboard</h1>

      <div className="flex justify-center gap-4 mb-6">
        {['BTCUSDT', 'ETHUSDT', 'BNBUSDT'].map(p => (
          <button key={p} className={`px-4 py-2 rounded-lg font-bold shadow-md transition ${pair === p ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`} onClick={() => setPair(p)}>
            {p.replace('USDT', '')}/USD
          </button>
        ))}
      </div>

      {/* Forecast cards */}
      {intervals.map(interval => {
        const forecast = predictions[interval] || 'Loading...';
        const conf = confidences[interval] || 0;
        const color = forecast === 'Buy' ? 'green' : forecast === 'Sell' ? 'red' : 'gray';
        return (
          <div key={interval} className={`p-4 rounded-2xl shadow-lg mb-4 text-center max-w-3xl mx-auto border-2 border-${color}-500`}>
            <div className="text-xl font-semibold mb-2">{interval} Forecast</div>
            <div className={`text-2xl font-bold mb-2 text-${color}-400`}>{forecast}</div>
            <div className="h-3 w-full bg-gray-700 rounded-full overflow-hidden">
              <div className={`h-3 bg-gradient-to-r from-${color}-500 to-${color}-300`} style={{ width: `${conf}%` }}></div>
            </div>
            <div className="mt-1 text-sm text-gray-400">{conf}% confidence</div>
          </div>
        );
      })}

      {/* Charts */}
      <div className="space-y-6 max-w-6xl mx-auto">
        {intervals.map(interval => (
          <React.Fragment key={interval}>
            <div ref={el => refs.current.chart[interval] = el} className="rounded-xl shadow-lg overflow-hidden" />
            <div ref={el => refs.current.rsi[interval] = el} className="rounded-xl shadow-lg overflow-hidden" />
            <div ref={el => refs.current.macd[interval] = el} className="rounded-xl shadow-lg overflow-hidden" />
            <div ref={el => refs.current.stoch[interval] = el} className="rounded-xl shadow-lg overflow-hidden" />
            <div ref={el => refs.current.cci[interval] = el} className="rounded-xl shadow-lg overflow-hidden" />
            <div ref={el => refs.current.atr[interval] = el} className="rounded-xl shadow-lg overflow-hidden" />
            <div ref={el => refs.current.obv[interval] = el} className="rounded-xl shadow-lg overflow-hidden" />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
