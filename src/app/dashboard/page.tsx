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
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/analytics/metrics?period=${selectedPeriod}`);
        if (!response.ok) {
          throw new Error('Failed to fetch analytics data');
        }
        const analyticsData = (await response.json()) as AnalyticsData;
        setData(analyticsData);
        setError(null);
      } catch (err) {
        console.error('Error fetching analytics:', err);
        setError('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedPeriod]);

  if (error) {
    return (
      <div className="p-4">
        <Card className="mx-auto max-w-4xl">
          <div className="text-center p-4">
            <Title>Error</Title>
            <Text>{error}</Text>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <main className="p-4 md:p-10 mx-auto max-w-7xl">
      <div className="flex items-center justify-between mb-4">
        <Title>Analytics Dashboard</Title>
        <TabGroup defaultValue={selectedPeriod} onIndexChange={(index) => {
          const periods = ['24h', '7d', '30d'];
          setSelectedPeriod(periods[index]);
        }}>
          <TabList variant="solid">
            <Tab>Last 24h</Tab>
            <Tab>Last 7 days</Tab>
            <Tab>Last 30 days</Tab>
          </TabList>
        </TabGroup>
      </div>

      <div className="grid gap-6 mb-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            <>
              <LoadingCard />
              <LoadingCard />
              <LoadingCard />
              <LoadingCard />
            </>
          ) : (
            <>
              <MetricCard
                title="Total Sessions"
                value={formatNumber(data?.retention?.total_sessions ?? null)}
                description="Total number of user sessions"
                color="blue"
              />
              <MetricCard
                title="Bounce Rate"
                value={formatPercent(data?.retention?.bounce_rate ?? null)}
                description="Percentage of single-page sessions"
                color="red"
              />
              <MetricCard
                title="Avg. Session Duration"
                value={formatDuration(data?.retention?.avg_session_duration ?? null)}
                description="Average time spent per session"
                color="emerald"
              />
              <MetricCard
                title="Pages per Session"
                value={formatNumber(data?.retention?.avg_pages_per_session ?? null)}
                description="Average pages viewed per session"
                color="amber"
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {loading ? (
            <>
              <LoadingChartCard />
              <LoadingChartCard />
            </>
          ) : (
            <>
              <ChartCard title="Page Views">
                {data?.timeOnPage && data.timeOnPage.length > 0 ? (
                  <BarChart
                    data={data.timeOnPage}
                    index="page_path"
                    categories={['views']}
                    colors={['blue']}
                    valueFormatter={formatNumber}
                    yAxisWidth={48}
                  />
                ) : (
                  <Text className="text-center py-8">No page view data available</Text>
                )}
              </ChartCard>

              <ChartCard title="Average Time on Page">
                {data?.timeOnPage && data.timeOnPage.length > 0 ? (
                  <BarChart
                    data={data.timeOnPage}
                    index="page_path"
                    categories={['avg_time_on_page']}
                    colors={['emerald']}
                    valueFormatter={(value) => formatDuration(value)}
                    yAxisWidth={48}
                  />
                ) : (
                  <Text className="text-center py-8">No time on page data available</Text>
                )}
              </ChartCard>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {loading ? (
            <>
              <LoadingChartCard />
              <LoadingChartCard />
            </>
          ) : (
            <>
              <ChartCard title="Device Distribution">
                {data?.deviceMetrics && data.deviceMetrics.length > 0 ? (
                  <DonutChart
                    data={data.deviceMetrics}
                    category="sessions"
                    index="device"
                    valueFormatter={formatNumber}
                    colors={['slate', 'violet', 'indigo', 'rose', 'cyan', 'amber']}
                  />
                ) : (
                  <Text className="text-center py-8">No device data available</Text>
                )}
              </ChartCard>

              <ChartCard title="Geographic Distribution">
                <div className="h-80">
                  <MapWithNoSSR data={data?.geographicData || []} />
                </div>
              </ChartCard>
            </>
          )}
        </div>
      </div>
    </main>
  );
} 