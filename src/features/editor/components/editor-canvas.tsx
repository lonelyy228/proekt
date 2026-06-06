"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, FabricImage, FabricObject, Textbox } from "fabric";
import Link from "next/link";
import { ensureCsrfToken } from "@/lib/csrf-client";
import { formatStoreMoney } from "@/lib/currency";

type GarmentType = "TSHIRT" | "HOODIE" | "SHORTS";
type GarmentSide = "FRONT" | "BACK";

type LayerItem = {
  layerPosition: number;
  label: string;
};

type StatusAction = {
  href: string;
  label: string;
};

type CustomizerVariant = {
  id: string;
  name: string;
  sku: string;
  color: string;
  size: string;
  priceCents: number;
  currency: string;
  isDefault: boolean;
};

type CustomizerProduct = {
  id: string;
  slug: string;
  brand: string;
  name: string;
  garmentType: GarmentType | "SWEATSHIRT" | "PANTS";
  basePriceCents: number;
  currency: string;
  variants: CustomizerVariant[];
};

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
};

type PrintArea = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type GarmentTemplate = {
  code: GarmentType;
  label: string;
  hint: string;
  printArea: PrintArea;
};

type SystemLayerKind = "garment" | "grid";

type SystemLayerData = {
  systemLayer?: boolean;
  systemLayerKind?: SystemLayerKind;
};

const CANVAS_DIMENSION = 760;
const GRID_STEP = 20;
const MAX_IMAGE_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const TEMPLATE_LINE_THRESHOLD = 96;
const TEMPLATE_LINE_COLOR = 40;
const GARMENT_TEMPLATES: Record<GarmentType, GarmentTemplate> = {
  TSHIRT: {
    code: "TSHIRT",
    label: "Футболка",
    hint: "Печатная зона футболки",
    printArea: { left: 286, top: 282, width: 188, height: 224 }
  },
  HOODIE: {
    code: "HOODIE",
    label: "Худи",
    hint: "Печатная зона худи",
    printArea: { left: 278, top: 302, width: 204, height: 230 }
  },
  SHORTS: {
    code: "SHORTS",
    label: "Шорты",
    hint: "Печатная зона шорт",
    printArea: { left: 278, top: 292, width: 204, height: 170 }
  }
};
const GARMENT_OPTIONS: GarmentType[] = ["TSHIRT", "HOODIE", "SHORTS"];
const GARMENT_SIDE_OPTIONS: GarmentSide[] = ["FRONT", "BACK"];
const GARMENT_SIDE_LABELS: Record<GarmentSide, string> = {
  FRONT: "Перед",
  BACK: "Спина"
};
const GARMENT_COLORS = ["#f4f1ea", "#f7f7f2", "#111111", "#2b2b2b", "#5c564f", "#9b111e", "#1f3d72", "#7c8f7a"];
const FONT_FAMILIES = ["Space Grotesk", "Arial", "Times New Roman", "Courier New", "Georgia"];
const TEXT_COLORS = ["#111111", "#ffffff", "#d91b3a", "#214fce", "#0f8a5f", "#f29f05", "#7a3cff"];

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
type TemplateViewAsset = {
  crop: { x: number; y: number; width: number; height: number };
  printAreaRatio: { left: number; top: number; width: number; height: number };
  fillSeedRatios: Array<{ x: number; y: number }>;
  maxWidth: number;
  maxHeight: number;
  layered?: {
    base: string;
    mask: string;
    shadow: string;
    lines: string;
  };
};

type TemplateAsset = {
  src: string;
  views: Record<GarmentSide, TemplateViewAsset>;
};

type RasterTemplateResult = {
  dataUrl: string;
  left: number;
  top: number;
  width: number;
  height: number;
  printArea: PrintArea;
};

const TEMPLATE_ASSETS: Record<GarmentType, TemplateAsset> = {
  TSHIRT: {
    src: "/editor/templates/tshirt.jpg",
    views: {
      FRONT: {
        crop: { x: 0, y: 0, width: 0.39, height: 1 },
        printAreaRatio: { left: 0.24, top: 0.22, width: 0.52, height: 0.58 },
        fillSeedRatios: [
          { x: 0.5, y: 0.52 },
          { x: 0.24, y: 0.34 },
          { x: 0.76, y: 0.34 }
        ],
        maxWidth: 460,
        maxHeight: 500,
        layered: {
          base: "/editor/templates/layers/tshirt/tshirt-front-base.png",
          mask: "/editor/templates/layers/tshirt/tshirt-front-mask.png",
          shadow: "/editor/templates/layers/tshirt/tshirt-front-shadow.png",
          lines: "/editor/templates/layers/tshirt/tshirt-front-lines.png"
        }
      },
      BACK: {
        crop: { x: 0.52, y: 0, width: 0.39, height: 1 },
        printAreaRatio: { left: 0.24, top: 0.22, width: 0.52, height: 0.6 },
        fillSeedRatios: [
          { x: 0.5, y: 0.52 },
          { x: 0.24, y: 0.34 },
          { x: 0.76, y: 0.34 }
        ],
        maxWidth: 460,
        maxHeight: 500
      }
    }
  },
  HOODIE: {
    src: "/editor/templates/hoodie.jpg",
    views: {
      FRONT: {
        crop: { x: 0, y: 0, width: 0.4, height: 1 },
        printAreaRatio: { left: 0.24, top: 0.24, width: 0.52, height: 0.54 },
        fillSeedRatios: [
          { x: 0.5, y: 0.54 },
          { x: 0.2, y: 0.6 },
          { x: 0.8, y: 0.6 },
          { x: 0.5, y: 0.18 }
        ],
        maxWidth: 500,
        maxHeight: 560,
        layered: {
          base: "/editor/templates/layers/hoodie/hoodie-front-base.png",
          mask: "/editor/templates/layers/hoodie/hoodie-front-mask.png",
          shadow: "/editor/templates/layers/hoodie/hoodie-front-shadow.png",
          lines: "/editor/templates/layers/hoodie/hoodie-front-lines.png"
        }
      },
      BACK: {
        crop: { x: 0.52, y: 0, width: 0.4, height: 1 },
        printAreaRatio: { left: 0.24, top: 0.24, width: 0.52, height: 0.54 },
        fillSeedRatios: [
          { x: 0.5, y: 0.54 },
          { x: 0.18, y: 0.58 },
          { x: 0.82, y: 0.58 },
          { x: 0.5, y: 0.18 }
        ],
        maxWidth: 500,
        maxHeight: 560
      }
    }
  },
  SHORTS: {
    src: "/editor/templates/shorts.jpg",
    views: {
      FRONT: {
        crop: { x: 0, y: 0, width: 0.52, height: 1 },
        printAreaRatio: { left: 0.18, top: 0.22, width: 0.64, height: 0.54 },
        fillSeedRatios: [
          { x: 0.35, y: 0.5 },
          { x: 0.65, y: 0.5 }
        ],
        maxWidth: 480,
        maxHeight: 380,
        layered: {
          base: "/editor/templates/layers/shorts/shorts-front-base.png",
          mask: "/editor/templates/layers/shorts/shorts-front-mask.png",
          shadow: "/editor/templates/layers/shorts/shorts-front-shadow.png",
          lines: "/editor/templates/layers/shorts/shorts-front-lines.png"
        }
      },
      BACK: {
        crop: { x: 0.5, y: 0, width: 0.46, height: 1 },
        printAreaRatio: { left: 0.18, top: 0.22, width: 0.64, height: 0.54 },
        fillSeedRatios: [
          { x: 0.35, y: 0.5 },
          { x: 0.65, y: 0.5 }
        ],
        maxWidth: 480,
        maxHeight: 380
      }
    }
  }
};

