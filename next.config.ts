import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Static CSP (research R10; verified in the browser, see docs/security-notes.md). Every source beyond 'self' is
 * there because a reported violation proved it necessary:
 * - script-src 'unsafe-inline': Next's bootstrap and streamed RSC payload are inline <script>s. Without it the
 *   page never hydrates. A nonce would make every route dynamic and lose the static shell.
 * - style-src-attr 'unsafe-inline': next/image `fill` and the rating bar render `style="…"` attributes.
 *   Inline <style> elements stay blocked (style-src 'self').
 * - Development only: 'unsafe-eval' (React's dev error stacks) and style-src 'unsafe-inline' (the dev-tools overlay).
 * img-src needs no remote host: every product image is served through /_next/image on this origin.
 */
const csp: Record<string, string[]> = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
  // Dev only: Next's dev-tools overlay injects inline <style> elements.
  "style-src": ["'self'", ...(isDev ? ["'unsafe-inline'"] : [])],
  "style-src-attr": ["'unsafe-inline'"],
  "img-src": ["'self'"],
  "font-src": ["'self'"],
  "connect-src": ["'self'"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
};

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: Object.entries(csp)
      .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
      .join("; "),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app uses none of these; deny them so injected or third-party code can't either.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // E2E builds with CATALOGUE_SOURCE=fixture go to their own directory, so `npm start` never serves a
  // build (or cache) made from fixture data.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Only the catalogue's image host. Matches the API schema's image rule.
    remotePatterns: [{ protocol: "https", hostname: "fakestoreapi.com", pathname: "/img/**" }],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
