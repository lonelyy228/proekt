export type BrandProfile = {
  focus: string;
  archiveNote: string;
  conditionScale: string;
  authenticityProtocol: string[];
  stylingSignal: string;
  dropTimeline: string[];
  materialsOrigin: string;
  careCard: string[];
  compareBrands: string[];
};

const defaultProfile: BrandProfile = {
  focus: "Отобранный брендовый предмет из нишевой подборки RSH.",
  archiveNote: "Выбран за качество материалов, актуальность силуэта и пригодность к кастому.",
  conditionScale: "A-",
  authenticityProtocol: ["Проверка лейбла и швов", "Проверка тактильности материала", "Проверка фурнитуры и принта"],
  stylingSignal: "Минималистичный монохромный образ с одной фактурной деталью.",
  dropTimeline: ["Drop: S24 Core Archive", "Переоценка: каждые 30 дней", "Ротация: ограниченный тираж"],
  materialsOrigin: "Смешанный архивный сток Европы и Японии, ручной отбор RSH.",
  careCard: ["Щадящая стирка до 30°C", "Сушить естественным способом", "Не использовать агрессивный отбеливатель"],
  compareBrands: ["По крою: ближе к NIKE", "По ткани: ближе к MAISON MARGIELA", "По визуальному коду: нейтральный архив"]
};

