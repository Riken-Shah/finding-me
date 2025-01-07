'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Title,
  Text,
  TabGroup,
  TabList,
  Tab,
  BarChart,
  DonutChart,
  Metric,
  ProgressBar,
  Badge,
  Color,
} from '@tremor/react';
import dynamic from 'next/dynamic';

const MapWithNoSSR = dynamic(() => import('./Map'), { ssr: false });

interface AnalyticsData {
  retention: {
    total_sessions: number;
    bounce_rate: number;
    avg_session_duration: number;
    avg_pages_per_session: number;
    returning_visitor_rate: number;
  };
  timeOnPage: Array<{
    page_path: string;
    views: number;
    avg_time_on_page: number;
    avg_scroll_depth: number;
  }>;
  navigationPaths: Array<{
    path: string;
    frequency: number;
    entry_rate: number;
    exit_rate: number;
  }>;
  deviceMetrics: Array<{
    device: string;
    browser: string;
    sessions: number;
    returning_sessions: number;
    engaged_sessions: number;
  }>;
  geographicData: Array<{
    country: string;
    city: string;
    sessions: number;
    returning_visitors: number;
    bounce_rate: number;
    lat?: number;
    lng?: number;
  }>;
  ctr: Array<{
    page_path: string;
    element: string;
    href: string;
    clicks: number;
    unique_clicks: number;
    views: number;
    ctr: number;
    unique_ctr: number;
    avg_x: number;
    avg_y: number;
    viewport_width: number;
    viewport_height: number;
  }>;
  exitRates: Array<{
    page_path: string;
    exit_rate: number;
    exits: number;
    views: number;
  }>;
  formSubmissions: Array<{
    form_id: string;
    submissions: number;
    success_rate: number;
  }>;
}

const defaultData: AnalyticsData = {
  retention: {
    total_sessions: 0,
    bounce_rate: 0,
    avg_session_duration: 0,
    avg_pages_per_session: 0,
    returning_visitor_rate: 0
  },
  timeOnPage: [],
  navigationPaths: [],
  deviceMetrics: [],
  geographicData: [],
  ctr: [],
  exitRates: [],
  formSubmissions: []
};

function MetricCard({ title, value, description, color, trend }: { 
  title: string; 
  value: string; 
  description: string;
  color: Color;
  trend?: string;
}) {
  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between">
        <Text className="text-sm font-medium text-tremor-content-subtle">{title}</Text>
        {trend && <Badge color={color} size="xs">{trend}</Badge>}
      </div>
      <Metric className="text-2xl">{value}</Metric>
      <Text className="text-xs text-tremor-content-subtle">{description}</Text>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="h-[400px]">
      <div className="flex items-center justify-between mb-6">
        <Title className="text-tremor-content-strong font-medium">{title}</Title>
      </div>
      {children}
    </Card>
  );
}

function LoadingCard() {
  return (
    <Card className="animate-pulse">
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
      </div>
    </Card>
  );
}

function LoadingChartCard() {
  return (
    <Card className="h-[400px] animate-pulse">
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        <div className="h-[300px] bg-gray-100 rounded mt-6"></div>
      </div>
    </Card>
  );
}

