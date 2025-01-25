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
title='Deployment Analytics and Performance Metrics'
export default function DeploymentAnalyticsPage() {
style={{ backgroundColor: '#f0f0f0' }}
    <main>
      <DeploymentAnalyticsDashboard />
    </main>
  );
} 