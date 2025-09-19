import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    webpackBuildWorker: true,
  },
  webpack(config) {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    config.output = {
      ...config.output,
      environment: {
        ...(config.output?.environment ?? {}),
        asyncFunction: true,
      },
    };

    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    return config;
  },
  async headers() {
    return [
      {
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
