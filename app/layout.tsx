import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FreshRecipes",
  description: "Type a natural-language request. We’ll fetch and format it.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="no-dark">
      <head>
        {/* Force light scheme for Safari/iOS and form controls */}
        <meta name="color-scheme" content="light" />
        {/* Older iOS hint */}
        <meta name="supported-color-schemes" content="light" />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
