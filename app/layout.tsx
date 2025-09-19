// app/layout.tsx
import './globals.css';
import Link from 'next/link';
import { ReactNode } from 'react';

export const metadata = {
  title: 'FreshRecipes',
  description: 'Fetch and render chef-quality recipes.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        {/* Global header (only one) */}
        <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm">
                ✷
              </span>
              <span className="text-xl font-extrabold tracking-tight font-playfair">
                FreshRecipes
              </span>
            </Link>

            <Link
              href="/archive"
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-neutral-50 active:scale-[0.98] transition"
            >
              <span className="inline-block">🗂</span>
              <span>Archive</span>
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>

        {/* Clean footer (no Archive/Deploy links) */}
        <footer className="border-t border-neutral-200 bg-white">
          <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-neutral-500">
            © 2025 FreshRecipes
          </div>
        </footer>
      </body>
    </html>
  );
}
