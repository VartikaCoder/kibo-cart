import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
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
