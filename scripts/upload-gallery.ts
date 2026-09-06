import { readdirSync } from "node:fs";
import { join } from "node:path";
import { v2 as cloudinary } from "cloudinary";
import { CLOUDINARY_FOLDER } from "../lib/cloudinary";

/**
 * Upload the photoshoot into this app's own Cloudinary folder.
 *
 * **This account is shared with other projects.** Every safeguard here exists
 * because of that:
 *
 *   - Every asset is written under `CLOUDINARY_FOLDER`, and the public ID is
 *     derived from the filename rather than accepted from anywhere else.
 *   - `overwrite: false` — a re-run never clobbers an existing asset, so this is
 *     safe to run twice. Cloudinary returns the existing asset instead.
 *   - The script never lists, moves or deletes anything outside our folder, and
 *     there is no delete path at all. An errant delete on a shared account is
 *     unrecoverable; code that cannot express it cannot cause it.
 *
 * Credentials come from CLOUDINARY_URL, which the SDK reads itself. Nothing here
 * prints or logs it.
 *
 * Usage:  pnpm cloudinary:upload
 */

const SOURCE_DIR = join(process.cwd(), "public", "gallery");

function assertConfigured() {
  if (!process.env.CLOUDINARY_URL) {
    throw new Error(
      "CLOUDINARY_URL is not set. Add it to .env.local (cloudinary://key:secret@cloud).",
    );
  }
  // The SDK auto-configures from CLOUDINARY_URL; this just proves it parsed.
  const { cloud_name } = cloudinary.config();
  if (!cloud_name) throw new Error("CLOUDINARY_URL did not parse into a cloud name.");
  return cloud_name;
}

async function main() {
  const cloudName = assertConfigured();
  console.log(`Uploading to cloud "${cloudName}", folder "${CLOUDINARY_FOLDER}/"\n`);

  const files = readdirSync(SOURCE_DIR)
    .filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f))
    .sort();

  if (files.length === 0) {
    console.log(`No images found in ${SOURCE_DIR}`);
    return;
  }

  const results: { file: string; publicId: string; reused: boolean }[] = [];

  for (const file of files) {
    const path = join(SOURCE_DIR, file);
    const slug = file.replace(/\.[^.]+$/, "");

    const result = await cloudinary.uploader.upload(path, {
      folder: CLOUDINARY_FOLDER,
      public_id: slug,
      // Never clobber. A second run is a no-op that returns the existing asset.
      overwrite: false,
      // Content-addressed dedupe: an identical re-upload resolves to the same asset.
      unique_filename: false,
      use_filename: false,
      resource_type: "image",
    });

    // Cloudinary reports the original creation time; if it predates this run the
    // asset already existed and we reused it.
    const reused = Date.now() - new Date(result.created_at).getTime() > 10_000;

    results.push({ file, publicId: result.public_id, reused });
    console.log(
      `  ${reused ? "exists" : "upload"}  ${file}  ->  ${result.public_id}` +
        `  (${result.width}x${result.height}, ${(result.bytes / 1024).toFixed(0)} KB)`,
    );
  }

  console.log("\nPaste these into content/event.config.ts as `publicId`:\n");
  for (const r of results) {
    // Stored without the folder prefix; `scopedPublicId` re-adds it, so the
    // config stays readable and the folder can only be changed in one place.
    const bare = r.publicId.replace(`${CLOUDINARY_FOLDER}/`, "");
    console.log(`  publicId: "${bare}",`.padEnd(34) + `// ${r.file}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nUpload failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
