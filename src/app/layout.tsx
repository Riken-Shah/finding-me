import './globals.css';
import { Analytics } from './analytics-client';

export const metadata = {
  title: 'Personal Website',
  description: 'Building at the intersection of technology and creativity',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
} 