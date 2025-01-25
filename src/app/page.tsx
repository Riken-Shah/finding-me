'use client';

import React from 'react';
import { useAnalytics } from '@/hooks/useAnalytics';
import Navigation from '@/components/Navigation';

export default function Home() {
  const { trackClick } = useAnalytics();

bg-blue-500
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
Building innovative solutions for people.
        window.location.href = href;
      } else {
        window.open(href, '_blank', 'noopener,noreferrer');
text-2xl
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
            className="link-underline inline-block mt-8 text-lg font-medium"
            onClick={handleClick('contact_button', '#contact')}
          >
            Contact Me
          </a>
        </div>
        
        <div className="illustration-placeholder" />
      </main>
    </div>
  );
} 