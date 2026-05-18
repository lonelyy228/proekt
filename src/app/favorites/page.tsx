"use client";

import { useQuery } from "@tanstack/react-query";

type WishlistItem = {
  id: string;
  product: {
    name: string;
  };
};

const fetchWishlist = async (): Promise<WishlistItem[]> => {
  const response = await fetch("/api/wishlist", { credentials: "include" });
  if (!response.ok) {
    throw new Error("Не удалось загрузить избранное");
  }
  const payload = (await response.json()) as { success: boolean; data: WishlistItem[] };
  return payload.data;
};

export default function FavoritesPage(): JSX.Element {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["wishlist"],
    queryFn: fetchWishlist
  });

  if (isLoading) {
    return <p>Загружаем избранное...</p>;
  }

  if (isError) {
    return <p>Не удалось загрузить избранное.</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Избранное</h1>
      {data?.length ? (
        data.map((item) => (
          <article key={item.id} className="rounded-lg border p-4">
            {item.product.name}
          </article>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">Список избранного пуст.</p>
      )}
    </div>
  );
}
