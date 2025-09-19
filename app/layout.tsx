// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FreshRecipes',
  description: 'Fetches chef-quality recipes and renders full Food52-style HTML.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <header className="site-header">
          <div className="brand">
            <span className="logo" aria-hidden>✺</span>
            <span className="brand-text">FreshRecipes</span>
          </div>
          <a className="archive-chip" href="/archive" aria-label="Open Archive">Archive</a>
        </header>

        <main className="site-main">{children}</main>

        <footer className="site-footer">
          <small>© 2025 FreshRecipes</small>
        </footer>
      </body>
    </html>
  );
}
