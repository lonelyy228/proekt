import { Prisma, ProductStatus } from "@prisma/client";
import { productRepository } from "@/server/repositories/product-repository";
import { sanitizeText } from "@/server/utils/sanitize";
import { AppError } from "@/server/utils/errors";
import { invalidateCatalogCache, invalidateProductCache } from "@/lib/cache";
import { CUSTOMIZER_BASE_BRANDS } from "@/config/customizer";

export type CatalogScope = "ALL" | "BRANDED" | "BASICS";

const buildCatalogScopeFilter = (scope: CatalogScope): Prisma.ProductWhereInput | undefined => {
  const baseBrandFilters: Prisma.ProductWhereInput[] = CUSTOMIZER_BASE_BRANDS.map((brand) => ({
    brand: {
      equals: brand,
      mode: "insensitive"
    }
  }));

  if (scope === "ALL") {
    return undefined;
  }

  if (scope === "BASICS") {
    return {
      OR: baseBrandFilters
    };
  }

  return {
    NOT: {
      OR: baseBrandFilters
    }
  };
};

export const productService = {
  listCatalog: async (params: {
    search?: string;
    category?: string;
    brand?: string;
    minPriceCents?: number;
    maxPriceCents?: number;
    sortBy: "newest" | "price_asc" | "price_desc" | "name_asc";
    scope?: CatalogScope;
    page: number;
    pageSize: number;
    skip: number;
  }) => {
    const conditions: Prisma.ProductWhereInput[] = [];
    const scopeFilter = buildCatalogScopeFilter(params.scope ?? "BRANDED");
    if (scopeFilter) {
      conditions.push(scopeFilter);
    }

    if (params.search) {
      conditions.push({
        OR: [
          {
            name: {
              contains: sanitizeText(params.search),
              mode: "insensitive"
            }
          },
          {
            description: {
              contains: sanitizeText(params.search),
              mode: "insensitive"
            }
          }
        ]
      });
    }

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      status: ProductStatus.ACTIVE,
      category: params.category
        ? {
            slug: params.category
          }
        : undefined,
      brand: params.brand
        ? {
            equals: sanitizeText(params.brand),
            mode: "insensitive"
          }
        : undefined,
      basePriceCents:
        params.minPriceCents !== undefined || params.maxPriceCents !== undefined
          ? {
              gte: params.minPriceCents,
              lte: params.maxPriceCents
            }
          : undefined,
      AND: conditions.length > 0 ? conditions : undefined
    };

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      params.sortBy === "price_asc"
        ? { basePriceCents: "asc" }
        : params.sortBy === "price_desc"
          ? { basePriceCents: "desc" }
          : params.sortBy === "name_asc"
            ? { name: "asc" }
            : { createdAt: "desc" };

    const [items, total] = await Promise.all([
      productRepository.findCatalog({ where, skip: params.skip, take: params.pageSize, orderBy }),
      productRepository.countCatalog(where)
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        slug: item.slug,
        brand: item.brand,
        name: item.name,
        basePriceCents: item.basePriceCents,
        currency: item.currency,
        imageUrl: item.images[0]?.url ?? null,
        category: item.category.name,
        tags: item.tags
      })),
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.pageSize))
    };
  },

  getProductBySlug: (slug: string) => productRepository.findBySlug(slug),

  getRelatedProducts: async (slug: string) => {
    const source = await productRepository.findBySlug(slug);
    if (!source) {
      return [];
    }

    return productRepository.findRelated(source.id, source.categoryId, source.tags);
  },

  createProduct: (payload: {
    brand: string;
    name: string;
    slug: string;
    description: string;
    shortDescription?: string;
    categoryId: string;
    basePriceCents: number;
    currency: "USD";
    tags: string[];
  }) =>
    productRepository.createProduct({
      brand: sanitizeText(payload.brand),
      name: sanitizeText(payload.name),
      slug: payload.slug,
      description: sanitizeText(payload.description),
      shortDescription: payload.shortDescription ? sanitizeText(payload.shortDescription) : undefined,
      category: { connect: { id: payload.categoryId } },
      basePriceCents: payload.basePriceCents,
      currency: payload.currency,
      tags: payload.tags,
      status: ProductStatus.ACTIVE
    }),

  listAdminProducts: async (params: {
    page: number;
    pageSize: number;
    search?: string;
    brand?: string;
    categoryId?: string;
    status?: ProductStatus;
    sortBy: "newest" | "price_asc" | "price_desc" | "name_asc";
  }) => {
    const skip = (params.page - 1) * params.pageSize;
    const orderBy: Prisma.ProductOrderByWithRelationInput =
      params.sortBy === "price_asc"
        ? { basePriceCents: "asc" }
        : params.sortBy === "price_desc"
          ? { basePriceCents: "desc" }
          : params.sortBy === "name_asc"
            ? { name: "asc" }
            : { createdAt: "desc" };

    const [items, total] = await Promise.all([
      productRepository.listAdminProducts({
        skip,
        take: params.pageSize,
        search: params.search ? sanitizeText(params.search) : undefined,
        brand: params.brand ? sanitizeText(params.brand) : undefined,
        categoryId: params.categoryId,
        status: params.status,
        orderBy
      }),
      productRepository.countAdminProducts({
        search: params.search ? sanitizeText(params.search) : undefined,
        brand: params.brand ? sanitizeText(params.brand) : undefined,
        categoryId: params.categoryId,
        status: params.status
      })
    ]);

    return {
      items,
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.pageSize))
    };
  },

  listCategories: (scope: CatalogScope = "ALL") => productRepository.listCategories(scope),

  createAdminProduct: async (payload: {
    brand: string;
    name: string;
    slug: string;
    description: string;
    shortDescription?: string;
    categoryId: string;
    basePriceCents: number;
    currency: "USD";
    tags: string[];
  }) => {
    const category = await productRepository.findCategoryById(payload.categoryId);
    if (!category) {
      throw new AppError("NOT_FOUND", "Категория не найдена");
    }

    const existingBySlug = await productRepository.findBySlugAny(payload.slug);
    if (existingBySlug) {
      throw new AppError("CONFLICT", "Продукт с таким slug уже существует");
    }

    const created = await productRepository.createProduct({
      brand: sanitizeText(payload.brand),
      name: sanitizeText(payload.name),
      slug: payload.slug,
      description: sanitizeText(payload.description),
      shortDescription: payload.shortDescription ? sanitizeText(payload.shortDescription) : undefined,
      category: { connect: { id: payload.categoryId } },
      basePriceCents: payload.basePriceCents,
      currency: payload.currency,
      tags: payload.tags.map((tag) => sanitizeText(tag)),
      status: ProductStatus.ACTIVE
    });

    invalidateCatalogCache();
    invalidateProductCache(created.slug);

    return created;
  },

  updateAdminProductById: async (
    productId: string,
    payload: {
      brand?: string;
      name?: string;
      slug?: string;
      description?: string;
      shortDescription?: string | null;
      categoryId?: string;
      basePriceCents?: number;
      currency?: "USD";
      status?: ProductStatus;
      tags?: string[];
    }
  ) => {
    const current = await productRepository.findById(productId);
    if (!current) {
      throw new AppError("NOT_FOUND", "Продукт не найден");
    }

    if (payload.categoryId) {
      const category = await productRepository.findCategoryById(payload.categoryId);
      if (!category) {
        throw new AppError("NOT_FOUND", "Категория не найдена");
      }
    }

    if (payload.slug && payload.slug !== current.slug) {
      const existingBySlug = await productRepository.findBySlugAny(payload.slug);
      if (existingBySlug && existingBySlug.id !== current.id) {
        throw new AppError("CONFLICT", "Продукт с таким slug уже существует");
      }
    }

    const updated = await productRepository.updateProductById(productId, {
      brand: payload.brand ? sanitizeText(payload.brand) : undefined,
      name: payload.name ? sanitizeText(payload.name) : undefined,
      slug: payload.slug,
      description: payload.description ? sanitizeText(payload.description) : undefined,
      shortDescription:
        payload.shortDescription === null
          ? null
          : payload.shortDescription
            ? sanitizeText(payload.shortDescription)
            : undefined,
      category: payload.categoryId ? { connect: { id: payload.categoryId } } : undefined,
      basePriceCents: payload.basePriceCents,
      currency: payload.currency,
      status: payload.status,
      tags: payload.tags ? payload.tags.map((tag) => sanitizeText(tag)) : undefined
    });

    invalidateCatalogCache();
    invalidateProductCache(current.slug);
    if (updated.slug !== current.slug) {
      invalidateProductCache(updated.slug);
    }

    return { before: current, after: updated };
  },

  deleteAdminProductById: async (productId: string) => {
    const current = await productRepository.findById(productId);
    if (!current) {
      throw new AppError("NOT_FOUND", "Продукт не найден");
    }

    const deleted = await productRepository.softDeleteProductById(productId);
    invalidateCatalogCache();
    invalidateProductCache(current.slug);

    return deleted;
  }
};
