import { createHash, randomBytes } from "node:crypto";
import { CLOUDINARY_FOLDER } from "./cloudinary";

/**
 * Signed direct-to-Cloudinary uploads.
 *
 * **Why direct rather than through our own API:** Vercel caps a serverless
 * request body at 4.5 MB and the function at 10s. A voice wish would sail past
 * both. So the browser uploads straight to Cloudinary and we only ever hand out
 * a signature.
 *
 * **Why signed rather than an unsigned preset:** an unsigned preset is a public
 * write endpoint. On an account shared with other projects that is not
 * acceptable — anyone who found it could fill the folder. Signing lets the
 * SERVER decide the folder and the public ID, and Cloudinary rejects the upload
 * if the client alters either, because both are covered by the signature.
 *
 * The signing algorithm is Cloudinary's documented one: sort the params, join
 * them `k=v&k=v`, append the api secret, SHA-1. It is implemented here rather
 * than pulled from the SDK so the serverless function stays small — and
 * `tests/cloudinary-sign.test.ts` checks this implementation against the real
 * SDK, so the shortcut is verified rather than assumed.
 */

/** Voice wishes live in their own subfolder, still inside the app's prefix. */
export const WISHES_FOLDER = `${CLOUDINARY_FOLDER}/wishes`;

/** Cloudinary treats audio as a video resource. */
export const WISH_RESOURCE_TYPE = "video";

function credentials() {
  const raw = process.env.CLOUDINARY_URL;
  if (!raw) throw new Error("CLOUDINARY_URL is not set.");

  const match = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(raw.trim());
  if (!match) throw new Error("CLOUDINARY_URL is malformed.");

  const [, apiKey, apiSecret, cloudName] = match;
  return { apiKey, apiSecret, cloudName };
}

/**
 * Cloudinary's signature: alphabetically sorted `k=v` pairs joined with `&`,
 * the api secret appended, SHA-1 hex.
 *
 * `file`, `api_key`, `resource_type` and `cloud_name` are excluded by
 * Cloudinary's spec — callers must not pass them in.
 */
export function signParams(params: Record<string, string | number>, apiSecret: string) {
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return createHash("sha1").update(canonical + apiSecret).digest("hex");
}

export type UploadTicket = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
  resourceType: string;
  uploadUrl: string;
};

/**
 * Mint a one-shot upload ticket.
 *
 * The public ID is generated here, never accepted from the client — otherwise a
 * caller could name their upload over an existing asset. It is random rather
 * than sequential so wishes cannot be enumerated by guessing.
 */
export function createUploadTicket(): UploadTicket {
  const { apiKey, apiSecret, cloudName } = credentials();

  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `wish-${randomBytes(8).toString("hex")}`;

  // Only these three are signed, so only these three are fixed. Cloudinary
  // rejects the upload if the client changes any of them.
  const signature = signParams(
    { folder: WISHES_FOLDER, public_id: publicId, timestamp },
    apiSecret,
  );

  return {
    cloudName,
    apiKey,
    timestamp,
    signature,
    folder: WISHES_FOLDER,
    publicId,
    resourceType: WISH_RESOURCE_TYPE,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${WISH_RESOURCE_TYPE}/upload`,
  };
}

/** Playback URL for a stored wish. */
export function wishAudioUrl(publicId: string, cloudName: string): string {
  const id = publicId.startsWith(`${WISHES_FOLDER}/`)
    ? publicId
    : `${WISHES_FOLDER}/${publicId}`;

  return `https://res.cloudinary.com/${cloudName}/${WISH_RESOURCE_TYPE}/upload/${id}`;
}