const brandProfiles: Record<string, BrandProfile> = {
  ADIDAS: {
    focus: "Архивный sportswear-бренд с выразительной ретро-геометрией и чистой айдентикой.",
    archiveNote: "Выбран за стабильную форму и отличную совместимость с минимальным кастомом.",
    conditionScale: "A",
    authenticityProtocol: [
      "Проверка пропорций логотипа и плотности вышивки",
      "Проверка дата-кодов и сервисных лейблов",
      "Проверка состава и фактуры ткани"
    ],
    stylingSignal: "Комбинируется с шерстяными брюками и монохромными кроссовками.",
    dropTimeline: ["Drop: Terrace Archive", "Доступность: лимит по размерам", "Ресток: не гарантирован"],
    materialsOrigin: "Архивные партии из Германии и Италии.",
    careCard: ["Стирать наизнанку", "Не сушить в барабане", "Гладить на низкой температуре"],
    compareBrands: ["Мягче по силуэту, чем PUMA", "Более геометричный код, чем NIKE", "Более утилитарен, чем GUCCI"]
  },
  NIKE: {
    focus: "Кроссовер performance и streetwear с узнаваемой архитектурой силуэта.",
    archiveNote: "Выбран за коллекционную ценность бренд-кода и стабильный фит.",
    conditionScale: "A-",
    authenticityProtocol: [
      "Проверка кромки Swoosh и качества вышивки",
      "Проверка внутренней маркировки и интервалов",
      "Проверка цветового кода с эталонными релизами"
    ],
    stylingSignal: "Лучше работает в контрасте с формальным верхом.",
    dropTimeline: ["Drop: Utility Street", "Лимит: low-volume", "Вторичная оценка: еженедельно"],
    materialsOrigin: "Архивные единицы США / ЕС.",
    careCard: ["Деликатная стирка", "Не перегревать при глажке", "Хранить на плечиках"],
    compareBrands: ["Более динамичный силуэт, чем ADIDAS", "Более техничный визуал, чем TIMBERLAND", "Менее концептуален, чем MARGIELA"]
  },
  PUMA: {
    focus: "Track-heritage линия с четкой графикой панелей и эстетикой 90-х.",
    archiveNote: "Включен за нишевую ретро-ценность и аккуратную панельную конструкцию.",
    conditionScale: "A-",
    authenticityProtocol: ["Проверка штриха Cat logo", "Проверка панелей и швов", "Проверка молний и фурнитуры"],
    stylingSignal: "Лучше всего с нейтральной базой и акцентом на геометрию линий.",
    dropTimeline: ["Drop: Retro Line", "Доступность: ограничена", "Повтор: только по коллекции"],
    materialsOrigin: "Архивный сток ЕС.",
    careCard: ["Стирать в холодной воде", "Не использовать жесткий отжим", "Сушить горизонтально"],
    compareBrands: ["Более ретро, чем NEW BALANCE", "Более графичный, чем TIMBERLAND", "Более доступный entry-point, чем BALENCIAGA"]
  },
  TIMBERLAND: {
    focus: "Премиальная утилитарная кожаная классика с долгим жизненным циклом.",
    archiveNote: "Выбран за прочность, потенциал патинирования и узнаваемый профиль.",
    conditionScale: "A",
    authenticityProtocol: [
      "Проверка зерна кожи и финиша",
      "Проверка тиснения и подошвы",
      "Проверка люверсов и длины стежка"
    ],
    stylingSignal: "Балансировать массивный низ с чистым зауженным силуэтом.",
    dropTimeline: ["Drop: Rugged Archive", "Ротация: сезонная", "Размеры: ограничены"],
    materialsOrigin: "Отобранные пары США / Великобритания.",
    careCard: ["Использовать крем для кожи", "Не сушить у источников тепла", "Хранить с распорками"],
    compareBrands: ["Более утилитарный, чем GUCCI", "Более долговечный, чем OFF-WHITE apparel", "Более тяжелый профиль, чем NIKE"]
  },
  "MAISON MARGIELA": {
    focus: "Концептуальная luxury-линия со сдержанными визуальными кодами.",
    archiveNote: "Выбран за коллекционную нишевость и материаловый нарратив.",
    conditionScale: "A",
    authenticityProtocol: [
      "Проверка расположения signature four-stitch",
      "Проверка типографики и расстояний на лейблах",
      "Проверка паттерна и логики швов"
    ],
    stylingSignal: "Минимальная палитра и один концептуальный акцент в образе.",
    dropTimeline: ["Drop: Concept Archive", "Редкость: высокая", "Ресток: практически отсутствует"],
    materialsOrigin: "Бутики и архивные ресейл-каналы ЕС.",
    careCard: ["Только деликатный уход", "Предпочтительно химчистка", "Хранить в чехле"],
    compareBrands: ["Более концептуален, чем NIKE", "Более минималистичен, чем GUCCI", "Более нишевый, чем ADIDAS"]
  },
  GUCCI: {
    focus: "Luxury fashion-бренд с выраженной декоративной ДНК и премиальными материалами.",
    archiveNote: "Отобран за узнаваемый бренд-код и устойчивый спрос на ресейле.",
    conditionScale: "A-",
    authenticityProtocol: ["Проверка serial/tag", "Проверка логотипных паттернов", "Проверка фурнитуры и швов"],
    stylingSignal: "Лучше работает как соло-акцент в сдержанном образе.",
    dropTimeline: ["Drop: Luxury Edit", "Ротация: ограниченная", "Ресток: выборочно"],
    materialsOrigin: "Италия / Франция, отобранные архивные каналы.",
    careCard: ["Щадящий уход", "Избегать агрессивной химии", "Хранить в фирменном чехле"],
    compareBrands: ["Более декоративен, чем MAISON MARGIELA", "Менее утилитарен, чем TIMBERLAND", "Ближе к high-fashion, чем PUMA"]
  },
  BALENCIAGA: {
    focus: "Экспериментальный luxury-бренд с oversize-силуэтами и радикальной пропорцией.",
    archiveNote: "Выбран за high-demand niche и сильный runway-визуал.",
    conditionScale: "A-",
    authenticityProtocol: ["Проверка внутренних лейблов", "Проверка формы и пропорций", "Проверка качества принта/вышивки"],
    stylingSignal: "Чистая база, чтобы силуэт оставался главным.",
    dropTimeline: ["Drop: Runway Archive", "Редкость: высокая", "Ресток: редко"],
    materialsOrigin: "Архивные каналы ЕС.",
    careCard: ["Деликатный режим", "Не сушить в барабане", "Хранить свободно, без перегибов"],
    compareBrands: ["Более радикальный силуэт, чем NIKE", "Более street-luxury, чем GUCCI", "Более экспериментальный, чем ADIDAS"]
  },
  "OFF-WHITE": {
    focus: "Street-luxury гибрид с графическим языком и коллекционной ценностью.",
    archiveNote: "Отобран за узнаваемую графику и сильную вторичную ликвидность.",
    conditionScale: "A-",
    authenticityProtocol: ["Проверка принтов и стрелочных маркеров", "Проверка лейблов и швов", "Проверка фурнитуры"],
    stylingSignal: "Работает с минималистичным низом и гладкой обувью.",
    dropTimeline: ["Drop: Street Luxury", "Объем: ограниченный", "Пополнение: эпизодическое"],
    materialsOrigin: "Европейские ресейл-архивы.",
    careCard: ["Стирать наизнанку", "Избегать перегрева принта", "Хранить в сухом месте"],
    compareBrands: ["Более графичный, чем MAISON MARGIELA", "Менее формальный, чем GUCCI", "Более коллекционный, чем PUMA"]
  },
  "STONE ISLAND": {
    focus: "Технический premium-casual бренд с материаловой инженерией.",
    archiveNote: "Выбран за архивную ценность тканей и утилитарный дизайн.",
    conditionScale: "A",
    authenticityProtocol: ["Проверка patch и креплений", "Проверка ткани и dye-эффекта", "Проверка швов и фурнитуры"],
    stylingSignal: "Идеален в техно-минимализме и монохроме.",
    dropTimeline: ["Drop: Tech Archive", "Сезонная ротация", "Ресток: ограниченный"],
    materialsOrigin: "Италия и ЕС архивные поставки.",
    careCard: ["Деликатная стирка", "Без агрессивной химии", "Сушить естественно"],
    compareBrands: ["Более техничный, чем NIKE", "Более утилитарный, чем GUCCI", "Более инженерный, чем ADIDAS"]
  },
  "NEW BALANCE": {
    focus: "Сбалансированный lifestyle/performance бренд с акцентом на комфорт и ретро-силуэты.",
    archiveNote: "Отобран за стабильный спрос и strong everyday-wear value.",
    conditionScale: "A",
    authenticityProtocol: ["Проверка формы и материалов", "Проверка лейблов", "Проверка подошвы и прошивки"],
    stylingSignal: "Лучше всего в чистом повседневном минимализме.",
    dropTimeline: ["Drop: Core Runner Edit", "Размеры: ограниченно", "Ротация: активная"],
    materialsOrigin: "США / ЕС архивные каналы.",
    careCard: ["Мягкая чистка", "Не стирать в горячей воде", "Сушить без нагрева"],
    compareBrands: ["Более универсален, чем OFF-WHITE", "Более сдержанный, чем BALENCIAGA", "Более lifestyle, чем TIMBERLAND"]
  }
};

export const getBrandProfile = (brand: string): BrandProfile => brandProfiles[brand.toUpperCase()] ?? defaultProfile;
