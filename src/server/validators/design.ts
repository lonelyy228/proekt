import { z } from "zod";
import {
  CUSTOMIZER_ALLOWED_FONTS,
  CUSTOMIZER_ALLOWED_OBJECT_TYPES,
  CUSTOMIZER_ALLOWED_TEXT_TYPES,
  CUSTOMIZER_CANVAS_SIZE,
  CUSTOMIZER_CONSTRAINTS,
  CUSTOMIZER_GARMENT_TYPES,
  CustomizerAllowedObjectType,
  getGarmentPrintArea
} from "@/config/customizer";
import { uploadConfig } from "@/config/constants";
import { isTrustedAssetUrl } from "@/server/utils/image-validation";

const isHexColor = (value: string): boolean => /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());

const designObjectSchema = z
  .object({
    type: z.string().min(1).max(40),
    left: z.number().finite(),
    top: z.number().finite(),
    width: z.number().finite().optional(),
    height: z.number().finite().optional(),
    scaleX: z.number().finite().positive(),
    scaleY: z.number().finite().positive(),
    angle: z.number().finite(),
    fill: z.string().max(32).optional(),
    text: z.string().max(CUSTOMIZER_CONSTRAINTS.maxTextLength).optional(),
    fontFamily: z.string().max(80).optional(),
    src: z.string().url().max(2048).optional()
  })
  .passthrough();

export const designSchema = z
  .object({
    garmentType: z.enum(CUSTOMIZER_GARMENT_TYPES),
    garmentColor: z
      .string()
      .min(4)
      .max(32)
      .refine((value) => isHexColor(value), "Цвет вещи должен быть в HEX формате"),
    canvasJson: z
      .object({
        version: z.string().min(1).max(40),
        objects: z.array(designObjectSchema).max(CUSTOMIZER_CONSTRAINTS.maxObjects)
      })
      .passthrough(),
    previewUrl: z
      .string()
      .url()
      .max(2048)
      .refine((url) => isTrustedAssetUrl(url), "Preview must use trusted object storage"),
    previewWidth: z.number().int().min(CUSTOMIZER_CANVAS_SIZE.min).max(CUSTOMIZER_CANVAS_SIZE.max),
    previewHeight: z.number().int().min(CUSTOMIZER_CANVAS_SIZE.min).max(CUSTOMIZER_CANVAS_SIZE.max)
  })
  .refine(
    (payload) => payload.previewWidth * payload.previewHeight <= uploadConfig.maxImagePixels,
    "Preview pixel count exceeds allowed limit"
  )
  .superRefine((payload, ctx) => {
    const jsonSizeBytes = new TextEncoder().encode(JSON.stringify(payload.canvasJson)).length;
    if (jsonSizeBytes > CUSTOMIZER_CONSTRAINTS.maxCanvasJsonBytes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["canvasJson"],
        message: `Canvas payload too large: ${jsonSizeBytes} bytes`
      });
    }

    const printArea = getGarmentPrintArea(payload.garmentType, payload.previewWidth, payload.previewHeight);
    const maxX = printArea.left + printArea.width;
    const maxY = printArea.top + printArea.height;
    const tolerance = CUSTOMIZER_CONSTRAINTS.printAreaOverflowTolerancePx;

    payload.canvasJson.objects.forEach((object, index) => {
      const objectType = object.type.toLowerCase() as CustomizerAllowedObjectType;
      if (!CUSTOMIZER_ALLOWED_OBJECT_TYPES.includes(objectType)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["canvasJson", "objects", index, "type"],
          message: "Object type is not allowed"
        });
        return;
      }

      if (
        object.angle < CUSTOMIZER_CONSTRAINTS.minRotation ||
        object.angle > CUSTOMIZER_CONSTRAINTS.maxRotation
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["canvasJson", "objects", index, "angle"],
          message: "Rotation angle is out of allowed range"
        });
      }

      if (
        object.scaleX < CUSTOMIZER_CONSTRAINTS.minScale ||
        object.scaleX > CUSTOMIZER_CONSTRAINTS.maxScale ||
        object.scaleY < CUSTOMIZER_CONSTRAINTS.minScale ||
        object.scaleY > CUSTOMIZER_CONSTRAINTS.maxScale
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["canvasJson", "objects", index],
          message: "Scale is out of allowed range"
        });
      }

      if (
        typeof object.width !== "number" ||
        !Number.isFinite(object.width) ||
        typeof object.height !== "number" ||
        !Number.isFinite(object.height)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["canvasJson", "objects", index],
          message: "Object width and height are required"
        });
        return;
      }

      const scaledWidth = Math.abs(object.width * object.scaleX);
      const scaledHeight = Math.abs(object.height * object.scaleY);

      if (
        scaledWidth < CUSTOMIZER_CONSTRAINTS.minObjectSize ||
        scaledHeight < CUSTOMIZER_CONSTRAINTS.minObjectSize ||
        scaledWidth > CUSTOMIZER_CONSTRAINTS.maxObjectSize ||
        scaledHeight > CUSTOMIZER_CONSTRAINTS.maxObjectSize
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["canvasJson", "objects", index],
          message: "Object size is out of allowed range"
        });
      }

      const objectLeft = object.left;
      const objectTop = object.top;
      const objectRight = object.left + scaledWidth;
      const objectBottom = object.top + scaledHeight;

      if (
        objectLeft < printArea.left - tolerance ||
        objectTop < printArea.top - tolerance ||
        objectRight > maxX + tolerance ||
        objectBottom > maxY + tolerance
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["canvasJson", "objects", index],
          message: "Object must stay inside garment print area"
        });
      }

      if (objectType === "image") {
        if (!object.src || !isTrustedAssetUrl(object.src)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["canvasJson", "objects", index, "src"],
            message: "Image source must use trusted object storage"
          });
        }
      }

      if (objectType === "text" || objectType === "i-text" || objectType === "textbox") {
        if (!object.text || object.text.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["canvasJson", "objects", index, "text"],
            message: "Text object must contain text"
          });
        }

        if (object.fontFamily && !CUSTOMIZER_ALLOWED_FONTS.includes(object.fontFamily as (typeof CUSTOMIZER_ALLOWED_FONTS)[number])) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["canvasJson", "objects", index, "fontFamily"],
            message: "Font is not in allowlist"
          });
        }
      }
    });
  });
