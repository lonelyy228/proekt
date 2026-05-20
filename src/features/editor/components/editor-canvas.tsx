"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, FabricImage, FabricObject, Rect, Textbox } from "fabric";
import { ensureCsrfToken } from "@/lib/csrf-client";
import { uploadDesignAsset } from "@/lib/uploadthing-client";
import {
  CUSTOMIZER_ALLOWED_FONTS,
  CUSTOMIZER_CANVAS_SIZE,
  CUSTOMIZER_CONSTRAINTS,
  CUSTOMIZER_GARMENT_TEMPLATES,
  CUSTOMIZER_GARMENT_TYPES,
  CustomizerGarmentType,
  PrintAreaRect,
  getGarmentPrintArea
} from "@/config/customizer";

type LayerItem = {
  layerPosition: number;
  label: string;
};

const GRID_STEP = 10;
const MAX_IMAGE_UPLOAD_SIZE_BYTES = 6 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const GARMENT_COLORS = ["#111111", "#2d2d2d", "#6d665d", "#f4f1ec", "#8a1118"] as const;

const clamp = (value: number, minValue: number, maxValue: number): number =>
  Math.min(Math.max(value, minValue), maxValue);

const clampToGrid = (value: number): number => Math.round(value / GRID_STEP) * GRID_STEP;

const getObjectLabel = (object: FabricObject, index: number): string => {
  if (object.type === "textbox" || object.type === "i-text" || object.type === "text") {
    return `Текст ${index + 1}`;
  }

  if (object.type === "image") {
    return `Изображение ${index + 1}`;
  }

  return `Слой ${index + 1}`;
};

const getObjectScaledSize = (object: FabricObject): { width: number; height: number } => {
  const width =
    typeof object.getScaledWidth === "function"
      ? object.getScaledWidth()
      : Math.abs((object.width ?? 0) * (object.scaleX ?? 1));
  const height =
    typeof object.getScaledHeight === "function"
      ? object.getScaledHeight()
      : Math.abs((object.height ?? 0) * (object.scaleY ?? 1));

  return {
    width: Math.max(width, CUSTOMIZER_CONSTRAINTS.minObjectSize),
    height: Math.max(height, CUSTOMIZER_CONSTRAINTS.minObjectSize)
  };
};

const clampObjectToPrintArea = (object: FabricObject, printArea: PrintAreaRect): void => {
  const { width, height } = getObjectScaledSize(object);

  const maxLeft = printArea.left + Math.max(0, printArea.width - width);
  const maxTop = printArea.top + Math.max(0, printArea.height - height);

  object.set({
    left: clamp(object.left ?? printArea.left, printArea.left, maxLeft),
    top: clamp(object.top ?? printArea.top, printArea.top, maxTop)
  });

  object.setCoords();
};

