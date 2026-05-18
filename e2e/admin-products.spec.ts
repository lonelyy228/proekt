import { test, expect, APIRequestContext } from "@playwright/test";
import { PrismaClient, ProductStatus } from "@prisma/client";

const prisma = new PrismaClient();

const randomSuffix = (): string => `${Date.now()}-${Math.round(Math.random() * 100000)}`;

const loginByApi = async (
  api: APIRequestContext,
  params: { email: string; password: string }
): Promise<{ csrfToken: string }> => {
  const response = await api.post("/api/auth/login", {
    data: params
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    success: boolean;
    data: { csrfToken: string };
  };
  expect(payload.success).toBeTruthy();
  return { csrfToken: payload.data.csrfToken };
};

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("admin products CRUD: create -> update -> soft delete", async ({ request }) => {
  const adminLogin = await loginByApi(request, {
    email: "admin@example.com",
    password: "ChangeMe123!"
  });

  const category = await prisma.category.findFirst({
    where: {
      slug: "rsh-brands"
    }
  });
  expect(category).not.toBeNull();
  if (!category) {
    return;
  }

  const suffix = randomSuffix();
  const slug = `rsh-admin-test-${suffix}`;
  const secondSlug = `rsh-admin-test-${suffix}-second`;

  const createRes = await request.post("/api/admin/products", {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      brand: "RSH",
      name: `Admin Test Product ${suffix}`,
      slug,
      description: "Тестовый товар для проверки полного CRUD цикла в административной панели.",
      shortDescription: "Тест CRUD",
      categoryId: category.id,
      basePriceCents: 12345,
      currency: "USD",
      tags: ["test", "admin", "crud"]
    }
  });

  const createPayload = (await createRes.json()) as {
    success: boolean;
    data: { id: string; slug: string };
    error?: { message?: string; details?: string[] };
  };
  expect(createRes.ok(), JSON.stringify(createPayload)).toBeTruthy();
  expect(createPayload.success).toBeTruthy();
  expect(createPayload.data.slug).toBe(slug);

  const productId = createPayload.data.id;
  const createSecondRes = await request.post("/api/admin/products", {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      brand: "RSH",
      name: `Admin Test Product 2 ${suffix}`,
      slug: secondSlug,
      description: "Второй тестовый товар для проверки bulk-операций по статусам.",
      shortDescription: "Тест bulk",
      categoryId: category.id,
      basePriceCents: 22345,
      currency: "USD",
      tags: ["test", "bulk"]
    }
  });
  expect(createSecondRes.ok()).toBeTruthy();
  const createSecondPayload = (await createSecondRes.json()) as {
    success: boolean;
    data: { id: string };
  };
  expect(createSecondPayload.success).toBeTruthy();
  const secondProductId = createSecondPayload.data.id;

  const listRes = await request.get(`/api/admin/products?search=${encodeURIComponent(slug)}&page=1&pageSize=20`);
  expect(listRes.ok()).toBeTruthy();
  const listPayload = (await listRes.json()) as {
    success: boolean;
    data: {
      items: Array<{ id: string; slug: string; status: ProductStatus }>;
    };
  };
  expect(listPayload.success).toBeTruthy();
  expect(listPayload.data.items.some((item) => item.id === productId)).toBeTruthy();

  const updateRes = await request.patch(`/api/admin/products/${encodeURIComponent(productId)}`, {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      name: `Updated Admin Product ${suffix}`,
      status: "ARCHIVED",
      basePriceCents: 15000,
      tags: ["updated", "admin", "crud"],
      description: "Обновленное описание тестового товара для проверки PATCH маршрута в админке.",
      categoryId: category.id,
      brand: "RSH",
      slug,
      currency: "USD"
    }
  });

  expect(updateRes.ok()).toBeTruthy();
  const updatePayload = (await updateRes.json()) as {
    success: boolean;
    data: { id: string; status: ProductStatus; basePriceCents: number };
  };
  expect(updatePayload.success).toBeTruthy();
  expect(updatePayload.data.status).toBe("ARCHIVED");
  expect(updatePayload.data.basePriceCents).toBe(15000);

  const bulkDryRunRes = await request.post("/api/admin/products/bulk", {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      productIds: [productId, secondProductId],
      status: "ACTIVE",
      dryRun: true
    }
  });
  expect(bulkDryRunRes.ok()).toBeTruthy();
  const bulkDryRunPayload = (await bulkDryRunRes.json()) as {
    success: boolean;
    data: { dryRun: boolean; eligibleCount: number; rejectedCount: number };
  };
  expect(bulkDryRunPayload.success).toBeTruthy();
  expect(bulkDryRunPayload.data.dryRun).toBeTruthy();
  expect(bulkDryRunPayload.data.eligibleCount).toBe(1);

  const bulkApplyRes = await request.post("/api/admin/products/bulk", {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      productIds: [productId, secondProductId],
      status: "ACTIVE",
      dryRun: false
    }
  });
  expect(bulkApplyRes.ok()).toBeTruthy();
  const bulkApplyPayload = (await bulkApplyRes.json()) as {
    success: boolean;
    data: { dryRun: boolean; updatedCount: number };
  };
  expect(bulkApplyPayload.success).toBeTruthy();
  expect(bulkApplyPayload.data.dryRun).toBeFalsy();
  expect(bulkApplyPayload.data.updatedCount).toBe(1);

  const presetName = `products_${Date.now()}_${Math.round(Math.random() * 100000)}`;
  const createPresetRes = await request.post("/api/admin/products/presets", {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      name: presetName,
      filters: {
        search: slug,
        status: "ACTIVE",
        sortBy: "newest"
      },
      isDefault: true
    }
  });
  expect(createPresetRes.ok()).toBeTruthy();
  const createPresetPayload = (await createPresetRes.json()) as {
    success: boolean;
    data: { id: string; name: string; isDefault: boolean };
  };
  expect(createPresetPayload.success).toBeTruthy();
  expect(createPresetPayload.data.name).toBe(presetName);
  expect(createPresetPayload.data.isDefault).toBeTruthy();

  const duplicatePresetRes = await request.post("/api/admin/products/presets", {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      name: presetName,
      filters: {},
      isDefault: false
    }
  });
  expect(duplicatePresetRes.status()).toBe(409);

  const updatePresetRes = await request.patch(
    `/api/admin/products/presets/${encodeURIComponent(createPresetPayload.data.id)}`,
    {
      headers: {
        "x-csrf-token": adminLogin.csrfToken
      },
      data: {
        name: `${presetName}_updated`,
        filters: {
          search: secondSlug,
          status: "ACTIVE",
          sortBy: "price_desc"
        }
      }
    }
  );
  expect(updatePresetRes.ok()).toBeTruthy();

  const listPresetsRes = await request.get("/api/admin/products/presets");
  expect(listPresetsRes.ok()).toBeTruthy();
  const listPresetsPayload = (await listPresetsRes.json()) as {
    success: boolean;
    data: Array<{ id: string; name: string }>;
  };
  expect(listPresetsPayload.success).toBeTruthy();
  expect(listPresetsPayload.data.some((item) => item.id === createPresetPayload.data.id)).toBeTruthy();

  const deletePresetRes = await request.delete(
    `/api/admin/products/presets/${encodeURIComponent(createPresetPayload.data.id)}`,
    {
      headers: {
        "x-csrf-token": adminLogin.csrfToken
      }
    }
  );
  expect(deletePresetRes.ok()).toBeTruthy();

  const deleteRes = await request.delete(`/api/admin/products/${encodeURIComponent(productId)}`, {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    }
  });

  expect(deleteRes.ok()).toBeTruthy();
  const deletePayload = (await deleteRes.json()) as {
    success: boolean;
    data: { deleted: boolean };
  };
  expect(deletePayload.success).toBeTruthy();
  expect(deletePayload.data.deleted).toBeTruthy();

  const deleteSecondRes = await request.delete(`/api/admin/products/${encodeURIComponent(secondProductId)}`, {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    }
  });
  expect(deleteSecondRes.ok()).toBeTruthy();

  const deletedProduct = await prisma.product.findUnique({ where: { id: productId } });
  expect(deletedProduct).not.toBeNull();
  expect(deletedProduct?.deletedAt).not.toBeNull();

  const missingInListRes = await request.get(`/api/admin/products?search=${encodeURIComponent(slug)}&page=1&pageSize=20`);
  expect(missingInListRes.ok()).toBeTruthy();
  const missingInListPayload = (await missingInListRes.json()) as {
    success: boolean;
    data: {
      items: Array<{ id: string }>;
    };
  };
  expect(missingInListPayload.success).toBeTruthy();
  expect(missingInListPayload.data.items.some((item) => item.id === productId)).toBeFalsy();

  const productAuditCount = await prisma.adminAction.count({
    where: {
      targetType: "PRODUCT",
      targetId: productId,
      action: {
        in: ["PRODUCT_CREATE", "PRODUCT_UPDATE", "PRODUCT_DELETE"]
      }
    }
  });
  expect(productAuditCount).toBeGreaterThanOrEqual(3);
});
