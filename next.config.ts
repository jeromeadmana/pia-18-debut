import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /**
     * Transforms are delegated to Cloudinary, which keeps the gallery off
     * Vercel Hobby's image-optimization quota — the first thing a photo gallery
     * exhausts on that tier.
     *
     * This must be configured globally rather than per-`<Image>`: a `loader`
     * prop is a function, and functions cannot cross the Server/Client Component
     * boundary. See lib/image-loader.ts.
     */
    loader: "custom",
    loaderFile: "./lib/image-loader.ts",
  },
};

export default nextConfig;
