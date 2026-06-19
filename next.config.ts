import type { NextConfig } from "next";

// Allow lizbuilds.ai (and its subdomains) to embed this app in an iframe.
// We intentionally do NOT set `X-Frame-Options: DENY`, which would block all
// framing; `frame-ancestors` is the modern, granular replacement.
const FRAME_ANCESTORS =
  "frame-ancestors 'self' https://lizbuilds.ai https://*.lizbuilds.ai";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: FRAME_ANCESTORS,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
