import { test, expect, APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const createStrongPassword = (): string => "StrongPass1!";
const createEmail = (): string => `e2e_user_mgmt_${Date.now()}_${Math.round(Math.random() * 100000)}@example.com`;

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

test("admin user management: role change + block/unblock", async ({ request }) => {
  const adminLogin = await loginByApi(request, {
    email: "admin@example.com",
    password: "ChangeMe123!"
  });

  const email = createEmail();
  const password = createStrongPassword();

  const registerRes = await request.post("/api/auth/register", {
    data: { email, password }
  });
  expect(registerRes.ok()).toBeTruthy();

  const user = await prisma.user.findUnique({ where: { email } });
  expect(user).not.toBeNull();
  if (!user) {
    return;
  }

  const secondEmail = createEmail();
  const secondPassword = createStrongPassword();
  const secondRegisterRes = await request.post("/api/auth/register", {
    data: { email: secondEmail, password: secondPassword }
  });
  expect(secondRegisterRes.ok()).toBeTruthy();
  const secondUser = await prisma.user.findUnique({ where: { email: secondEmail } });
  expect(secondUser).not.toBeNull();
  if (!secondUser) {
    return;
  }

  const promoteRes = await request.patch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      role: "ADMIN"
    }
  });

  expect(promoteRes.ok()).toBeTruthy();
  const promotePayload = (await promoteRes.json()) as {
    success: boolean;
    data: { role: "USER" | "ADMIN" };
  };
  expect(promotePayload.success).toBeTruthy();
  expect(promotePayload.data.role).toBe("ADMIN");

  const blockRes = await request.patch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      isBlocked: true
    }
  });

  expect(blockRes.ok()).toBeTruthy();
  const blockPayload = (await blockRes.json()) as {
    success: boolean;
    data: { isBlocked: boolean };
  };
  expect(blockPayload.success).toBeTruthy();
  expect(blockPayload.data.isBlocked).toBeTruthy();

  const blockedLoginRes = await request.post("/api/auth/login", {
    data: { email, password }
  });
  expect(blockedLoginRes.status()).toBe(401);

  const unblockRes = await request.patch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      isBlocked: false,
      role: "USER"
    }
  });

  expect(unblockRes.ok()).toBeTruthy();
  const unblockPayload = (await unblockRes.json()) as {
    success: boolean;
    data: { isBlocked: boolean; role: "USER" | "ADMIN" };
  };
  expect(unblockPayload.success).toBeTruthy();
  expect(unblockPayload.data.isBlocked).toBeFalsy();
  expect(unblockPayload.data.role).toBe("USER");

  const afterUnblockLoginRes = await request.post("/api/auth/login", {
    data: { email, password }
  });
  expect(afterUnblockLoginRes.ok()).toBeTruthy();

  const adminRelogin = await loginByApi(request, {
    email: "admin@example.com",
    password: "ChangeMe123!"
  });

  const auditActions = await prisma.adminAction.findMany({
    where: {
      targetType: "USER",
      targetId: user.id,
      action: {
        in: ["USER_ROLE_CHANGE", "USER_BLOCK", "USER_UNBLOCK"]
      }
    },
    select: {
      action: true
    }
  });

  const actionNames = new Set(auditActions.map((item) => item.action));
  expect(actionNames.has("USER_ROLE_CHANGE")).toBeTruthy();
  expect(actionNames.has("USER_BLOCK")).toBeTruthy();
  expect(actionNames.has("USER_UNBLOCK")).toBeTruthy();

  const bulkDryRunRes = await request.post("/api/admin/users/bulk", {
    headers: {
      "x-csrf-token": adminRelogin.csrfToken
    },
    data: {
      userIds: [user.id, secondUser.id],
      operation: "BLOCK",
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
  expect(bulkDryRunPayload.data.eligibleCount).toBe(2);

  const bulkApplyRes = await request.post("/api/admin/users/bulk", {
    headers: {
      "x-csrf-token": adminRelogin.csrfToken
    },
    data: {
      userIds: [user.id, secondUser.id],
      operation: "BLOCK",
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
  expect(bulkApplyPayload.data.updatedCount).toBe(2);

  const usersAfterBlock = await prisma.user.findMany({
    where: { id: { in: [user.id, secondUser.id] } },
    select: { id: true, isBlocked: true }
  });
  expect(usersAfterBlock.every((item) => item.isBlocked)).toBeTruthy();

  const bulkUnblockRes = await request.post("/api/admin/users/bulk", {
    headers: {
      "x-csrf-token": adminRelogin.csrfToken
    },
    data: {
      userIds: [user.id, secondUser.id],
      operation: "UNBLOCK",
      dryRun: false
    }
  });
  expect(bulkUnblockRes.ok()).toBeTruthy();

  const presetName = `users_${Date.now()}_${Math.round(Math.random() * 100000)}`;
  const createPresetRes = await request.post("/api/admin/users/presets", {
    headers: {
      "x-csrf-token": adminRelogin.csrfToken
    },
    data: {
      name: presetName,
      filters: {
        search: email,
        role: "USER",
        isBlocked: false
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

  const duplicatePresetRes = await request.post("/api/admin/users/presets", {
    headers: {
      "x-csrf-token": adminRelogin.csrfToken
    },
    data: {
      name: presetName,
      filters: {},
      isDefault: false
    }
  });
  expect(duplicatePresetRes.status()).toBe(409);

  const updatePresetRes = await request.patch(
    `/api/admin/users/presets/${encodeURIComponent(createPresetPayload.data.id)}`,
    {
      headers: {
        "x-csrf-token": adminRelogin.csrfToken
      },
      data: {
        name: `${presetName}_updated`,
        filters: {
          search: secondEmail,
          role: "USER",
          isBlocked: false
        }
      }
    }
  );
  expect(updatePresetRes.ok()).toBeTruthy();

  const listPresetsRes = await request.get("/api/admin/users/presets");
  expect(listPresetsRes.ok()).toBeTruthy();
  const listPresetsPayload = (await listPresetsRes.json()) as {
    success: boolean;
    data: Array<{ id: string; name: string }>;
  };
  expect(listPresetsPayload.success).toBeTruthy();
  expect(listPresetsPayload.data.some((item) => item.id === createPresetPayload.data.id)).toBeTruthy();

  const deletePresetRes = await request.delete(
    `/api/admin/users/presets/${encodeURIComponent(createPresetPayload.data.id)}`,
    {
      headers: {
        "x-csrf-token": adminRelogin.csrfToken
      }
    }
  );
  expect(deletePresetRes.ok()).toBeTruthy();
});
