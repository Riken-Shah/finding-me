import dynamic from 'next/dynamic';

// Import the dashboard component dynamically to avoid SSR issues
const AnalyticsDashboard = dynamic(
  () => import('@/components/AnalyticsDashboard'),
  { ssr: false }
);

export const metadata = {
  title: 'Analytics Dashboard',
  description: 'View website analytics and metrics',
};

export default function AnalyticsPage() {
  return <AnalyticsDashboard title='Website Analytics' />;
}