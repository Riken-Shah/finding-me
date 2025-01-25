import React from 'react';
import { useAnalytics } from '@/hooks/useAnalytics';
import Navigation from '@/components/Navigation';

export default function Home() {
  const { trackClick } = useAnalytics();

  const handleClick = (element: string, href?: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    trackClick({
      element,
      href,
      x: e.clientX,
      y: e.clientY,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight
    });
    
    if (href) {
      if (href.startsWith('#')) {
        document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
      } else if (href.startsWith('mailto:')) {
        window.location.href = href;
      } else {
        window.open(href, '_blank', 'noopener,noreferrer');
      }
    }
  };

  return (
    <div className="min-h-screen bg-white antialiased">
      <Navigation />
      
      <main className="container pt-24">
        <div>
          <h1 className="heading">
            Building <span className="underline decoration-[3px] md:decoration-4 underline-offset-4">what</span>
            <br />
            people want.
          </h1>
          
          <p className="subheading mt-6 max-w-xl">
            A personal space where I share my experiences,
            project insights, and thoughtful essays.
          </p>
          
          <a
            href="#contact"
            className="link-underline inline-block mt-8 text-lg font-medium text-blue-600"
            onClick={handleClick('contact_button', '#contact')}
          >
            Get in Touch
          </a>
        </div>
        
        <div className="illustration-placeholder" />
      </main>
    </div>
  );