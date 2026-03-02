const path = require('path');

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
};

module.exports = nextConfig;
