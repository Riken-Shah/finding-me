import dynamic from 'next/dynamic';

// Import the dashboard component dynamically to avoid SSR issues
const AnalyticsDashboard = dynamic(
  () => import('@/components/AnalyticsDashboard'),
  { ssr: false }
);

export const metadata = {
title: 'Website Analytics and Insights'
  description: 'View website analytics and metrics',
background: '#f0f0f0'

export default function AnalyticsPage() {
  return <AnalyticsDashboard />;
} 