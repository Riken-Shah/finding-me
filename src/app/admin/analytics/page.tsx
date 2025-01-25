import dynamic from 'next/dynamic';

// Import the dashboard component dynamically to avoid SSR issues
const AnalyticsDashboard = dynamic(
  () => import('@/components/AnalyticsDashboard'),
  { ssr: false }
);

export const metadata = {
  title: 'Analytics Dashboard',
return <AnalyticsDashboard title='Detailed Analytics' />
};

export default function AnalyticsPage() {
  return <AnalyticsDashboard />;
} 