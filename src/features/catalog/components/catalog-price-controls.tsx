"use client";

import { useMemo, useState } from "react";

type CatalogPriceControlsProps = {
  initialMinPrice?: number;
  initialMaxPrice?: number;
  floor?: number;
  ceiling?: number;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const CatalogPriceControls = ({
  initialMinPrice,
  initialMaxPrice,
  floor = 0,
  ceiling = 5000
}: CatalogPriceControlsProps): JSX.Element => {
  const [minPrice, setMinPrice] = useState<number | undefined>(
    initialMinPrice !== undefined ? clamp(initialMinPrice, floor, ceiling) : undefined
  );
  const [maxPrice, setMaxPrice] = useState<number | undefined>(
    initialMaxPrice !== undefined ? clamp(initialMaxPrice, floor, ceiling) : undefined
  );

  const resolvedMin = minPrice ?? floor;
  const resolvedMax = maxPrice ?? ceiling;

  const normalized = useMemo(() => {
    const min = Math.round(Math.min(resolvedMin, resolvedMax));
    const max = Math.round(Math.max(resolvedMin, resolvedMax));
    return { min, max };
  }, [resolvedMin, resolvedMax]);

  const step = 100;
  const left = ((normalized.min - floor) / (ceiling - floor)) * 100;
  const right = ((normalized.max - floor) / (ceiling - floor)) * 100;
  const includeMinPrice = normalized.min !== floor || initialMinPrice !== undefined;
  const includeMaxPrice = normalized.max !== ceiling || initialMaxPrice !== undefined;

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3 md:col-span-2 xl:col-span-2">
      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Диапазон цены (RUB)</p>

      <div className="relative h-2 rounded-full bg-muted/70">
        <div className="absolute h-2 rounded-full bg-primary/80" style={{ left: `${left}%`, right: `${100 - right}%` }} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">От</p>
          <input
            type="range"
            min={floor}
            max={ceiling}
            step={step}
            value={normalized.min}
            onChange={(event) => {
              const next = Number(event.target.value);
              const clamped = clamp(next, floor, normalized.max);
              setMinPrice(Math.round(clamped));
            }}
            className="w-full accent-primary"
          />
          <input
            type="number"
            min={floor}
            max={normalized.max}
            step={step}
            value={String(normalized.min)}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              if (!Number.isFinite(parsed)) {
                return;
              }

              const clamped = clamp(parsed, floor, normalized.max);
              setMinPrice(Math.round(clamped));
            }}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>

        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">До</p>
          <input
            type="range"
            min={floor}
            max={ceiling}
            step={step}
            value={normalized.max}
            onChange={(event) => {
              const next = Number(event.target.value);
              const clamped = clamp(next, normalized.min, ceiling);
              setMaxPrice(Math.round(clamped));
            }}
            className="w-full accent-primary"
          />
          <input
            type="number"
            min={normalized.min}
            max={ceiling}
            step={step}
            value={String(normalized.max)}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              if (!Number.isFinite(parsed)) {
                return;
              }

              const clamped = clamp(parsed, normalized.min, ceiling);
              setMaxPrice(Math.round(clamped));
            }}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
      </div>

      <input type="hidden" name="minPrice" value={String(normalized.min)} disabled={!includeMinPrice} />
      <input type="hidden" name="maxPrice" value={String(normalized.max)} disabled={!includeMaxPrice} />
    </div>
  );
};
