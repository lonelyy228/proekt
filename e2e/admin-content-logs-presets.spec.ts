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

test("admin content/log presets CRUD", async ({ request }) => {
  const adminLogin = await loginByApi(request, {
    email: "admin@example.com",
    password: "ChangeMe123!"
  });

  const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 100000)}`;
  const contentPresetA = `content_${uniqueSuffix}_a`;
  const contentPresetB = `content_${uniqueSuffix}_b`;
  const logPresetA = `logs_${uniqueSuffix}_a`;

  const createContentA = await request.post("/api/admin/content/presets", {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      name: contentPresetA,
      filters: {
        search: "nike",
        status: "PUBLISHED"
      },
      isDefault: true
    }
  });
  expect(createContentA.ok()).toBeTruthy();
  const contentAData = (await createContentA.json()) as {
    success: boolean;
    data: { id: string; isDefault: boolean; filters: { search?: string; status?: string } };
  };
  expect(contentAData.success).toBeTruthy();
  expect(contentAData.data.isDefault).toBeTruthy();
  expect(contentAData.data.filters.search).toBe("nike");

  const createContentB = await request.post("/api/admin/content/presets", {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      name: contentPresetB,
      filters: {
        status: "DRAFT"
      },
      isDefault: true
    }
  });
  expect(createContentB.ok()).toBeTruthy();

  const listContentRes = await request.get("/api/admin/content/presets");
  expect(listContentRes.ok()).toBeTruthy();
  const listContentPayload = (await listContentRes.json()) as {
    success: boolean;
    data: Array<{ id: string; name: string; isDefault: boolean }>;
  };
  expect(listContentPayload.success).toBeTruthy();
  const scopedContent = listContentPayload.data.filter((item) => item.name.startsWith(`content_${uniqueSuffix}`));
  expect(scopedContent.length).toBe(2);
  expect(scopedContent.filter((item) => item.isDefault).length).toBe(1);

  const updateContentA = await request.patch(
    `/api/admin/content/presets/${encodeURIComponent(contentAData.data.id)}`,
    {
      headers: {
        "x-csrf-token": adminLogin.csrfToken
      },
      data: {
        name: `${contentPresetA}_updated`,
        filters: {
          search: "adidas",
          status: "ARCHIVED"
        },
        isDefault: false
      }
    }
  );
  expect(updateContentA.ok()).toBeTruthy();

  const deleteContentA = await request.delete(
    `/api/admin/content/presets/${encodeURIComponent(contentAData.data.id)}`,
    {
      headers: {
        "x-csrf-token": adminLogin.csrfToken
      }
    }
  );
  expect(deleteContentA.ok()).toBeTruthy();

  const createLogA = await request.post("/api/admin/logs/presets", {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      name: logPresetA,
      filters: {
        action: "USER_BLOCK",
        targetType: "USER",
        search: "admin@example.com"
      },
      isDefault: true
    }
  });
  expect(createLogA.ok()).toBeTruthy();
  const logAData = (await createLogA.json()) as {
    success: boolean;
    data: { id: string; filters: { action?: string } };
  };
  expect(logAData.success).toBeTruthy();
  expect(logAData.data.filters.action).toBe("USER_BLOCK");

  const updateLogA = await request.patch(`/api/admin/logs/presets/${encodeURIComponent(logAData.data.id)}`, {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      filters: {
        action: "USER_UNBLOCK",
        targetType: "USER",
        search: "admin@example.com"
      }
    }
  });
  expect(updateLogA.ok()).toBeTruthy();

  const listLogRes = await request.get("/api/admin/logs/presets");
  expect(listLogRes.ok()).toBeTruthy();
  const listLogPayload = (await listLogRes.json()) as {
    success: boolean;
    data: Array<{ id: string; name: string }>;
  };
  expect(listLogPayload.success).toBeTruthy();
  expect(listLogPayload.data.some((item) => item.id === logAData.data.id)).toBeTruthy();

  const deleteLogA = await request.delete(`/api/admin/logs/presets/${encodeURIComponent(logAData.data.id)}`, {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    }
  });
  expect(deleteLogA.ok()).toBeTruthy();

  const contentPresetAuditCount = await prisma.adminAction.count({
    where: {
      action: {
        in: ["CONTENT_FILTER_PRESET_CREATE", "CONTENT_FILTER_PRESET_UPDATE", "CONTENT_FILTER_PRESET_DELETE"]
      },
      targetType: "CONTENT_FILTER_PRESET"
    }
  });
  expect(contentPresetAuditCount).toBeGreaterThan(0);

  const logPresetAuditCount = await prisma.adminAction.count({
    where: {
      action: {
        in: [
          "ADMIN_LOG_FILTER_PRESET_CREATE",
          "ADMIN_LOG_FILTER_PRESET_UPDATE",
          "ADMIN_LOG_FILTER_PRESET_DELETE"
        ]
      },
      targetType: "ADMIN_LOG_FILTER_PRESET"
    }
  });
  expect(logPresetAuditCount).toBeGreaterThan(0);
});
