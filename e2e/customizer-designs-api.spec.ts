import { expect, test, type APIRequestContext } from "@playwright/test";

type LoginResult = { csrfToken: string };

const loginByApi = async (
  request: APIRequestContext,
  creds: { email: string; password: string }
): Promise<LoginResult> => {
  const response = await request.post("/api/auth/login", {
    data: creds
  });

  expect(response.ok()).toBeTruthy();

  const payload = (await response.json()) as {
    success: boolean;
    data: { csrfToken: string };
  };

  expect(payload.success).toBeTruthy();
  return { csrfToken: payload.data.csrfToken };
};

test("customizer designs API validates trusted URLs and persists valid designs", async ({ request }) => {
  const login = await loginByApi(request, {
    email: "admin@example.com",
    password: "ChangeMe123!"
  });

  const invalidPreviewResponse = await request.post("/api/designs", {
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": login.csrfToken
    },
    data: {
      garmentType: "TSHIRT",
      garmentColor: "#111111",
      canvasJson: {
        version: "6.0.0",
        objects: []
      },
      previewUrl: "https://example.com/preview.webp",
      previewWidth: 900,
      previewHeight: 900
    }
  });

  expect(invalidPreviewResponse.status()).toBe(422);

  const invalidObjectSrcResponse = await request.post("/api/designs", {
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": login.csrfToken
    },
    data: {
      garmentType: "HOODIE",
      garmentColor: "#222222",
      canvasJson: {
        version: "6.0.0",
        objects: [
          {
            type: "image",
            left: 220,
            top: 260,
            width: 300,
            height: 300,
            scaleX: 1,
            scaleY: 1,
            angle: 0,
            src: "https://example.com/image.webp"
          }
        ]
      },
      previewUrl: "https://utfs.io/f/rsh-preview.webp",
      previewWidth: 900,
      previewHeight: 900
    }
  });

  expect(invalidObjectSrcResponse.status()).toBe(422);

  const validCreateResponse = await request.post("/api/designs", {
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": login.csrfToken
    },
    data: {
      garmentType: "SWEATSHIRT",
      garmentColor: "#333333",
      canvasJson: {
        version: "6.0.0",
        objects: [
          {
            type: "textbox",
            left: 260,
            top: 280,
            width: 260,
            height: 80,
            scaleX: 1,
            scaleY: 1,
            angle: 0,
            text: "RSH"
          },
          {
            type: "image",
            left: 320,
            top: 360,
            width: 300,
            height: 300,
            scaleX: 0.5,
            scaleY: 0.5,
            angle: 0,
            src: "https://utfs.io/f/rsh-asset.webp"
          }
        ]
      },
      previewUrl: "https://utfs.io/f/rsh-preview.webp",
      previewWidth: 1024,
      previewHeight: 1024
    }
  });

  expect(validCreateResponse.ok()).toBeTruthy();
  const createdPayload = (await validCreateResponse.json()) as {
    success: boolean;
    data: {
      id: string;
      previewUrl: string;
      garmentType: string;
    };
  };

  expect(createdPayload.success).toBeTruthy();
  expect(createdPayload.data.garmentType).toBe("SWEATSHIRT");
  expect(createdPayload.data.previewUrl).toContain("utfs.io");

  const listResponse = await request.get("/api/designs");
  expect(listResponse.ok()).toBeTruthy();

  const listPayload = (await listResponse.json()) as {
    success: boolean;
    data: Array<{ id: string }>;
  };

  expect(listPayload.success).toBeTruthy();
  expect(listPayload.data.some((item) => item.id === createdPayload.data.id)).toBeTruthy();
});
