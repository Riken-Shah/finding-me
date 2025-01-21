'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface PerformanceScore {
  ttfb: number;
  fcp: number;
  lcp: number;
  cls: number;
  fid: number;
}

interface DeploymentMetrics {
  deploymentId: string;
  deploymentDate: string;
  totalVisitors: number;
  bounceRate: number;
  avgTimeSpentSeconds: number;
  conversionRate: number;
  performanceScore: PerformanceScore;
}

interface ApiResponse {
  current: DeploymentMetrics | null;
  previous: DeploymentMetrics[];
}

export default function DeploymentAnalyticsDashboard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/analytics/deployments');
        if (!response.ok) {
          throw new Error('Failed to fetch deployment metrics');
        }
        const result = await response.json();
        setData(result as ApiResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading deployment analytics...</div>
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

  if (!data?.current) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">No deployment data available</div>
      </div>
    );
  }

  const calculateChange = (current: number, previous: number) => {
    const percentChange = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(percentChange).toFixed(1),
      direction: percentChange >= 0 ? 'up' : 'down',
      positive: percentChange >= 0 ? 'text-green-500' : 'text-red-500'
    };
  };

  const getAverageFromPrevious = (metric: keyof DeploymentMetrics) => {
    if (!data.previous.length) return 0;
    const sum = data.previous.reduce((acc, dep) => {
      const value = dep[metric];
      return acc + (typeof value === 'number' ? value : 0);
    }, 0);
    return sum / data.previous.length;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold">Deployment Analytics</h1>
            <Link 
              href="/admin/analytics"
              className="text-sm px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              ← Back to Analytics
            </Link>
          </div>
          <div className="text-sm text-gray-500">
            Current Deployment: {new Date(data.current.deploymentDate).toLocaleString()}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <h2 className="card-header">Total Visitors</h2>
            <p className="card-value">{data.current.totalVisitors}</p>
            {data.previous.length > 0 && (
              <div className="text-sm mt-2">
                {(() => {
                  const change = calculateChange(
                    data.current.totalVisitors,
                    getAverageFromPrevious('totalVisitors')
                  );
                  return (
                    <span className={change.positive}>
                      {change.direction === 'up' ? '↑' : '↓'} {change.value}%
                    </span>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="card-header">Bounce Rate</h2>
            <p className="card-value">{data.current.bounceRate.toFixed(1)}%</p>
            {data.previous.length > 0 && (
              <div className="text-sm mt-2">
                {(() => {
                  const change = calculateChange(
                    data.current.bounceRate,
                    getAverageFromPrevious('bounceRate')
                  );
                  return (
                    <span className={change.direction === 'down' ? 'text-green-500' : 'text-red-500'}>
                      {change.direction === 'up' ? '↑' : '↓'} {change.value}%
                    </span>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="card-header">Avg. Time Spent</h2>
            <p className="card-value">{Math.round(data.current.avgTimeSpentSeconds)}s</p>
            {data.previous.length > 0 && (
              <div className="text-sm mt-2">
                {(() => {
                  const change = calculateChange(
                    data.current.avgTimeSpentSeconds,
                    getAverageFromPrevious('avgTimeSpentSeconds')
                  );
                  return (
                    <span className={change.positive}>
                      {change.direction === 'up' ? '↑' : '↓'} {change.value}%
                    </span>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="card-header">Conversion Rate</h2>
            <p className="card-value">{data.current.conversionRate?.toFixed(1) || 0}%</p>
            {data.previous.length > 0 && (
              <div className="text-sm mt-2">
                {(() => {
                  const change = calculateChange(
                    data.current.conversionRate || 0,
                    getAverageFromPrevious('conversionRate')
                  );
                  return (
                    <span className={change.positive}>
                      {change.direction === 'up' ? '↑' : '↓'} {change.value}%
                    </span>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Previous Deployments Table */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Previous Deployments</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Date</th>
                  <th className="text-right py-2">Visitors</th>
                  <th className="text-right py-2">Bounce Rate</th>
                  <th className="text-right py-2">Avg. Time</th>
                  <th className="text-right py-2">Conv. Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.previous.map((deployment) => (
                  <tr key={deployment.deploymentId} className="border-b">
                    <td className="py-2">{new Date(deployment.deploymentDate).toLocaleString()}</td>
                    <td className="text-right">{deployment.totalVisitors}</td>
                    <td className="text-right">{deployment.bounceRate.toFixed(1)}%</td>
                    <td className="text-right">{Math.round(deployment.avgTimeSpentSeconds)}s</td>
                    <td className="text-right">{deployment.conversionRate?.toFixed(1) || 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
} 