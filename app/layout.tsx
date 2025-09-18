import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "FreshRecipes — Generate chef-quality recipes",
  description:
    "Generate clear, well-formatted recipes with copy/print tools, mobile-first layout, and robust image handling.",
  applicationName: "FreshRecipes",
  metadataBase:
    typeof process !== "undefined"
      ? new URL("https://freshrecipes.vercel.app")
      : undefined,
  openGraph: {
    title: "FreshRecipes",
    description:
      "Generate chef-quality recipes with fast UX and robust image handling.",
    url: "https://freshrecipes.vercel.app",
    siteName: "FreshRecipes",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FreshRecipes",
    description:
      "Generate chef-quality recipes with fast UX and robust image handling.",
  },
  themeColor: "#2e5bff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header role="banner" />
        {children}
        <footer role="contentinfo" />
      </body>
    </html>
  );
}
