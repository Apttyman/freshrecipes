// app/layout.tsx
import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FreshRecipes",
  description: "Fetch chef-grade recipes and render them beautifully.",
};

export const buttonClass =
  "inline-flex items-center justify-center rounded-xl px-5 py-3 text-white " +
  "bg-indigo-600 hover:bg-indigo-600/90 active:bg-indigo-700 " +
  "shadow-[0_6px_20px_rgba(79,70,229,.3)] transition-colors font-semibold";

export const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-xl px-5 py-3 " +
  "bg-white text-neutral-800 border border-neutral-300 hover:bg-neutral-50 transition-colors font-semibold";

export const disabledButtonClass =
  "inline-flex items-center justify-center rounded-xl px-5 py-3 " +
  "bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed font-semibold";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-neutral-50 text-neutral-900">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 grid place-items-center text-white">✶</span>
              <span className="text-[20px] sm:text-[22px] font-extrabold tracking-tight">FreshRecipes</span>
            </Link>
            <Link
              href="/archive"
              className={secondaryButtonClass}
            >
              🗂️&nbsp;Archive
            </Link>
          </div>
        </header>

        {/* Page */}
        <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8">{children}</main>

        {/* Footer */}
        <footer className="border-t border-neutral-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 text-sm text-neutral-500">
            © 2025 FreshRecipes
          </div>
        </footer>
      </body>
    </html>
  );
}
