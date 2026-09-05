const counters: Record<string, number> = {};
const histograms: Record<string, number[]> = {};
const gauges: Record<string, number> = {};

export function incrementCounter(name: string, amount = 1): void {
  counters[name] = (counters[name] || 0) + amount;
}

export function setGauge(name: string, value: number): void {
  gauges[name] = value;
}

export function recordHistogram(name: string, value: number): void {
  if (!histograms[name]) histograms[name] = [];
  const arr = histograms[name];
  arr.push(value);
  if (arr.length > 1000) arr.shift();
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export function getMetrics(): Record<string, unknown> {
  const result: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    memory: {
      rss_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heap_used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
    counters: { ...counters },
    gauges: { ...gauges },
    histograms: {},
  };

  for (const [name, values] of Object.entries(histograms)) {
    (result.histograms as Record<string, unknown>)[name] = {
      count: values.length,
      avg_ms: values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0,
      p50_ms: percentile(values, 50),
      p95_ms: percentile(values, 95),
      p99_ms: percentile(values, 99),
      max_ms: values.length > 0 ? Math.max(...values) : 0,
    };
  }

  return result;
}

setInterval(() => {
  for (const key of Object.keys(histograms)) {
    histograms[key] = [];
  }
}, 600_000);
