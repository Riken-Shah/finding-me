'use client';

import { useAnalytics } from '@/hooks/useAnalytics';

export default function Home() {
  const { trackClick } = useAnalytics();

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-6xl sm:text-8xl font-bold tracking-tight mb-8">
            AI × Software × Art
          </h1>
          <p className="text-xl sm:text-2xl text-gray-400 max-w-2xl mx-auto mb-16">
            Building at the intersection of technology and creativity
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-6">
            <a
              href="#work"
              className="px-12 py-4 bg-white text-[rgb(15,23,42)] hover:bg-gray-100 transition-colors"
              onClick={() => trackClick('work_button')}
            >
              See my work
            </a>
            <a
              href="#contact"
              className="px-12 py-4 border border-white hover:bg-white/5 transition-colors"
              onClick={() => trackClick('contact_button')}
            >
              Get in touch
            </a>
          </div>
        </div>
      </section>

      {/* Currently Working Section */}
      <section id="work" className="h-screen flex items-center border-t border-white/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold mb-12 tracking-tight">Currently Working On</h2>
          <div className="space-y-8">
            <div 
              className="p-8 border border-white/10 hover:border-white/30 transition-colors"
              onClick={() => trackClick('current_work_item')}
            >
              <h3 className="text-xl sm:text-2xl font-semibold mb-4">Project Title</h3>
              <p className="text-gray-400 text-lg">
                Description of your current work and responsibilities.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Projects Section */}
      <section id="projects" className="h-screen flex items-center border-t border-white/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold mb-12 tracking-tight">Featured Projects</h2>
          <div className="space-y-8">
            <div 
              className="group p-8 border border-white/10 hover:border-white/30 transition-colors"
              onClick={() => trackClick('project_item')}
            >
              <h3 className="text-xl sm:text-2xl font-semibold mb-4 group-hover:text-white/80">Project Name</h3>
              <p className="text-gray-400 text-lg mb-6">
                Brief project description
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="px-4 py-1.5 text-sm border border-white/10">
                  Tech Stack
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Essays Section */}
      <section id="essays" className="h-screen flex items-center border-t border-white/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold mb-12 tracking-tight">Essays</h2>
          <div className="space-y-8">
            <div 
              className="p-8 border border-white/10 hover:border-white/30 transition-colors"
              onClick={() => trackClick('essay_item')}
            >
              <h3 className="text-xl sm:text-2xl font-semibold mb-4">Essay Title</h3>
              <p className="text-gray-400 text-lg mb-6">
                Brief essay description or excerpt
              </p>
              <a 
                href="#" 
                className="inline-flex items-center text-lg hover:text-white/80 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  trackClick('essay_read_more');
                }}
              >
                Read more <span className="ml-2">→</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="h-screen flex items-center border-t border-white/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-12 tracking-tight">Get in Touch</h2>
          <p className="text-xl sm:text-2xl text-gray-400 max-w-2xl mx-auto mb-16">
            I&apos;m always open to interesting conversations and opportunities.
          </p>
          <div className="flex justify-center gap-12 text-lg">
            <a
              href="mailto:your.email@example.com"
              className="hover:text-white/80 transition-colors"
              onClick={() => trackClick('contact_email')}
            >
              Email
            </a>
            <a
              href="https://github.com/yourusername"
              className="hover:text-white/80 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackClick('contact_github')}
            >
              GitHub
            </a>
            <a
              href="https://linkedin.com/in/yourusername"
              className="hover:text-white/80 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackClick('contact_linkedin')}
            >
              LinkedIn
            </a>
          </div>
        </div>
      </section>
    </main>
  );
} 