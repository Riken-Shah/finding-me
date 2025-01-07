interface SectionViewEvent {
  section_id: string;
  visible_time_ms: number;
  viewport_height: number;
  section_height: number;
  visible_percentage: number;
}

export async function trackSectionView(event: SectionViewEvent): Promise<void> {
  try {
    const response = await fetch(`/api/analytics/track?page=${window.location.pathname}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_name: 'section_view',
        event_data: {
          ...event,
          timestamp: new Date().toISOString(),
          page_path: window.location.pathname,
          page_title: document.title,
          referrer: document.referrer,
          user_agent: navigator.userAgent,
          screen_width: window.screen.width,
          screen_height: window.screen.height
        }
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to track section view');
    }
  } catch (error) {
    console.error('Failed to track section view:', error);
  }
} 