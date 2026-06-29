/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The app is a client-rendered SPA (custom window-based router); we keep that
  // intact and only use Next for server-rendered <head> metadata + hosting.
  eslint: {
    dirs: ['app', 'src'],
  },
}

export default nextConfig
