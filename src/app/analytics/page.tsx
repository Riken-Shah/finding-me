'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

// Helper function to format numbers safely
const formatNumber = (num: number | null | undefined, decimals: number = 0): string => {
  if (num === null || num === undefined) return '0';
  return decimals > 0 ? num.toFixed(decimals) : num.toLocaleString();
};

// Helper function to format time
const formatTime = (ms: number | null | undefined): string => {
  if (!ms) return '0s';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

// Helper function to format percentage
const formatPercent = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return '0%';
  return `${num.toFixed(1)}%`;
};

// Add new helper function for sorting sections by engagement
const getSectionEngagement = (data: any) => {
  const sections = new Map();
  
  // Collect events by section
  data.pages.stats.forEach((page: any) => {
    const pathParts = page.page_path.split('/').filter(Boolean);
    const section = pathParts[0] || 'home';
    
    if (!sections.has(section)) {
      sections.set(section, {
        name: section,
        views: 0,
        unique_views: 0,
        avg_time: 0,
        scroll_depth: 0,
        engagement_score: 0
      });
    }
    
    const sectionData = sections.get(section);
    sectionData.views += page.views || 0;
    sectionData.unique_views += page.unique_views || 0;
    sectionData.avg_time += page.avg_time || 0;
    sectionData.scroll_depth += page.scroll_depth || 0;
  });
  
  // Calculate engagement score and format data
  return Array.from(sections.values())
    .map(section => ({
      ...section,
      engagement_score: (
        (section.views * 0.3) + 
        (section.unique_views * 0.2) + 
        (section.avg_time * 0.25) + 
        (section.scroll_depth * 0.25)
      )
    }))
    .sort((a, b) => b.engagement_score - a.engagement_score)
    .slice(0, 5);
};

export default function AnalyticsDashboard() {
  const [period, setPeriod] = useState('7d');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Add no-track header to all requests
        const headers = {
          'X-No-Track': '1'
        };

        const response = await fetch(`/api/analytics/public?period=${period}`, { headers });
        const json = await response.json();
        setData(json);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      }
      setLoading(false);
    };

    fetchData();
  }, [period]);

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <div className="animate-pulse text-center">Loading analytics...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen p-8">
        <div className="text-center text-red-500">Failed to load analytics data</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="p-6 bg-white rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold text-gray-500">Total Sessions</h3>
            <p className="text-3xl font-bold">{formatNumber(data.sessions.total_sessions)}</p>
            <p className="text-sm text-gray-500">
              {formatNumber(data.sessions.new_users)} new users
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold text-gray-500">Avg. Session Duration</h3>
            <p className="text-3xl font-bold">{formatTime(data.sessions.avg_duration)}</p>
            <p className="text-sm text-gray-500">
              {formatNumber(data.engagement.pageviews_per_session, 1)} pages/session
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold text-gray-500">Bounce Rate</h3>
            <p className="text-3xl font-bold">{formatPercent(data.sessions.bounce_rate)}</p>
            <p className="text-sm text-gray-500">
              {formatNumber(data.sessions.returning_users)} returning users
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold text-gray-500">Avg. Scroll Depth</h3>
            <p className="text-3xl font-bold">{formatPercent(data.engagement.avg_scroll_depth)}</p>
            <p className="text-sm text-gray-500">
              {formatPercent(data.pages.scrollDepth[100])} reached bottom
            </p>
          </div>
        </div>

        {/* Traffic Sources & Devices */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="p-6 bg-white rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Traffic Sources</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.traffic.bySource}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="source" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="sessions" fill="#8884d8" name="Sessions" />
                <Bar dataKey="bounce_rate" fill="#82ca9d" name="Bounce Rate (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="p-6 bg-white rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Devices</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.traffic.byDevice}
                  dataKey="sessions"
                  nameKey="device"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {data.traffic.byDevice.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Page Performance */}
        <div className="p-6 bg-white rounded-lg shadow-lg mb-8">
          <h2 className="text-xl font-semibold mb-4">Page Performance</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-4 py-2">Page</th>
                  <th className="px-4 py-2">Views</th>
                  <th className="px-4 py-2">Unique Views</th>
                  <th className="px-4 py-2">Avg. Time</th>
                  <th className="px-4 py-2">Exit Rate</th>
                  <th className="px-4 py-2">Scroll Depth</th>
                </tr>
              </thead>
              <tbody>
                {data.pages.stats.map((page: any, i: number) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="px-4 py-2">{page.page_path}</td>
                    <td className="px-4 py-2">{formatNumber(page.views)}</td>
                    <td className="px-4 py-2">{formatNumber(page.unique_views)}</td>
                    <td className="px-4 py-2">{formatTime(page.avg_time)}</td>
                    <td className="px-4 py-2">{formatPercent(page.exit_rate)}</td>
                    <td className="px-4 py-2">{formatPercent(page.scroll_depth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Geographic Distribution */}
        <div className="p-6 bg-white rounded-lg shadow-lg mb-8">
          <h2 className="text-xl font-semibold mb-4">Geographic Distribution</h2>
          <div className="overflow-x-auto">
            {data.traffic.byCountry?.length > 0 ? (
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="px-4 py-2">Country</th>
                    <th className="px-4 py-2">Sessions</th>
                    <th className="px-4 py-2">Users</th>
                  </tr>
                </thead>
                <tbody>
                  {data.traffic.byCountry.map((country: any, i: number) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                      <td className="px-4 py-2">{country.country || 'Unknown'}</td>
                      <td className="px-4 py-2">{formatNumber(country.sessions)}</td>
                      <td className="px-4 py-2">{formatNumber(country.users)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center text-gray-500 py-4">
                No geographic data available
              </div>
            )}
          </div>
        </div>

        {/* Most Engaged Sections */}
        <div className="p-6 bg-white rounded-lg shadow-lg mb-8">
          <h2 className="text-xl font-semibold mb-4">Most Engaged Sections</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-4 py-2">Section</th>
                  <th className="px-4 py-2">Total Views</th>
                  <th className="px-4 py-2">Unique Views</th>
                  <th className="px-4 py-2">Avg. Time</th>
                  <th className="px-4 py-2">Avg. Scroll Depth</th>
                </tr>
              </thead>
              <tbody>
                {getSectionEngagement(data).map((section: any, i: number) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="px-4 py-2 capitalize">{section.name}</td>
                    <td className="px-4 py-2">{formatNumber(section.views)}</td>
                    <td className="px-4 py-2">{formatNumber(section.unique_views)}</td>
                    <td className="px-4 py-2">{formatTime(section.avg_time)}</td>
                    <td className="px-4 py-2">{formatPercent(section.scroll_depth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            Engagement score is calculated based on views, time spent, and scroll depth
          </p>
        </div>

        {/* Scroll Depth Distribution */}
        <div className="p-6 bg-white rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Scroll Depth Distribution</h2>
          <div className="grid grid-cols-4 gap-4">
            {[25, 50, 75, 100].map((depth) => (
              <div key={depth} className="p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-500">{depth}% Scroll</h3>
                <p className="text-3xl font-bold">
                  {formatPercent(data.pages?.scrollDepth?.[depth] || 0)}
                </p>
                <p className="text-sm text-gray-500">
                  of users reached {depth}% of page
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 