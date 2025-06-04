'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType } from 'lightweight-charts';

const TIME_RANGES = [
  { label: '7D', value: 7 },
  { label: '30D', value: 30 },
  { label: '90D', value: 90 },
  { label: '180D', value: 180 },
  { label: '1Y', value: 365 },
];

// CoinGecko API para precios históricos de ETH/USDC
async function fetchHistoricalData(days: number) {
  const res = await fetch(`https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=${days}&interval=daily`);
  const data = await res.json();
  // CoinGecko devuelve: prices: [[timestamp, price], ...]
  return data.prices.map((d: [number, number]) => ({
    time: Math.floor(d[0] / 1000), // timestamp en segundos
    value: d[1],
  }));
}

export const PriceChart = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [selectedRange, setSelectedRange] = useState(180);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    fetchHistoricalData(selectedRange).then(setHistoricalData);
  }, [isClient, selectedRange]);

  useEffect(() => {
    if (!chartContainerRef.current || historicalData.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'white' }, textColor: 'black' },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
      timeScale: { timeVisible: true, secondsVisible: false },
    });

    const priceSeries = chart.addLineSeries({
      color: '#2962FF',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });

    priceSeries.setData(historicalData);

    // Ajuste automático con ResizeObserver
    const resizeObserver = new window.ResizeObserver(() => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [historicalData]);

  // Evita hydration mismatch: solo renderiza el gráfico y el selector en el cliente
  if (!isClient) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-8xl h-[600px] bg-white rounded-lg shadow-lg p-4 mx-auto overflow-hidden mb-5">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">ETH/USD (CoinGecko)</h2>
          {historicalData.length > 0 && (
            <p className="text-sm text-gray-600">
              Precio cierre último día: ${historicalData[historicalData.length - 1].value.toFixed(2)}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {TIME_RANGES.map((range) => (
            <button
              key={range.value}
              className={`px-3 py-1 rounded font-medium border transition-colors duration-150 ${selectedRange === range.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'}`}
              onClick={() => setSelectedRange(range.value)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
}; 