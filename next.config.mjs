/** @type {import('next').NextConfig} */

// Private areas: never indexed (see also lib/site.ts and app/robots.ts). Adapted from AcadeXMatch next.config.mjs.
const NOINDEX = ['/admin', '/admin/:path*', '/candidate/:path*', '/school/:path*', '/account', '/account/:path*',
  '/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/api/:path*'];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['mysql2'],
  async headers() {
    return [
      { source: '/:path*', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://accounts.google.com" },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        ...(process.env.NODE_ENV === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }] : []),
      ] },
      ...NOINDEX.map(source => ({ source, headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] })),
    ];
  },
};

export default nextConfig;
