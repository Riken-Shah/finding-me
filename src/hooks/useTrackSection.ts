import { useEffect, useRef } from 'react';
import { trackSectionView } from '@/utils/analytics';

export const useTrackSection = (sectionId: string) => {
  const observer = useRef<IntersectionObserver | null>(null);
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => {
    const element = document.getElementById(sectionId);
    if (!element) return;

    observer.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            cleanup.current = trackSectionView(sectionId);
            observer.current?.disconnect();
          }
        });
      },
      {
        threshold: 0.5, // Track when 50% of the section is visible
      }
    );

    observer.current.observe(element);

    return () => {
      cleanup.current?.();
      observer.current?.disconnect();
    };
  }, [sectionId]);
}; 