import type { Metadata } from 'next';
import './globals.css';
import { Playfair_Display } from 'next/font/google';

// Expose Playfair as a CSS variable we can use anywhere.
// We’ll consume it in globals.css on `.recipe-title`.
const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'FreshRecipes',
  description: 'Type a natural-language request. We’ll fetch and format it.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={playfair.variable}>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
