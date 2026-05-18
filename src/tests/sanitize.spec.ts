import { describe, expect, it } from "vitest";
import { sanitizeText } from "../server/utils/sanitize";

describe("sanitizeText", () => {
  it("removes html tags and normalizes whitespace", () => {
    const value = sanitizeText("  <script>alert(1)</script>Hello   world  ");
    expect(value).toBe("alert(1)Hello world");
  });
});
