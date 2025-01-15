'use client';

import { useState, useEffect } from 'react';
import { AnalyticsMetrics } from '@/lib/analytics-d1';

interface TimeframeOption {
  label: string;
  value: string;
  startTime: number;
}

const timeframeOptions: TimeframeOption[] = [
  {
    label: 'Last 24 Hours',
    value: '24h',
    startTime: Date.now() - 24 * 60 * 60 * 1000,
  },
  {
    label: 'Last 7 Days',
    value: '7d',
    startTime: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
  {
    label: 'Last 30 Days',
    value: '30d',
    startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
  },
  {
    label: 'All Time',
    value: 'all',
    startTime: 0,
  },
];

export default function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [timeframe, setTimeframe] = useState<TimeframeOption>(timeframeOptions[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (timeframe.value !== 'all') {
          params.set('startTime', timeframe.startTime.toString());
          params.set('endTime', Date.now().toString());
        }

        const response = await fetch(`/api/analytics/metrics?${params}`);
        if (!response.ok) {
          throw new Error('Failed to fetch metrics');
        }

        const data = await response.json() as AnalyticsMetrics;
        setMetrics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [timeframe]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500 text-lg">Error: {error}</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">No data available</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 space-y-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <select
            value={timeframe.value}
            onChange={(e) => {
              const selected = timeframeOptions.find(opt => opt.value === e.target.value);
              if (selected) setTimeframe(selected);
            }}
            className="select"
          >
            {timeframeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <h2 className="card-header">Total Visitors</h2>
            <p className="card-value">{metrics.totalVisitors}</p>
          </div>
          <div className="card">
            <h2 className="card-header">Bounce Rate</h2>
            <p className="card-value">{metrics.bounceRate.toFixed(1)}%</p>
          </div>
          <div className="card">
            <h2 className="card-header">Avg. Time Spent</h2>
            <p className="card-value">{Math.round(metrics.avgTimeSpentSeconds)}s</p>
          </div>
          <div className="card">
            <h2 className="card-header">Conversion Rate</h2>
            <p className="card-value">{metrics.conversionRate?.toFixed(1) || 0}%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Top Pages</h2>
            <div className="space-y-3">
              {metrics.topPages.map(({ page, views }) => (
                <div key={page} className="list-item">
                  <span className="list-item-text">{page}</span>
                  <span className="list-item-value">{views}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Click-through Rates</h2>
            <div className="space-y-3">
              {metrics.clickThroughRates.map(({ element, clicks, ctr }) => (
                <div key={element} className="list-item">
                  <span className="list-item-text">{element}</span>
                  <span className="list-item-value">{clicks} ({ctr.toFixed(1)}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Device Breakdown</h2>
            <div className="space-y-3">
              {metrics.deviceBreakdown.map(({ device_type, count }) => (
                <div key={device_type} className="list-item">
                  <span className="list-item-text capitalize">{device_type}</span>
                  <span className="list-item-value">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Country Breakdown</h2>
            <div className="space-y-3">
              {metrics.countryBreakdown.map(({ country, count }) => (
                <div key={country} className="list-item">
                  <span className="list-item-text">{country}</span>
                  <span className="list-item-value">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 