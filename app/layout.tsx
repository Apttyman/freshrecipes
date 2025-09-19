// app/layout.tsx
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Playfair_Display } from "next/font/google";

export const metadata: Metadata = {
  title: "FreshRecipes",
  description: "Fetch chef-grade recipes with full HTML and real images.",
};

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "700", "900"],
  display: "swap",
});

// Shared button style (use this in page.tsx too for uniformity)
const btn =
  "inline-flex items-center justify-center h-11 px-5 rounded-xl " +
  "bg-indigo-600 text-white font-semibold tracking-wide " +
  "shadow-sm shadow-indigo-300/40 hover:bg-indigo-500 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 " +
  "transition-colors";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={playfair.variable}>
      <body className="min-h-dvh bg-neutral-50 text-neutral-900 antialiased">
        {/* Global header — only one */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-neutral-200">
          <div className="mx-auto max-w-3xl px-4 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 select-none">
              {/* Simple gradient squircle logo */}
              <span
                aria-hidden
                className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-amber-400 shadow-sm"
              />
              <span className="text-xl font-black leading-none"
                style={{ fontFamily: "var(--font-serif)" }}>
                FreshRecipes
              </span>
            </Link>

            <Link href="/archive" className={btn} prefetch>
              Archive
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>

        {/* Single footer */}
        <footer className="border-t border-neutral-200 bg-white">
          <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-neutral-600">
            © 2025 FreshRecipes
          </div>
        </footer>
      </body>
    </html>
  );
}

// Export the class so page.tsx can match button styling if needed
export const buttonClass = btn;