function formatDuration(seconds: number | null): string {
  if (seconds == null || isNaN(seconds)) return '0s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function formatNumber(num: number | null): string {
  if (num == null || isNaN(num)) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatPercent(num: number | null): string {
  if (num == null || isNaN(num)) return '0%';
  return `${num.toFixed(1)}%`;
}

export default function DashboardPage() {
  const [period, setPeriod] = useState('7d');
  const [data, setData] = useState<AnalyticsData>(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/analytics/metrics?period=${period}`);
        if (!response.ok) {
          throw new Error('Failed to fetch analytics data');
        }
        const result = await response.json() as AnalyticsData;
        console.log('Dashboard received data:', result);
        setData({
          ...defaultData,
          ...result,
          retention: {
            ...defaultData.retention,
            ...(result.retention || {})
          }
        });
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch analytics');
        setData(defaultData);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [period]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-lg mx-auto">
          <div className="text-center">
            <Title className="text-red-500 mb-2">Error Loading Analytics</Title>
            <Text>{error}</Text>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-2xl mx-auto p-4 md:p-8 space-y-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <Title className="text-2xl font-semibold mb-1">Analytics Dashboard</Title>
              <Text className="text-tremor-content">Track your website&apos;s performance metrics</Text>
            </div>
            <div className="flex items-center gap-4">
              <Badge size="lg" className="bg-blue-50 text-blue-700">
                {formatNumber(data.retention.total_sessions)} Total Sessions
              </Badge>
              <TabGroup defaultValue="7d" onIndexChange={(index) => {
                const periods = ['24h', '7d', '30d'];
                const newPeriod = periods[index];
                setPeriod(newPeriod);
              }}>
                <TabList variant="solid" className="w-fit">
                  <Tab>24h</Tab>
                  <Tab>7d</Tab>
                  <Tab>30d</Tab>
                </TabList>
              </TabGroup>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (
            [...Array(4)].map((_, i) => <LoadingCard key={i} />)
          ) : (
            <>
              <MetricCard
                title="Bounce Rate"
                value={formatPercent(data.retention.bounce_rate)}
                description="Percentage of single-page sessions"
                color="rose"
                trend={data.retention.bounce_rate > 50 ? "High" : "Good"}
              />
              <MetricCard
                title="Avg. Session Duration"
                value={formatDuration(data.retention.avg_session_duration)}
                description="Time spent per session"
                color="blue"
              />
              <MetricCard
                title="Pages per Session"
                value={formatNumber(data.retention.avg_pages_per_session)}
                description="Average pages viewed"
                color="amber"
              />
              <MetricCard
                title="Returning Visitors"
                value={formatPercent(data.retention.returning_visitor_rate)}
                description="Percentage of returning users"
                color="emerald"
              />
            </>
          )}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {loading ? (
            [...Array(4)].map((_, i) => <LoadingChartCard key={i} />)
          ) : (
            <>
              {/* Page Views Chart */}
              <ChartCard title="Page Views">
                {data.timeOnPage.length > 0 ? (
                  <BarChart
                    data={data.timeOnPage}
                    index="page_path"
                    categories={["views"]}
                    colors={["blue"]}
                    valueFormatter={formatNumber}
                    yAxisWidth={48}
                    className="h-[300px] mt-4"
                  />
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    No page view data available
                  </div>
                )}
              </ChartCard>

              {/* Time on Page Chart */}
              <ChartCard title="Average Time on Page">
                {data.timeOnPage.length > 0 ? (
                  <BarChart
                    data={data.timeOnPage}
                    index="page_path"
                    categories={["avg_time_on_page"]}
                    colors={["green"]}
                    valueFormatter={(value) => formatDuration(value)}
                    yAxisWidth={48}
                    className="h-[300px] mt-4"
                  />
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    No time on page data available
                  </div>
                )}
              </ChartCard>

              {/* Device Distribution */}
              <ChartCard title="Device & Browser Distribution">
                {data.deviceMetrics.length > 0 ? (
                  <DonutChart
                    data={data.deviceMetrics}
                    category="sessions"
                    index="device"
                    valueFormatter={formatNumber}
                    colors={["slate", "violet", "indigo", "rose", "cyan", "amber"]}
                    className="h-[300px] mt-4"
                  />
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    No device data available
                  </div>
                )}
              </ChartCard>

              {/* Geographic Distribution */}
              <ChartCard title="Geographic Distribution">
                <div className="h-[300px]">
                  <MapWithNoSSR data={data.geographicData} />
                </div>
              </ChartCard>

              {/* Navigation Flow */}
              <ChartCard title="Navigation Flow">
                {data.navigationPaths.length > 0 ? (
                  <BarChart
                    data={data.navigationPaths}
                    index="path"
                    categories={["entry_rate", "exit_rate"]}
                    colors={["emerald", "rose"]}
                    valueFormatter={formatPercent}
                    yAxisWidth={48}
                    className="h-[300px] mt-4"
                  />
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    No navigation data available
                  </div>
                )}
              </ChartCard>

              {/* Scroll Depth */}
              <ChartCard title="Scroll Depth">
                {data.timeOnPage.length > 0 ? (
                  <div className="space-y-6 mt-4">
                    {data.timeOnPage.slice(0, 5).map((page) => (
                      <div key={page.page_path} className="space-y-2">
                        <div className="flex justify-between">
                          <Text>{page.page_path}</Text>
                          <Text>{formatPercent(page.avg_scroll_depth)}</Text>
                        </div>
                        <ProgressBar 
                          value={page.avg_scroll_depth || 0} 
                          color="blue"
                          tooltip={`${formatPercent(page.avg_scroll_depth)} average scroll depth`}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    No scroll depth data available
                  </div>
                )}
              </ChartCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 