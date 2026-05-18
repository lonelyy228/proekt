import { Role } from "@prisma/client";

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: Role;
  sessionId: string;
};

export type ProductListItem = {
  id: string;
  slug: string;
  brand: string;
  name: string;
  basePriceCents: number;
  currency: string;
  imageUrl: string | null;
  category: string;
  tags: string[];
};

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type CartLine = {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  customizationId: string | null;
  unitPriceCents: number;
  totalPriceCents: number;
  productName: string;
  variantName: string;
  imageUrl: string | null;
};
