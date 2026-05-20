import { describe, expect, it } from "vitest";
import {
  assertTrustedAssetUrl,
  assertValidImageDimensions,
  assertValidImageMeta,
  isTrustedAssetUrl
} from "../server/utils/image-validation";

describe("image validation utils", () => {
  it("accepts supported mime and size", () => {
    expect(() => assertValidImageMeta("image/webp", 1024)).not.toThrow();
  });

  it("rejects unsupported mime type", () => {
    expect(() => assertValidImageMeta("image/svg+xml", 1024)).toThrowError(
      "Unsupported image file type"
    );
  });

  it("rejects oversize image dimensions", () => {
    expect(() => assertValidImageDimensions(5000, 1200)).toThrowError(
      "Image dimensions exceed maximum limit"
    );
  });

  it("rejects too many pixels", () => {
    expect(() => assertValidImageDimensions(4096, 4097)).toThrowError(
      "Image dimensions exceed maximum limit"
    );
  });

  it("accepts trusted upload host url", () => {
    expect(isTrustedAssetUrl("https://utfs.io/f/some-file.webp")).toBe(true);
    expect(() =>
      assertTrustedAssetUrl("https://ufs.sh/f/some-file.webp")
    ).not.toThrow();
  });

  it("rejects non-https and untrusted hosts", () => {
    expect(isTrustedAssetUrl("http://utfs.io/f/file.webp")).toBe(false);
    expect(isTrustedAssetUrl("https://example.com/file.webp")).toBe(false);
    expect(() =>
      assertTrustedAssetUrl("https://example.com/file.webp")
    ).toThrowError("Image URL is not from a trusted storage host");
  });
});
