import { PrismaClient, ProductStatus, Role } from "@prisma/client";
import { hashSync } from "bcryptjs";

type ProductSeed = {
  slug: string;
  brand: string;
  categorySlug?: "rsh-brands" | "rsh-basics";
  name: string;
  description: string;
  shortDescription: string;
  image: {
    url: string;
    alt: string;
  };
  tags: string[];
  basePriceCents: number;
  variant: {
    sku: string;
    name: string;
    color: string;
    size: string;
    priceCents: number;
  };
};

const prisma = new PrismaClient();
const legacySlugs = [
  "rsh-archive-tee-01",
  "rsh-monogram-hoodie-02",
  "rsh-runway-sweatshirt-03",
  "rsh-timberland-boot-archive-04",
  "rsh-puma-track-jacket-05",
  "rsh-admin-test-1779040440998-50511",
  "rsh-admin-test-1779040440998-50511-second",
  "rsh-basics-blank-tee-01",
  "rsh-basics-blank-hoodie-02",
  "rsh-basics-blank-sweatshirt-03",
  "rsh-basics-blank-shorts-04",
  "rsh-basics-blank-pants-05"
];

const productSeeds: ProductSeed[] = [
  {
    slug: "rsh-adidas-essential-tee-01",
    brand: "ADIDAS",
    name: "Adidas Essential Tee",
    description:
      "Лаконичная хлопковая футболка Adidas для повседневных образов: плотная посадка без лишнего объёма, мягкая фактура и спокойный силуэт под джинсы, карго или лёгкую куртку.",
    shortDescription: "Базовая футболка Adidas для ежедневной носки",
    image: {
      url: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=82",
      alt: "Белая базовая футболка на нейтральном фоне"
    },
    tags: ["tee", "everyday", "adidas", "basic"],
    basePriceCents: 6900,
    variant: {
      sku: "RSH-ADI-TEE-BLK-M",
      name: "Black / M",
      color: "Black",
      size: "M",
      priceCents: 6900
    }
  },
  {
    slug: "rsh-nike-club-hoodie-02",
    brand: "NIKE",
    name: "Nike Club Hoodie",
    description:
      "Универсальное худи Nike Club для городского гардероба: мягкий флис, чистая форма, удобный капюшон и relaxed-посадка, которую легко носить каждый день.",
    shortDescription: "Мягкое худи Nike Club в базовом силуэте",
    image: {
      url: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=1200&q=82",
      alt: "Серое худи на модели в минималистичной съёмке"
    },
    tags: ["hoodie", "everyday", "nike", "street"],
    basePriceCents: 9900,
    variant: {
      sku: "RSH-NIKE-HOOD-GRY-L",
      name: "Grey / L",
      color: "Grey",
      size: "L",
      priceCents: 9900
    }
  },
  {
    slug: "rsh-puma-track-jacket-03",
    brand: "PUMA",
    name: "Puma Track Jacket",
    description:
      "Лёгкая track-куртка Puma для повседневного sportswear: аккуратная посадка, контрастная динамика и удобный слой на прохладную погоду.",
    shortDescription: "Лёгкая track-куртка Puma для города",
    image: {
      url: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=1200&q=82",
      alt: "Тёмная городская куртка на модели"
    },
    tags: ["jacket", "puma", "everyday", "sportswear"],
    basePriceCents: 8900,
    variant: {
      sku: "RSH-PUMA-JKT-BLK-L",
      name: "Black / L",
      color: "Black",
      size: "L",
      priceCents: 8900
    }
  },
  {
    slug: "rsh-timberland-6in-boots-04",
    brand: "TIMBERLAND",
    name: "Timberland 6-Inch Boots",
    description:
      "Классические ботинки Timberland 6-Inch в wheat-оттенке: плотная кожа, узнаваемая форма и практичный силуэт для осени, зимы и грубых streetwear-комплектов.",
    shortDescription: "Классические кожаные ботинки Timberland",
    image: {
      url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=82",
      alt: "Пара жёлтых кожаных ботинок на ярком фоне"
    },
    tags: ["boots", "timberland", "everyday", "premium"],
    basePriceCents: 18900,
    variant: {
      sku: "RSH-TMBR-WHT-42",
      name: "Wheat / 42",
      color: "Wheat",
      size: "42",
      priceCents: 18900
    }
  },
  {
    slug: "rsh-margiela-sweatshirt-05",
    brand: "MAISON MARGIELA",
    name: "Maison Margiela Sweatshirt",
    description:
      "Сдержанный свитшот Maison Margiela для минималистичного премиального гардероба: спокойный stone-оттенок, мягкая линия плеча и ощущение тихой роскоши без перегруза.",
    shortDescription: "Минималистичный премиальный свитшот Margiela",
    image: {
      url: "https://images.unsplash.com/photo-1516826957135-700dedea698c?auto=format&fit=crop&w=1200&q=82",
      alt: "Минималистичный светлый свитшот в fashion-съёмке"
    },
    tags: ["sweatshirt", "margiela", "minimal", "premium"],
    basePriceCents: 35900,
    variant: {
      sku: "RSH-MMG-SWT-STONE-M",
      name: "Stone / M",
      color: "Stone",
      size: "M",
      priceCents: 35900
    }
  },
  {
    slug: "rsh-gucci-knit-polo-06",
    brand: "GUCCI",
    name: "Gucci Knit Polo",
    description:
      "Трикотажное поло Gucci в спокойной палитре для smart-casual образов: мягкая фактура, аккуратный ворот и статусная база под брюки или расслабленный denim.",
    shortDescription: "Трикотажное поло Gucci для smart-casual",
    image: {
      url: "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=1200&q=82",
      alt: "Светлое поло на вешалке в студийной съёмке"
    },
    tags: ["polo", "gucci", "luxury", "everyday"],
    basePriceCents: 45900,
    variant: {
      sku: "RSH-GCCI-CRM-M",
      name: "Cream / M",
      color: "Cream",
      size: "M",
      priceCents: 45900
    }
  },
  {
    slug: "rsh-balenciaga-oversized-hoodie-07",
    brand: "BALENCIAGA",
    name: "Balenciaga Oversized Hoodie",
    description:
      "Oversized-худи Balenciaga с выразительным объёмом и плотной фактурой: вещь для силуэтных street-luxury образов, где форма работает сильнее логотипа.",
    shortDescription: "Oversized худи Balenciaga с плотной посадкой",
    image: {
      url: "https://images.unsplash.com/photo-1578681994506-b8f463449011?auto=format&fit=crop&w=1200&q=82",
      alt: "Чёрное худи на нейтральном фоне"
    },
    tags: ["hoodie", "balenciaga", "oversized", "luxury"],
    basePriceCents: 69900,
    variant: {
      sku: "RSH-BLCG-BLK-L",
      name: "Black / L",
      color: "Black",
      size: "L",
      priceCents: 69900
    }
  },
  {
    slug: "rsh-offwhite-arrow-tee-08",
    brand: "OFF-WHITE",
    name: "Off-White Arrow Tee",
    description:
      "Футболка Off-White в street-luxury стилистике: чистая база, графический характер и посадка, которая хорошо работает с широкими брюками и кроссовками.",
    shortDescription: "Графичная футболка Off-White в streetwear-стиле",
    image: {
      url: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1200&q=82",
      alt: "Белая футболка в fashion-съёмке"
    },
    tags: ["tee", "off-white", "street-luxury", "graphic"],
    basePriceCents: 31900,
    variant: {
      sku: "RSH-OFWH-WHT-M",
      name: "White / M",
      color: "White",
      size: "M",
      priceCents: 31900
    }
  },
  {
    slug: "rsh-stoneisland-tech-overshirt-09",
    brand: "STONE ISLAND",
    name: "Stone Island Tech Overshirt",
    description:
      "Технологичная overshirt-модель Stone Island для функционального городского гардероба: плотная ткань, утилитарное настроение и спокойный olive-тон.",
    shortDescription: "Технологичная overshirt Stone Island",
    image: {
      url: "https://images.unsplash.com/photo-1523398002811-999ca8dec234?auto=format&fit=crop&w=1200&q=82",
      alt: "Утилитарная верхняя одежда на вешалке"
    },
    tags: ["overshirt", "stone-island", "techwear", "everyday"],
    basePriceCents: 38900,
    variant: {
      sku: "RSH-STNI-OLV-L",
      name: "Olive / L",
      color: "Olive",
      size: "L",
      priceCents: 38900
    }
  },
  {
    slug: "rsh-newbalance-runner-jacket-10",
    brand: "NEW BALANCE",
    name: "New Balance Runner Jacket",
    description:
      "Лёгкая runner-куртка New Balance с акцентом на комфорт и повседневный функционал: хороший слой для прогулок, тренировочного настроения и relaxed lifestyle.",
    shortDescription: "Лёгкая runner-куртка New Balance",
    image: {
      url: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=82",
      alt: "Спортивная куртка в городской fashion-съёмке"
    },
    tags: ["jacket", "new-balance", "runner", "lifestyle"],
    basePriceCents: 10900,
    variant: {
      sku: "RSH-NBLC-GRY-M",
      name: "Grey / M",
      color: "Grey",
      size: "M",
      priceCents: 10900
    }
  },
  {
    slug: "rsh-basics-oversized-tee-11",
    brand: "RSH BASICS",
    categorySlug: "rsh-basics",
    name: "RSH Basics Oversized Tee",
    description:
      "Плотная oversized-футболка RSH BASICS, подготовленная под кастомизацию в 2D Lab: чистая поверхность, правильная посадка и зона для текста, фото или графики.",
    shortDescription: "База для кастомизации: oversized-футболка",
    image: {
      url: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=1200&q=82",
      alt: "Чистая белая футболка для кастомизации"
    },
    tags: ["basics", "customizable", "tee", "rsh-basics"],
    basePriceCents: 3900,
    variant: {
      sku: "RSH-BSC-TEE-WHT-M",
      name: "White / M",
      color: "White",
      size: "M",
      priceCents: 3900
    }
  },
  {
    slug: "rsh-basics-hoodie-core-12",
    brand: "RSH BASICS",
    categorySlug: "rsh-basics",
    name: "RSH Basics Hoodie Core",
    description:
      "Плотное худи RSH BASICS для персонализации: объёмный капюшон, чистая фронтальная зона и ткань, которая подходит для принтов и авторской графики.",
    shortDescription: "База для кастомизации: плотное худи",
    image: {
      url: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=1200&q=82",
      alt: "Базовое худи для кастомизации"
    },
    tags: ["basics", "customizable", "hoodie", "rsh-basics"],
    basePriceCents: 5900,
    variant: {
      sku: "RSH-BSC-HOOD-BLK-L",
      name: "Black / L",
      color: "Black",
      size: "L",
      priceCents: 5900
    }
  },
  {
    slug: "rsh-basics-sweatshirt-studio-13",
    brand: "RSH BASICS",
    categorySlug: "rsh-basics",
    name: "RSH Basics Sweatshirt Studio",
    description:
      "Минималистичный свитшот RSH BASICS Studio: мягкая база без лишних деталей, созданная для аккуратных принтов, типографики и персональных серий.",
    shortDescription: "База для кастомизации: свитшот Studio",
    image: {
      url: "https://images.unsplash.com/photo-1618354691438-25bc04584c23?auto=format&fit=crop&w=1200&q=82",
      alt: "Базовый свитшот в студийной съёмке"
    },
    tags: ["basics", "customizable", "sweatshirt", "rsh-basics"],
    basePriceCents: 5200,
    variant: {
      sku: "RSH-BSC-SWT-GRY-M",
      name: "Grey / M",
      color: "Grey",
      size: "M",
      priceCents: 5200
    }
  },
  {
    slug: "rsh-basics-shorts-training-14",
    brand: "RSH BASICS",
    categorySlug: "rsh-basics",
    name: "RSH Basics Training Shorts",
    description:
      "Базовые training-шорты RSH BASICS для 2D Lab: лаконичная форма, удобная посадка и пространство для небольших графических акцентов.",
    shortDescription: "База для кастомизации: training-шорты",
    image: {
      url: "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?auto=format&fit=crop&w=1200&q=82",
      alt: "Базовые спортивные шорты для кастомизации"
    },
    tags: ["basics", "customizable", "shorts", "rsh-basics"],
    basePriceCents: 3400,
    variant: {
      sku: "RSH-BSC-SHRT-BLK-M",
      name: "Black / M",
      color: "Black",
      size: "M",
      priceCents: 3400
    }
  }
];

