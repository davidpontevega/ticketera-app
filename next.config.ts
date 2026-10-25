import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      ...(process.env.NEXT_PUBLIC_MEDIA_URL ? [new URL(`${process.env.NEXT_PUBLIC_MEDIA_URL}/**`)] : []),
    ],
  },
};

export default nextConfig;
