import type { NextConfig } from 'next';

const developmentEval = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';

const securityHeaders = [
  { key: 'Content-Security-Policy', value: `default-src 'self'; script-src 'self' 'unsafe-inline'${developmentEval}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
