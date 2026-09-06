import { describe, expect, it } from "vitest";
import {
  CLOUDINARY_FOLDER,
  cloudinaryLoader,
  resolveImage,
  scopedPublicId,
} from "@/lib/cloudinary";
import imageLoader from "@/lib/image-loader";

/**
 * The Cloudinary account is shared with other projects, so folder confinement is
 * a correctness property rather than tidiness. These tests pin it.
 */

describe("scopedPublicId", () => {
  it("adds the app's folder prefix", () => {
    expect(scopedPublicId("pia-01")).toBe(`${CLOUDINARY_FOLDER}/pia-01`);
  });

  it("does not double-prefix an already-scoped id", () => {
    expect(scopedPublicId(`${CLOUDINARY_FOLDER}/pia-01`)).toBe(
      `${CLOUDINARY_FOLDER}/pia-01`,
    );
  });

  it("tolerates a leading slash", () => {
    expect(scopedPublicId("/pia-01")).toBe(`${CLOUDINARY_FOLDER}/pia-01`);
  });

  it("REFUSES an id that climbs out of the folder", () => {
    // The one that matters on a shared account: without this, a public ID could
    // address — or a future upload path overwrite — another project's asset.
    expect(() => scopedPublicId("../other-project/logo")).toThrow(/escape/i);
    expect(() => scopedPublicId("a/../../b")).toThrow(/escape/i);
    expect(() => scopedPublicId(`${CLOUDINARY_FOLDER}/../secrets/x`)).toThrow(/escape/i);
  });

  it("allows nested paths inside the folder", () => {
    expect(scopedPublicId("gallery/pia-01")).toBe(
      `${CLOUDINARY_FOLDER}/gallery/pia-01`,
    );
  });
});

describe("cloudinaryLoader", () => {
  it("emits f_auto and q_auto, and confines the path to the folder", () => {
    const url = cloudinaryLoader({ src: "pia-01", width: 800 });

    expect(url).toContain("f_auto");
    expect(url).toContain("q_auto");
    expect(url).toContain("w_800");
    expect(url).toContain(`/${CLOUDINARY_FOLDER}/pia-01`);
  });

  it("honours an explicit quality", () => {
    expect(cloudinaryLoader({ src: "pia-01", width: 400, quality: 60 })).toContain("q_60");
  });

  it("uses c_limit so an image is never upscaled past its original", () => {
    expect(cloudinaryLoader({ src: "pia-01", width: 4000 })).toContain("c_limit");
  });
});

describe("resolveImage", () => {
  it("falls back to the local file when no publicId is set", () => {
    const r = resolveImage({ src: "/gallery/pia-01.jpg", publicId: null });

    expect(r.src).toBe("/gallery/pia-01.jpg");
    expect(r.unoptimized).toBe(true);
  });

  it("returns data only, never a function", () => {
    // A loader function cannot cross the Server/Client Component boundary — it
    // fails the build with "Functions cannot be passed directly to Client
    // Components". This is why the loader is global instead of a prop.
    for (const entry of [
      { src: "/gallery/pia-01.jpg", publicId: null },
      { src: "/gallery/pia-01.jpg", publicId: "pia-01" },
    ]) {
      for (const value of Object.values(resolveImage(entry))) {
        expect(typeof value).not.toBe("function");
      }
    }
  });
});

describe("global image loader", () => {
  it("passes local /public paths through untouched", () => {
    expect(imageLoader({ src: "/gallery/pia-01.jpg", width: 800 })).toBe(
      "/gallery/pia-01.jpg",
    );
  });

  it("rewrites a bare public ID into a folder-scoped delivery URL", () => {
    const url = imageLoader({ src: "pia-01", width: 800 });
    if (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) {
      expect(url).toContain(`/${CLOUDINARY_FOLDER}/pia-01`);
      expect(url).toContain("f_auto");
    } else {
      expect(url).toBe("pia-01");
    }
  });

  it("refuses an ID that climbs out of the folder", () => {
    if (!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) return;
    expect(() => imageLoader({ src: "../other-project/logo", width: 800 })).toThrow(
      /escape/i,
    );
  });
});
