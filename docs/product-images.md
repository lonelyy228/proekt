# Как добавить свои фотографии товаров

## Быстрый вариант для локального показа

1. Подготовь 3 фото на один товар:
   - `front` - главное фото;
   - `back` или второй ракурс;
   - `detail` - бирка, материал, подошва, принт или крупный план.
2. Размер лучше делать квадратный: `1200x1200` или `1600x1600`.
3. Формат: `webp` или `jpg`.
4. Положи файлы в папку:

```text
public/product-images/
```

5. Называй файлы по slug товара, например:

```text
public/product-images/rsh-adidas-essential-tee-01-1.webp
public/product-images/rsh-adidas-essential-tee-01-2.webp
public/product-images/rsh-adidas-essential-tee-01-3.webp
```

6. Открой `prisma/seed.ts`, найди товар по `slug` и вместо одного `image` можно поставить `images`:

```ts
images: [
  {
    url: "/product-images/rsh-adidas-essential-tee-01-1.webp",
    alt: "Adidas Essential Tee, вид спереди"
  },
  {
    url: "/product-images/rsh-adidas-essential-tee-01-2.webp",
    alt: "Adidas Essential Tee, второй ракурс"
  },
  {
    url: "/product-images/rsh-adidas-essential-tee-01-3.webp",
    alt: "Adidas Essential Tee, детали материала"
  }
],
```

7. После замены запусти:

```powershell
npm run seed
npm run dev
```

8. Открой карточку товара. На странице товара появятся 3 миниатюры и стрелки переключения.

## Важно для production

Для настоящего деплоя лучше хранить фото не в репозитории, а в UploadThing или Vercel Blob. В базе должны быть только URL и alt-текст.

Не вставляй в seed путь вида `C:\Users\...`. Браузер не сможет открыть такой файл. Для локальных фото используй путь от `public`, например `/product-images/file.webp`.

## Правило 3 фото

Страница товара специально берёт максимум 3 изображения. Если в seed добавить больше, лишние не будут показаны в галерее.
