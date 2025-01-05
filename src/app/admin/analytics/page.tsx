'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

type MetricsData = {
  pageviews: Array<{ page_path: string; count: number; unique_visitors: number }>;
  events: Array<{ event_name: string; count: number }>;
  scrollData: Array<{ percentage: number; avg_time_to_reach: number; count: number }>;
  experiments: Array<{ experiment_id: string; variant: string; action: string; count: number }>;
  sectionEngagement: Array<{ section_id: string; avg_time_spent: number; views: number }>;
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function AnalyticsDashboard() {
  const [period, setPeriod] = useState('7d');
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/analytics/metrics?period=${period}`);
        const json = await response.json() as MetricsData;
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
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Page Views */}
          <div className="p-6 bg-white rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Top Pages</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.pageviews}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="page_path" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#0088FE" name="Views" />
                <Bar dataKey="unique_visitors" fill="#00C49F" name="Unique Visitors" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Events Distribution */}
          <div className="p-6 bg-white rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Events Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.events}
                  dataKey="count"
                  nameKey="event_name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {data.events.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Scroll Depth */}
          <div className="p-6 bg-white rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Scroll Depth</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.scrollData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="percentage" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#8884d8"
                  name="Reached"
                />
                <Line
                  type="monotone"
                  dataKey="avg_time_to_reach"
                  stroke="#82ca9d"
                  name="Avg Time (ms)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Section Engagement */}
          <div className="p-6 bg-white rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Section Engagement</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.sectionEngagement}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="section_id" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="views" fill="#8884d8" name="Views" />
                <Bar
                  dataKey="avg_time_spent"
                  fill="#82ca9d"
                  name="Avg Time Spent (ms)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* A/B Test Results */}
          {data.experiments.length > 0 && (
            <div className="p-6 bg-white rounded-lg shadow-lg md:col-span-2">
              <h2 className="text-xl font-semibold mb-4">A/B Test Results</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr>
                      <th className="px-4 py-2">Experiment</th>
                      <th className="px-4 py-2">Variant</th>
                      <th className="px-4 py-2">Action</th>
                      <th className="px-4 py-2">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.experiments.map((exp, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                        <td className="px-4 py-2">{exp.experiment_id}</td>
                        <td className="px-4 py-2">{exp.variant}</td>
                        <td className="px-4 py-2">{exp.action}</td>
                        <td className="px-4 py-2">{exp.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 