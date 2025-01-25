import dynamic from 'next/dynamic';

// Import the dashboard component dynamically to avoid SSR issues
const DeploymentAnalyticsDashboard = dynamic(
  () => import('@/components/DeploymentAnalyticsDashboard'),
  { ssr: false }
);

export const metadata = {
  title: 'Deployment Analytics | Admin',
  description: 'View and compare deployment performance metrics',
};

export default function DeploymentAnalyticsPage() {
  return (
    <main>
      <h1>Deployment Analytics and Performance</h1>
      <DeploymentAnalyticsDashboard style={{ backgroundColor: '#f0f0f0' }} />
    </main>
  );