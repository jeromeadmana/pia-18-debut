import type { ImageLoaderProps } from "next/image";

/**
 * Cloudinary delivery.
 *
 * Two separate jobs here:
 *
 * 1. Transforms happen on Cloudinary's free tier instead of consuming Vercel
 *    Hobby's image-optimization quota, which a photo gallery is the fastest way
 *    to exhaust. `f_auto,q_auto` lets Cloudinary pick format and quality per
 *    client.
 *
 * 2. **Everything this app touches is confined to one folder.** The Cloudinary
 *    account is shared with other projects, so the folder prefix is enforced in
 *    code rather than left as a naming convention — see `scopedPublicId`. A
 *    convention is something a future edit forgets; a thrown error is not.
 *
 * Note there is deliberately NO delete helper anywhere in this codebase. On a
 * shared account an errant delete is the expensive, unrecoverable mistake, so
 * the safest design is one that cannot express it. Remove assets from the
 * Cloudinary console by hand.
 */

/** Every asset this app owns lives under this prefix. Nothing outside it is ours. */
export const CLOUDINARY_FOLDER = "pia-18-debut";

/** Public by design — it appears in every delivery URL. */
export const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

export function isCloudinaryConfigured(): boolean {
  return CLOUD_NAME.length > 0;
}

/**
 * Force a public ID into this app's folder, and refuse anything that tries to
 * climb out of it.
 *
 * The `..` check matters: Cloudinary public IDs are path-like, so a value such
 * as `../other-project/logo` would otherwise resolve outside our prefix and let
 * this app read — or a future upload path overwrite — another project's asset.
 */
export function scopedPublicId(publicId: string): string {
  const id = publicId.replace(/^\/+/, "");

  if (id.split("/").includes("..")) {
    throw new Error(
      `Cloudinary public ID "${publicId}" tries to escape the ${CLOUDINARY_FOLDER}/ folder.`,
    );
  }

  return id.startsWith(`${CLOUDINARY_FOLDER}/`) ? id : `${CLOUDINARY_FOLDER}/${id}`;
}

/**
 * Build a delivery URL. `src` is a Cloudinary public ID, scoped to our folder.
 *
 * `c_limit` prevents upscaling past the original, so we never pay to serve a
 * blurry enlargement.
 *
 * The actual `next/image` loader lives in lib/image-loader.ts and is wired up
 * globally in next.config.ts — a `loader` prop is a function and cannot cross
 * the Server/Client Component boundary. This function stays for direct URL
 * construction (og images, the guest pass) and is what the tests exercise.
 */
export function cloudinaryLoader({ src, width, quality }: ImageLoaderProps): string {
  const transforms = [
    "f_auto",
    `q_${quality ?? "auto"}`,
    `w_${width}`,
    "c_limit",
    "dpr_auto",
  ].join(",");

  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transforms}/${scopedPublicId(src)}`;
}

/**
 * Decide how a gallery entry should be served.
 *
 * While `publicId` is null — or Cloudinary is unconfigured — the file is served
 * straight from /public with `unoptimized`, which keeps the site working before
 * Cloudinary is set up AND still avoids the Vercel optimizer. Fill in `publicId`
 * in event.config.ts and delivery switches over with no component change.
 */
export function resolveImage(entry: { src: string; publicId: string | null }) {
  // Returns data only — no function. `unoptimized` short-circuits the global
  // loader for local files so /public images pass through untouched.
  if (entry.publicId && isCloudinaryConfigured()) {
    return { src: scopedPublicId(entry.publicId), unoptimized: false } as const;
  }
  return { src: entry.src, unoptimized: true } as const;
}
