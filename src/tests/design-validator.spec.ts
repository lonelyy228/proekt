import { describe, expect, it } from "vitest";
import { designSchema } from "../server/validators/design";

describe("designSchema", () => {
  it("accepts valid payload with trusted preview and object assets", () => {
    const parsed = designSchema.parse({
      garmentType: "TSHIRT",
      garmentColor: "#111111",
      canvasJson: {
        version: "6.0.0",
        objects: [
          {
            type: "textbox",
            left: 240,
            top: 220,
            width: 220,
            height: 60,
            scaleX: 1,
            scaleY: 1,
            angle: 0,
            text: "RSH",
            fontFamily: "Space Grotesk"
          },
          {
            type: "image",
            left: 260,
            top: 310,
            width: 200,
            height: 200,
            scaleX: 0.5,
            scaleY: 0.5,
            angle: 0,
            src: "https://utfs.io/f/sample-asset.webp"
          }
        ]
      },
      previewUrl: "https://utfs.io/f/sample-preview.webp",
      previewWidth: 1024,
      previewHeight: 1024
    });

    expect(parsed.garmentType).toBe("TSHIRT");
    expect(parsed.canvasJson.objects.length).toBe(2);
  });

  it("rejects untrusted preview url", () => {
    expect(() =>
      designSchema.parse({
        garmentType: "HOODIE",
        garmentColor: "#222222",
        canvasJson: {
          version: "6.0.0",
          objects: []
        },
        previewUrl: "https://evil-cdn.example.com/preview.webp",
        previewWidth: 800,
        previewHeight: 800
      })
    ).toThrowError(/Preview must use trusted object storage/i);
  });

  it("rejects untrusted image src in fabric objects", () => {
    expect(() =>
      designSchema.parse({
        garmentType: "SWEATSHIRT",
        garmentColor: "#333333",
        canvasJson: {
          version: "6.0.0",
          objects: [
            {
              type: "image",
              left: 20,
              top: 30,
              width: 200,
              height: 200,
              scaleX: 1,
              scaleY: 1,
              angle: 0,
              src: "https://example.com/not-allowed.png"
            }
          ]
        },
        previewUrl: "https://utfs.io/f/preview.webp",
        previewWidth: 600,
        previewHeight: 600
      })
    ).toThrowError(/trusted object storage/i);
  });

  it("rejects object outside print area", () => {
    expect(() =>
      designSchema.parse({
        garmentType: "TSHIRT",
        garmentColor: "#111111",
        canvasJson: {
          version: "6.0.0",
          objects: [
            {
              type: "textbox",
              left: 12,
              top: 14,
              width: 260,
              height: 80,
              scaleX: 1,
              scaleY: 1,
              angle: 0,
              text: "out-of-bounds",
              fontFamily: "Arial"
            }
          ]
        },
        previewUrl: "https://utfs.io/f/preview.webp",
        previewWidth: 1024,
        previewHeight: 1024
      })
    ).toThrowError(/print area/i);
  });
});
