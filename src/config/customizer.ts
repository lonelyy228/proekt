export const CUSTOMIZER_GARMENT_TYPES = [
  "TSHIRT",
  "HOODIE",
  "SWEATSHIRT",
  "SHORTS",
  "PANTS"
] as const;

export type CustomizerGarmentType = (typeof CUSTOMIZER_GARMENT_TYPES)[number];

export const CUSTOMIZER_BASE_BRANDS = ["RSH BASICS"] as const;
export const CUSTOMIZER_TAG_PREFIX = "customizer:";

export const CUSTOMIZER_CANVAS_SIZE = {
  min: 512,
  max: 2048,
  reference: 720
} as const;

export const CUSTOMIZER_CONSTRAINTS = {
  maxObjects: 120,
  maxCanvasJsonBytes: 300_000,
  maxTextLength: 300,
  minScale: 0.08,
  maxScale: 6,
  minObjectSize: 8,
  maxObjectSize: 4096,
  minRotation: -180,
  maxRotation: 180,
  printAreaOverflowTolerancePx: 2
} as const;

export const CUSTOMIZER_ALLOWED_TEXT_TYPES = ["text", "i-text", "textbox"] as const;
export const CUSTOMIZER_ALLOWED_OBJECT_TYPES = ["image", ...CUSTOMIZER_ALLOWED_TEXT_TYPES] as const;
export type CustomizerAllowedObjectType = (typeof CUSTOMIZER_ALLOWED_OBJECT_TYPES)[number];

export const CUSTOMIZER_ALLOWED_FONTS = [
  "Space Grotesk",
  "Arial",
  "Times New Roman",
  "Courier New",
  "Georgia"
] as const;

export type PrintAreaRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type GarmentTemplateConfig = {
  displayName: string;
  printAreaRatio: PrintAreaRect;
  hint: string;
};

export const CUSTOMIZER_GARMENT_TEMPLATES: Record<CustomizerGarmentType, GarmentTemplateConfig> = {
  TSHIRT: {
    displayName: "Футболка",
    printAreaRatio: { left: 0.195, top: 0.165, width: 0.61, height: 0.665 },
    hint: "Область печати футболки"
  },
  HOODIE: {
    displayName: "Худи",
    printAreaRatio: { left: 0.18, top: 0.195, width: 0.64, height: 0.61 },
    hint: "Область груди худи"
  },
  SWEATSHIRT: {
    displayName: "Свитшот",
    printAreaRatio: { left: 0.21, top: 0.21, width: 0.58, height: 0.58 },
    hint: "Фронтальная зона свитшота"
  },
  SHORTS: {
    displayName: "Шорты",
    printAreaRatio: { left: 0.28, top: 0.305, width: 0.445, height: 0.39 },
    hint: "Принт-зона шорт"
  },
  PANTS: {
    displayName: "Штаны",
    printAreaRatio: { left: 0.265, top: 0.235, width: 0.47, height: 0.585 },
    hint: "Принт-зона штанов"
  }
};

const normalizeBrand = (value: string): string => value.trim().replace(/\s+/g, " ").toUpperCase();

export const isCustomizerBaseBrand = (brand: string): boolean =>
  CUSTOMIZER_BASE_BRANDS.some((allowed) => normalizeBrand(allowed) === normalizeBrand(brand));

export const getGarmentPrintArea = (
  garmentType: CustomizerGarmentType,
  canvasWidth: number,
  canvasHeight: number
): PrintAreaRect => {
  const template = CUSTOMIZER_GARMENT_TEMPLATES[garmentType];

  return {
    left: Math.round(template.printAreaRatio.left * canvasWidth),
    top: Math.round(template.printAreaRatio.top * canvasHeight),
    width: Math.round(template.printAreaRatio.width * canvasWidth),
    height: Math.round(template.printAreaRatio.height * canvasHeight)
  };
};

export const toCustomizerGarmentTag = (garmentType: CustomizerGarmentType): string =>
  `${CUSTOMIZER_TAG_PREFIX}${garmentType}`;

export const extractCustomizerGarmentTypesFromTags = (tags: string[]): CustomizerGarmentType[] => {
  const values = new Set<CustomizerGarmentType>();

  for (const rawTag of tags) {
    const normalizedTag = rawTag.trim().toLowerCase();
    if (!normalizedTag.startsWith(CUSTOMIZER_TAG_PREFIX)) {
      continue;
    }

    const garmentType = normalizedTag
      .slice(CUSTOMIZER_TAG_PREFIX.length)
      .toUpperCase() as CustomizerGarmentType;

    if (CUSTOMIZER_GARMENT_TYPES.includes(garmentType)) {
      values.add(garmentType);
    }
  }

  return Array.from(values);
};
