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
const GARMENT_IMAGE_TARGET_WIDTH = 620;
const GRID_STEP = 20;
const MAX_IMAGE_FILE_SIZE_BYTES = 8 * 1024 * 1024;

const GARMENT_TEMPLATES: Record<GarmentType, GarmentTemplate> = {
  TSHIRT: {
    code: "TSHIRT",
    label: "Футболка",
    technicalLabel: "Front",
    hint: "Печатная зона футболки",
    printArea: { left: 274, top: 252, width: 212, height: 220 }
  },
  HOODIE: {
    code: "HOODIE",
    label: "Худи",
    technicalLabel: "Front",
    hint: "Печатная зона худи",
    printArea: { left: 258, top: 284, width: 244, height: 196 }
  },
  SHORTS: {
    code: "SHORTS",
    label: "Шорты",
    technicalLabel: "Front",
    hint: "Печатная зона шорт",
    printArea: { left: 266, top: 286, width: 228, height: 178 }
  }
};

const GARMENT_OPTIONS: GarmentType[] = ["TSHIRT", "HOODIE", "SHORTS"];
const GARMENT_COLORS = ["#111111", "#2b2b2b", "#5c564f", "#e8e5df", "#9b111e", "#1f3d72"];
const FONT_FAMILIES = ["Space Grotesk", "Arial", "Times New Roman", "Courier New", "Georgia"];
const TEXT_COLORS = ["#111111", "#ffffff", "#d91b3a", "#214fce", "#0f8a5f", "#f29f05"];

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const shadeColor = (hex: string, delta: number): string => {
  const normalized = hex.replace("#", "");

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return hex;
  }

  const makeHex = (channel: number): string => channel.toString(16).padStart(2, "0");

  const r = clamp(parseInt(normalized.slice(0, 2), 16) + delta, 0, 255);
  const g = clamp(parseInt(normalized.slice(2, 4), 16) + delta, 0, 255);
  const b = clamp(parseInt(normalized.slice(4, 6), 16) + delta, 0, 255);

  return `#${makeHex(r)}${makeHex(g)}${makeHex(b)}`;
};

const svgToDataUrl = (svg: string): string => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const buildTshirtSvg = (color: string): string => {
  const stroke = shadeColor(color, -50);
  const shadow = shadeColor(color, -18);
  const highlight = shadeColor(color, 26);

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 760">
  <g>
    <path d="M259 150 L321 124 L439 124 L501 150 L560 227 L528 273 L490 242 L490 592 Q490 616 466 616 L294 616 Q270 616 270 592 L270 242 L232 273 L200 227 Z"
          fill="${color}" stroke="${stroke}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M321 124 Q380 180 439 124" fill="none" stroke="${stroke}" stroke-width="2"/>
    <path d="M318 124 Q380 198 442 124" fill="none" stroke="${highlight}" stroke-width="1.5" opacity="0.5"/>
    <path d="M270 260 L226 294 L208 252 L246 198 L270 212 Z" fill="${shadow}" opacity="0.42"/>
    <path d="M490 260 L534 294 L552 252 L514 198 L490 212 Z" fill="${shadow}" opacity="0.42"/>
    <path d="M270 592 L490 592" fill="none" stroke="${stroke}" stroke-width="2"/>
  </g>
</svg>`;
};

const buildHoodieSvg = (color: string): string => {
  const stroke = shadeColor(color, -52);
  const shadow = shadeColor(color, -18);
  const cuff = shadeColor(color, -24);

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 760">
  <g>
    <path d="M235 212 L286 168 Q331 126 380 126 Q429 126 474 168 L525 212 L548 280 L512 312 L500 287 L500 598 Q500 620 478 620 L282 620 Q260 620 260 598 L260 287 L248 312 L212 280 Z"
          fill="${color}" stroke="${stroke}" stroke-width="2.3" stroke-linejoin="round"/>
    <path d="M286 168 Q380 248 474 168" fill="none" stroke="${stroke}" stroke-width="2"/>
    <path d="M302 190 Q380 255 458 190" fill="none" stroke="${shadow}" stroke-width="1.4" opacity="0.75"/>
    <path d="M248 282 L196 328 L176 278 L214 224 L254 232 Z" fill="${shadow}" opacity="0.46"/>
    <path d="M512 282 L564 328 L584 278 L546 224 L506 232 Z" fill="${shadow}" opacity="0.46"/>
    <rect x="311" y="414" width="138" height="88" rx="20" fill="${shadow}" opacity="0.42" stroke="${stroke}" stroke-width="1.2"/>
    <path d="M350 242 L342 323" fill="none" stroke="${cuff}" stroke-width="3" stroke-linecap="round"/>
    <path d="M410 242 L418 323" fill="none" stroke="${cuff}" stroke-width="3" stroke-linecap="round"/>
    <path d="M260 620 L500 620" fill="none" stroke="${stroke}" stroke-width="2"/>
  </g>
</svg>`;
};

