import { test, expect, APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

test("admin order filter presets CRUD + conflict + single default", async ({ request }) => {
  const adminLogin = await loginByApi(request, {
    email: "admin@example.com",
    password: "ChangeMe123!"
  });

  const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 100000)}`;
  const firstPresetName = `orders_${uniqueSuffix}_1`;
  const secondPresetName = `orders_${uniqueSuffix}_2`;

  const createFirstRes = await request.post("/api/admin/orders/presets", {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      name: firstPresetName,
      filters: {
        search: "nike",
        status: "PAID",
        minTotalCents: 10000,
        maxTotalCents: 80000
      },
      isDefault: true
    }
  });
  expect(createFirstRes.ok()).toBeTruthy();
  const createFirstPayload = (await createFirstRes.json()) as {
    success: boolean;
    data: {
      id: string;
      name: string;
      isDefault: boolean;
      filters: {
        search?: string;
        status?: string;
      };
    };
  };
  expect(createFirstPayload.success).toBeTruthy();
  expect(createFirstPayload.data.name).toBe(firstPresetName);
  expect(createFirstPayload.data.isDefault).toBeTruthy();
  expect(createFirstPayload.data.filters.search).toBe("nike");

  const duplicateRes = await request.post("/api/admin/orders/presets", {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      name: firstPresetName,
      filters: {},
      isDefault: false
    }
  });
  expect(duplicateRes.status()).toBe(409);

  const updateFirstRes = await request.patch(
    `/api/admin/orders/presets/${encodeURIComponent(createFirstPayload.data.id)}`,
    {
      headers: {
        "x-csrf-token": adminLogin.csrfToken
      },
      data: {
        name: `${firstPresetName}_updated`,
        filters: {
          search: "adidas",
          status: "FULFILLED",
          dateFrom: "2026-01-01",
          dateTo: "2026-12-31"
        },
        isDefault: false
      }
    }
  );
  expect(updateFirstRes.ok()).toBeTruthy();
  const updateFirstPayload = (await updateFirstRes.json()) as {
    success: boolean;
    data: {
      name: string;
      isDefault: boolean;
      filters: {
        search?: string;
        status?: string;
      };
    };
  };
  expect(updateFirstPayload.success).toBeTruthy();
  expect(updateFirstPayload.data.name).toBe(`${firstPresetName}_updated`);
  expect(updateFirstPayload.data.filters.search).toBe("adidas");
  expect(updateFirstPayload.data.isDefault).toBeFalsy();

  const createSecondRes = await request.post("/api/admin/orders/presets", {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      name: secondPresetName,
      filters: {
        status: "PENDING"
      },
      isDefault: true
    }
  });
  expect(createSecondRes.ok()).toBeTruthy();
  const createSecondPayload = (await createSecondRes.json()) as {
    success: boolean;
    data: {
      id: string;
      isDefault: boolean;
    };
  };
  expect(createSecondPayload.success).toBeTruthy();
  expect(createSecondPayload.data.isDefault).toBeTruthy();

  const listRes = await request.get("/api/admin/orders/presets");
  expect(listRes.ok()).toBeTruthy();
  const listPayload = (await listRes.json()) as {
    success: boolean;
    data: Array<{
      id: string;
      name: string;
      isDefault: boolean;
    }>;
  };
  expect(listPayload.success).toBeTruthy();
  const scopedPresets = listPayload.data.filter(
    (item) =>
      item.name.startsWith(`orders_${uniqueSuffix}`) || item.name.startsWith(`orders_${uniqueSuffix}_1_updated`)
  );
  expect(scopedPresets.length).toBe(2);
  expect(scopedPresets.filter((item) => item.isDefault).length).toBe(1);
  expect(scopedPresets.some((item) => item.id === createSecondPayload.data.id && item.isDefault)).toBeTruthy();

  const deleteFirstRes = await request.delete(
    `/api/admin/orders/presets/${encodeURIComponent(createFirstPayload.data.id)}`,
    {
      headers: {
        "x-csrf-token": adminLogin.csrfToken
      }
    }
  );
  expect(deleteFirstRes.ok()).toBeTruthy();

  const afterDeleteRes = await request.get("/api/admin/orders/presets");
  expect(afterDeleteRes.ok()).toBeTruthy();
  const afterDeletePayload = (await afterDeleteRes.json()) as {
    success: boolean;
    data: Array<{ id: string }>;
  };
  expect(afterDeletePayload.success).toBeTruthy();
  expect(afterDeletePayload.data.some((item) => item.id === createFirstPayload.data.id)).toBeFalsy();
  expect(afterDeletePayload.data.some((item) => item.id === createSecondPayload.data.id)).toBeTruthy();

  const auditCreates = await prisma.adminAction.count({
    where: {
      action: "ORDER_FILTER_PRESET_CREATE",
      targetType: "ORDER_FILTER_PRESET"
    }
  });
  expect(auditCreates).toBeGreaterThan(0);
});
