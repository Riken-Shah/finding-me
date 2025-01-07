import { useEffect, useRef } from 'react';
import { trackSectionView } from '@/utils/analytics';

export const useTrackSection = (sectionId: string) => {
  const observer = useRef<IntersectionObserver | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const cleanup = () => {
      if (observer.current) {
        observer.current.disconnect();
        observer.current = null;
      }
    };

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Start timing when section becomes visible
          startTimeRef.current = Date.now();
        } else if (startTimeRef.current) {
          // Track when section leaves viewport
          const visibleTime = Date.now() - startTimeRef.current;
          trackSectionView({
            section_id: sectionId,
            visible_time_ms: visibleTime,
            viewport_height: window.innerHeight,
            section_height: entry.boundingClientRect.height,
            visible_percentage: entry.intersectionRatio * 100
          });
          startTimeRef.current = null;
        }
      });
    };

    // Create observer
    observer.current = new IntersectionObserver(handleIntersection, {
      threshold: [0, 0.25, 0.5, 0.75, 1],
      rootMargin: '0px'
    });

    // Find and observe section
    const section = document.getElementById(sectionId);
    if (section) {
      observer.current.observe(section);
    }

    return cleanup;
  }, [sectionId]);
}; 