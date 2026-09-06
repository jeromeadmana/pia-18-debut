import { describe, expect, it } from "vitest";
import { v2 as cloudinary } from "cloudinary";
import { WISHES_FOLDER, createUploadTicket, signParams } from "@/lib/cloudinary-sign";
import { CLOUDINARY_FOLDER } from "@/lib/cloudinary";

/**
 * The signing algorithm is implemented by hand in lib/cloudinary-sign.ts so the
 * serverless function does not have to carry the Cloudinary SDK.
 *
 * That shortcut is only acceptable if it is verified rather than assumed — so
 * these tests check it against the real SDK, which is a devDependency and never
 * ships to production.
 */

const SECRET = "test-secret-not-a-real-key";

describe("signParams", () => {
  it("matches the Cloudinary SDK's own signature", () => {
    const params = { folder: "a/b", public_id: "wish-123", timestamp: 1700000000 };

    expect(signParams(params, SECRET)).toBe(
      cloudinary.utils.api_sign_request(params, SECRET),
    );
  });

  it("matches the SDK regardless of key insertion order", () => {
    // Cloudinary sorts params; if our implementation did not, a differently
    // ordered object would produce a signature the API rejects.
    const a = { timestamp: 1700000000, public_id: "z", folder: "a" };
    const b = { folder: "a", public_id: "z", timestamp: 1700000000 };

    expect(signParams(a, SECRET)).toBe(signParams(b, SECRET));
    expect(signParams(a, SECRET)).toBe(cloudinary.utils.api_sign_request(b, SECRET));
  });

  it("changes when any signed param changes", () => {
    const base = { folder: "a", public_id: "p", timestamp: 1 };

    expect(signParams({ ...base, folder: "b" }, SECRET)).not.toBe(
      signParams(base, SECRET),
    );
    expect(signParams({ ...base, public_id: "q" }, SECRET)).not.toBe(
      signParams(base, SECRET),
    );
    expect(signParams({ ...base, timestamp: 2 }, SECRET)).not.toBe(
      signParams(base, SECRET),
    );
  });
});

describe("createUploadTicket", () => {
  const configured = Boolean(process.env.CLOUDINARY_URL);
  const maybe = configured ? it : it.skip;

  maybe("pins the upload inside the app's wishes folder", () => {
    const ticket = createUploadTicket();

    expect(ticket.folder).toBe(WISHES_FOLDER);
    expect(ticket.folder.startsWith(`${CLOUDINARY_FOLDER}/`)).toBe(true);
  });

  maybe("generates a random public id rather than accepting one", () => {
    // Server-generated so a caller cannot name an upload over an existing
    // asset, and random so wishes cannot be enumerated by guessing.
    const a = createUploadTicket();
    const b = createUploadTicket();

    expect(a.publicId).toMatch(/^wish-[0-9a-f]{16}$/);
    expect(a.publicId).not.toBe(b.publicId);
  });

  maybe("never leaks the api secret in the ticket", () => {
    const ticket = createUploadTicket();
    const secret = /^cloudinary:\/\/[^:]+:([^@]+)@/.exec(process.env.CLOUDINARY_URL!)![1];

    expect(JSON.stringify(ticket)).not.toContain(secret);
  });

  maybe("uploads as a video resource, which is how Cloudinary stores audio", () => {
    expect(createUploadTicket().resourceType).toBe("video");
  });
});
