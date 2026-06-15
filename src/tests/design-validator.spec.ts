import { describe, expect, it } from "vitest";
import { designSchema } from "@/server/validators/design";

const safePreview = "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";

const baseDesignPayload = {
  garmentType: "TSHIRT",
  garmentColor: "#ffffff",
  canvasJson: {
    version: "7.3.1",
    objects: []
  },
  previewUrl: safePreview,
  previewWidth: 760,
  previewHeight: 760
} as const;

describe("designSchema", () => {
  it("accepts Fabric template, text and image objects with production-safe limits", () => {
    const parsed = designSchema.parse({
      ...baseDesignPayload,
      canvasJson: {
        version: "7.3.1",
        objects: [
          {
            type: "image",
            left: 120,
            top: 80,
            scaleX: 0.5,
            scaleY: 0.5,
            src: safePreview,
            data: {
              systemLayer: true
            }
          },
          {
            type: "textbox",
            left: 250,
            top: 300,
            text: "RSH custom",
            fill: "#111111",
            stroke: null,
            fontFamily: "Space Grotesk"
          },
          {
            type: "rect",
            width: 180,
            height: 220,
            fill: {
              source: "template-mask"
            }
          }
        ]
      }
    });

    expect(parsed.canvasJson.objects).toHaveLength(3);
  });

  it("rejects unsafe Fabric object types", () => {
    expect(() =>
      designSchema.parse({
        ...baseDesignPayload,
        canvasJson: {
          version: "7.3.1",
          objects: [
            {
              type: "script",
              left: 0,
              top: 0
            }
          ]
        }
      })
    ).toThrow(/Unsupported Fabric object type/);
  });

  it("rejects non-image and non-http image sources", () => {
    expect(() =>
      designSchema.parse({
        ...baseDesignPayload,
        previewUrl: "javascript:alert(1)"
      })
    ).toThrow(/Expected an http/);
  });
});
