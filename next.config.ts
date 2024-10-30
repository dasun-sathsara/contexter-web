import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config, { isServer }) {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Handle WASM files as assets
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/wasm/[name].[hash][ext]',
        publicPath: '/_next/',
      },
    });

    // Set public path for workers
    if (!isServer) {
      config.output.publicPath = '/_next/';
    }

    return config;
  },
};

export default nextConfig;
