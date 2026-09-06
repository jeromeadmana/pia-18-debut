import { CLOUDINARY_FOLDER } from "./cloudinary";

/**
 * Global `next/image` loader, wired up in next.config.ts.
 *
 * This has to be a module-level loader rather than a `loader` prop, because a
 * function cannot cross the Server/Client Component boundary — passing one from
 * a server-rendered page fails the build with "Functions cannot be passed
 * directly to Client Components".
 *
 * It handles both sources the gallery can have:
 *
 *   "/gallery/pia-01.jpg"  a local file in /public — returned untouched.
 *   "pia-01"               a Cloudinary public ID — rewritten to a delivery URL,
 *                          confined to this app's folder.
 *
 * Duplicating the scoping logic here rather than importing `scopedPublicId`
 * keeps this file free of anything that would drag app code into the loader
 * bundle; the folder constant itself is still the single source of truth.
 */

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

export default function imageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  // Local file, or an absolute URL someone passed deliberately. Leave it alone.
  if (src.startsWith("/") || src.startsWith("http")) return src;

  if (!CLOUD_NAME) return src;

  const id = src.replace(/^\/+/, "");

  // Belt and braces with `scopedPublicId`: an ID that climbs out of our folder
  // would address another project's asset on this shared account.
  if (id.split("/").includes("..")) {
    throw new Error(`Image ID "${src}" tries to escape the ${CLOUDINARY_FOLDER}/ folder.`);
  }

  const scoped = id.startsWith(`${CLOUDINARY_FOLDER}/`)
    ? id
    : `${CLOUDINARY_FOLDER}/${id}`;

  const transforms = [
    "f_auto",
    `q_${quality ?? "auto"}`,
    `w_${width}`,
    "c_limit",
    "dpr_auto",
  ].join(",");

  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transforms}/${scoped}`;
}
