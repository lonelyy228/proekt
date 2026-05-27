"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, Circle, FabricImage, FabricObject, Path, Rect, Textbox } from "fabric";
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
  shortLabel: string;
  hint: string;
  printArea: PrintArea;
};

type SystemLayerData = {
  systemLayer?: boolean;
};

const CANVAS_SIZE = 720;
const IMAGE_FILE_LIMIT_BYTES = 8 * 1024 * 1024;
const GRID_STEP = 20;

const GARMENT_TEMPLATES: Record<GarmentType, GarmentTemplate> = {
  TSHIRT: {
    code: "TSHIRT",
    label: "Футболка",
    shortLabel: "T-shirt",
    hint: "Область печати футболки",
    printArea: { left: 245, top: 235, width: 230, height: 220 }
  },
  HOODIE: {
    code: "HOODIE",
    label: "Худи",
    shortLabel: "Hoodie",
    hint: "Фронтальная область худи",
    printArea: { left: 235, top: 250, width: 250, height: 210 }
  },
  SHORTS: {
    code: "SHORTS",
    label: "Шорты",
    shortLabel: "Shorts",
    hint: "Фронтальная область шорт",
    printArea: { left: 240, top: 260, width: 240, height: 190 }
  }
};

const GARMENT_OPTIONS: GarmentType[] = ["TSHIRT", "HOODIE", "SHORTS"];
const GARMENT_COLORS = ["#111111", "#2d2d2d", "#58514a", "#f4f1ec", "#8a1118", "#1a2f56"];
const FONT_FAMILIES = ["Space Grotesk", "Arial", "Times New Roman", "Courier New", "Georgia"];
const TEXT_COLORS = ["#0f0f0f", "#ffffff", "#d90429", "#1d4ed8", "#047857", "#f59e0b"];

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const clampToGrid = (value: number, step: number): number => Math.round(value / step) * step;

const adjustHexColor = (hex: string, delta: number): string => {
  const normalized = hex.replace("#", "");

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return hex;
  }

  const toHex = (channel: number): string => channel.toString(16).padStart(2, "0");
  const r = clamp(parseInt(normalized.slice(0, 2), 16) + delta, 0, 255);
  const g = clamp(parseInt(normalized.slice(2, 4), 16) + delta, 0, 255);
  const b = clamp(parseInt(normalized.slice(4, 6), 16) + delta, 0, 255);

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const tagSystemLayer = <T extends FabricObject>(object: T): T => {
  const extendedObject = object as T & { data?: SystemLayerData };
  extendedObject.data = { ...(extendedObject.data ?? {}), systemLayer: true };
  object.selectable = false;
  object.evented = false;
  object.excludeFromExport = true;
  return object;
};

const isSystemLayer = (object: FabricObject): boolean => {
  const data = (object as FabricObject & { data?: SystemLayerData }).data;
  return data?.systemLayer === true;
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

  const width = object.width ?? 0;
  return width * (object.scaleX ?? 1);
};

const getScaledObjectHeight = (object: FabricObject): number => {
  if (typeof object.getScaledHeight === "function") {
    return object.getScaledHeight();
  }

  const height = object.height ?? 0;
  return height * (object.scaleY ?? 1);
};

const constrainObjectToPrintArea = (object: FabricObject, printArea: PrintArea, snapToGridEnabled: boolean): void => {
  const objectWidth = getScaledObjectWidth(object);
  const objectHeight = getScaledObjectHeight(object);

  const minLeft = printArea.left;
  const maxLeft = printArea.left + printArea.width - objectWidth;
  const minTop = printArea.top;
  const maxTop = printArea.top + printArea.height - objectHeight;

  const rawLeft = clamp(object.left ?? minLeft, minLeft, maxLeft);
  const rawTop = clamp(object.top ?? minTop, minTop, maxTop);

  const left = snapToGridEnabled ? clampToGrid(rawLeft, GRID_STEP) : rawLeft;
  const top = snapToGridEnabled ? clampToGrid(rawTop, GRID_STEP) : rawTop;

  object.set({ left, top });
  object.setCoords();
};

