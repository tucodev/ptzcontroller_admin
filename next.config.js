const path = require('path');

// ── 보안 헤더 ──────────────────────────────────────────────────
// CSP는 인라인 스크립트/스타일 이슈 발생 가능성으로 제외
// X-Frame-Options: SAMEORIGIN → 동일 출처 iframe 허용 (DENY시 일부 기능 깨질 수 있음)
const securityHeaders = [
    { key: 'X-Content-Type-Options',  value: 'nosniff' },
    { key: 'X-Frame-Options',         value: 'SAMEORIGIN' },
    { key: 'X-XSS-Protection',        value: '1; mode=block' },
    { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
    // tuco add
    output: "standalone", // 👈 이 줄을 추가하세요! standalone
    // tuco remove
    // distDir: process.env.NEXT_DIST_DIR || '.next',
    // output: process.env.NEXT_OUTPUT_MODE,
    // experimental: {
    //   outputFileTracingRoot: path.join(__dirname, '../'),
    // },
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: false,
    },
    images: { unoptimized: true },
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: securityHeaders,
            },
        ];
    },
};

module.exports = nextConfig;
