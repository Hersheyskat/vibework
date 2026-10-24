import { afterEach, describe, expect, it, vi } from "vitest";
import { isAdminEmail, testerBypassEnabled } from "./access";

describe("admin access", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows listed emails", () => {
    vi.stubEnv("VIBEWORK_ADMIN_EMAILS", "hersh@example.com, Other@Ex.com");
    vi.stubEnv("VIBEWORK_TESTER", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(isAdminEmail("hersh@example.com")).toBe(true);
    expect(isAdminEmail("other@ex.com")).toBe(true);
    expect(isAdminEmail("random@ex.com")).toBe(false);
  });

  it("blocks tester bypass in production", () => {
    vi.stubEnv("VIBEWORK_TESTER", "1");
    vi.stubEnv("VIBEWORK_ADMIN_EMAILS", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(testerBypassEnabled()).toBe(false);
    expect(isAdminEmail("anyone@ex.com")).toBe(false);
  });

  it("allows tester bypass only in non-production", () => {
    vi.stubEnv("VIBEWORK_TESTER", "1");
    vi.stubEnv("VIBEWORK_ADMIN_EMAILS", "");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "development");
    expect(testerBypassEnabled()).toBe(true);
    expect(isAdminEmail("anyone@ex.com")).toBe(true);
  });
});
