import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components (PPR + "use cache") is intentionally disabled for the
  // foundation: every authenticated route is request-bound. Revisit in a later
  // milestone once static shells are worth the extra Suspense discipline.
  // See docs/architecture/adr/0003-next-cache-components-deferred.md.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Security headers applied to every response. CSP is deferred until the
  // asset/CDN strategy is settled (see docs/development/SECURITY.md).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
