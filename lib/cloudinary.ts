import type { ImageLoaderProps } from "next/image";

/**
 * Cloudinary delivery.
 *
 * The point of routing images through Cloudinary is NOT just compression — it is
 * that transforms happen on Cloudinary's free tier instead of consuming Vercel
 * Hobby's image-optimization quota, which a photo gallery is the fastest way to
 * exhaust.
 *
 * `f_auto,q_auto` lets Cloudinary pick format (AVIF/WebP) and quality per client.
 */

export const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

export function isCloudinaryConfigured(): boolean {
  return CLOUD_NAME.length > 0;
}

/**
 * next/image loader. `src` is the Cloudinary public ID (e.g. "pia-debut/portrait-01").
 *
 * `c_limit` prevents upscaling past the original, so we never pay to serve a
 * blurry enlargement.
 */
export function cloudinaryLoader({ src, width, quality }: ImageLoaderProps): string {
  const transforms = [
    "f_auto",
    `q_${quality ?? "auto"}`,
    `w_${width}`,
    "c_limit",
    "dpr_auto",
  ].join(",");

  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transforms}/${src}`;
}

/**
 * Decide how a gallery entry should be served.
 *
 * While `publicId` is null the file is served straight from /public with
 * `unoptimized`, which keeps the site working before Cloudinary is set up AND
 * still avoids the Vercel optimizer. Fill in `publicId` in event.config.ts after
 * uploading and delivery switches over with no component change.
 */
export function resolveImage(entry: { src: string; publicId: string | null }) {
  if (entry.publicId && isCloudinaryConfigured()) {
    return { src: entry.publicId, loader: cloudinaryLoader, unoptimized: false } as const;
  }
  return { src: entry.src, loader: undefined, unoptimized: true } as const;
}
