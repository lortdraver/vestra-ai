// Baseline security headers. The CSP deliberately does not restrict
// script/style/connect sources yet: Paddle.js, GA4, Clarity and Vercel
// Analytics would need an audited allowlist first. These directives are safe
// to enforce today and block clickjacking, plugin content and base-tag hijacks.
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), geolocation=(self), microphone=(), payment=(self)',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ['sharp'],
  // sharp's native addon dlopen()s libvips-cpp.so from the sibling
  // @img/sharp-libvips-<platform> package. File tracing only follows JS
  // requires, so under pnpm the .so files were left out of the Vercel
  // function bundle and every sharp call failed with ERR_DLOPEN_FAILED.
  outputFileTracingIncludes: {
    '/api/**': [
      './node_modules/.pnpm/@img+sharp-libvips-linux-x64@*/node_modules/@img/sharp-libvips-linux-x64/lib/**/*',
    ],
  },
  images: {
    remotePatterns: [],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
