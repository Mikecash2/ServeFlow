/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Disable webpack's persistent filesystem cache: this sandbox's /tmp
    // filesystem appears to reject the mmap operations webpack's cache pack
    // relies on (observed as SIGBUS during `next build`). In-memory caching
    // still works fine; this only affects cold-start compile speed.
    config.cache = false;
    return config;
  },
};
export default nextConfig;