const imageCache = new Map<string, HTMLImageElement>();

const parseHexColor = (hex: string): [number, number, number] => {
  const normalized = hex.replace("#", "");

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return [0, 0, 0];
  }

  return [parseInt(normalized.slice(0, 2), 16), parseInt(normalized.slice(2, 4), 16), parseInt(normalized.slice(4, 6), 16)];
};

const imageHasVisibleAlpha = (image: HTMLImageElement): boolean => {
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = image.width;
  sampleCanvas.height = image.height;
  const sampleContext = sampleCanvas.getContext("2d");

  if (!sampleContext) {
    return false;
  }

  sampleContext.clearRect(0, 0, sampleCanvas.width, sampleCanvas.height);
  sampleContext.drawImage(image, 0, 0, sampleCanvas.width, sampleCanvas.height);

  const pixels = sampleContext.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data;
  for (let index = 3; index < pixels.length; index += 32) {
    if (pixels[index] > 24) {
      return true;
    }
  }

  return false;
};

const applySyntheticGarmentDepth = (context: CanvasRenderingContext2D, width: number, height: number, garmentType: GarmentType): void => {
  context.save();
  context.globalCompositeOperation = "source-atop";

  const highlight = context.createRadialGradient(width * 0.5, height * 0.16, width * 0.08, width * 0.5, height * 0.22, width * 0.72);
  highlight.addColorStop(0, "rgba(255,255,255,0.18)");
  highlight.addColorStop(0.36, "rgba(255,255,255,0.08)");
  highlight.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = highlight;
  context.fillRect(0, 0, width, height);

  const topSoftness = context.createLinearGradient(0, 0, 0, height * 0.42);
  topSoftness.addColorStop(0, "rgba(255,255,255,0.05)");
  topSoftness.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = topSoftness;
  context.fillRect(0, 0, width, Math.round(height * 0.42));

  context.globalCompositeOperation = "multiply";

  const sideFalloff = context.createLinearGradient(0, 0, width, 0);
  sideFalloff.addColorStop(0, "rgba(0,0,0,0.12)");
  sideFalloff.addColorStop(0.18, "rgba(0,0,0,0.05)");
  sideFalloff.addColorStop(0.5, "rgba(0,0,0,0)");
  sideFalloff.addColorStop(0.82, "rgba(0,0,0,0.05)");
  sideFalloff.addColorStop(1, "rgba(0,0,0,0.12)");
  context.fillStyle = sideFalloff;
  context.fillRect(0, 0, width, height);

  const hemShadow = context.createLinearGradient(0, height * 0.58, 0, height);
  hemShadow.addColorStop(0, "rgba(0,0,0,0)");
  hemShadow.addColorStop(1, "rgba(0,0,0,0.09)");
  context.fillStyle = hemShadow;
  context.fillRect(0, Math.round(height * 0.58), width, Math.round(height * 0.42));

  if (garmentType === "HOODIE") {
    const torsoShadow = context.createRadialGradient(width * 0.5, height * 0.52, width * 0.12, width * 0.5, height * 0.56, width * 0.48);
    torsoShadow.addColorStop(0, "rgba(0,0,0,0)");
    torsoShadow.addColorStop(1, "rgba(0,0,0,0.08)");
    context.fillStyle = torsoShadow;
    context.fillRect(0, 0, width, height);
  }

  if (garmentType === "SHORTS") {
    const centerCrease = context.createLinearGradient(width * 0.5, height * 0.18, width * 0.5, height);
    centerCrease.addColorStop(0, "rgba(0,0,0,0)");
    centerCrease.addColorStop(0.6, "rgba(0,0,0,0.03)");
    centerCrease.addColorStop(1, "rgba(0,0,0,0.08)");
    context.fillStyle = centerCrease;
    context.fillRect(Math.round(width * 0.44), 0, Math.round(width * 0.12), height);
  }

  context.restore();
};

