"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useWishlist } from "@/hooks/use-wishlist";
import { cn } from "@/lib/utils";

type WishlistToggleButtonProps = {
  productId: string;
  variantId?: string;
  productName: string;
  loginRedirectPath?: string;
  compact?: boolean;
  className?: string;
};

export const WishlistToggleButton = ({
  productId,
  variantId,
  productName,
  loginRedirectPath = "/favorites",
  compact = false,
  className
}: WishlistToggleButtonProps): JSX.Element => {
  const { data = [], isAuthenticated, isLoading, toggle } = useWishlist();
  const normalizedVariantId = variantId ?? null;
  const isActive = useMemo(
    () => data.some((item) => item.productId === productId && item.variantId === normalizedVariantId),
    [data, normalizedVariantId, productId]
  );

  const baseClassName = cn(
    "inline-flex items-center justify-center rounded-full border bg-background/90 font-medium text-primary shadow-sm backdrop-blur transition hover:border-primary hover:bg-primary hover:text-primary-foreground",
    compact ? "h-9 min-w-9 px-3 text-xs" : "h-11 px-5 text-sm",
    isActive && "border-primary bg-primary text-primary-foreground",
    className
  );

  if (!isAuthenticated && !isLoading) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(loginRedirectPath)}`}
        className={baseClassName}
        aria-label={`Войти, чтобы добавить ${productName} в избранное`}
      >
        {compact ? "Избр." : "Войти для избранного"}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={baseClassName}
      disabled={isLoading || toggle.isPending}
      aria-pressed={isActive}
      aria-label={isActive ? `Убрать ${productName} из избранного` : `Добавить ${productName} в избранное`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle.mutate({ productId, ...(variantId ? { variantId } : {}) });
      }}
    >
      {compact ? (isActive ? "В изб." : "Избр.") : isActive ? "В избранном" : "В избранное"}
    </button>
  );
};
