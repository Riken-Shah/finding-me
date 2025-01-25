import dynamic from 'next/dynamic';

// Import the dashboard component dynamically to avoid SSR issues
const AnalyticsDashboard = dynamic(
  () => import('@/components/AnalyticsDashboard'),
  { ssr: false }
);

export const metadata = {
  title: 'Analytics and Insights',
  description: 'View website analytics and metrics',
};

export default function AnalyticsPage() {
  return <AnalyticsDashboard style={{ backgroundColor: '#f7f7f7' }} />