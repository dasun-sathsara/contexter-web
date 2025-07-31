import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    webpackBuildWorker: true,
  },
  webpack(config) {
    // Experiments for WASM and workers, recommended for modern setups.
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // We no longer need a special rule for .wasm files, as we're not importing them directly.
    // The wasm-bindgen JS glue code will fetch it using `new URL('...'.wasm', import.meta.url)`.
    // Modern bundlers (Webpack 5+, Turbopack) understand this pattern and will copy the asset correctly.

    // Fallback for Node.js modules in client-side code.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    return config;
  },
  // Set required headers for cross-origin isolation and correct MIME type for WASM.
  async headers() {
    return [
      {
        // This rule is important. It ensures that any .wasm file served
        // has the correct MIME type. The browser requires this.
        source: "/:path*{.wasm}",
        headers: [
          {
            key: "Content-Type",
            value: "application/wasm",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
