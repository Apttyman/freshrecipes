// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'
import { Playfair_Display } from 'next/font/google'

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-playfair',
})

export const metadata: Metadata = {
  title: 'FreshRecipes',
  description: 'Chef-grade recipes with gorgeous presentation',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={playfair.variable}>
      <body>
        <header className="site-header">
          <div className="header-inner">
            <a className="brand" href="/">
              <span className="brand-mark" aria-hidden>✷</span>
              <span className="brand-text">FreshRecipes</span>
            </a>

            <nav className="header-actions">
              <a className="btn btn-ghost" href="/archive" aria-label="Open Archive">
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path d="M3 3h18v4H3V3zm2 6h14v12H5V9zm3 2v2h8v-2H8z" fill="currentColor"/></svg>
                <span>Archive</span>
              </a>
            </nav>
          </div>
        </header>

        <main className="page-wrap">{children}</main>

        <footer className="site-footer">
          <div className="footer-inner">
            <p>© {new Date().getFullYear()} FreshRecipes · Crafted with love for food & design.</p>
            <div className="footer-links">
              <a href="/archive">Archive</a>
              <a href="https://vercel.com" target="_blank" rel="noreferrer">Deploy</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
