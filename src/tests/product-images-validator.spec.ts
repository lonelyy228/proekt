import { describe, expect, it } from "vitest";

import { productCreateSchema, productUpdateSchema } from "@/server/validators/product";

const baseProductPayload = {
  brand: "Nike",
  name: "Nike Lab Hoodie",
  slug: "nike-lab-hoodie",
  description: "Premium hoodie with structured fit and clean RSH catalog presentation.",
  categoryId: "clx0000000000000000000000",
  basePriceCents: 1599900,
  currency: "USD" as const,
  tags: ["hoodie", "streetwear"]
};

describe("product image validators", () => {
  it("accepts up to three local product image paths", () => {
    const result = productCreateSchema.safeParse({
      ...baseProductPayload,
      images: [
        { url: "/product-images/nike-lab-hoodie-1.jpg", alt: "Nike Lab Hoodie front" },
        { url: "/product-images/nike-lab-hoodie-2.jpg", alt: "Nike Lab Hoodie back" },
        { url: "/product-images/nike-lab-hoodie-3.jpg", alt: "Nike Lab Hoodie detail" }
      ]
    });

    expect(result.success).toBe(true);
  });

  it("rejects more than three product images", () => {
    const result = productUpdateSchema.safeParse({
      images: [
        { url: "/product-images/one.jpg", alt: "One" },
        { url: "/product-images/two.jpg", alt: "Two" },
        { url: "/product-images/three.jpg", alt: "Three" },
        { url: "/product-images/four.jpg", alt: "Four" }
      ]
    });

    expect(result.success).toBe(false);
  });

  it("rejects non-product local paths", () => {
    const result = productUpdateSchema.safeParse({
      images: [{ url: "/uploads/raw-file.jpg", alt: "Unsafe local path" }]
    });

    expect(result.success).toBe(false);
  });
});
