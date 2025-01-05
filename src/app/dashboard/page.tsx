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
  Flex,
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
  ctr: Array<any>;
  exitRates: Array<any>;
  formSubmissions: Array<any>;
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

const colors: { [key: string]: Color } = {
  bounce: "rose",
  duration: "blue",
  pages: "amber",
  returning: "emerald"
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
              <Text className="text-tremor-content">Track your website's performance metrics</Text>
            </div>
            <div className="flex items-center gap-4">
              <Badge size="lg" className="bg-blue-50 text-blue-700">
                {formatNumber(data.retention.total_sessions)} Total Sessions
              </Badge>
              <TabGroup>
                <TabList variant="solid" className="w-fit">
                  <Tab onClick={() => setPeriod('24h')}>24h</Tab>
                  <Tab onClick={() => setPeriod('7d')}>7d</Tab>
                  <Tab onClick={() => setPeriod('30d')}>30d</Tab>
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
                description="Single page visits"
                color="rose"
                trend={data.retention.bounce_rate > 70 ? 'High' : data.retention.bounce_rate < 30 ? 'Good' : 'Average'}
              />
              <MetricCard
                title="Session Duration"
                value={formatDuration(data.retention.avg_session_duration)}
                description="Average time spent"
                color="blue"
                trend={data.retention.avg_session_duration > 300 ? 'Good' : 'Average'}
              />
              <MetricCard
                title="Pages per Session"
                value={formatNumber(data.retention.avg_pages_per_session)}
                description="Average pages viewed"
                color="amber"
                trend={data.retention.avg_pages_per_session > 3 ? 'Good' : 'Average'}
              />
              <MetricCard
                title="Returning Visitors"
                value={formatPercent(data.retention.returning_visitor_rate)}
                description="Of total visitors"
                color="emerald"
                trend={data.retention.returning_visitor_rate > 30 ? 'Good' : 'Average'}
              />
            </>
          )}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {loading ? (
            [...Array(2)].map((_, i) => <LoadingChartCard key={i} />)
          ) : (
            <>
              <ChartCard title="Time on Page">
                {data.timeOnPage.length > 0 ? (
                  <div className="space-y-4">
                    <BarChart
                      className="h-[300px]"
                      data={data.timeOnPage}
                      index="page_path"
                      categories={['avg_time_on_page']}
                      colors={['blue']}
                      valueFormatter={(value) => formatDuration(value)}
                      yAxisWidth={48}
                      showLegend={false}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <Text className="text-sm text-gray-500">Most Viewed Page</Text>
                        <Text className="font-medium truncate">
                          {data.timeOnPage[0]?.page_path || 'N/A'}
                        </Text>
                        <Text className="text-sm text-gray-500">
                          {formatNumber(data.timeOnPage[0]?.views)} views
                        </Text>
                      </div>
                      <div className="text-center">
                        <Text className="text-sm text-gray-500">Avg. Scroll Depth</Text>
                        <Text className="font-medium">
                          {formatPercent(data.timeOnPage[0]?.avg_scroll_depth)}
                        </Text>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center">
                    <Text>No time on page data available</Text>
                  </div>
                )}
              </ChartCard>

              <ChartCard title="Device & Browser Distribution">
                {data.deviceMetrics.length > 0 ? (
                  <div className="space-y-4">
                    <DonutChart
                      className="h-[200px]"
                      data={data.deviceMetrics}
                      category="sessions"
                      index="device"
                      valueFormatter={(value) => `${formatNumber(value)} sessions`}
                      colors={['slate', 'violet', 'indigo']}
                      showAnimation={true}
                    />
                    <div className="space-y-2">
                      {data.deviceMetrics.map((metric, index) => (
                        <div key={index} className="flex justify-between items-center">
                          <div>
                            <Text className="font-medium">{metric.device}</Text>
                            <Text className="text-sm text-gray-500">{metric.browser}</Text>
                            <Text className="text-xs text-gray-400">
                              {formatPercent((metric.engaged_sessions / metric.sessions) * 100)} engaged
                            </Text>
                          </div>
                          <div className="text-right">
                            <Badge size="sm">
                              {formatNumber(metric.sessions)} sessions
                            </Badge>
                            <Text className="text-xs text-gray-500">
                              {formatNumber(metric.returning_sessions)} returning
                            </Text>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center">
                    <Text>No device data available</Text>
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