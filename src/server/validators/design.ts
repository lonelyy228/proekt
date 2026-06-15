import { z } from "zod";

const MAX_IMAGE_SOURCE_CHARS = 10_000_000;
const MAX_CANVAS_JSON_CHARS = 18_000_000;
const MAX_FABRIC_OBJECTS = 250;
const SAFE_FABRIC_OBJECT_TYPES = new Set([
  "textbox",
  "text",
  "i-text",
  "image",
  "rect",
  "line",
  "group"
]);

const imageSourceSchema = z
  .string()
  .max(MAX_IMAGE_SOURCE_CHARS)
  .refine((value) => {
    if (value.startsWith("data:image/png;base64,") || value.startsWith("data:image/webp;base64,")) {
      return true;
    }

    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "Expected an http(s), png data URL, or webp data URL");

const optionalFiniteNumberSchema = z.number().finite().optional();
const nullablePaintSchema = z.union([z.string().max(128), z.record(z.string(), z.unknown()), z.null()]).optional();

const designObjectSchema = z
  .object({
    type: z.string().min(1).max(80),
    left: optionalFiniteNumberSchema,
    top: optionalFiniteNumberSchema,
    width: optionalFiniteNumberSchema,
    height: optionalFiniteNumberSchema,
    scaleX: z.number().positive().finite().optional(),
    scaleY: z.number().positive().finite().optional(),
    angle: optionalFiniteNumberSchema,
    fill: nullablePaintSchema,
    stroke: nullablePaintSchema,
    text: z.string().max(500).optional(),
    src: imageSourceSchema.optional()
  })
  .passthrough()
  .superRefine((value, context) => {
    const objectType = value.type.toLowerCase();

    if (!SAFE_FABRIC_OBJECT_TYPES.has(objectType)) {
      context.addIssue({
        code: "custom",
        path: ["type"],
        message: `Unsupported Fabric object type: ${value.type}`
      });
    }
  });

const canvasJsonSchema = z
  .object({
    version: z.string().min(1).max(40),
    objects: z.array(designObjectSchema).max(MAX_FABRIC_OBJECTS)
  })
  .passthrough()
  .superRefine((value, context) => {
    const serializedLength = JSON.stringify(value).length;

    if (serializedLength > MAX_CANVAS_JSON_CHARS) {
      context.addIssue({
        code: "custom",
        message: "Canvas JSON exceeds maximum payload size"
      });
    }
  });

export const designSchema = z.object({
  garmentType: z.enum(["TSHIRT", "HOODIE", "SWEATSHIRT", "SHORTS"]),
  garmentColor: z.string().min(1).max(32),
  canvasJson: canvasJsonSchema,
  previewUrl: imageSourceSchema,
  previewWidth: z.number().int().positive().max(4096),
  previewHeight: z.number().int().positive().max(4096)
});
