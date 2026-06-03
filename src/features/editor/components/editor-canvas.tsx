"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, FabricImage, FabricObject, Rect, Textbox } from "fabric";
import { ensureCsrfToken } from "@/lib/csrf-client";

type GarmentType = "TSHIRT" | "HOODIE" | "SHORTS";

type LayerItem = {
  layerPosition: number;
  label: string;
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
  technicalLabel: string;
  hint: string;
  printArea: PrintArea;
};

type SystemLayerData = {
  systemLayer?: boolean;
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
    technicalLabel: "Front",
    hint: "Печатная зона футболки",
    printArea: { left: 286, top: 282, width: 188, height: 224 }
  },
  HOODIE: {
    code: "HOODIE",
    label: "Худи",
    technicalLabel: "Front",
    hint: "Печатная зона худи",
    printArea: { left: 278, top: 302, width: 204, height: 230 }
  },
  SHORTS: {
    code: "SHORTS",
    label: "Шорты",
    technicalLabel: "Front",
    hint: "Печатная зона шорт",
    printArea: { left: 278, top: 292, width: 204, height: 170 }
  }
};
const GARMENT_OPTIONS: GarmentType[] = ["TSHIRT", "HOODIE", "SHORTS"];
const GARMENT_COLORS = ["#e9e9e9", "#111111", "#2b2b2b", "#5c564f", "#9b111e", "#1f3d72"];
const FONT_FAMILIES = ["Space Grotesk", "Arial", "Times New Roman", "Courier New", "Georgia"];
const TEXT_COLORS = ["#111111", "#ffffff", "#d91b3a", "#214fce", "#0f8a5f", "#f29f05"];

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
type TemplateAsset = {
  src: string;
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
  HOODIE: {
    src: "/editor/templates/hoodie.jpg",
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
  SHORTS: {
    src: "/editor/templates/shorts.jpg",
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

const buildRasterTemplate = async (garmentType: GarmentType, garmentColor: string): Promise<RasterTemplateResult> => {
  const asset = TEMPLATE_ASSETS[garmentType];
  const [colorR, colorG, colorB] = parseHexColor(garmentColor);

  if (asset.layered) {
    const [baseImage, maskImage, shadowImage, linesImage] = await Promise.all([
      loadHtmlImage(asset.layered.base),
      loadHtmlImage(asset.layered.mask),
      loadHtmlImage(asset.layered.shadow),
      loadHtmlImage(asset.layered.lines)
    ]);

    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = baseImage.width;
    sourceCanvas.height = baseImage.height;
    const sourceContext = sourceCanvas.getContext("2d");

    if (!sourceContext) {
      throw new Error("No 2d context for layered template render");
    }

    sourceContext.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    sourceContext.drawImage(maskImage, 0, 0, sourceCanvas.width, sourceCanvas.height);

    const tintData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const tintPixels = tintData.data;
    let minX = sourceCanvas.width;
    let minY = sourceCanvas.height;
    let maxX = 0;
    let maxY = 0;

    for (let index = 0; index < tintPixels.length; index += 4) {
      const alpha = tintPixels[index + 3];
      const maskLuminance = (tintPixels[index] + tintPixels[index + 1] + tintPixels[index + 2]) / 3;

      if (alpha < 32 || maskLuminance < 192) {
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
      tintPixels[index + 3] = 255;
    }
    sourceContext.putImageData(tintData, 0, 0);

    if (maxX <= minX || maxY <= minY) {
      minX = 0;
      minY = 0;
      maxX = sourceCanvas.width - 1;
      maxY = sourceCanvas.height - 1;
    }

    sourceContext.globalCompositeOperation = "multiply";
    sourceContext.drawImage(shadowImage, 0, 0, sourceCanvas.width, sourceCanvas.height);
    sourceContext.globalCompositeOperation = "source-over";
    sourceContext.drawImage(linesImage, 0, 0, sourceCanvas.width, sourceCanvas.height);

    const padding = 140;
    const cropX = clamp(minX - padding, 0, sourceCanvas.width - 1);
    const cropY = clamp(minY - padding, 0, sourceCanvas.height - 1);
    const cropWidth = clamp(maxX - minX + 1 + padding * 2, 1, sourceCanvas.width - cropX);
    const cropHeight = clamp(maxY - minY + 1 + padding * 2, 1, sourceCanvas.height - cropY);

    const scale = Math.min(asset.maxWidth / cropWidth, asset.maxHeight / cropHeight);
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
    const top = Math.max(48, Math.round((CANVAS_DIMENSION - renderHeight) / 2) - 36);
    const printArea: PrintArea = {
      left: left + Math.round(renderWidth * asset.printAreaRatio.left),
      top: top + Math.round(renderHeight * asset.printAreaRatio.top),
      width: Math.round(renderWidth * asset.printAreaRatio.width),
      height: Math.round(renderHeight * asset.printAreaRatio.height)
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

  const cropX = Math.floor(source.width * asset.crop.x);
  const cropY = Math.floor(source.height * asset.crop.y);
  const cropWidth = Math.max(1, Math.floor(source.width * asset.crop.width));
  const cropHeight = Math.max(1, Math.floor(source.height * asset.crop.height));

  const scale = Math.min(asset.maxWidth / cropWidth, asset.maxHeight / cropHeight);
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

  for (const seed of asset.fillSeedRatios) {
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

  const left = Math.round((CANVAS_DIMENSION - trimmedWidth) / 2);
  const top = Math.max(40, Math.round((CANVAS_DIMENSION - trimmedHeight) / 2));
  const printArea: PrintArea = {
    left: left + Math.round(trimmedWidth * asset.printAreaRatio.left),
    top: top + Math.round(trimmedHeight * asset.printAreaRatio.top),
    width: Math.round(trimmedWidth * asset.printAreaRatio.width),
    height: Math.round(trimmedHeight * asset.printAreaRatio.height)
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


const tagSystemLayer = <T extends FabricObject>(object: T): T => {
  const extended = object as T & { data?: SystemLayerData };
  extended.data = { ...(extended.data ?? {}), systemLayer: true };
  object.selectable = false;
  object.evented = false;
  object.excludeFromExport = true;
  return object;
};

const isSystemLayer = (object: FabricObject): boolean => {
  const layerData = (object as FabricObject & { data?: SystemLayerData }).data;
  return layerData?.systemLayer === true;
};

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

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Не удалось прочитать изображение"));
    reader.readAsDataURL(file);
  });

export const EditorCanvas = (): JSX.Element => {
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const renderNonceRef = useRef(0);

  const [garmentType, setGarmentType] = useState<GarmentType>("TSHIRT");
  const [garmentColor, setGarmentColor] = useState<string>(GARMENT_COLORS[0]);
  const [fontFamily, setFontFamily] = useState<string>(FONT_FAMILIES[0]);
  const [textColor, setTextColor] = useState<string>(TEXT_COLORS[0]);
  const [textValue, setTextValue] = useState<string>("RSH custom");
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [snapToGridEnabled, setSnapToGridEnabled] = useState<boolean>(true);
  const [imageUrlInput, setImageUrlInput] = useState<string>("");
  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [activePrintArea, setActivePrintArea] = useState<PrintArea>(GARMENT_TEMPLATES.TSHIRT.printArea);

  const template = useMemo(() => GARMENT_TEMPLATES[garmentType], [garmentType]);
  const printAreaRef = useRef<PrintArea>(activePrintArea);

  useEffect(() => {
    printAreaRef.current = activePrintArea;
  }, [activePrintArea]);

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

  const repaintTemplate = useCallback(
    async (canvas: Canvas): Promise<void> => {
      const nonce = ++renderNonceRef.current;

      canvas
        .getObjects()
        .filter((object) => isSystemLayer(object))
        .forEach((object) => canvas.remove(object));

      const rasterTemplate = await buildRasterTemplate(garmentType, garmentColor);

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

      const garmentLayer = tagSystemLayer(garmentImage);
      canvas.add(garmentLayer);
      canvas.sendObjectToBack(garmentLayer);

      setActivePrintArea(rasterTemplate.printArea);
      printAreaRef.current = rasterTemplate.printArea;

      canvas.requestRenderAll();
    },
    [garmentColor, garmentType]
  );

  useEffect(() => {
    if (!canvasElementRef.current) {
      return;
    }

    const canvas = new Canvas(canvasElementRef.current, {
      width: CANVAS_DIMENSION,
      height: CANVAS_DIMENSION,
      backgroundColor: "#f7f7f7",
      preserveObjectStacking: true
    });

    canvas.on("object:moving", (event) => {
      const target = event.target;
      if (!target || isSystemLayer(target)) {
        return;
      }

      constrainInsidePrintArea(target, printAreaRef.current, snapToGridEnabled);
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

    fabricRef.current = canvas;
    void repaintTemplate(canvas);

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [repaintTemplate, refreshLayers, snapToGridEnabled]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) {
      return;
    }
    void repaintTemplate(canvas);
    refreshLayers();
  }, [garmentType, garmentColor, repaintTemplate, refreshLayers]);

  const addText = (): void => {
    const canvas = fabricRef.current;
    if (!canvas) {
      return;
    }

    const text = new Textbox(textValue.trim() || "RSH custom", {
      left: activePrintArea.left + 18,
      top: activePrintArea.top + 18,
      width: activePrintArea.width - 36,
      fontSize: 34,
      fill: textColor,
      fontFamily,
      editable: true
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    constrainInsidePrintArea(text, activePrintArea, snapToGridEnabled);
    canvas.requestRenderAll();
    setStatusMessage("Текст добавлен.");
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

    canvas.add(image);
    canvas.setActiveObject(image);
    constrainInsidePrintArea(image, activePrintArea, snapToGridEnabled);
    canvas.requestRenderAll();
  };

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setStatusMessage("Поддерживаются только изображения.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
      setStatusMessage("Файл слишком большой. Лимит: 8 МБ.");
      event.target.value = "";
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      const image = await FabricImage.fromURL(dataUrl);
      placeImage(image);
      setStatusMessage(`Фото «${file.name}» добавлено.`);
    } catch {
      setStatusMessage("Не удалось загрузить фото с устройства.");
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
      setStatusMessage("Фото по ссылке добавлено.");
    } catch {
      setStatusMessage("Не удалось загрузить фото по ссылке. Проверь URL и CORS на источнике.");
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
    setStatusMessage("Слой удалён.");
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

  const saveDesign = async (): Promise<void> => {
    const canvas = fabricRef.current;
    if (!canvas) {
      return;
    }

    setStatusMessage("Сохраняем дизайн...");

    const canvasJson = canvas.toJSON();
    const previewUrl = canvas.toDataURL({ format: "webp", quality: 0.9, multiplier: 1 });

    try {
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
        throw new Error("failed-save");
      }

      setStatusMessage("Дизайн сохранён в профиль.");
    } catch {
      setStatusMessage("Не удалось сохранить дизайн. Войдите в аккаунт и повторите.");
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card p-4">
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
                    className={`rounded-lg border px-3 py-2 text-left transition ${active ? "border-primary bg-primary/10" : "hover:border-primary/50"}`}
                  >
                    <p className="text-sm font-semibold">{option.label}</p>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{option.technicalLabel}</p>
                  </button>
                );
              })}
            </div>
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
                Сетка
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={snapToGridEnabled}
                  onChange={(event) => setSnapToGridEnabled(event.target.checked)}
                />
                Привязка
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={addText} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">
              Текст
            </button>
            <label className="rounded-md border px-3 py-2 text-sm hover:border-primary hover:text-primary">
              Фото
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

          <div className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_0.9fr_0.75fr]">
            <div className="space-y-1">
              <label htmlFor="editor-text-value" className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Текст слоя
              </label>
              <input
                id="editor-text-value"
                value={textValue}
                onChange={(event) => setTextValue(event.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="Например: RSH ARCHIVE"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="editor-font" className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Шрифт
              </label>
              <select
                id="editor-font"
                value={fontFamily}
                onChange={(event) => setFontFamily(event.target.value)}
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
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Цвет</p>
              <div className="flex flex-wrap gap-1.5">
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setTextColor(color)}
                    className={`h-8 w-8 rounded-full border ${textColor === color ? "ring-2 ring-primary" : ""}`}
                    style={{ backgroundColor: color }}
                    aria-label={`Цвет текста ${color}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-2 rounded-lg border p-3">
            <label htmlFor="editor-image-url" className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Фото по ссылке
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
                Добавить
              </button>
            </div>
          </div>

          <div className="overflow-auto rounded-xl border bg-[#f3f3f3] p-2">
            <canvas ref={canvasElementRef} className="mx-auto block" />
          </div>

          <div className="flex items-center gap-3">
            <button type="button" onClick={saveDesign} className="rounded-md bg-primary px-4 py-2 text-primary-foreground">
              Сохранить дизайн
            </button>
            {statusMessage ? <p className="text-sm text-muted-foreground">{statusMessage}</p> : null}
          </div>
        </div>

        <aside className="rounded-lg border p-3">
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
            {layers.length === 0 ? <p className="text-sm text-muted-foreground">Пока нет слоёв.</p> : null}
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
