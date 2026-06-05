import { Prisma, ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type ProductImageInput = {
  url: string;
  alt: string;
};

const productImageSelect = {
  id: true,
  url: true,
  alt: true,
  width: true,
  height: true,
  sortOrder: true
} satisfies Prisma.ProductImageSelect;

const adminProductInclude = {
  category: {
    select: {
      id: true,
      name: true
    }
  },
  images: {
    orderBy: { sortOrder: "asc" },
    take: 3,
    select: productImageSelect
  }
} satisfies Prisma.ProductInclude;

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

  findCustomizerBaseProducts: () =>
    prisma.product.findMany({
      where: {
        brand: {
          equals: "RSH BASICS",
          mode: "insensitive"
        },
        status: ProductStatus.ACTIVE,
        deletedAt: null,
        tags: {
          has: "customizable"
        }
      },
      include: {
        variants: {
          orderBy: [{ isDefault: "desc" }, { size: "asc" }, { color: "asc" }]
        },
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1
        }
      },
      orderBy: { name: "asc" }
    }),

  createProduct: (data: Prisma.ProductCreateInput) => prisma.product.create({ data }),

  replaceProductImages: (productId: string, images: ProductImageInput[]) =>
    prisma.$transaction(async (tx) => {
      await tx.productImage.deleteMany({
        where: { productId }
      });

      if (images.length > 0) {
        await tx.productImage.createMany({
          data: images.slice(0, 3).map((image, index) => ({
            productId,
            url: image.url,
            alt: image.alt,
            width: 1200,
            height: 1200,
            sortOrder: index
          }))
        });
      }

      return tx.product.findUniqueOrThrow({
        where: { id: productId },
        include: adminProductInclude
      });
    }),

  findById: (id: string) =>
    prisma.product.findFirst({
      where: {
        id,
        deletedAt: null
      }
    }),

  findVariantById: (id: string) =>
    prisma.productVariant.findUnique({
      where: { id }
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
      include: adminProductInclude,
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

  listCategories: () =>
    prisma.category.findMany({
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
    })
};