async function main(): Promise<void> {
  const userPasswordHash = hashSync("ChangeMe123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      passwordHash: userPasswordHash,
      role: Role.ADMIN
    }
  });

  const brandsCategory = await prisma.category.upsert({
    where: { slug: "rsh-brands" },
    update: {
      name: "RSH Brands",
      description: "Популярные брендовые вещи и опциональная кастомизация"
    },
    create: {
      slug: "rsh-brands",
      name: "RSH Brands",
      description: "Популярные брендовые вещи и опциональная кастомизация"
    }
  });

  const basicsCategory = await prisma.category.upsert({
    where: { slug: "rsh-basics" },
    update: {
      name: "RSH Basics",
      description: "Базовые позиции RSH для кастомизации в 2D Lab"
    },
    create: {
      slug: "rsh-basics",
      name: "RSH Basics",
      description: "Базовые позиции RSH для кастомизации в 2D Lab"
    }
  });

  await prisma.product.updateMany({
    where: {
      slug: {
        in: legacySlugs
      }
    },
    data: {
      deletedAt: new Date(),
      status: ProductStatus.ARCHIVED
    }
  });

  for (const seed of productSeeds) {
    const product = await prisma.product.upsert({
      where: { slug: seed.slug },
      update: {
        brand: seed.brand,
        name: seed.name,
        description: seed.description,
        shortDescription: seed.shortDescription,
        tags: seed.tags,
        status: ProductStatus.ACTIVE,
        categoryId: seed.categorySlug === "rsh-basics" ? basicsCategory.id : brandsCategory.id,
        basePriceCents: seed.basePriceCents,
        currency: "USD"
      },
      create: {
        brand: seed.brand,
        name: seed.name,
        slug: seed.slug,
        description: seed.description,
        shortDescription: seed.shortDescription,
        tags: seed.tags,
        status: ProductStatus.ACTIVE,
        categoryId: seed.categorySlug === "rsh-basics" ? basicsCategory.id : brandsCategory.id,
        basePriceCents: seed.basePriceCents,
        currency: "USD"
      }
    });

    await prisma.productVariant.upsert({
      where: { sku: seed.variant.sku },
      update: {
        productId: product.id,
        name: seed.variant.name,
        priceCents: seed.variant.priceCents,
        currency: "USD",
        color: seed.variant.color,
        size: seed.variant.size,
        isDefault: true
      },
      create: {
        productId: product.id,
        name: seed.variant.name,
        sku: seed.variant.sku,
        color: seed.variant.color,
        size: seed.variant.size,
        priceCents: seed.variant.priceCents,
        currency: "USD",
        isDefault: true
      }
    });

    await prisma.productImage.deleteMany({
      where: {
        productId: product.id
      }
    });

    await prisma.productImage.create({
      data: {
        productId: product.id,
        url: seed.image.url,
        alt: seed.image.alt,
        width: 1200,
        height: 1200,
        sortOrder: 0
      }
    });
  }

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "SEED_DATA_INITIALIZED",
      targetType: "SYSTEM",
      targetId: "seed"
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
