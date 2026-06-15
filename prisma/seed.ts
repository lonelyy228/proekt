import { PrismaClient, ProductStatus, Role } from "@prisma/client";
import { hashSync } from "bcryptjs";

type ProductSeedImage = {
  url: string;
  alt: string;
};

type ProductSeed = {
  slug: string;
  brand: string;
  categorySlug?: "rsh-brands" | "rsh-basics";
  name: string;
  description: string;
  shortDescription: string;
  image?: ProductSeedImage;
  images?: ProductSeedImage[];
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
const maxProductImages = 3;
const placeholderProductImage: ProductSeedImage = {
  url: "/product-images/catalog-placeholder.svg",
  alt: "Каталожный placeholder до загрузки продуктового фото"
};
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

type GeneratedBrandItemTemplate = {
  slugTail: string;
  title: string;
  shortDescription: string;
  descriptor: string;
  tags: string[];
  color: string;
  size: string;
  priceCents: number;
  skuTail: string;
};

type GeneratedBrandCatalogConfig = {
  brand: string;
  brandLabel: string;
  slugPrefix: string;
  skuPrefix: string;
  tone: string;
  items: GeneratedBrandItemTemplate[];
};

const coreProductSeeds: ProductSeed[] = [
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

const generatedBrandCatalogConfigs: GeneratedBrandCatalogConfig[] = [
  {
    brand: "ADIDAS",
    brandLabel: "Adidas",
    slugPrefix: "adidas",
    skuPrefix: "ADI",
    tone: "архивной sportswear-эстетикой и чистым городским силуэтом",
    items: [
      {
        slugTail: "archive-zip-hoodie-15",
        title: "Archive Zip Hoodie",
        shortDescription: "Zip-худи Adidas в архивном sportswear-настроении",
        descriptor: "плотный трикотаж, спокойная посадка и слой на каждый день",
        tags: ["hoodie", "zip", "adidas", "sportswear"],
        color: "Black",
        size: "L",
        priceCents: 11900,
        skuTail: "ZIP-BLK-L"
      },
      {
        slugTail: "terrace-track-pant-16",
        title: "Terrace Track Pant",
        shortDescription: "Track-брюки Adidas для расслабленного city-fit",
        descriptor: "лёгкая динамика, прямой крой и комфортный повседневный ритм",
        tags: ["pants", "track", "adidas", "terrace"],
        color: "Navy",
        size: "M",
        priceCents: 8900,
        skuTail: "TRK-NVY-M"
      },
      {
        slugTail: "essential-crewneck-17",
        title: "Essential Crewneck",
        shortDescription: "Базовый crewneck Adidas для ежедневной ротации",
        descriptor: "чистая форма, мягкая фактура и универсальный mid-layer",
        tags: ["crewneck", "adidas", "basic", "everyday"],
        color: "Grey",
        size: "M",
        priceCents: 7900,
        skuTail: "CRW-GRY-M"
      },
      {
        slugTail: "training-longsleeve-18",
        title: "Training Longsleeve",
        shortDescription: "Лонгслив Adidas для layering и лёгких сетов",
        descriptor: "дышащая база под ветровку, жилет или самостоятельный городской образ",
        tags: ["longsleeve", "adidas", "layering", "training"],
        color: "White",
        size: "L",
        priceCents: 6200,
        skuTail: "LNG-WHT-L"
      },
      {
        slugTail: "utility-wind-vest-19",
        title: "Utility Wind Vest",
        shortDescription: "Лёгкий жилет Adidas для межсезонного слоя",
        descriptor: "утилитарная подача без перегруза и удобный верхний слой на прохладный вечер",
        tags: ["vest", "adidas", "utility", "outerwear"],
        color: "Olive",
        size: "L",
        priceCents: 9900,
        skuTail: "VST-OLV-L"
      },
      {
        slugTail: "weekend-shorts-20",
        title: "Weekend Shorts",
        shortDescription: "Свободные шорты Adidas для повседневного гардероба",
        descriptor: "комфортная длина, relaxed-посадка и простая связка с футболками и худи",
        tags: ["shorts", "adidas", "weekend", "casual"],
        color: "Sand",
        size: "M",
        priceCents: 5900,
        skuTail: "SRT-SND-M"
      }
    ]
  },
  {
    brand: "NIKE",
    brandLabel: "Nike",
    slugPrefix: "nike",
    skuPrefix: "NKE",
    tone: "мягким athletic lifestyle-подходом и спокойной everyday-функциональностью",
    items: [
      {
        slugTail: "club-zip-hoodie-21",
        title: "Club Zip Hoodie",
        shortDescription: "Zip-худи Nike Club для базы на каждый день",
        descriptor: "мягкий флис, чистая линия плеча и удобный слой для города",
        tags: ["hoodie", "nike", "zip", "club"],
        color: "Grey",
        size: "L",
        priceCents: 12500,
        skuTail: "ZIP-GRY-L"
      },
      {
        slugTail: "tech-track-pant-22",
        title: "Tech Track Pant",
        shortDescription: "Track-брюки Nike с акцентом на комфорт",
        descriptor: "гибкая посадка, повседневная пластика и easy-to-style силуэт",
        tags: ["pants", "nike", "track", "tech"],
        color: "Black",
        size: "M",
        priceCents: 10400,
        skuTail: "TRK-BLK-M"
      },
      {
        slugTail: "solo-crew-23",
        title: "Solo Crew",
        shortDescription: "Минималистичный свитшот Nike в чистом силуэте",
        descriptor: "ровный объём, мягкая база и универсальность под denim или cargo",
        tags: ["crewneck", "nike", "minimal", "everyday"],
        color: "Bone",
        size: "M",
        priceCents: 9500,
        skuTail: "CRW-BON-M"
      },
      {
        slugTail: "running-longsleeve-24",
        title: "Running Longsleeve",
        shortDescription: "Лонгслив Nike для легкого active-layering",
        descriptor: "тонкий комфортный слой для прогулок, поездок и тренировочного настроения",
        tags: ["longsleeve", "nike", "running", "layering"],
        color: "White",
        size: "L",
        priceCents: 6800,
        skuTail: "LNG-WHT-L"
      },
      {
        slugTail: "utility-vest-25",
        title: "Utility Vest",
        shortDescription: "Утилитарный жилет Nike для межсезонья",
        descriptor: "спокойная техничность и практичный верхний слой поверх худи или лонгслива",
        tags: ["vest", "nike", "utility", "outerwear"],
        color: "Olive",
        size: "L",
        priceCents: 11800,
        skuTail: "VST-OLV-L"
      },
      {
        slugTail: "court-shorts-26",
        title: "Court Shorts",
        shortDescription: "Шорты Nike для ежедневного summer-fit",
        descriptor: "лёгкая посадка, чистая длина и универсальная спортивная база",
        tags: ["shorts", "nike", "court", "casual"],
        color: "Black",
        size: "M",
        priceCents: 6100,
        skuTail: "SRT-BLK-M"
      }
    ]
  },
  {
    brand: "PUMA",
    brandLabel: "Puma",
    slugPrefix: "puma",
    skuPrefix: "PMA",
    tone: "чёткой ретро-динамикой и собранным sportswear-силуэтом",
    items: [
      {
        slugTail: "motorsport-zip-hoodie-27",
        title: "Motorsport Zip Hoodie",
        shortDescription: "Zip-худи Puma с ретро-спортивным характером",
        descriptor: "контрастная подача, аккуратная форма и городской спортивный вайб",
        tags: ["hoodie", "puma", "zip", "motorsport"],
        color: "Black",
        size: "L",
        priceCents: 10900,
        skuTail: "ZIP-BLK-L"
      },
      {
        slugTail: "stadium-track-pant-28",
        title: "Stadium Track Pant",
        shortDescription: "Track-брюки Puma для спокойного street-sportswear",
        descriptor: "подтянутая линия, удобство в движении и everyday-функциональность",
        tags: ["pants", "puma", "track", "stadium"],
        color: "Navy",
        size: "M",
        priceCents: 8400,
        skuTail: "TRK-NVY-M"
      },
      {
        slugTail: "team-crewneck-29",
        title: "Team Crewneck",
        shortDescription: "Crewneck Puma в винтажно-командной эстетике",
        descriptor: "мягкий объём и понятная база для джинсов, шорт или карго",
        tags: ["crewneck", "puma", "team", "everyday"],
        color: "Grey",
        size: "M",
        priceCents: 7600,
        skuTail: "CRW-GRY-M"
      },
      {
        slugTail: "active-longsleeve-30",
        title: "Active Longsleeve",
        shortDescription: "Лонгслив Puma для layering и легких сетов",
        descriptor: "гибкая база на каждый день с чистым визуальным ритмом",
        tags: ["longsleeve", "puma", "active", "layering"],
        color: "White",
        size: "L",
        priceCents: 5900,
        skuTail: "LNG-WHT-L"
      },
      {
        slugTail: "packable-vest-31",
        title: "Packable Vest",
        shortDescription: "Компактный жилет Puma для межсезонных образов",
        descriptor: "лёгкий верхний слой с утилитарной подачей без перегруза",
        tags: ["vest", "puma", "packable", "outerwear"],
        color: "Olive",
        size: "L",
        priceCents: 9200,
        skuTail: "VST-OLV-L"
      },
      {
        slugTail: "weekend-shorts-32",
        title: "Weekend Shorts",
        shortDescription: "Шорты Puma для повседневной спортивной базы",
        descriptor: "лёгкая посадка, свободное движение и простая интеграция в summer-fit",
        tags: ["shorts", "puma", "weekend", "casual"],
        color: "Black",
        size: "M",
        priceCents: 5600,
        skuTail: "SRT-BLK-M"
      }
    ]
  },
  {
    brand: "TIMBERLAND",
    brandLabel: "Timberland",
    slugPrefix: "timberland",
    skuPrefix: "TMB",
    tone: "outdoor-настроением, плотными материалами и rugged-городской подачей",
    items: [
      {
        slugTail: "outdoor-hoodie-33",
        title: "Outdoor Hoodie",
        shortDescription: "Плотное худи Timberland для холодного сезона",
        descriptor: "устойчивый объём, практичная база и вещь под грубый повседневный сет",
        tags: ["hoodie", "timberland", "outdoor", "rugged"],
        color: "Brown",
        size: "L",
        priceCents: 12900,
        skuTail: "HOOD-BRN-L"
      },
      {
        slugTail: "field-cargo-pant-34",
        title: "Field Cargo Pant",
        shortDescription: "Карго Timberland в outdoor-городской эстетике",
        descriptor: "утилитарный силуэт, плотная ткань и удобство под ботинки или кроссовки",
        tags: ["pants", "timberland", "cargo", "field"],
        color: "Olive",
        size: "32",
        priceCents: 14900,
        skuTail: "CRG-OLV-32"
      },
      {
        slugTail: "heritage-crewneck-35",
        title: "Heritage Crewneck",
        shortDescription: "Свитшот Timberland в heritage-подаче",
        descriptor: "ровная форма, плотный трикотаж и спокойная рабочая база",
        tags: ["crewneck", "timberland", "heritage", "everyday"],
        color: "Sand",
        size: "M",
        priceCents: 9900,
        skuTail: "CRW-SND-M"
      },
      {
        slugTail: "waffle-longsleeve-36",
        title: "Waffle Longsleeve",
        shortDescription: "Фактурный лонгслив Timberland для layering",
        descriptor: "тёплая повседневная база с выраженной текстурой и outdoor-ноткой",
        tags: ["longsleeve", "timberland", "waffle", "layering"],
        color: "Ecru",
        size: "L",
        priceCents: 7900,
        skuTail: "LNG-ECR-L"
      },
      {
        slugTail: "trail-vest-37",
        title: "Trail Vest",
        shortDescription: "Жилет Timberland как рабочий верхний слой",
        descriptor: "плотная утилитарная подача и практичность для межсезонного гардероба",
        tags: ["vest", "timberland", "trail", "outerwear"],
        color: "Black",
        size: "L",
        priceCents: 15900,
        skuTail: "VST-BLK-L"
      },
      {
        slugTail: "carpenter-shorts-38",
        title: "Carpenter Shorts",
        shortDescription: "Шорты Timberland в workwear-настроении",
        descriptor: "грубоватая фактура, свободная посадка и расслабленный summer rugged-fit",
        tags: ["shorts", "timberland", "carpenter", "workwear"],
        color: "Khaki",
        size: "32",
        priceCents: 9500,
        skuTail: "SRT-KHK-32"
      }
    ]
  },
  {
    brand: "MAISON MARGIELA",
    brandLabel: "Maison Margiela",
    slugPrefix: "margiela",
    skuPrefix: "MMG",
    tone: "тихой премиальностью, деконструированным ощущением и мягкой минималистичной линией",
    items: [
      {
        slugTail: "replica-hoodie-39",
        title: "Replica Hoodie",
        shortDescription: "Премиальное худи Margiela в спокойном объёме",
        descriptor: "чистый силуэт, выверенная пластика ткани и сдержанный luxury-контекст",
        tags: ["hoodie", "margiela", "premium", "minimal"],
        color: "Stone",
        size: "L",
        priceCents: 47900,
        skuTail: "HOOD-STN-L"
      },
      {
        slugTail: "atelier-trouser-40",
        title: "Atelier Trouser",
        shortDescription: "Брюки Margiela для refined smart-casual гардероба",
        descriptor: "мягкая линия, спокойный объём и премиальная база под layered-образ",
        tags: ["pants", "margiela", "atelier", "premium"],
        color: "Black",
        size: "48",
        priceCents: 51900,
        skuTail: "TRS-BLK-48"
      },
      {
        slugTail: "fourstitch-crewneck-41",
        title: "Four-Stitch Crewneck",
        shortDescription: "Crewneck Margiela в тихой luxury-эстетике",
        descriptor: "мягкий трикотаж, аккуратный объём и спокойное дизайнерское настроение",
        tags: ["crewneck", "margiela", "luxury", "minimal"],
        color: "Ecru",
        size: "M",
        priceCents: 44900,
        skuTail: "CRW-ECR-M"
      },
      {
        slugTail: "minimal-longsleeve-42",
        title: "Minimal Longsleeve",
        shortDescription: "Лонгслив Margiela как чистая база под layering",
        descriptor: "тонкий премиальный слой для сдержанных образов без визуального шума",
        tags: ["longsleeve", "margiela", "minimal", "layering"],
        color: "White",
        size: "L",
        priceCents: 28900,
        skuTail: "LNG-WHT-L"
      },
      {
        slugTail: "utility-gilet-43",
        title: "Utility Gilet",
        shortDescription: "Жилет Margiela с утилитарным luxury-настроением",
        descriptor: "деконструированная лёгкость и верхний слой для продуманного smart-layering",
        tags: ["vest", "margiela", "gilet", "premium"],
        color: "Charcoal",
        size: "L",
        priceCents: 53900,
        skuTail: "VST-CHR-L"
      },
      {
        slugTail: "relaxed-shorts-44",
        title: "Relaxed Shorts",
        shortDescription: "Шорты Margiela для сдержанного summer luxury-fit",
        descriptor: "ровная длина, чистая линия и спокойный премиальный ритм",
        tags: ["shorts", "margiela", "relaxed", "premium"],
        color: "Sand",
        size: "48",
        priceCents: 32900,
        skuTail: "SRT-SND-48"
      }
    ]
  },
  {
    brand: "GUCCI",
    brandLabel: "Gucci",
    slugPrefix: "gucci",
    skuPrefix: "GCI",
    tone: "мягкой luxury-подачей, статусной базой и заметной fashion-энергией без перегруза",
    items: [
      {
        slugTail: "knit-zip-hoodie-45",
        title: "Knit Zip Hoodie",
        shortDescription: "Вязаное zip-худи Gucci для luxury casual",
        descriptor: "мягкая фактура, статусный everyday-слой и спокойная fashion-пластика",
        tags: ["hoodie", "gucci", "luxury", "knit"],
        color: "Cream",
        size: "L",
        priceCents: 55900,
        skuTail: "ZIP-CRM-L"
      },
      {
        slugTail: "web-track-pant-46",
        title: "Web Track Pant",
        shortDescription: "Track-брюки Gucci в premium sportswear-ключе",
        descriptor: "легкая динамика, мягкий люксовый контекст и комфортный relaxed-fit",
        tags: ["pants", "gucci", "track", "luxury"],
        color: "Navy",
        size: "48",
        priceCents: 52900,
        skuTail: "TRK-NVY-48"
      },
      {
        slugTail: "script-crewneck-47",
        title: "Script Crewneck",
        shortDescription: "Свитшот Gucci как статусная повседневная база",
        descriptor: "ровный объём и premium-силуэт, который легко собирать с денимом и лоферами",
        tags: ["crewneck", "gucci", "luxury", "everyday"],
        color: "Camel",
        size: "M",
        priceCents: 48900,
        skuTail: "CRW-CML-M"
      },
      {
        slugTail: "lightweight-longsleeve-48",
        title: "Lightweight Longsleeve",
        shortDescription: "Лонгслив Gucci для layering в smart-casual",
        descriptor: "тонкая премиальная база с чистым визуальным ритмом и мягким падением ткани",
        tags: ["longsleeve", "gucci", "smart-casual", "premium"],
        color: "White",
        size: "L",
        priceCents: 31900,
        skuTail: "LNG-WHT-L"
      },
      {
        slugTail: "monogram-vest-49",
        title: "Monogram Vest",
        shortDescription: "Жилет Gucci для выразительного top-layer",
        descriptor: "сдержанный luxe-акцент и верхний слой для собранного городского образа",
        tags: ["vest", "gucci", "monogram", "luxury"],
        color: "Brown",
        size: "L",
        priceCents: 57900,
        skuTail: "VST-BRN-L"
      },
      {
        slugTail: "resort-shorts-50",
        title: "Resort Shorts",
        shortDescription: "Шорты Gucci для летнего luxury casual",
        descriptor: "чистая длина, лёгкая ткань и расслабленная премиальная база",
        tags: ["shorts", "gucci", "resort", "luxury"],
        color: "Beige",
        size: "48",
        priceCents: 35900,
        skuTail: "SRT-BGE-48"
      }
    ]
  },
  {
    brand: "BALENCIAGA",
    brandLabel: "Balenciaga",
    slugPrefix: "balenciaga",
    skuPrefix: "BLC",
    tone: "объёмным силуэтом, тяжёлой фактурой и прямолинейной street-luxury подачей",
    items: [
      {
        slugTail: "layered-zip-hoodie-51",
        title: "Layered Zip Hoodie",
        shortDescription: "Объёмное zip-худи Balenciaga в тяжёлом силуэте",
        descriptor: "выраженный shape, плотный материал и сильная street-luxury форма",
        tags: ["hoodie", "balenciaga", "oversized", "luxury"],
        color: "Black",
        size: "L",
        priceCents: 77900,
        skuTail: "ZIP-BLK-L"
      },
      {
        slugTail: "wide-track-pant-52",
        title: "Wide Track Pant",
        shortDescription: "Широкие track-брюки Balenciaga для statement-fit",
        descriptor: "масштабный объём, расслабленная линия и fashion-силуэт без компромиссов",
        tags: ["pants", "balenciaga", "wide", "fashion"],
        color: "Charcoal",
        size: "M",
        priceCents: 73900,
        skuTail: "TRK-CHR-M"
      },
      {
        slugTail: "boxy-crewneck-53",
        title: "Boxy Crewneck",
        shortDescription: "Boxy crewneck Balenciaga для тяжелого layering",
        descriptor: "собранный укороченный объём и плотная база под широкий низ",
        tags: ["crewneck", "balenciaga", "boxy", "luxury"],
        color: "Grey",
        size: "M",
        priceCents: 64900,
        skuTail: "CRW-GRY-M"
      },
      {
        slugTail: "logo-longsleeve-54",
        title: "Logo Longsleeve",
        shortDescription: "Лонгслив Balenciaga как графичная база",
        descriptor: "тяжёлая посадка и clean-statement вещь для широких городских сетов",
        tags: ["longsleeve", "balenciaga", "graphic", "street-luxury"],
        color: "White",
        size: "L",
        priceCents: 41900,
        skuTail: "LNG-WHT-L"
      },
      {
        slugTail: "technical-vest-55",
        title: "Technical Vest",
        shortDescription: "Жилет Balenciaga для layered street-luxury",
        descriptor: "массивная верхняя линия и заметный акцент в монохромном образе",
        tags: ["vest", "balenciaga", "technical", "luxury"],
        color: "Black",
        size: "L",
        priceCents: 82900,
        skuTail: "VST-BLK-L"
      },
      {
        slugTail: "baggy-shorts-56",
        title: "Baggy Shorts",
        shortDescription: "Шорты Balenciaga в wide summer silhouette",
        descriptor: "объёмный крой и fashion-пропорции под массивную обувь или high-top sneakers",
        tags: ["shorts", "balenciaga", "baggy", "fashion"],
        color: "Black",
        size: "M",
        priceCents: 45900,
        skuTail: "SRT-BLK-M"
      }
    ]
  },
  {
    brand: "OFF-WHITE",
    brandLabel: "Off-White",
    slugPrefix: "offwhite",
    skuPrefix: "OFW",
    tone: "графичным streetwear-характером и заметной fashion-энергией",
    items: [
      {
        slugTail: "marker-zip-hoodie-57",
        title: "Marker Zip Hoodie",
        shortDescription: "Zip-худи Off-White в графичном streetwear-ключе",
        descriptor: "ясный визуальный акцент и everyday-база для широкого низа и кроссовок",
        tags: ["hoodie", "off-white", "graphic", "streetwear"],
        color: "Black",
        size: "L",
        priceCents: 38900,
        skuTail: "ZIP-BLK-L"
      },
      {
        slugTail: "industrial-track-pant-58",
        title: "Industrial Track Pant",
        shortDescription: "Track-брюки Off-White для street-luxury комплекта",
        descriptor: "повседневная динамика, прямой крой и графичный контекст бренда",
        tags: ["pants", "off-white", "track", "streetwear"],
        color: "Olive",
        size: "M",
        priceCents: 34900,
        skuTail: "TRK-OLV-M"
      },
      {
        slugTail: "arrow-crewneck-59",
        title: "Arrow Crewneck",
        shortDescription: "Свитшот Off-White как базовый streetwear-слой",
        descriptor: "чистая форма, комфортный объём и предмет для ежедневной ротации",
        tags: ["crewneck", "off-white", "streetwear", "everyday"],
        color: "Grey",
        size: "M",
        priceCents: 32900,
        skuTail: "CRW-GRY-M"
      },
      {
        slugTail: "graphic-longsleeve-60",
        title: "Graphic Longsleeve",
        shortDescription: "Лонгслив Off-White с уличным графичным настроением",
        descriptor: "лёгкая база для layering, которая не теряет характер без сложного образа",
        tags: ["longsleeve", "off-white", "graphic", "layering"],
        color: "White",
        size: "L",
        priceCents: 21900,
        skuTail: "LNG-WHT-L"
      },
      {
        slugTail: "tactical-vest-61",
        title: "Tactical Vest",
        shortDescription: "Жилет Off-White для layered street-fit",
        descriptor: "утилитарный верхний слой с выраженным streetwear-ритмом",
        tags: ["vest", "off-white", "tactical", "streetwear"],
        color: "Black",
        size: "L",
        priceCents: 39900,
        skuTail: "VST-BLK-L"
      },
      {
        slugTail: "cargo-shorts-62",
        title: "Cargo Shorts",
        shortDescription: "Шорты Off-White для функционального summer streetwear",
        descriptor: "свободная посадка и лёгкая утилитарность без потери fashion-акцента",
        tags: ["shorts", "off-white", "cargo", "streetwear"],
        color: "Khaki",
        size: "M",
        priceCents: 25900,
        skuTail: "SRT-KHK-M"
      }
    ]
  },
  {
    brand: "STONE ISLAND",
    brandLabel: "Stone Island",
    slugPrefix: "stoneisland",
    skuPrefix: "STI",
    tone: "техническим характером, утилитарной сдержанностью и premium functional wear-настроением",
    items: [
      {
        slugTail: "garment-dye-hoodie-63",
        title: "Garment Dye Hoodie",
        shortDescription: "Худи Stone Island в техническом everyday-ключе",
        descriptor: "плотный материал, чистый utilitarian-силуэт и спокойный функциональный стиль",
        tags: ["hoodie", "stone-island", "techwear", "premium"],
        color: "Olive",
        size: "L",
        priceCents: 42900,
        skuTail: "HOOD-OLV-L"
      },
      {
        slugTail: "cargo-pant-64",
        title: "Cargo Pant",
        shortDescription: "Карго Stone Island для функционального city-fit",
        descriptor: "утилитарная база, плотная посадка и премиальное techwear-настроение",
        tags: ["pants", "stone-island", "cargo", "techwear"],
        color: "Black",
        size: "32",
        priceCents: 45900,
        skuTail: "CRG-BLK-32"
      },
      {
        slugTail: "compass-crewneck-65",
        title: "Compass Crewneck",
        shortDescription: "Crewneck Stone Island как premium mid-layer",
        descriptor: "сдержанный силуэт и предмет для функционального layered-гардероба",
        tags: ["crewneck", "stone-island", "premium", "everyday"],
        color: "Grey",
        size: "M",
        priceCents: 36900,
        skuTail: "CRW-GRY-M"
      },
      {
        slugTail: "jersey-longsleeve-66",
        title: "Jersey Longsleeve",
        shortDescription: "Лонгслив Stone Island для техничной базы",
        descriptor: "спокойная футболочная линия с premium functional wear-ощущением",
        tags: ["longsleeve", "stone-island", "jersey", "layering"],
        color: "White",
        size: "L",
        priceCents: 24900,
        skuTail: "LNG-WHT-L"
      },
      {
        slugTail: "microreps-vest-67",
        title: "Micro Reps Vest",
        shortDescription: "Жилет Stone Island для межсезонного layering",
        descriptor: "технический верхний слой с утилитарной аккуратностью и спокойной графикой",
        tags: ["vest", "stone-island", "techwear", "outerwear"],
        color: "Charcoal",
        size: "L",
        priceCents: 49900,
        skuTail: "VST-CHR-L"
      },
      {
        slugTail: "nylon-shorts-68",
        title: "Nylon Shorts",
        shortDescription: "Шорты Stone Island в utilitarian summer-ключе",
        descriptor: "лёгкий технический материал и база для продуманного городского лета",
        tags: ["shorts", "stone-island", "nylon", "techwear"],
        color: "Olive",
        size: "M",
        priceCents: 27900,
        skuTail: "SRT-OLV-M"
      }
    ]
  },
  {
    brand: "NEW BALANCE",
    brandLabel: "New Balance",
    slugPrefix: "newbalance",
    skuPrefix: "NBL",
    tone: "комфортным athletic lifestyle-настроением и мягкой городской функциональностью",
    items: [
      {
        slugTail: "running-zip-hoodie-69",
        title: "Running Zip Hoodie",
        shortDescription: "Zip-худи New Balance для комфортного daily wear",
        descriptor: "мягкая форма, легкий спортивный контекст и база для города",
        tags: ["hoodie", "new-balance", "running", "lifestyle"],
        color: "Grey",
        size: "L",
        priceCents: 11900,
        skuTail: "ZIP-GRY-L"
      },
      {
        slugTail: "tech-jogger-70",
        title: "Tech Jogger",
        shortDescription: "Jogger New Balance для relaxed active wardrobe",
        descriptor: "комфортное движение, чистый everyday-силуэт и понятная база под кроссовки",
        tags: ["pants", "new-balance", "jogger", "lifestyle"],
        color: "Black",
        size: "M",
        priceCents: 9800,
        skuTail: "JGR-BLK-M"
      },
      {
        slugTail: "athletics-crewneck-71",
        title: "Athletics Crewneck",
        shortDescription: "Crewneck New Balance как спортивная база на каждый день",
        descriptor: "спокойный объём и мягкий athletic lifestyle-ритм без лишней агрессии",
        tags: ["crewneck", "new-balance", "athletics", "everyday"],
        color: "Stone",
        size: "M",
        priceCents: 8200,
        skuTail: "CRW-STN-M"
      },
      {
        slugTail: "active-longsleeve-72",
        title: "Active Longsleeve",
        shortDescription: "Лонгслив New Balance для layering и прогулок",
        descriptor: "лёгкая повседневная база с акцентом на комфорт и движение",
        tags: ["longsleeve", "new-balance", "active", "layering"],
        color: "White",
        size: "L",
        priceCents: 6400,
        skuTail: "LNG-WHT-L"
      },
      {
        slugTail: "training-vest-73",
        title: "Training Vest",
        shortDescription: "Жилет New Balance для межсезонной спортивной базы",
        descriptor: "лёгкий слой на прохладную погоду и спокойный utilitarian lifestyle-fit",
        tags: ["vest", "new-balance", "training", "outerwear"],
        color: "Navy",
        size: "L",
        priceCents: 10400,
        skuTail: "VST-NVY-L"
      },
      {
        slugTail: "court-shorts-74",
        title: "Court Shorts",
        shortDescription: "Шорты New Balance для summer lifestyle образов",
        descriptor: "простая посадка, лёгкий спортивный характер и everyday-комфорт",
        tags: ["shorts", "new-balance", "court", "casual"],
        color: "Sand",
        size: "M",
        priceCents: 5700,
        skuTail: "SRT-SND-M"
      }
    ]
  }
];

const buildGeneratedBrandProducts = (config: GeneratedBrandCatalogConfig): ProductSeed[] =>
  config.items.map((item) => {
    const name = `${config.brandLabel} ${item.title}`;

    return {
      slug: `rsh-${config.slugPrefix}-${item.slugTail}`,
      brand: config.brand,
      name,
      description: `${name} с акцентом на ${config.tone}: ${item.descriptor}. Позиция добавлена как готовая каталожная карточка, а фото можно заменить позже без изменения slug и SKU.`,
      shortDescription: item.shortDescription,
      image: {
        ...placeholderProductImage,
        alt: `${name} placeholder`
      },
      tags: [...item.tags, "catalog-seed", config.slugPrefix],
      basePriceCents: item.priceCents,
      variant: {
        sku: `RSH-${config.skuPrefix}-${item.skuTail}`,
        name: `${item.color} / ${item.size}`,
        color: item.color,
        size: item.size,
        priceCents: item.priceCents
      }
    };
  });

const productSeeds: ProductSeed[] = [
  ...coreProductSeeds,
  ...generatedBrandCatalogConfigs.flatMap(buildGeneratedBrandProducts)
];

const getProductImages = (seed: ProductSeed): ProductSeedImage[] => {
  const images = seed.images ?? (seed.image ? [seed.image] : []);

  if (images.length === 0) {
    throw new Error(`Product seed "${seed.slug}" must contain at least one image.`);
  }

  return images.slice(0, maxProductImages);
};

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
    const productImages = getProductImages(seed);
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
        currency: "USD",
        deletedAt: null
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
        currency: "USD",
        deletedAt: null
      }
    });

    const variant = await prisma.productVariant.upsert({
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

    await prisma.inventoryItem.upsert({
      where: { variantId: variant.id },
      update: {
        productId: product.id,
        quantity: 10,
        reservedQuantity: 0
      },
      create: {
        productId: product.id,
        variantId: variant.id,
        quantity: 10,
        reservedQuantity: 0
      }
    });

    await prisma.productImage.deleteMany({
      where: {
        productId: product.id
      }
    });

    await prisma.productImage.createMany({
      data: productImages.map((image, index) => ({
        productId: product.id,
        url: image.url,
        alt: image.alt,
        width: 1200,
        height: 1200,
        sortOrder: index
      }))
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


