import { PrismaClient, ProductStatus, Role } from "@prisma/client";
import { hashSync } from "bcryptjs";

type ProductSeed = {
  slug: string;
  brand: string;
  categorySlug?: "rsh-brands" | "rsh-basics";
  name: string;
  description: string;
  shortDescription: string;
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
  "rsh-puma-track-jacket-05"
];

const productSeeds: ProductSeed[] = [
  {
    slug: "rsh-adidas-essential-tee-01",
    brand: "ADIDAS",
    name: "Adidas Essential Tee",
    description: "Повседневная хлопковая футболка Adidas с комфортным прямым кроем.",
    shortDescription: "Базовая футболка Adidas",
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
    description: "Классическое худи Nike на каждый день, мягкий флис и универсальный силуэт.",
    shortDescription: "Базовое худи Nike",
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
    description: "Легкая брендовая track-куртка Puma в минималистичном городском стиле.",
    shortDescription: "Track-куртка Puma",
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
    description: "Легендарные ботинки Timberland из прочной кожи для повседневной носки.",
    shortDescription: "Классические ботинки Timberland",
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
    description: "Сдержанный премиальный свитшот Maison Margiela для минималистичного гардероба.",
    shortDescription: "Премиальный свитшот Margiela",
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
    description: "Брендовое поло Gucci в спокойной палитре, подходит для smart-casual образов.",
    shortDescription: "Поло Gucci",
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
    description: "Худи Balenciaga с фирменным oversize-кроем и плотным премиальным материалом.",
    shortDescription: "Oversized худи Balenciaga",
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
    description: "Футболка Off-White с узнаваемой графикой в лаконичной street-luxury стилистике.",
    shortDescription: "Футболка Off-White",
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
    description: "Технологичная overshirt-модель Stone Island для практичного городского гардероба.",
    shortDescription: "Tech overshirt Stone Island",
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
    description: "Легкая куртка New Balance с акцентом на комфорт и повседневный функционал.",
    shortDescription: "Runner-куртка New Balance",
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
    description: "Базовая футболка RSH BASICS для кастомизации в 2D Lab.",
    shortDescription: "База для кастомизации: футболка",
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
    description: "Плотное худи RSH BASICS, специально подготовленное для персонализации.",
    shortDescription: "База для кастомизации: худи",
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
    description: "Минималистичный свитшот RSH BASICS для создания уникальных принтов в 2D Lab.",
    shortDescription: "База для кастомизации: свитшот",
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
    description: "Базовые шорты RSH BASICS для персонального принта в 2D Lab.",
    shortDescription: "База для кастомизации: шорты",
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

  await prisma.product.deleteMany({
    where: {
      slug: {
        in: legacySlugs
      }
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
