import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Broad allow-list so remote images coming from LLM output don’t break.
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
      { protocol: "data", hostname: "**" }, // allow embedded data URLs if any
    ],
  },
};

export default nextConfig;
