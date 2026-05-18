"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, FabricImage, FabricObject, Rect, Textbox } from "fabric";
import { ensureCsrfToken } from "@/lib/csrf-client";

type GarmentType = "TSHIRT" | "HOODIE" | "SWEATSHIRT";

type LayerItem = {
  layerPosition: number;
  label: string;
};

type TemplateConfig = {
  printArea: { left: number; top: number; width: number; height: number };
  hint: string;
};

const CANVAS_MAX_SIZE = 720;
const GRID_STEP = 10;

const GARMENT_TEMPLATES: Record<GarmentType, TemplateConfig> = {
  TSHIRT: {
    printArea: { left: 140, top: 120, width: 440, height: 480 },
    hint: "ОБЛАСТЬ ПЕЧАТИ ФУТБОЛКИ"
  },
  HOODIE: {
    printArea: { left: 130, top: 140, width: 460, height: 440 },
    hint: "ОБЛАСТЬ ГРУДИ ХУДИ"
  },
  SWEATSHIRT: {
    printArea: { left: 150, top: 150, width: 420, height: 420 },
    hint: "ФРОНТАЛЬНАЯ ЗОНА СВИТШОТА"
  }
};

const GARMENT_COLORS = ["#111111", "#2d2d2d", "#6d665d", "#f4f1ec", "#8a1118"];
const FONT_FAMILIES = ["Space Grotesk", "Arial", "Times New Roman", "Courier New", "Georgia"];

const clampToGrid = (value: number): number => Math.round(value / GRID_STEP) * GRID_STEP;

const getObjectLabel = (object: FabricObject, index: number): string => {
  if (object.type === "textbox") {
    return `Текст ${index + 1}`;
  }

  if (object.type === "image") {
    return `Изображение ${index + 1}`;
  }

  return `Слой ${index + 1}`;
};