const loadHtmlImage = async (src: string): Promise<HTMLImageElement> => {
  const cached = imageCache.get(src);
  if (cached) {
    return cached;
  }

  const loaded = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load template image: ${src}`));
    image.src = src;
  });

  imageCache.set(src, loaded);
  return loaded;
};

const buildRasterTemplate = async (
  garmentType: GarmentType,
  garmentSide: GarmentSide,
  garmentColor: string
): Promise<RasterTemplateResult> => {
  const asset = TEMPLATE_ASSETS[garmentType];
  const view = asset.views[garmentSide];
  const [colorR, colorG, colorB] = parseHexColor(garmentColor);

  if (view.layered) {
    const [baseImage, maskImage, shadowImage, linesImage] = await Promise.all([
      loadHtmlImage(view.layered.base),
      loadHtmlImage(view.layered.mask),
      loadHtmlImage(view.layered.shadow),
      loadHtmlImage(view.layered.lines)
    ]);

    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = baseImage.width;
    sourceCanvas.height = baseImage.height;
    const sourceContext = sourceCanvas.getContext("2d");

    if (!sourceContext) {
      throw new Error("No 2d context for layered template render");
    }

    sourceContext.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    sourceContext.drawImage(baseImage, 0, 0, sourceCanvas.width, sourceCanvas.height);

    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = sourceCanvas.width;
    maskCanvas.height = sourceCanvas.height;
    const maskContext = maskCanvas.getContext("2d");

    if (!maskContext) {
      throw new Error("No 2d context for layered mask render");
    }

    maskContext.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    maskContext.drawImage(maskImage, 0, 0, maskCanvas.width, maskCanvas.height);

    const tintData = maskContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const tintPixels = tintData.data;
    let minX = sourceCanvas.width;
    let minY = sourceCanvas.height;
    let maxX = 0;
    let maxY = 0;

    for (let index = 0; index < tintPixels.length; index += 4) {
      const alpha = tintPixels[index + 3];
      if (alpha < 16) {
        tintPixels[index + 3] = 0;
        continue;
      }

      const pixelPosition = index / 4;
      const x = pixelPosition % sourceCanvas.width;
      const y = Math.floor(pixelPosition / sourceCanvas.width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      tintPixels[index] = colorR;
      tintPixels[index + 1] = colorG;
      tintPixels[index + 2] = colorB;
      tintPixels[index + 3] = alpha;
    }
    sourceContext.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    sourceContext.putImageData(tintData, 0, 0);

    if (maxX <= minX || maxY <= minY) {
      minX = 0;
      minY = 0;
      maxX = sourceCanvas.width - 1;
      maxY = sourceCanvas.height - 1;
    }

    applySyntheticGarmentDepth(sourceContext, sourceCanvas.width, sourceCanvas.height, garmentType);

    if (imageHasVisibleAlpha(shadowImage)) {
      sourceContext.globalCompositeOperation = "multiply";
      sourceContext.drawImage(shadowImage, 0, 0, sourceCanvas.width, sourceCanvas.height);
      sourceContext.globalCompositeOperation = "source-over";
    }

    sourceContext.drawImage(linesImage, 0, 0, sourceCanvas.width, sourceCanvas.height);

    const padding = 140;
    const cropX = clamp(minX - padding, 0, sourceCanvas.width - 1);
    const cropY = clamp(minY - padding, 0, sourceCanvas.height - 1);
    const cropWidth = clamp(maxX - minX + 1 + padding * 2, 1, sourceCanvas.width - cropX);
    const cropHeight = clamp(maxY - minY + 1 + padding * 2, 1, sourceCanvas.height - cropY);

    const scale = Math.min(view.maxWidth / cropWidth, view.maxHeight / cropHeight);
    const renderWidth = Math.max(1, Math.round(cropWidth * scale));
    const renderHeight = Math.max(1, Math.round(cropHeight * scale));

    const offscreen = document.createElement("canvas");
    offscreen.width = renderWidth;
    offscreen.height = renderHeight;
    const context = offscreen.getContext("2d");

    if (!context) {
      throw new Error("No 2d context for normalized template render");
    }

    context.drawImage(sourceCanvas, cropX, cropY, cropWidth, cropHeight, 0, 0, renderWidth, renderHeight);

    const left = Math.round((CANVAS_DIMENSION - renderWidth) / 2);
    const top = Math.round((CANVAS_DIMENSION - renderHeight) / 2);
    const printArea: PrintArea = {
      left: left + Math.round(renderWidth * view.printAreaRatio.left),
      top: top + Math.round(renderHeight * view.printAreaRatio.top),
      width: Math.round(renderWidth * view.printAreaRatio.width),
      height: Math.round(renderHeight * view.printAreaRatio.height)
    };

    return {
      dataUrl: offscreen.toDataURL("image/png"),
      left,
      top,
      width: renderWidth,
      height: renderHeight,
      printArea
    };
  }

  const source = await loadHtmlImage(asset.src);

  const cropX = Math.floor(source.width * view.crop.x);
  const cropY = Math.floor(source.height * view.crop.y);
  const cropWidth = Math.max(1, Math.floor(source.width * view.crop.width));
  const cropHeight = Math.max(1, Math.floor(source.height * view.crop.height));

  const scale = Math.min(view.maxWidth / cropWidth, view.maxHeight / cropHeight);
  const renderWidth = Math.max(1, Math.round(cropWidth * scale));
  const renderHeight = Math.max(1, Math.round(cropHeight * scale));

  const offscreen = document.createElement("canvas");
  offscreen.width = renderWidth;
  offscreen.height = renderHeight;
  const context = offscreen.getContext("2d");

  if (!context) {
    throw new Error("No 2d context for template render");
  }

  context.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, renderWidth, renderHeight);
  const fullWidth = renderWidth;
  const fullHeight = renderHeight;
  const trimmedData = context.getImageData(0, 0, fullWidth, fullHeight);
  const pixels = trimmedData.data;

  const lineThreshold = TEMPLATE_LINE_THRESHOLD;
  const mask = new Uint8Array(fullWidth * fullHeight);
  const colorTolerance = 32;
  const maxReachPixels = fullWidth * fullHeight * 0.72;
  let reachedPixels = 0;

  for (const seed of view.fillSeedRatios) {
    const seedX = clamp(Math.round(fullWidth * seed.x), 0, fullWidth - 1);
    const seedY = clamp(Math.round(fullHeight * seed.y), 0, fullHeight - 1);
    const seedIndex = (seedY * fullWidth + seedX) * 4;
    const seedR = pixels[seedIndex];
    const seedG = pixels[seedIndex + 1];
    const seedB = pixels[seedIndex + 2];

    const visited = new Uint8Array(fullWidth * fullHeight);
    const stack: number[] = [seedY * fullWidth + seedX];

    while (stack.length > 0 && reachedPixels < maxReachPixels) {
      const current = stack.pop();
      if (current === undefined || visited[current] === 1) {
        continue;
      }

      visited[current] = 1;
      const currentX = current % fullWidth;
      const currentY = Math.floor(current / fullWidth);
      const currentPixel = current * 4;

      const red = pixels[currentPixel];
      const green = pixels[currentPixel + 1];
      const blue = pixels[currentPixel + 2];
      const alpha = pixels[currentPixel + 3];
      const luminance = (red + green + blue) / 3;

      if (alpha === 0 || luminance <= lineThreshold) {
        continue;
      }

      const distance = Math.sqrt((red - seedR) ** 2 + (green - seedG) ** 2 + (blue - seedB) ** 2);
      if (distance > colorTolerance) {
        continue;
      }

      if (mask[current] === 0) {
        mask[current] = 1;
        reachedPixels += 1;
      }

      if (currentX > 0) stack.push(current - 1);
      if (currentX < fullWidth - 1) stack.push(current + 1);
      if (currentY > 0) stack.push(current - fullWidth);
      if (currentY < fullHeight - 1) stack.push(current + fullWidth);
    }
  }

  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const alpha = pixels[index + 3];

    if (alpha === 0) {
      continue;
    }

    const luminance = (red + green + blue) / 3;
    if (luminance <= lineThreshold) {
      pixels[index] = TEMPLATE_LINE_COLOR;
      pixels[index + 1] = TEMPLATE_LINE_COLOR;
      pixels[index + 2] = TEMPLATE_LINE_COLOR;
      pixels[index + 3] = 232;
      continue;
    }

    const pixelPosition = index / 4;
    if (mask[pixelPosition] === 0) {
      pixels[index + 3] = 0;
      continue;
    }

    pixels[index] = colorR;
    pixels[index + 1] = colorG;
    pixels[index + 2] = colorB;
    pixels[index + 3] = 255;
  }

  const safeMinX = 0;
  const safeMinY = 0;
  const trimmedWidth = fullWidth;
  const trimmedHeight = fullHeight;

  context.putImageData(trimmedData, 0, 0);

  const preparedCanvas = document.createElement("canvas");
  preparedCanvas.width = trimmedWidth;
  preparedCanvas.height = trimmedHeight;
  const preparedContext = preparedCanvas.getContext("2d");

  if (!preparedContext) {
    throw new Error("No 2d context for prepared template render");
  }

  preparedContext.drawImage(
    offscreen,
    safeMinX,
    safeMinY,
    trimmedWidth,
    trimmedHeight,
    0,
    0,
    trimmedWidth,
    trimmedHeight
  );
  applySyntheticGarmentDepth(preparedContext, trimmedWidth, trimmedHeight, garmentType);

  const left = Math.round((CANVAS_DIMENSION - trimmedWidth) / 2);
  const top = Math.round((CANVAS_DIMENSION - trimmedHeight) / 2);
  const printArea: PrintArea = {
    left: left + Math.round(trimmedWidth * view.printAreaRatio.left),
    top: top + Math.round(trimmedHeight * view.printAreaRatio.top),
    width: Math.round(trimmedWidth * view.printAreaRatio.width),
    height: Math.round(trimmedHeight * view.printAreaRatio.height)
  };

  return {
    dataUrl: preparedCanvas.toDataURL("image/png"),
    left,
    top,
    width: trimmedWidth,
    height: trimmedHeight,
    printArea
  };
};


const tagSystemLayer = <T extends FabricObject>(object: T, systemLayerKind: SystemLayerKind): T => {
  const extended = object as T & { data?: SystemLayerData };
  extended.data = { ...(extended.data ?? {}), systemLayer: true, systemLayerKind };
  object.selectable = false;
  object.evented = false;
  object.excludeFromExport = true;
  return object;
};

const getSystemLayerKind = (object: FabricObject): SystemLayerKind | null => {
  const layerData = (object as FabricObject & { data?: SystemLayerData }).data;
  return layerData?.systemLayer === true ? layerData.systemLayerKind ?? "garment" : null;
};

const isSystemLayer = (object: FabricObject): boolean => getSystemLayerKind(object) !== null;

const getObjectLabel = (object: FabricObject, index: number): string => {
  if (object.type === "textbox") {
    return `Текст ${index + 1}`;
  }

  if (object.type === "image") {
    return `Фото ${index + 1}`;
  }

  return `Слой ${index + 1}`;
};

const getScaledObjectWidth = (object: FabricObject): number => {
  if (typeof object.getScaledWidth === "function") {
    return object.getScaledWidth();
  }

  return (object.width ?? 0) * (object.scaleX ?? 1);
};

const getScaledObjectHeight = (object: FabricObject): number => {
  if (typeof object.getScaledHeight === "function") {
    return object.getScaledHeight();
  }

  return (object.height ?? 0) * (object.scaleY ?? 1);
};

const clampToGrid = (value: number): number => Math.round(value / GRID_STEP) * GRID_STEP;

const constrainInsidePrintArea = (object: FabricObject, printArea: PrintArea, snapEnabled: boolean): void => {
  const objectWidth = getScaledObjectWidth(object);
  const objectHeight = getScaledObjectHeight(object);

  const minLeft = printArea.left;
  const maxLeft = printArea.left + printArea.width - objectWidth;
  const minTop = printArea.top;
  const maxTop = printArea.top + printArea.height - objectHeight;

  const rawLeft = clamp(object.left ?? minLeft, minLeft, maxLeft);
  const rawTop = clamp(object.top ?? minTop, minTop, maxTop);

  const left = snapEnabled ? clampToGrid(rawLeft) : rawLeft;
  const top = snapEnabled ? clampToGrid(rawTop) : rawTop;

  object.set({ left, top });
  object.setCoords();
};

const centerObjectInPrintArea = (object: FabricObject, printArea: PrintArea): void => {
  const objectWidth = getScaledObjectWidth(object);
  const objectHeight = getScaledObjectHeight(object);

  object.set({
    left: Math.round(printArea.left + (printArea.width - objectWidth) / 2),
    top: Math.round(printArea.top + (printArea.height - objectHeight) / 2)
  });
  object.setCoords();
};

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Не удалось прочитать изображение"));
    reader.readAsDataURL(file);
  });

const createPrintGridDataUrl = (printArea: PrintArea): string => {
  const gridCanvas = document.createElement("canvas");
  gridCanvas.width = printArea.width;
  gridCanvas.height = printArea.height;

  const context = gridCanvas.getContext("2d");
  if (!context) {
    return gridCanvas.toDataURL("image/png");
  }

  context.clearRect(0, 0, printArea.width, printArea.height);
  context.strokeStyle = "rgba(17, 17, 17, 0.045)";
  context.lineWidth = 1;

  for (let x = GRID_STEP; x < printArea.width; x += GRID_STEP) {
    context.beginPath();
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, printArea.height);
    context.stroke();
  }

  for (let y = GRID_STEP; y < printArea.height; y += GRID_STEP) {
    context.beginPath();
    context.moveTo(0, y + 0.5);
    context.lineTo(printArea.width, y + 0.5);
    context.stroke();
  }

  context.setLineDash([8, 6]);
  context.strokeStyle = "rgba(17, 17, 17, 0.16)";
  context.strokeRect(0.5, 0.5, printArea.width - 1, printArea.height - 1);

  return gridCanvas.toDataURL("image/png");
};

const createExportPayload = (canvas: Canvas): { canvasJson: unknown; previewUrl: string } => {
  const gridLayers = canvas.getObjects().filter((object) => getSystemLayerKind(object) === "grid");

  gridLayers.forEach((object) => object.set({ visible: false }));
  canvas.requestRenderAll();

  try {
    return {
      canvasJson: canvas.toJSON(),
      previewUrl: canvas.toDataURL({ format: "webp", quality: 0.9, multiplier: 1 })
    };
  } finally {
    gridLayers.forEach((object) => object.set({ visible: true }));
    canvas.requestRenderAll();
  }
};

export const EditorCanvas = (): JSX.Element => {
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const renderNonceRef = useRef(0);

  const [garmentType, setGarmentType] = useState<GarmentType>("TSHIRT");
  const [garmentSide, setGarmentSide] = useState<GarmentSide>("FRONT");
  const [garmentColor, setGarmentColor] = useState<string>(GARMENT_COLORS[0]);
  const [fontFamily, setFontFamily] = useState<string>(FONT_FAMILIES[0]);
  const [textColor, setTextColor] = useState<string>(TEXT_COLORS[0]);
  const [textValue, setTextValue] = useState<string>("RSH custom");
  const [textSize, setTextSize] = useState<number>(34);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [snapToGridEnabled, setSnapToGridEnabled] = useState<boolean>(true);
  const [imageUrlInput, setImageUrlInput] = useState<string>("");
  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [statusAction, setStatusAction] = useState<StatusAction | null>(null);
  const [activePrintArea, setActivePrintArea] = useState<PrintArea>(GARMENT_TEMPLATES.TSHIRT.printArea);
  const [customizerProducts, setCustomizerProducts] = useState<CustomizerProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const snapToGridEnabledRef = useRef<boolean>(snapToGridEnabled);

  const template = useMemo(() => GARMENT_TEMPLATES[garmentType], [garmentType]);
  const setEditorStatus = useCallback((message: string): void => {
    setStatusAction(null);
    setStatusMessage(message);
  }, []);
  const productsForGarment = useMemo(
    () => customizerProducts.filter((product) => product.garmentType === garmentType && product.variants.length > 0),
    [customizerProducts, garmentType]
  );
  const selectedProduct = useMemo(
    () => productsForGarment.find((product) => product.id === selectedProductId) ?? productsForGarment[0] ?? null,
    [productsForGarment, selectedProductId]
  );
  const selectedVariant = useMemo(
    () =>
      selectedProduct?.variants.find((variant) => variant.id === selectedVariantId) ??
      selectedProduct?.variants.find((variant) => variant.isDefault) ??
      selectedProduct?.variants[0] ??
      null,
    [selectedProduct, selectedVariantId]
  );
  const printAreaRef = useRef<PrintArea>(activePrintArea);

  useEffect(() => {
    printAreaRef.current = activePrintArea;
  }, [activePrintArea]);

  useEffect(() => {
    snapToGridEnabledRef.current = snapToGridEnabled;
  }, [snapToGridEnabled]);

  useEffect(() => {
    let mounted = true;

    const loadCustomizerProducts = async (): Promise<void> => {
      try {
        const response = await fetch("/api/customizer/options", { credentials: "include" });
        if (!response.ok) {
          throw new Error("customizer-options-failed");
        }

        const payload = (await response.json()) as ApiEnvelope<{ items: CustomizerProduct[] }>;
        if (mounted) {
          setCustomizerProducts(payload.data?.items ?? []);
        }
      } catch {
        if (mounted) {
          setEditorStatus("Не удалось загрузить базовые вещи RSH BASICS для корзины.");
        }
      }
    };

    void loadCustomizerProducts();

    return () => {
      mounted = false;
    };
  }, [setEditorStatus]);

  useEffect(() => {
    const firstProduct = productsForGarment[0];
    if (!firstProduct) {
      setSelectedProductId("");
      setSelectedVariantId("");
      return;
    }

    if (!productsForGarment.some((product) => product.id === selectedProductId)) {
      setSelectedProductId(firstProduct.id);
      setSelectedVariantId(firstProduct.variants.find((variant) => variant.isDefault)?.id ?? firstProduct.variants[0]?.id ?? "");
      return;
    }

    const activeProduct = productsForGarment.find((product) => product.id === selectedProductId);
    if (activeProduct && !activeProduct.variants.some((variant) => variant.id === selectedVariantId)) {
      setSelectedVariantId(activeProduct.variants.find((variant) => variant.isDefault)?.id ?? activeProduct.variants[0]?.id ?? "");
    }
  }, [productsForGarment, selectedProductId, selectedVariantId]);

  const getEditableObjects = useCallback((canvas: Canvas): FabricObject[] => {
    return canvas
      .getObjects()
      .filter((object) => !isSystemLayer(object))
      .reverse();
  }, []);

  const refreshLayers = useCallback((): void => {
    const canvas = fabricRef.current;
    if (!canvas) {
      return;
    }

    const editable = getEditableObjects(canvas);
    setLayers(
      editable.map((object, index) => ({
        layerPosition: index,
        label: getObjectLabel(object, index)
      }))
    );
  }, [getEditableObjects]);

  const getSelectedTextbox = useCallback((): Textbox | null => {
    const canvas = fabricRef.current;
    const selected = canvas?.getActiveObject();

    if (!selected || isSystemLayer(selected) || !(selected instanceof Textbox)) {
      return null;
    }

    return selected;
  }, []);

  const syncTextControlsFromSelection = useCallback((): void => {
    const selectedTextbox = getSelectedTextbox();
    if (!selectedTextbox) {
      return;
    }

    setTextValue(selectedTextbox.text ?? "");
    setFontFamily(selectedTextbox.fontFamily ?? FONT_FAMILIES[0]);
    setTextSize(Math.round(selectedTextbox.fontSize ?? 34));
    if (typeof selectedTextbox.fill === "string") {
      setTextColor(selectedTextbox.fill);
    }
  }, [getSelectedTextbox]);

  const repaintTemplate = useCallback(
    async (canvas: Canvas): Promise<void> => {
      const nonce = ++renderNonceRef.current;

      canvas
        .getObjects()
        .filter((object) => isSystemLayer(object))
        .forEach((object) => canvas.remove(object));

      const rasterTemplate = await buildRasterTemplate(garmentType, garmentSide, garmentColor);

      if (nonce !== renderNonceRef.current) {
        return;
      }

      const garmentImage = await FabricImage.fromURL(rasterTemplate.dataUrl);

      if (nonce !== renderNonceRef.current) {
        return;
      }

      garmentImage.set({
        left: rasterTemplate.left,
        top: rasterTemplate.top,
        originX: "left",
        originY: "top",
        objectCaching: true
      });

      const garmentLayer = tagSystemLayer(garmentImage, "garment");
      canvas.add(garmentLayer);
      canvas.sendObjectToBack(garmentLayer);

      if (showGrid) {
        const gridImage = await FabricImage.fromURL(createPrintGridDataUrl(rasterTemplate.printArea));

        if (nonce !== renderNonceRef.current) {
          return;
        }

        gridImage.set({
          left: rasterTemplate.printArea.left,
          top: rasterTemplate.printArea.top,
          originX: "left",
          originY: "top",
          objectCaching: false,
          opacity: 1
        });

        const gridLayer = tagSystemLayer(gridImage, "grid");
        canvas.add(gridLayer);
        canvas.sendObjectToBack(gridLayer);
        canvas.bringObjectForward(gridLayer);
      }

      setActivePrintArea(rasterTemplate.printArea);
      printAreaRef.current = rasterTemplate.printArea;

      canvas.requestRenderAll();
    },
    [garmentColor, garmentSide, garmentType, showGrid]
  );

  useEffect(() => {
    if (!canvasElementRef.current) {
      return;
    }

    const canvas = new Canvas(canvasElementRef.current, {
      width: CANVAS_DIMENSION,
      height: CANVAS_DIMENSION,
      backgroundColor: "#f6f4ef",
      preserveObjectStacking: true
    });

    canvas.on("object:moving", (event) => {
      const target = event.target;
      if (!target || isSystemLayer(target)) {
        return;
      }

      constrainInsidePrintArea(target, printAreaRef.current, snapToGridEnabledRef.current);
    });

    canvas.on("object:scaling", (event) => {
      const target = event.target;
      if (!target || isSystemLayer(target)) {
        return;
      }

      constrainInsidePrintArea(target, printAreaRef.current, false);
    });

    canvas.on("object:added", refreshLayers);
    canvas.on("object:removed", refreshLayers);
    canvas.on("object:modified", refreshLayers);
    canvas.on("selection:created", syncTextControlsFromSelection);
    canvas.on("selection:updated", syncTextControlsFromSelection);
    canvas.on("selection:cleared", syncTextControlsFromSelection);

    fabricRef.current = canvas;

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [refreshLayers, syncTextControlsFromSelection]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) {
      return;
    }
    void repaintTemplate(canvas);
    refreshLayers();
  }, [garmentType, garmentSide, garmentColor, repaintTemplate, refreshLayers]);

  const changeSelectedProduct = (productId: string): void => {
    const product = productsForGarment.find((item) => item.id === productId);
    setSelectedProductId(productId);
    setSelectedVariantId(product?.variants.find((variant) => variant.isDefault)?.id ?? product?.variants[0]?.id ?? "");
  };

  const addText = (): void => {
    const canvas = fabricRef.current;
    if (!canvas) {
      return;
    }

    const text = new Textbox(textValue.trim() || "RSH custom", {
      left: activePrintArea.left + 18,
      top: activePrintArea.top + 18,
      width: activePrintArea.width - 36,
      fontSize: textSize,
      fill: textColor,
      fontFamily,
      editable: true
    });

    centerObjectInPrintArea(text, activePrintArea);
    canvas.add(text);
    canvas.setActiveObject(text);
    constrainInsidePrintArea(text, activePrintArea, snapToGridEnabled);
    canvas.requestRenderAll();
    refreshLayers();
    setEditorStatus("Текст добавлен.");
  };

  const updateSelectedTextbox = (updater: (textbox: Textbox) => void): void => {
    const canvas = fabricRef.current;
    const selectedTextbox = getSelectedTextbox();

    if (!canvas || !selectedTextbox) {
      return;
    }

    updater(selectedTextbox);
    constrainInsidePrintArea(selectedTextbox, activePrintArea, false);
    selectedTextbox.setCoords();
    canvas.requestRenderAll();
    refreshLayers();
  };

  const handleTextValueChange = (value: string): void => {
    setTextValue(value);
    updateSelectedTextbox((textbox) => {
      textbox.set("text", value || " ");
    });
  };

  const handleFontFamilyChange = (value: string): void => {
    setFontFamily(value);
    updateSelectedTextbox((textbox) => {
      textbox.set("fontFamily", value);
    });
  };

  const handleTextColorChange = (value: string): void => {
    setTextColor(value);
    updateSelectedTextbox((textbox) => {
      textbox.set("fill", value);
    });
  };

  const applyTextSize = (nextSize: number): void => {
    const normalized = clamp(Math.round(nextSize), 14, 160);
    setTextSize(normalized);
    updateSelectedTextbox((textbox) => {
      textbox.set("fontSize", normalized);
    });
  };

  const placeImage = (image: FabricImage): void => {
    const canvas = fabricRef.current;
    if (!canvas) {
      return;
    }

    const maxWidth = activePrintArea.width * 0.78;
    const maxHeight = activePrintArea.height * 0.78;

    if ((image.width ?? 0) > (image.height ?? 0)) {
      image.scaleToWidth(maxWidth);
    } else {
      image.scaleToHeight(maxHeight);
    }

    image.set({
      left: activePrintArea.left + 14,
      top: activePrintArea.top + 14,
      objectCaching: true
    });

    centerObjectInPrintArea(image, activePrintArea);
    canvas.add(image);
    canvas.setActiveObject(image);
    constrainInsidePrintArea(image, activePrintArea, snapToGridEnabled);
    canvas.requestRenderAll();
    refreshLayers();
  };

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setEditorStatus("Поддерживаются только изображения.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
      setEditorStatus("Файл слишком большой. Лимит: 8 МБ.");
      event.target.value = "";
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      const image = await FabricImage.fromURL(dataUrl);
      placeImage(image);
      setEditorStatus(`Фото «${file.name}» добавлено.`);
    } catch {
      setEditorStatus("Не удалось загрузить фото с устройства.");
    } finally {
      event.target.value = "";
    }
  };

  const addImageByUrl = async (): Promise<void> => {
    if (!imageUrlInput.trim()) {
      return;
    }

    try {
      const image = await FabricImage.fromURL(imageUrlInput.trim(), { crossOrigin: "anonymous" });
      placeImage(image);
      setImageUrlInput("");
      setEditorStatus("Фото по ссылке добавлено.");
    } catch {
      setEditorStatus("Не удалось загрузить фото по ссылке. Проверь URL и CORS на источнике.");
    }
  };

  const rotateSelected = (angleDelta: number): void => {
    const canvas = fabricRef.current;
    const selected = canvas?.getActiveObject();

    if (!canvas || !selected || isSystemLayer(selected)) {
      return;
    }

    selected.set("angle", (selected.angle ?? 0) + angleDelta);
    constrainInsidePrintArea(selected, activePrintArea, false);
    canvas.requestRenderAll();
  };

  const scaleSelected = (delta: number): void => {
    const canvas = fabricRef.current;
    const selected = canvas?.getActiveObject();

    if (!canvas || !selected || isSystemLayer(selected)) {
      return;
    }

    const nextScaleX = clamp((selected.scaleX ?? 1) + delta, 0.1, 4);
    const nextScaleY = clamp((selected.scaleY ?? 1) + delta, 0.1, 4);

    selected.set({ scaleX: nextScaleX, scaleY: nextScaleY });
    constrainInsidePrintArea(selected, activePrintArea, false);
    canvas.requestRenderAll();
  };

  const moveLayer = (direction: "UP" | "DOWN"): void => {
    const canvas = fabricRef.current;
    const selected = canvas?.getActiveObject();

    if (!canvas || !selected || isSystemLayer(selected)) {
      return;
    }

    if (direction === "UP") {
      canvas.bringObjectForward(selected, true);
    } else {
      canvas.sendObjectBackwards(selected, true);
    }

    canvas.requestRenderAll();
    refreshLayers();
  };

  const removeSelected = (): void => {
    const canvas = fabricRef.current;
    const selected = canvas?.getActiveObject();

    if (!canvas || !selected || isSystemLayer(selected)) {
      return;
    }

    canvas.remove(selected);
    canvas.requestRenderAll();
    setEditorStatus("Слой удалён.");
  };

  const selectLayer = (layerPosition: number): void => {
    const canvas = fabricRef.current;
    if (!canvas) {
      return;
    }

    const editable = getEditableObjects(canvas);
    const target = editable[layerPosition];

    if (!target) {
      return;
    }

    canvas.setActiveObject(target);
    canvas.requestRenderAll();
  };

  const createDesignRequest = async (): Promise<string> => {
    const canvas = fabricRef.current;
    if (!canvas) {
      throw new Error("canvas-not-ready");
    }

    const { canvasJson, previewUrl } = createExportPayload(canvas);
    const csrfToken = await ensureCsrfToken();

    const response = await fetch("/api/designs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken
      },
      credentials: "include",
      body: JSON.stringify({
        garmentType,
        garmentColor,
        canvasJson,
        previewUrl,
        previewWidth: canvas.getWidth(),
        previewHeight: canvas.getHeight()
      })
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null;
      const errorCode = errorPayload?.error?.code;
      const authLikeError = response.status === 401 || response.status === 403 || errorCode === "AUTH_ERROR" || errorCode === "FORBIDDEN";
      throw new Error(authLikeError ? "auth-required" : "failed-save");
    }

    const payload = (await response.json()) as ApiEnvelope<{ id: string }>;
    if (!payload.data?.id) {
      throw new Error("missing-design-id");
    }

    return payload.data.id;
  };

  const saveDesign = async (): Promise<void> => {
    setIsSaving(true);
    setEditorStatus("Сохраняем дизайн...");

    try {
      await createDesignRequest();
      setStatusMessage("Дизайн сохранён в профиль.");
      setStatusAction({ href: "/profile", label: "Открыть профиль" });
    } catch (error: unknown) {
      const requiresAuth = error instanceof Error && error.message === "auth-required";
      setStatusMessage(
        requiresAuth ? "Чтобы сохранить дизайн в профиль, нужно войти в аккаунт." : "Не удалось сохранить дизайн. Попробуй ещё раз."
      );
      setStatusAction(requiresAuth ? { href: "/login?next=/editor", label: "Войти и сохранить" } : null);
    } finally {
      setIsSaving(false);
    }
  };

  const saveDesignAndAddToCart = async (): Promise<void> => {
    if (!selectedProduct || !selectedVariant) {
      setEditorStatus("Для этого макета пока нет активной базы RSH BASICS в каталоге.");
      return;
    }

    setIsSaving(true);
    setEditorStatus("Сохраняем дизайн и добавляем вещь в корзину...");

    try {
      const designId = await createDesignRequest();
      const csrfToken = await ensureCsrfToken();
      const response = await fetch("/api/cart/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken
        },
        credentials: "include",
        body: JSON.stringify({
          productId: selectedProduct.id,
          variantId: selectedVariant.id,
          quantity: 1,
          customizationId: designId
        })
      });

      if (!response.ok) {
        throw new Error(response.status === 401 ? "auth-required" : "cart-add-failed");
      }

      setStatusMessage("Готово: кастомная вещь добавлена в корзину.");
      setStatusAction({ href: "/cart", label: "Открыть корзину" });
    } catch (error: unknown) {
      const requiresAuth = error instanceof Error && error.message === "auth-required";
      setStatusMessage(
        requiresAuth
          ? "Чтобы добавить кастомную вещь в корзину, нужно войти в аккаунт."
          : "Не удалось добавить кастомную вещь в корзину. Попробуй ещё раз."
      );
      setStatusAction(requiresAuth ? { href: "/login?next=/editor", label: "Войти и повторить" } : null);
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Выбери макет</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {GARMENT_OPTIONS.map((item) => {
                const option = GARMENT_TEMPLATES[item];
                const active = garmentType === item;

                return (
                  <button
                    key={item}
                    onClick={() => setGarmentType(item)}
                    type="button"
                    className={`group rounded-xl border px-3 py-3 text-left transition ${active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/50"}`}
                  >
                    <p className="text-sm font-semibold">{option.label}</p>
                    <p className={`text-[10px] uppercase tracking-[0.16em] ${active ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {GARMENT_SIDE_LABELS[garmentSide]}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {GARMENT_SIDE_OPTIONS.map((side) => {
                const active = garmentSide === side;

                return (
                  <button
                    key={side}
                    type="button"
                    onClick={() => setGarmentSide(side)}
                    className={`rounded-md border px-3 py-2 text-sm transition ${
                      active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/50"
                    }`}
                  >
                    {GARMENT_SIDE_LABELS[side]}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">{template.hint}. Брендовые вещи из каталога не изменяются.</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Цвет вещи</p>
            <div className="flex flex-wrap gap-2">
              {GARMENT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setGarmentColor(color)}
                  className={`h-9 w-9 rounded-full border ${garmentColor === color ? "ring-2 ring-primary" : ""}`}
                  style={{ backgroundColor: color }}
                  aria-label={`Цвет ${color}`}
                />
              ))}
            </div>

            <div className="flex flex-wrap gap-4 pt-1">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} />
                Показать сетку
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={snapToGridEnabled}
                  onChange={(event) => setSnapToGridEnabled(event.target.checked)}
                />
                Привязка к сетке
              </label>
            </div>
            <p className="text-xs text-muted-foreground">Сетка нужна только для выравнивания и не попадёт в сохранённый дизайн.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 rounded-lg border bg-background/70 p-3 md:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1">
            <label htmlFor="customizer-product" className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              База для корзины
            </label>
            <select
              id="customizer-product"
              value={selectedProduct?.id ?? ""}
              onChange={(event) => changeSelectedProduct(event.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              disabled={productsForGarment.length === 0}
            >
              {productsForGarment.length === 0 ? <option value="">Нет активной базы</option> : null}
              {productsForGarment.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="customizer-variant" className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Размер / цвет
            </label>
            <select
              id="customizer-variant"
              value={selectedVariant?.id ?? ""}
              onChange={(event) => setSelectedVariantId(event.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              disabled={!selectedProduct}
            >
              {selectedProduct?.variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.name} · {variant.sku}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Цена базы</p>
            <p className="text-sm font-semibold">
              {selectedVariant ? formatStoreMoney(selectedVariant.priceCents, selectedVariant.currency) : "—"}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border bg-card p-3 shadow-sm lg:grid-cols-[280px_minmax(0,1fr)_280px] lg:p-4">
        <div className="space-y-3 lg:order-1">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={addText} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">
              Добавить текст
            </button>
            <label className="cursor-pointer rounded-md border px-3 py-2 text-center text-sm hover:border-primary hover:text-primary">
              Загрузить фото
              <input type="file" className="hidden" accept="image/*" onChange={uploadImage} />
            </label>
            <button type="button" onClick={() => rotateSelected(-15)} className="rounded-md border px-3 py-2 text-sm">
              -15°
            </button>
            <button type="button" onClick={() => rotateSelected(15)} className="rounded-md border px-3 py-2 text-sm">
              +15°
            </button>
            <button type="button" onClick={() => scaleSelected(-0.1)} className="rounded-md border px-3 py-2 text-sm">
              Масштаб -
            </button>
            <button type="button" onClick={() => scaleSelected(0.1)} className="rounded-md border px-3 py-2 text-sm">
              Масштаб +
            </button>
            <button type="button" onClick={removeSelected} className="rounded-md border px-3 py-2 text-sm">
              Удалить
            </button>
          </div>

          <div className="grid gap-3 rounded-xl border bg-background/80 p-3">
            <div className="space-y-1">
              <label htmlFor="editor-text-value" className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Текст слоя
              </label>
              <input
                id="editor-text-value"
                value={textValue}
                onChange={(event) => handleTextValueChange(event.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="Например: RSH ARCHIVE"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px]">
              <div className="space-y-1">
                <label htmlFor="editor-font" className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Шрифт
                </label>
                <select
                  id="editor-font"
                  value={fontFamily}
                  onChange={(event) => handleFontFamilyChange(event.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  {FONT_FAMILIES.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="editor-font-size" className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Размер
                </label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => applyTextSize(textSize - 2)} className="rounded-md border px-3 py-2 text-sm">
                    A-
                  </button>
                  <input
                    id="editor-font-size"
                    type="number"
                    min={14}
                    max={160}
                    step={1}
                    value={textSize}
                    onChange={(event) => applyTextSize(Number(event.target.value) || 14)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  />
                  <button type="button" onClick={() => applyTextSize(textSize + 2)} className="rounded-md border px-3 py-2 text-sm">
                    A+
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Цвет текста</p>
              <div className="flex flex-wrap gap-1.5">
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleTextColorChange(color)}
                    className={`h-8 w-8 rounded-full border ${textColor === color ? "ring-2 ring-primary" : ""}`}
                    style={{ backgroundColor: color }}
                    aria-label={`Цвет текста ${color}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-2 rounded-xl border bg-background/80 p-3">
            <label htmlFor="editor-image-url" className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Фото по ссылке (URL)
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="editor-image-url"
                value={imageUrlInput}
                onChange={(event) => setImageUrlInput(event.target.value)}
                className="min-w-[220px] flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="https://..."
              />
              <button type="button" onClick={addImageByUrl} className="rounded-md border px-3 py-2 text-sm">
                Добавить по ссылке
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3 lg:order-2">
          <div className="overflow-auto rounded-2xl border bg-[#f3f1ec] p-2 shadow-inner">
            <canvas ref={canvasElementRef} className="mx-auto block" />
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-background/80 p-3">
            <button
              type="button"
              onClick={saveDesign}
              disabled={isSaving}
              className="rounded-md border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Сохранить дизайн
            </button>
            <button
              type="button"
              onClick={saveDesignAndAddToCart}
              disabled={isSaving || !selectedProduct || !selectedVariant}
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              Сохранить и добавить в корзину
            </button>
            {statusMessage ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-background px-3 py-2">
                <p className="text-sm text-muted-foreground">{statusMessage}</p>
                {statusAction ? (
                  <Link href={statusAction.href} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                    {statusAction.label}
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <aside className="rounded-xl border bg-background/80 p-3 lg:order-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Слои</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => moveLayer("UP")} className="rounded-md border px-3 py-2 text-sm">
              Вверх
            </button>
            <button type="button" onClick={() => moveLayer("DOWN")} className="rounded-md border px-3 py-2 text-sm">
              Вниз
            </button>
          </div>

          <div className="mt-3 max-h-[520px] space-y-2 overflow-auto pr-1">
            {layers.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Добавь текст или фото, и слои появятся здесь. Макет вещи и сетка не считаются редактируемыми слоями.
              </div>
            ) : null}
            {layers.map((layer) => (
              <button
                key={`${layer.layerPosition}-${layer.label}`}
                type="button"
                onClick={() => selectLayer(layer.layerPosition)}
                className="w-full rounded-md border px-3 py-2 text-left text-sm transition hover:border-primary hover:text-primary"
              >
                {layer.label}
              </button>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
};

