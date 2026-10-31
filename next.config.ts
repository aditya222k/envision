import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["playwright"],
  experimental: {
    // The disk cache kept serving old CSS after globals.css changed.
    turbopackFileSystemCacheForDev: false,
    turbopackFileSystemCacheForBuild: false,
  },
  outputFileTracingIncludes: {
    "/api/generate": [
      "./node_modules/phaser/dist/phaser.min.js",
      "./src/lib/games/engine/world.js",
      "./src/lib/games/engine/lab.js",
      "./src/lib/games/engine/activities.js",
      "./src/lib/games/engine/world3d.js",
      "./src/lib/games/engine/three.global.js",
    ],
    // Route keys are globs, so the brackets in [id] are escaped.
    "/ready-games/\\[id\\]": ["./src/lib/games/prebuilt/*.html"],
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