const createTshirtSilhouette = (baseColor: string): FabricObject[] => {
  const body = tagSystemLayer(
    new Rect({
      left: 230,
      top: 165,
      width: 260,
      height: 360,
      rx: 34,
      ry: 34,
      fill: baseColor,
      stroke: adjustHexColor(baseColor, -30),
      strokeWidth: 2
    })
  );

  const leftSleeve = tagSystemLayer(
    new Rect({
      left: 165,
      top: 190,
      width: 92,
      height: 126,
      rx: 20,
      ry: 20,
      angle: -11,
      fill: adjustHexColor(baseColor, -6),
      stroke: adjustHexColor(baseColor, -32),
      strokeWidth: 2
    })
  );

  const rightSleeve = tagSystemLayer(
    new Rect({
      left: 463,
      top: 190,
      width: 92,
      height: 126,
      rx: 20,
      ry: 20,
      angle: 11,
      fill: adjustHexColor(baseColor, -6),
      stroke: adjustHexColor(baseColor, -32),
      strokeWidth: 2
    })
  );

  const collar = tagSystemLayer(
    new Circle({
      left: 322,
      top: 145,
      radius: 38,
      fill: adjustHexColor(baseColor, -48),
      stroke: adjustHexColor(baseColor, -64),
      strokeWidth: 2
    })
  );

  return [body, leftSleeve, rightSleeve, collar];
};

const createHoodieSilhouette = (baseColor: string): FabricObject[] => {
  const body = tagSystemLayer(
    new Rect({
      left: 210,
      top: 178,
      width: 300,
      height: 356,
      rx: 32,
      ry: 32,
      fill: baseColor,
      stroke: adjustHexColor(baseColor, -34),
      strokeWidth: 2
    })
  );

  const hood = tagSystemLayer(
    new Path("M 236 198 Q 360 58 484 198 Q 470 241 444 269 Q 360 219 276 269 Q 250 242 236 198 Z", {
      fill: adjustHexColor(baseColor, -12),
      stroke: adjustHexColor(baseColor, -40),
      strokeWidth: 2
    })
  );

  const pocket = tagSystemLayer(
    new Rect({
      left: 268,
      top: 394,
      width: 184,
      height: 96,
      rx: 24,
      ry: 24,
      fill: adjustHexColor(baseColor, -16),
      stroke: adjustHexColor(baseColor, -42),
      strokeWidth: 2
    })
  );

  const laceLeft = tagSystemLayer(
    new Path("M 334 235 L 324 318", {
      stroke: adjustHexColor(baseColor, -58),
      strokeWidth: 4,
      fill: "",
      selectable: false
    })
  );

  const laceRight = tagSystemLayer(
    new Path("M 386 235 L 396 318", {
      stroke: adjustHexColor(baseColor, -58),
      strokeWidth: 4,
      fill: "",
      selectable: false
    })
  );

  return [body, hood, pocket, laceLeft, laceRight];
};

const createShortsSilhouette = (baseColor: string): FabricObject[] => {
  const waist = tagSystemLayer(
    new Rect({
      left: 228,
      top: 176,
      width: 264,
      height: 84,
      rx: 18,
      ry: 18,
      fill: adjustHexColor(baseColor, -8),
      stroke: adjustHexColor(baseColor, -32),
      strokeWidth: 2
    })
  );

  const leftLeg = tagSystemLayer(
    new Rect({
      left: 228,
      top: 252,
      width: 122,
      height: 228,
      rx: 22,
      ry: 22,
      fill: baseColor,
      stroke: adjustHexColor(baseColor, -32),
      strokeWidth: 2
    })
  );

  const rightLeg = tagSystemLayer(
    new Rect({
      left: 370,
      top: 252,
      width: 122,
      height: 228,
      rx: 22,
      ry: 22,
      fill: baseColor,
      stroke: adjustHexColor(baseColor, -32),
      strokeWidth: 2
    })
  );

  const centerCut = tagSystemLayer(
    new Path("M 350 258 Q 360 320 370 258", {
      stroke: adjustHexColor(baseColor, -54),
      strokeWidth: 3,
      fill: ""
    })
  );

  return [waist, leftLeg, rightLeg, centerCut];
};