export const EditorCanvas = (): JSX.Element => {
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const printAreaRef = useRef<Rect | null>(null);
  const hintRef = useRef<Textbox | null>(null);

  const [garmentType, setGarmentType] = useState<CustomizerGarmentType>("TSHIRT");
  const [garmentColor, setGarmentColor] = useState<string>(GARMENT_COLORS[0]);
  const [fontFamily, setFontFamily] = useState<string>(CUSTOMIZER_ALLOWED_FONTS[0]);
  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [saveStatus, setSaveStatus] = useState<string>("");

  const template = useMemo(() => CUSTOMIZER_GARMENT_TEMPLATES[garmentType], [garmentType]);

  const getCurrentPrintArea = useCallback((canvas: Canvas): PrintAreaRect => {
    return getGarmentPrintArea(garmentType, canvas.getWidth(), canvas.getHeight());
  }, [garmentType]);

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

      const printArea = getCurrentPrintArea(canvas);

      const printAreaLayer = new Rect({
        left: printArea.left,
        top: printArea.top,
        width: printArea.width,
        height: printArea.height,
        fill: "rgba(255,255,255,0.14)",
        stroke: "#0f0f0f",
        strokeDashArray: [8, 6],
        selectable: false,
        evented: false
      });

      const hint = new Textbox(template.hint, {
        left: printArea.left + 8,
        top: printArea.top + 8,
        width: printArea.width - 16,
        fontSize: 14,
        fill: "#141414",
        selectable: false,
        evented: false,
        textAlign: "center"
      });

      printAreaRef.current = printAreaLayer;
      hintRef.current = hint;

      canvas.add(printAreaLayer);
      canvas.add(hint);
      canvas.sendObjectToBack(printAreaLayer);
      canvas.bringObjectToFront(hint);

      const editable = getEditableObjects(canvas);
      editable.forEach((object) => {
        clampObjectToPrintArea(object, printArea);
      });

      canvas.requestRenderAll();
    },
    [getCurrentPrintArea, getEditableObjects, template.hint]
  );

  useEffect(() => {
    if (!canvasElementRef.current) {
      return;
    }

    const canvas = new Canvas(canvasElementRef.current, {
      width: CUSTOMIZER_CANVAS_SIZE.reference,
      height: CUSTOMIZER_CANVAS_SIZE.reference,
      backgroundColor: garmentColor,
      preserveObjectStacking: true
    });

    const enforceObjectBounds = (target: FabricObject): void => {
      if (target === printAreaRef.current || target === hintRef.current) {
        return;
      }

      const printArea = getCurrentPrintArea(canvas);
      clampObjectToPrintArea(target, printArea);
    };

    canvas.on("object:moving", (event) => {
      const target = event.target;
      if (!target) {
        return;
      }

      target.set({
        left: clampToGrid(target.left ?? 0),
        top: clampToGrid(target.top ?? 0)
      });

      enforceObjectBounds(target);
    });

    canvas.on("object:scaling", (event) => {
      const target = event.target;
      if (!target) {
        return;
      }

      const clampedScaleX = clamp(
        target.scaleX ?? 1,
        CUSTOMIZER_CONSTRAINTS.minScale,
        CUSTOMIZER_CONSTRAINTS.maxScale
      );
      const clampedScaleY = clamp(
        target.scaleY ?? 1,
        CUSTOMIZER_CONSTRAINTS.minScale,
        CUSTOMIZER_CONSTRAINTS.maxScale
      );

      target.set({
        scaleX: clampedScaleX,
        scaleY: clampedScaleY
      });

      enforceObjectBounds(target);
    });

    canvas.on("object:rotating", (event) => {
      const target = event.target;
      if (!target) {
        return;
      }

      target.set({
        angle: clamp(
          target.angle ?? 0,
          CUSTOMIZER_CONSTRAINTS.minRotation,
          CUSTOMIZER_CONSTRAINTS.maxRotation
        )
      });
      enforceObjectBounds(target);
    });

    canvas.on("object:added", refreshLayers);
    canvas.on("object:removed", refreshLayers);

    fabricRef.current = canvas;
    repaintTemplate(canvas);

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [garmentColor, getCurrentPrintArea, repaintTemplate, refreshLayers]);

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

    const printArea = getCurrentPrintArea(canvas);

    const text = new Textbox("RSH custom", {
      left: printArea.left + 24,
      top: printArea.top + 24,
      width: Math.max(80, printArea.width - 48),
      fontSize: 34,
      fill: "#121212",
      fontFamily
    });

    clampObjectToPrintArea(text, printArea);

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

    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
      setSaveStatus("Поддерживаются только PNG, JPEG и WEBP.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_UPLOAD_SIZE_BYTES) {
      setSaveStatus("Файл слишком большой. Максимум 6 MB.");
      event.target.value = "";
      return;
    }

    try {
      setSaveStatus("Загружаем изображение...");
      const uploadedFileUrl = await uploadDesignAsset(file);
      const image = await FabricImage.fromURL(uploadedFileUrl, { crossOrigin: "anonymous" });

      const printArea = getCurrentPrintArea(canvas);

      image.set({
        left: printArea.left + 24,
        top: printArea.top + 24,
        scaleX: 0.45,
        scaleY: 0.45
      });

      clampObjectToPrintArea(image, printArea);

      canvas.add(image);
      canvas.setActiveObject(image);
      canvas.requestRenderAll();
      setSaveStatus("");
    } catch {
      setSaveStatus("Не удалось загрузить изображение. Попробуйте еще раз.");
    }

    event.target.value = "";
  };

  const rotateSelected = (angleDelta: number): void => {
    const canvas = fabricRef.current;
    const selected = canvas?.getActiveObject();

    if (canvas && selected) {
      selected.set(
        "angle",
        clamp(
          (selected.angle ?? 0) + angleDelta,
          CUSTOMIZER_CONSTRAINTS.minRotation,
          CUSTOMIZER_CONSTRAINTS.maxRotation
        )
      );

      clampObjectToPrintArea(selected, getCurrentPrintArea(canvas));
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
    const previewDataUrl = canvas.toDataURL({ format: "webp", quality: 0.9, multiplier: 1 });

    try {
      setSaveStatus("Загружаем превью...");
      const previewFile = await dataUrlToFile(previewDataUrl, `rsh-preview-${Date.now()}.webp`);
      const previewUrl = await uploadDesignAsset(previewFile);

      setSaveStatus("Сохраняем дизайн...");
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
            {CUSTOMIZER_GARMENT_TYPES.map((item) => (
              <button
                key={item}
                className={`rounded-md border px-3 py-2 text-xs tracking-wide ${item === garmentType ? "border-primary bg-primary text-primary-foreground" : ""}`}
                onClick={() => setGarmentType(item)}
                type="button"
              >
                {CUSTOMIZER_GARMENT_TEMPLATES[item].displayName}
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
              {CUSTOMIZER_ALLOWED_FONTS.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </div>

          <canvas ref={canvasElementRef} className="w-full max-w-[720px] rounded-xl border bg-white" />

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

const dataUrlToFile = async (dataUrl: string, fileName: string): Promise<File> => {
  const response = await fetch(dataUrl);

  if (!response.ok) {
    throw new Error("Не удалось сгенерировать превью-файл");
  }

  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type || "image/webp" });
};