const buildShortsSvg = (color: string): string => {
  const stroke = shadeColor(color, -52);
  const shadow = shadeColor(color, -16);
  const hem = shadeColor(color, -28);

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 760">
  <g>
    <path d="M256 178 H504 Q526 178 530 200 L548 314 Q554 352 520 370 L492 384 L468 578 Q465 604 440 604 H320 Q295 604 292 578 L268 384 L240 370 Q206 352 212 314 L230 200 Q234 178 256 178 Z"
          fill="${color}" stroke="${stroke}" stroke-width="2.3" stroke-linejoin="round"/>
    <rect x="258" y="182" width="244" height="52" rx="16" fill="${shadow}" opacity="0.48"/>
    <path d="M380 236 L368 376" fill="none" stroke="${stroke}" stroke-width="2"/>
    <path d="M330 254 L316 336" fill="none" stroke="${hem}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M430 254 L444 336" fill="none" stroke="${hem}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M292 578 H468" fill="none" stroke="${stroke}" stroke-width="2"/>
  </g>
</svg>`;
};

const buildGarmentSvg = (garmentType: GarmentType, color: string): string => {
  if (garmentType === "TSHIRT") {
    return buildTshirtSvg(color);
  }

  if (garmentType === "HOODIE") {
    return buildHoodieSvg(color);
  }

  return buildShortsSvg(color);
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
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [snapToGridEnabled, setSnapToGridEnabled] = useState<boolean>(true);
  const [imageUrlInput, setImageUrlInput] = useState<string>("");
  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const template = useMemo(() => GARMENT_TEMPLATES[garmentType], [garmentType]);

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

      const templateSvg = buildGarmentSvg(garmentType, garmentColor);
      const garmentImage = await FabricImage.fromURL(svgToDataUrl(templateSvg));

      if (nonce !== renderNonceRef.current) {
        return;
      }

      garmentImage.scaleToWidth(GARMENT_IMAGE_TARGET_WIDTH);
      garmentImage.set({
        left: (CANVAS_DIMENSION - getScaledObjectWidth(garmentImage)) / 2,
        top: 86,
        objectCaching: true
      });

      const garmentLayer = tagSystemLayer(garmentImage);

      const printAreaLayer = tagSystemLayer(
        new Rect({
          left: template.printArea.left,
          top: template.printArea.top,
          width: template.printArea.width,
          height: template.printArea.height,
          fill: "rgba(255,255,255,0.16)",
          stroke: "rgba(20,20,20,0.72)",
          strokeDashArray: [8, 6],
          strokeWidth: 2
        })
      );

      const hintLayer = tagSystemLayer(
        new Textbox(template.hint, {
          left: template.printArea.left + 8,
          top: template.printArea.top + 8,
          width: template.printArea.width - 16,
          fontSize: 12,
          fill: "#111111",
          textAlign: "center"
        })
      );

      canvas.add(garmentLayer);

      if (showGrid) {
        for (let x = template.printArea.left; x <= template.printArea.left + template.printArea.width; x += GRID_STEP) {
          canvas.add(
            tagSystemLayer(
              new Rect({
                left: x,
                top: template.printArea.top,
                width: 1,
                height: template.printArea.height,
                fill: "rgba(0,0,0,0.08)",
                strokeWidth: 0
              })
            )
          );
        }

        for (let y = template.printArea.top; y <= template.printArea.top + template.printArea.height; y += GRID_STEP) {
          canvas.add(
            tagSystemLayer(
              new Rect({
                left: template.printArea.left,
                top: y,
                width: template.printArea.width,
                height: 1,
                fill: "rgba(0,0,0,0.08)",
                strokeWidth: 0
              })
            )
          );
        }
      }

      canvas.add(printAreaLayer);
      canvas.add(hintLayer);

      canvas
        .getObjects()
        .filter((object) => isSystemLayer(object))
        .forEach((object) => canvas.sendObjectToBack(object));

      canvas.requestRenderAll();
    },
    [garmentColor, garmentType, showGrid, template]
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

      constrainInsidePrintArea(target, template.printArea, snapToGridEnabled);
    });

    canvas.on("object:scaling", (event) => {
      const target = event.target;
      if (!target || isSystemLayer(target)) {
        return;
      }

      constrainInsidePrintArea(target, template.printArea, false);
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
  }, [repaintTemplate, refreshLayers, snapToGridEnabled, template.printArea]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) {
      return;
    }

    void repaintTemplate(canvas).then(() => {
      refreshLayers();
    });
  }, [garmentType, garmentColor, showGrid, repaintTemplate, refreshLayers]);

  const addText = (): void => {
    const canvas = fabricRef.current;
    if (!canvas) {
      return;
    }

    const text = new Textbox(textValue.trim() || "RSH custom", {
      left: template.printArea.left + 18,
      top: template.printArea.top + 18,
      width: template.printArea.width - 36,
      fontSize: 34,
      fill: textColor,
      fontFamily,
      editable: true
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    constrainInsidePrintArea(text, template.printArea, snapToGridEnabled);
    canvas.requestRenderAll();
    setStatusMessage("Текст добавлен.");
  };

  const placeImage = (image: FabricImage): void => {
    const canvas = fabricRef.current;
    if (!canvas) {
      return;
    }

    const maxWidth = template.printArea.width * 0.78;
    const maxHeight = template.printArea.height * 0.78;

    if ((image.width ?? 0) > (image.height ?? 0)) {
      image.scaleToWidth(maxWidth);
    } else {
      image.scaleToHeight(maxHeight);
    }

    image.set({
      left: template.printArea.left + 14,
      top: template.printArea.top + 14,
      objectCaching: true
    });

    canvas.add(image);
    canvas.setActiveObject(image);
    constrainInsidePrintArea(image, template.printArea, snapToGridEnabled);
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
    constrainInsidePrintArea(selected, template.printArea, false);
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
    constrainInsidePrintArea(selected, template.printArea, false);
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

      <section className="grid gap-4 rounded-xl border bg-card p-4 xl:grid-cols-[minmax(0,1fr)_300px]">
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
