import { z } from "zod";

const imageSourceSchema = z
  .string()
  .max(10_000_000)
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

const designObjectSchema = z.object({
  type: z.string().min(1).max(40),
  left: z.number(),
  top: z.number(),
  scaleX: z.number().positive(),
  scaleY: z.number().positive(),
  angle: z.number(),
  fill: z.string().max(32).optional(),
  text: z.string().max(300).optional(),
  src: imageSourceSchema.optional()
});

export const designSchema = z.object({
  garmentType: z.enum(["TSHIRT", "HOODIE", "SWEATSHIRT", "SHORTS"]),
  garmentColor: z.string().min(1).max(32),
  canvasJson: z.object({
    version: z.string(),
    objects: z.array(designObjectSchema).max(250)
  }),
  previewUrl: imageSourceSchema,
  previewWidth: z.number().int().positive().max(4096),
  previewHeight: z.number().int().positive().max(4096)
});
