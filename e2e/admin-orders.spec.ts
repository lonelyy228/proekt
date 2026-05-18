import { test, expect, APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const createStrongPassword = (): string => "StrongPass1!";
const createEmail = (): string => `e2e_order_admin_${Date.now()}_${Math.round(Math.random() * 100000)}@example.com`;

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

test("admin orders management: list + safe status transitions + audit", async ({ request }) => {
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

  const order = await prisma.order.create({
    data: {
      userId: user.id,
      status: "PENDING",
      subtotalCents: 25000,
      shippingCents: 0,
      taxCents: 2000,
      totalCents: 27000,
      currency: "USD",
      shippingAddressJson: {
        firstName: "E2E",
        lastName: "Buyer",
        line1: "Admin Street 1",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "US"
      }
    }
  });

  const listBySearchRes = await request.get(`/api/admin/orders?search=${encodeURIComponent(email)}&page=1&pageSize=20`);
  expect(listBySearchRes.ok()).toBeTruthy();
  const listBySearchPayload = (await listBySearchRes.json()) as {
    success: boolean;
    data: {
      items: Array<{ id: string; status: string; user: { email: string } }>;
    };
  };
  expect(listBySearchPayload.success).toBeTruthy();
  expect(listBySearchPayload.data.items.some((item) => item.id === order.id)).toBeTruthy();

  const day = order.createdAt.toISOString().slice(0, 10);
  const listByRangeRes = await request.get(
    `/api/admin/orders?search=${encodeURIComponent(email)}&dateFrom=${encodeURIComponent(day)}&dateTo=${encodeURIComponent(day)}&minTotalCents=26000&maxTotalCents=28000&page=1&pageSize=20`
  );
  expect(listByRangeRes.ok()).toBeTruthy();
  const listByRangePayload = (await listByRangeRes.json()) as {
    success: boolean;
    data: {
      items: Array<{ id: string }>;
    };
  };
  expect(listByRangePayload.success).toBeTruthy();
  expect(listByRangePayload.data.items.some((item) => item.id === order.id)).toBeTruthy();

  const detailsRes = await request.get(`/api/admin/orders/${encodeURIComponent(order.id)}`);
  expect(detailsRes.ok()).toBeTruthy();
  const detailsPayload = (await detailsRes.json()) as {
    success: boolean;
    data: {
      id: string;
      status: string;
      items: Array<{ id: string }>;
      payments: Array<{ id: string }>;
      statusTimeline: Array<{ id: string }>;
    };
  };
  expect(detailsPayload.success).toBeTruthy();
  expect(detailsPayload.data.id).toBe(order.id);
  expect(detailsPayload.data.status).toBe("PENDING");
  expect(detailsPayload.data.items.length).toBe(0);
  expect(detailsPayload.data.statusTimeline.length).toBe(0);

  const invalidPaidRes = await request.patch(`/api/admin/orders/${encodeURIComponent(order.id)}`, {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      status: "PAID"
    }
  });
  expect(invalidPaidRes.status()).toBe(409);

  await prisma.payment.create({
    data: {
      orderId: order.id,
      provider: "STRIPE",
      status: "SUCCEEDED",
      amountCents: order.totalCents,
      currency: "USD",
      stripePaymentIntentId: `pi_e2e_${Date.now()}_${Math.round(Math.random() * 100000)}`
    }
  });

  const secondOrder = await prisma.order.create({
    data: {
      userId: user.id,
      status: "PENDING",
      subtotalCents: 10000,
      shippingCents: 0,
      taxCents: 1000,
      totalCents: 11000,
      currency: "USD",
      shippingAddressJson: {
        firstName: "E2E",
        lastName: "Buyer",
        line1: "Admin Street 2",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "US"
      }
    }
  });

  await prisma.payment.create({
    data: {
      orderId: secondOrder.id,
      provider: "STRIPE",
      status: "SUCCEEDED",
      amountCents: secondOrder.totalCents,
      currency: "USD",
      stripePaymentIntentId: `pi_e2e_bulk_${Date.now()}_${Math.round(Math.random() * 100000)}`
    }
  });

  const cursorPageOneRes = await request.get(
    `/api/admin/orders/cursor?search=${encodeURIComponent(email)}&limit=1`
  );
  expect(cursorPageOneRes.ok()).toBeTruthy();
  const cursorPageOnePayload = (await cursorPageOneRes.json()) as {
    success: boolean;
    data: {
      items: Array<{ id: string }>;
      nextCursor: string | null;
    };
  };
  expect(cursorPageOnePayload.success).toBeTruthy();
  expect(cursorPageOnePayload.data.items.length).toBe(1);
  expect(cursorPageOnePayload.data.nextCursor).not.toBeNull();

  const cursorPageTwoRes = await request.get(
    `/api/admin/orders/cursor?search=${encodeURIComponent(email)}&limit=1&cursor=${encodeURIComponent(
      cursorPageOnePayload.data.nextCursor ?? ""
    )}`
  );
  expect(cursorPageTwoRes.ok()).toBeTruthy();
  const cursorPageTwoPayload = (await cursorPageTwoRes.json()) as {
    success: boolean;
    data: {
      items: Array<{ id: string }>;
      nextCursor: string | null;
    };
  };
  expect(cursorPageTwoPayload.success).toBeTruthy();
  expect(cursorPageTwoPayload.data.items.length).toBe(1);

  const toPaidRes = await request.patch(`/api/admin/orders/${encodeURIComponent(order.id)}`, {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      status: "PAID"
    }
  });
  expect(toPaidRes.ok()).toBeTruthy();

  const toFulfilledRes = await request.patch(`/api/admin/orders/${encodeURIComponent(order.id)}`, {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      status: "FULFILLED"
    }
  });
  expect(toFulfilledRes.ok()).toBeTruthy();

  const toRefundedRes = await request.patch(`/api/admin/orders/${encodeURIComponent(order.id)}`, {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      status: "REFUNDED"
    }
  });
  expect(toRefundedRes.ok()).toBeTruthy();
  const toRefundedPayload = (await toRefundedRes.json()) as {
    success: boolean;
    data: { status: string };
  };
  expect(toRefundedPayload.success).toBeTruthy();
  expect(toRefundedPayload.data.status).toBe("REFUNDED");

  const invalidRollbackRes = await request.patch(`/api/admin/orders/${encodeURIComponent(order.id)}`, {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      status: "PAID"
    }
  });
  expect(invalidRollbackRes.status()).toBe(409);

  const detailsAfterMutationsRes = await request.get(`/api/admin/orders/${encodeURIComponent(order.id)}`);
  expect(detailsAfterMutationsRes.ok()).toBeTruthy();
  const detailsAfterMutationsPayload = (await detailsAfterMutationsRes.json()) as {
    success: boolean;
    data: {
      status: string;
      payments: Array<{ id: string }>;
      statusTimeline: Array<{ id: string; toStatus: string | null }>;
    };
  };
  expect(detailsAfterMutationsPayload.success).toBeTruthy();
  expect(detailsAfterMutationsPayload.data.status).toBe("REFUNDED");
  expect(detailsAfterMutationsPayload.data.payments.length).toBeGreaterThan(0);
  expect(
    detailsAfterMutationsPayload.data.statusTimeline.some((entry) => entry.toStatus === "PAID")
  ).toBeTruthy();
  expect(
    detailsAfterMutationsPayload.data.statusTimeline.some((entry) => entry.toStatus === "FULFILLED")
  ).toBeTruthy();
  expect(
    detailsAfterMutationsPayload.data.statusTimeline.some((entry) => entry.toStatus === "REFUNDED")
  ).toBeTruthy();

  const bulkDryRunRes = await request.post("/api/admin/orders/bulk", {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      orderIds: [order.id, secondOrder.id],
      status: "PAID",
      dryRun: true
    }
  });
  expect(bulkDryRunRes.ok()).toBeTruthy();
  const bulkDryRunPayload = (await bulkDryRunRes.json()) as {
    success: boolean;
    data: {
      dryRun: boolean;
      eligibleCount: number;
      rejectedCount: number;
    };
  };
  expect(bulkDryRunPayload.success).toBeTruthy();
  expect(bulkDryRunPayload.data.dryRun).toBeTruthy();
  expect(bulkDryRunPayload.data.eligibleCount).toBe(1);
  expect(bulkDryRunPayload.data.rejectedCount).toBe(1);

  const bulkApplyRes = await request.post("/api/admin/orders/bulk", {
    headers: {
      "x-csrf-token": adminLogin.csrfToken
    },
    data: {
      orderIds: [order.id, secondOrder.id],
      status: "PAID",
      dryRun: false
    }
  });
  expect(bulkApplyRes.ok()).toBeTruthy();
  const bulkApplyPayload = (await bulkApplyRes.json()) as {
    success: boolean;
    data: {
      dryRun: boolean;
      updatedCount: number;
      rejectedCount: number;
      updatedOrderIds: string[];
    };
  };
  expect(bulkApplyPayload.success).toBeTruthy();
  expect(bulkApplyPayload.data.dryRun).toBeFalsy();
  expect(bulkApplyPayload.data.updatedCount).toBe(1);
  expect(bulkApplyPayload.data.rejectedCount).toBe(1);
  expect(bulkApplyPayload.data.updatedOrderIds.includes(secondOrder.id)).toBeTruthy();

  const secondOrderAfterBulk = await prisma.order.findUnique({
    where: { id: secondOrder.id },
    select: { status: true }
  });
  expect(secondOrderAfterBulk?.status).toBe("PAID");

  const exportRes = await request.get(
    `/api/admin/orders/export?status=${encodeURIComponent("REFUNDED")}&search=${encodeURIComponent(email)}&limit=1000`
  );
  expect(exportRes.ok()).toBeTruthy();
  expect(exportRes.headers()["content-type"]).toContain("text/csv");
  const csvText = await exportRes.text();
  expect(csvText.includes("orderId")).toBeTruthy();
  expect(csvText.includes(order.id)).toBeTruthy();

  const auditCount = await prisma.adminAction.count({
    where: {
      targetType: "ORDER",
      targetId: order.id,
      action: "ORDER_STATUS_CHANGE"
    }
  });
  expect(auditCount).toBeGreaterThanOrEqual(3);

  const exportAuditCount = await prisma.adminAction.count({
    where: {
      targetType: "ORDER",
      targetId: "bulk",
      action: "ORDER_EXPORT"
    }
  });
  expect(exportAuditCount).toBeGreaterThanOrEqual(1);

  const bulkAuditCount = await prisma.adminAction.count({
    where: {
      targetType: "ORDER",
      targetId: "bulk",
      action: "ORDER_STATUS_CHANGE_BULK"
    }
  });
  expect(bulkAuditCount).toBeGreaterThanOrEqual(1);
});
