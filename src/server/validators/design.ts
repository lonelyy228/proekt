import { z } from "zod";

const designObjectSchema = z.object({
  type: z.string().min(1).max(40),
  left: z.number(),
  top: z.number(),
  scaleX: z.number().positive(),
  scaleY: z.number().positive(),
  angle: z.number(),
  fill: z.string().max(32).optional(),
  text: z.string().max(300).optional(),
  src: z.string().url().optional()
});

export const designSchema = z.object({
  garmentType: z.enum(["TSHIRT", "HOODIE", "SWEATSHIRT", "SHORTS"]),
  garmentColor: z.string().min(1).max(32),
  canvasJson: z.object({
    version: z.string(),
    objects: z.array(designObjectSchema).max(250)
  }),
  previewUrl: z.string().url(),
  previewWidth: z.number().int().positive().max(4096),
  previewHeight: z.number().int().positive().max(4096)
});
