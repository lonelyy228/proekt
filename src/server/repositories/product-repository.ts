import { Prisma, ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CUSTOMIZER_BASE_BRANDS } from "@/config/customizer";
import type { CatalogScope } from "@/server/services/product-service";

const buildCategoryScopeWhere = (scope: CatalogScope): Prisma.ProductWhereInput | undefined => {
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

export const productRepository = {
  findCatalog: (args: {
    where: Prisma.ProductWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.ProductOrderByWithRelationInput;
  }) =>
    prisma.product.findMany({
      where: args.where,
      skip: args.skip,
      take: args.take,
      orderBy: args.orderBy,
      include: {
        category: true,
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1
        }
      }
    }),

  countCatalog: (where: Prisma.ProductWhereInput) => prisma.product.count({ where }),

  findBySlug: (slug: string) =>
    prisma.product.findFirst({
      where: { slug, status: ProductStatus.ACTIVE, deletedAt: null },
      include: {
        category: true,
        variants: true,
        images: { orderBy: { sortOrder: "asc" } }
      }
    }),

  findRelated: (productId: string, categoryId: string, tags: string[]) =>
    prisma.product.findMany({
      where: {
        id: { not: productId },
        categoryId,
        status: ProductStatus.ACTIVE,
        deletedAt: null,
        OR: tags.map((tag) => ({ tags: { has: tag } }))
      },
      include: {
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1
        }
      },
      take: 8
    }),

  createProduct: (data: Prisma.ProductCreateInput) => prisma.product.create({ data }),

  findById: (id: string) =>
    prisma.product.findFirst({
      where: {
        id,
        deletedAt: null
      }
    }),

  findBySlugAny: (slug: string) =>
    prisma.product.findUnique({
      where: { slug }
    }),

  listAdminProducts: (params: {
    skip: number;
    take: number;
    search?: string;
    brand?: string;
    categoryId?: string;
    status?: ProductStatus;
    orderBy: Prisma.ProductOrderByWithRelationInput;
  }) =>
    prisma.product.findMany({
      where: {
        deletedAt: null,
        brand: params.brand
          ? {
              equals: params.brand,
              mode: "insensitive"
            }
          : undefined,
        categoryId: params.categoryId,
        status: params.status,
        OR: params.search
          ? [
              {
                name: {
                  contains: params.search,
                  mode: "insensitive"
                }
              },
              {
                slug: {
                  contains: params.search,
                  mode: "insensitive"
                }
              }
            ]
          : undefined
      },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        }
      },
      skip: params.skip,
      take: params.take,
      orderBy: params.orderBy
    }),

  countAdminProducts: (params: {
    search?: string;
    brand?: string;
    categoryId?: string;
    status?: ProductStatus;
  }) =>
    prisma.product.count({
      where: {
        deletedAt: null,
        brand: params.brand
          ? {
              equals: params.brand,
              mode: "insensitive"
            }
          : undefined,
        categoryId: params.categoryId,
        status: params.status,
        OR: params.search
          ? [
              {
                name: {
                  contains: params.search,
                  mode: "insensitive"
                }
              },
              {
                slug: {
                  contains: params.search,
                  mode: "insensitive"
                }
              }
            ]
          : undefined
      }
    }),

  updateProductById: (id: string, data: Prisma.ProductUpdateInput) =>
    prisma.product.update({
      where: { id },
      data
    }),

  softDeleteProductById: (id: string) =>
    prisma.product.update({
      where: { id },
      data: {
        deletedAt: new Date()
      }
    }),

  findProductsByIdsForAdmin: (productIds: string[]) =>
    prisma.product.findMany({
      where: {
        id: {
          in: productIds
        },
        deletedAt: null
      },
      select: {
        id: true,
        status: true
      }
    }),

  updateProductsStatusByIds: (productIds: string[], status: ProductStatus) =>
    prisma.product.updateMany({
      where: {
        id: {
          in: productIds
        },
        deletedAt: null
      },
      data: {
        status
      }
    }),

  listCategories: (scope: CatalogScope) =>
    prisma.category.findMany({
      where: {
        products: {
          some: {
            deletedAt: null,
            status: ProductStatus.ACTIVE,
            ...(buildCategoryScopeWhere(scope) ?? {})
          }
        }
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true
      }
    }),

  findCategoryById: (id: string) =>
    prisma.category.findUnique({
      where: { id },
      select: {
        id: true
      }
    }),

  findVariantForCartInput: (params: { productId: string; variantId: string }) =>
    prisma.productVariant.findFirst({
      where: {
        id: params.variantId,
        productId: params.productId,
        product: {
          deletedAt: null,
          status: ProductStatus.ACTIVE
        }
      },
      select: {
        id: true,
        productId: true,
        product: {
          select: {
            id: true,
            brand: true,
            tags: true
          }
        }
      }
    })
};