const createGridLayers = (printArea: PrintArea): FabricObject[] => {
  const lines: FabricObject[] = [];

  for (let x = printArea.left; x <= printArea.left + printArea.width; x += GRID_STEP) {
    lines.push(
      tagSystemLayer(
        new Path(`M ${x} ${printArea.top} L ${x} ${printArea.top + printArea.height}`, {
          stroke: "rgba(0,0,0,0.1)",
          strokeWidth: 1,
          fill: ""
        })
      )
    );
  }

  for (let y = printArea.top; y <= printArea.top + printArea.height; y += GRID_STEP) {
    lines.push(
      tagSystemLayer(
        new Path(`M ${printArea.left} ${y} L ${printArea.left + printArea.width} ${y}`, {
          stroke: "rgba(0,0,0,0.1)",
          strokeWidth: 1,
          fill: ""
        })
      )
    );
  }

  return lines;
};

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });

export const EditorCanvas = (): JSX.Element => {
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);

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

  const repaintScene = useCallback(
    (canvas: Canvas): void => {
      const existingSystemLayers = canvas.getObjects().filter((object) => isSystemLayer(object));
      existingSystemLayers.forEach((object) => canvas.remove(object));

      let silhouette: FabricObject[] = [];
      if (garmentType === "TSHIRT") {
        silhouette = createTshirtSilhouette(garmentColor);
      } else if (garmentType === "HOODIE") {
        silhouette = createHoodieSilhouette(garmentColor);
      } else {
        silhouette = createShortsSilhouette(garmentColor);
      }

      const printAreaLayer = tagSystemLayer(
        new Rect({
          left: template.printArea.left,
          top: template.printArea.top,
          width: template.printArea.width,
          height: template.printArea.height,
          fill: "rgba(255,255,255,0.2)",
          stroke: "rgba(20,20,20,0.7)",
          strokeDashArray: [8, 6],
          strokeWidth: 2
        })
      );

      const hintLayer = tagSystemLayer(
        new Textbox(template.hint, {
          left: template.printArea.left + 8,
          top: template.printArea.top + 8,
          width: template.printArea.width - 16,
          fontSize: 13,
          fill: "#111111",
          textAlign: "center"
        })
      );

      const gridLayers = showGrid ? createGridLayers(template.printArea) : [];
      const systemLayers: FabricObject[] = [...silhouette, printAreaLayer, ...gridLayers, hintLayer];

      systemLayers.forEach((object) => canvas.add(object));
      systemLayers.forEach((object) => canvas.sendObjectToBack(object));

      canvas.requestRenderAll();
    },
    [garmentColor, garmentType, showGrid, template]
  );

  useEffect(() => {
    if (!canvasElementRef.current) {
      return;
    }

    const canvas = new Canvas(canvasElementRef.current, {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      backgroundColor: "#f3f3f3",
      preserveObjectStacking: true
    });

    canvas.on("object:moving", (event) => {
      const target = event.target;
      if (!target || isSystemLayer(target)) {
        return;
      }

      constrainObjectToPrintArea(target, template.printArea, snapToGridEnabled);
    });

    canvas.on("object:scaling", (event) => {
      const target = event.target;
      if (!target || isSystemLayer(target)) {
        return;
      }

      constrainObjectToPrintArea(target, template.printArea, false);
    });

    canvas.on("object:added", refreshLayers);
    canvas.on("object:removed", refreshLayers);
    canvas.on("object:modified", refreshLayers);

    fabricRef.current = canvas;
    repaintScene(canvas);
    refreshLayers();

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [repaintScene, refreshLayers, snapToGridEnabled, template.printArea]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) {
      return;
    }

    repaintScene(canvas);
    refreshLayers();
  }, [garmentType, garmentColor, showGrid, repaintScene, refreshLayers]);

  const addText = (): void => {
    const canvas = fabricRef.current;
    if (!canvas) {
      return;
    }

    const textObject = new Textbox(textValue.trim() || "RSH custom", {
      left: template.printArea.left + 30,
      top: template.printArea.top + 30,
      width: template.printArea.width - 60,
      fontSize: 34,
      fill: textColor,
      fontFamily,
      editable: true
    });

    canvas.add(textObject);
    canvas.setActiveObject(textObject);
    constrainObjectToPrintArea(textObject, template.printArea, snapToGridEnabled);
    canvas.requestRenderAll();
    setStatusMessage("Текст добавлен.");
  };

  const placeImageObject = (canvas: Canvas, image: FabricImage): void => {
    const maxWidth = template.printArea.width * 0.7;
    const maxHeight = template.printArea.height * 0.7;

    const rawWidth = image.width ?? maxWidth;
    const rawHeight = image.height ?? maxHeight;

    const widthRatio = maxWidth / rawWidth;
    const heightRatio = maxHeight / rawHeight;
    const ratio = Math.min(widthRatio, heightRatio, 1);

    image.set({
      left: template.printArea.left + 24,
      top: template.printArea.top + 24,
      scaleX: ratio,
      scaleY: ratio,
      objectCaching: true
    });

    canvas.add(image);
    canvas.setActiveObject(image);
    constrainObjectToPrintArea(image, template.printArea, snapToGridEnabled);
    canvas.requestRenderAll();
  };

  const uploadImageFromDevice = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const canvas = fabricRef.current;
    const file = event.target.files?.[0];

    if (!canvas || !file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setStatusMessage("Можно загружать только изображения.");
      event.target.value = "";
      return;
    }

    if (file.size > IMAGE_FILE_LIMIT_BYTES) {
      setStatusMessage("Файл слишком большой. Лимит: 8 МБ.");
      event.target.value = "";
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      const image = await FabricImage.fromURL(dataUrl);
      placeImageObject(canvas, image);
      setStatusMessage(`Фото "${file.name}" добавлено.`);
    } catch {
      setStatusMessage("Не удалось загрузить фото с устройства.");
    } finally {
      event.target.value = "";
    }
  };

  const addImageFromUrl = async (): Promise<void> => {
    const canvas = fabricRef.current;
    const sourceUrl = imageUrlInput.trim();

    if (!canvas || sourceUrl.length === 0) {
      return;
    }

    try {
      const image = await FabricImage.fromURL(sourceUrl, { crossOrigin: "anonymous" });
      placeImageObject(canvas, image);
      setStatusMessage("Фото по ссылке добавлено.");
      setImageUrlInput("");
    } catch {
      setStatusMessage("Не удалось загрузить фото по ссылке. Проверь ссылку и CORS на источнике.");
    }
  };

  const rotateSelected = (angleDelta: number): void => {
    const canvas = fabricRef.current;
    const selected = canvas?.getActiveObject();

    if (!canvas || !selected || isSystemLayer(selected)) {
      return;
    }

    selected.set("angle", (selected.angle ?? 0) + angleDelta);
    constrainObjectToPrintArea(selected, template.printArea, false);
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
    constrainObjectToPrintArea(selected, template.printArea, false);
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

    if (canvas && selected && !isSystemLayer(selected)) {
      canvas.remove(selected);
      canvas.requestRenderAll();
      setStatusMessage("Слой удалён.");
    }
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
        throw new Error("Не удалось сохранить дизайн");
      }

      setStatusMessage("Дизайн сохранён в профиль.");
    } catch {
      setStatusMessage("Не удалось сохранить дизайн. Войдите в аккаунт и попробуйте снова.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Выбери макет</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {GARMENT_OPTIONS.map((item) => {
            const option = GARMENT_TEMPLATES[item];
            return (
              <button
                key={item}
                className={`rounded-lg border px-3 py-3 text-left transition ${item === garmentType ? "border-primary bg-primary/10" : "hover:border-primary/50"}`}
                onClick={() => setGarmentType(item)}
                type="button"
              >
                <p className="text-sm font-semibold">{option.label}</p>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{option.shortLabel}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Цвет вещи</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {GARMENT_COLORS.map((color) => (
                <button
                  key={color}
                  className={`h-9 w-9 rounded-full border ${garmentColor === color ? "ring-2 ring-primary" : ""}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setGarmentColor(color)}
                  type="button"
                  aria-label={`Цвет ${color}`}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} type="checkbox" />
              Показать сетку
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input checked={snapToGridEnabled} onChange={(event) => setSnapToGridEnabled(event.target.checked)} type="checkbox" />
              Привязка к сетке
            </label>
          </div>
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-4 lg:grid-cols-[1.5fr_0.9fr]">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button onClick={addText} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" type="button">
              Добавить текст
            </button>

            <label className="rounded-md border px-4 py-2 text-sm hover:border-primary hover:text-primary">
              Добавить фото
              <input className="hidden" type="file" accept="image/*" onChange={uploadImageFromDevice} />
            </label>

            <button onClick={() => rotateSelected(-15)} className="rounded-md border px-4 py-2 text-sm" type="button">
              -15°
            </button>
            <button onClick={() => rotateSelected(15)} className="rounded-md border px-4 py-2 text-sm" type="button">
              +15°
            </button>
            <button onClick={() => scaleSelected(-0.1)} className="rounded-md border px-4 py-2 text-sm" type="button">
              Масштаб -
            </button>
            <button onClick={() => scaleSelected(0.1)} className="rounded-md border px-4 py-2 text-sm" type="button">
              Масштаб +
            </button>
            <button onClick={removeSelected} className="rounded-md border px-4 py-2 text-sm" type="button">
              Удалить
            </button>
          </div>

          <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1.1fr_0.9fr_0.8fr]">
            <div className="space-y-1">
              <label htmlFor="rsh-text" className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Текст слоя
              </label>
              <input
                id="rsh-text"
                value={textValue}
                onChange={(event) => setTextValue(event.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="Например: RSH ARCHIVE"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="rsh-font" className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Шрифт
              </label>
              <select
                id="rsh-font"
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
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Цвет текста</p>
              <div className="flex flex-wrap gap-2">
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    className={`h-8 w-8 rounded-full border ${textColor === color ? "ring-2 ring-primary" : ""}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setTextColor(color)}
                    type="button"
                    aria-label={`Цвет текста ${color}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-2 rounded-lg border p-3">
            <label htmlFor="rsh-image-url" className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Фото по ссылке (URL)
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="rsh-image-url"
                value={imageUrlInput}
                onChange={(event) => setImageUrlInput(event.target.value)}
                className="min-w-[240px] flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="https://..."
              />
              <button onClick={addImageFromUrl} className="rounded-md border px-4 py-2 text-sm" type="button">
                Добавить по ссылке
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border bg-white">
            <canvas ref={canvasElementRef} className="h-auto w-full max-w-[720px]" />
          </div>

          <button onClick={saveDesign} className="rounded-md bg-primary px-4 py-2 text-primary-foreground" type="button">
            Сохранить дизайн
          </button>

          {statusMessage ? <p className="text-sm text-muted-foreground">{statusMessage}</p> : null}
        </div>

        <aside className="space-y-3 rounded-lg border p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Слои</p>

          <div className="flex gap-2">
            <button onClick={() => moveLayer("UP")} className="rounded-md border px-3 py-2 text-sm" type="button">
              Вверх
            </button>
            <button onClick={() => moveLayer("DOWN")} className="rounded-md border px-3 py-2 text-sm" type="button">
              Вниз
            </button>
          </div>

          <div className="space-y-2">
            {layers.length === 0 ? <p className="text-sm text-muted-foreground">Пока нет редактируемых слоёв.</p> : null}
            {layers.map((layer) => (
              <button
                key={`${layer.layerPosition}-${layer.label}`}
                onClick={() => selectLayer(layer.layerPosition)}
                className="w-full rounded-md border px-3 py-2 text-left text-sm transition hover:border-primary hover:text-primary"
                type="button"
              >
                {layer.label}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};
