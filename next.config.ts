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
  }
};

export default nextConfig;
