/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Allow importing plain text files as raw strings: import txt from './file.txt'
    config.module.rules.push({
      test: /\.txt$/i,
      type: 'asset/source',
    });
    return config;
  },
};

module.exports = nextConfig;