export const EditorCanvas = (): JSX.Element => {
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const printAreaRef = useRef<Rect | null>(null);
  const hintRef = useRef<Textbox | null>(null);

  const [garmentType, setGarmentType] = useState<GarmentType>("TSHIRT");
  const [garmentColor, setGarmentColor] = useState<string>(GARMENT_COLORS[0]);
  const [fontFamily, setFontFamily] = useState<string>(FONT_FAMILIES[0]);
  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [saveStatus, setSaveStatus] = useState<string>("");

  const template = useMemo(() => GARMENT_TEMPLATES[garmentType], [garmentType]);

  const getEditableObjects = useCallback((canvas: Canvas): FabricObject[] => {
    return canvas
      .getObjects()
      .filter((object) => object !== printAreaRef.current && object !== hintRef.current)
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
    (canvas: Canvas): void => {
      if (printAreaRef.current) {
        canvas.remove(printAreaRef.current);
      }

      if (hintRef.current) {
        canvas.remove(hintRef.current);
      }

      const printArea = new Rect({
        left: template.printArea.left,
        top: template.printArea.top,
        width: template.printArea.width,
        height: template.printArea.height,
        fill: "rgba(255,255,255,0.14)",
        stroke: "#0f0f0f",
        strokeDashArray: [8, 6],
        selectable: false,
        evented: false
      });

      const hint = new Textbox(template.hint, {
        left: template.printArea.left + 8,
        top: template.printArea.top + 8,
        width: template.printArea.width - 16,
        fontSize: 14,
        fill: "#141414",
        selectable: false,
        evented: false,
        textAlign: "center"
      });

      printAreaRef.current = printArea;
      hintRef.current = hint;

      canvas.add(printArea);
      canvas.add(hint);
      canvas.sendObjectToBack(printArea);
      canvas.bringObjectToFront(hint);
      canvas.requestRenderAll();
    },
    [template]
  );

  useEffect(() => {
    if (!canvasElementRef.current) {
      return;
    }

    const canvas = new Canvas(canvasElementRef.current, {
      width: CANVAS_MAX_SIZE,
      height: CANVAS_MAX_SIZE,
      backgroundColor: garmentColor,
      preserveObjectStacking: true
    });

    canvas.on("object:moving", (event) => {
      const target = event.target;
      if (!target || target === printAreaRef.current || target === hintRef.current) {
        return;
      }

      target.set({
        left: clampToGrid(target.left ?? 0),
        top: clampToGrid(target.top ?? 0)
      });
    });

    canvas.on("object:added", refreshLayers);
    canvas.on("object:removed", refreshLayers);

    fabricRef.current = canvas;
    repaintTemplate(canvas);

    const handleResize = (): void => {
      const host = canvasElementRef.current;
      if (!host) {
        return;
      }

      const size = Math.min(CANVAS_MAX_SIZE, Math.max(300, window.innerWidth - 48));
      canvas.setDimensions({ width: size, height: size });
      canvas.requestRenderAll();
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [garmentColor, repaintTemplate, refreshLayers]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) {
      return;
    }

    canvas.backgroundColor = garmentColor;
    repaintTemplate(canvas);
    refreshLayers();
    canvas.requestRenderAll();
  }, [garmentColor, repaintTemplate, refreshLayers]);

  const addText = (): void => {
    const canvas = fabricRef.current;
    if (!canvas) {
      return;
    }

    const text = new Textbox("RSH custom", {
      left: template.printArea.left + 40,
      top: template.printArea.top + 40,
      width: template.printArea.width - 80,
      fontSize: 34,
      fill: "#121212",
      fontFamily
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.requestRenderAll();
  };

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const canvas = fabricRef.current;
    const file = event.target.files?.[0];

    if (!canvas || !file) {
      return;
    }

    const dataUrl = await fileToDataUrl(file);
    const image = await FabricImage.fromURL(dataUrl);
    image.set({
      left: template.printArea.left + 60,
      top: template.printArea.top + 60,
      scaleX: 0.45,
      scaleY: 0.45
    });

    canvas.add(image);
    canvas.setActiveObject(image);
    canvas.requestRenderAll();

    event.target.value = "";
  };

  const rotateSelected = (angleDelta: number): void => {
    const canvas = fabricRef.current;
    const selected = canvas?.getActiveObject();

    if (canvas && selected) {
      selected.set("angle", (selected.angle ?? 0) + angleDelta);
      canvas.requestRenderAll();
    }
  };

  const removeSelected = (): void => {
    const canvas = fabricRef.current;
    const selected = canvas?.getActiveObject();

    if (canvas && selected && selected !== printAreaRef.current && selected !== hintRef.current) {
      canvas.remove(selected);
      canvas.requestRenderAll();
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

    setSaveStatus("Сохраняем дизайн...");

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

      setSaveStatus("Дизайн сохранен в профиль.");
    } catch {
      setSaveStatus("Не удалось сохранить дизайн. Войдите в аккаунт и попробуйте снова.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-xl border bg-card p-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Тип вещи</p>
          <div className="flex flex-wrap gap-2">
            {(["TSHIRT", "HOODIE", "SWEATSHIRT"] as GarmentType[]).map((item) => (
              <button
                key={item}
                className={`rounded-md border px-3 py-2 text-xs tracking-wide ${item === garmentType ? "border-primary bg-primary text-primary-foreground" : ""}`}
                onClick={() => setGarmentType(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Цвет вещи</p>
          <div className="flex gap-2">
            {GARMENT_COLORS.map((color) => (
              <button
                key={color}
                className={`h-8 w-8 rounded-full border ${garmentColor === color ? "ring-2 ring-primary" : ""}`}
                style={{ backgroundColor: color }}
                onClick={() => setGarmentColor(color)}
                type="button"
                aria-label={`Цвет ${color}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-4 lg:grid-cols-[1.5fr_0.9fr]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button onClick={addText} className="rounded-md bg-primary px-4 py-2 text-primary-foreground" type="button">
              Добавить текст
            </button>
            <label className="rounded-md border px-4 py-2 text-sm">
              Загрузить изображение
              <input className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadImage} />
            </label>
            <button onClick={() => rotateSelected(-15)} className="rounded-md border px-4 py-2" type="button">
              Повернуть -15°
            </button>
            <button onClick={() => rotateSelected(15)} className="rounded-md border px-4 py-2" type="button">
              Повернуть +15°
            </button>
            <button onClick={removeSelected} className="rounded-md border px-4 py-2" type="button">
              Удалить
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="fontFamily" className="text-sm text-muted-foreground">
              Шрифт
            </label>
            <select
              id="fontFamily"
              value={fontFamily}
              onChange={(event) => setFontFamily(event.target.value)}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              {FONT_FAMILIES.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </div>

          <canvas ref={canvasElementRef} className="w-full rounded-xl border bg-white" />

          <button onClick={saveDesign} className="rounded-md bg-primary px-4 py-2 text-primary-foreground" type="button">
            Сохранить дизайн
          </button>
          {saveStatus ? <p className="text-sm text-muted-foreground">{saveStatus}</p> : null}
        </div>

        <aside className="rounded-lg border p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Слои</p>
          <div className="mt-3 space-y-2">
            {layers.length === 0 ? <p className="text-sm text-muted-foreground">Пока нет редактируемых слоев.</p> : null}
            {layers.map((layer) => (
              <button
                key={`${layer.layerPosition}-${layer.label}`}
                onClick={() => selectLayer(layer.layerPosition)}
                className="w-full rounded-md border px-3 py-2 text-left text-sm hover:border-primary hover:text-primary"
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

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
