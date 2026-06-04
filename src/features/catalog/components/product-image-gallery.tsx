"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

const MAX_PRODUCT_GALLERY_IMAGES = 3;

export type ProductGalleryImage = {
  id: string;
  url: string;
  alt: string;
};

type ProductImageGalleryProps = {
  images: ProductGalleryImage[];
  productName: string;
};

export function ProductImageGallery({ images, productName }: ProductImageGalleryProps): JSX.Element {
  const galleryImages = useMemo(
    () => images.filter((image) => image.url.trim().length > 0).slice(0, MAX_PRODUCT_GALLERY_IMAGES),
    [images]
  );
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const safeActiveIndex = activeIndex < galleryImages.length ? activeIndex : 0;
  const activeImage = galleryImages[safeActiveIndex] ?? null;
  const canNavigate = galleryImages.length > 1;

  const goToPrevious = (): void => {
    if (!canNavigate) {
      return;
    }

    setActiveIndex((currentIndex) => (currentIndex === 0 ? galleryImages.length - 1 : currentIndex - 1));
  };

  const goToNext = (): void => {
    if (!canNavigate) {
      return;
    }

    setActiveIndex((currentIndex) => (currentIndex + 1) % galleryImages.length);
  };

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-2xl border bg-[radial-gradient(circle_at_30%_15%,rgba(255,255,255,0.92),rgba(245,245,242,0.78)_42%,rgba(226,224,218,0.8))] shadow-sm">
        {activeImage ? (
          <Image
            src={activeImage.url}
            alt={activeImage.alt}
            fill
            priority
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-contain p-6"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-5xl font-semibold tracking-[0.35em] text-muted-foreground/45">
            RSH
          </div>
        )}

        <div className="absolute left-4 top-4 rounded-full bg-background/85 px-3 py-1 text-[10px] uppercase tracking-[0.18em] backdrop-blur">
          RSH selected
        </div>

        {activeImage ? (
          <div className="absolute bottom-4 right-4 rounded-full bg-background/85 px-3 py-1 text-[10px] uppercase tracking-[0.18em] backdrop-blur">
            Фото {safeActiveIndex + 1} / {galleryImages.length}
          </div>
        ) : null}

        {canNavigate ? (
          <>
            <button
              type="button"
              onClick={goToPrevious}
              className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border bg-background/85 text-lg shadow-sm backdrop-blur transition hover:bg-primary hover:text-primary-foreground"
              aria-label={`Предыдущее фото товара ${productName}`}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={goToNext}
              className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border bg-background/85 text-lg shadow-sm backdrop-blur transition hover:bg-primary hover:text-primary-foreground"
              aria-label={`Следующее фото товара ${productName}`}
            >
              ›
            </button>
          </>
        ) : null}
      </div>

      {galleryImages.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {galleryImages.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={
                index === safeActiveIndex
                  ? "group relative aspect-square overflow-hidden rounded-xl border border-primary bg-muted shadow-sm"
                  : "group relative aspect-square overflow-hidden rounded-xl border bg-muted/40 transition hover:border-primary"
              }
              aria-label={`Открыть фото ${index + 1} товара ${productName}`}
            >
              <Image
                src={image.url}
                alt={image.alt}
                fill
                sizes="160px"
                className="object-cover transition duration-300 group-hover:scale-105"
              />
              <span className="absolute bottom-2 left-2 rounded-full bg-background/85 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]">
                {index + 1}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
