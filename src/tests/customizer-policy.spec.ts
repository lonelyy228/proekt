import { describe, expect, it } from "vitest";
import { CUSTOMIZER_BASE_BRANDS, isCustomizerBaseBrand } from "@/config/customizer";

describe("customizer brand policy", () => {
  it("allows customization only for configured base brands", () => {
    expect(CUSTOMIZER_BASE_BRANDS).toContain("RSH BASICS");
    expect(isCustomizerBaseBrand("RSH BASICS")).toBe(true);
  });

  it("normalizes case and whitespace", () => {
    expect(isCustomizerBaseBrand("  rsh    basics  ")).toBe(true);
  });

  it("blocks branded catalog labels", () => {
    expect(isCustomizerBaseBrand("NIKE")).toBe(false);
    expect(isCustomizerBaseBrand("ADIDAS")).toBe(false);
  });
});
