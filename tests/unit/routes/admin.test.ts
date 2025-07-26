import { describe, expect, it } from "bun:test";

// Simple unit tests for admin routes without complex mocking
describe("Admin Routes", () => {
  it("should export admin route module", async () => {
    // Dynamic import to test module existence
    const adminModule = await import("../../../src/routes/admin");
    expect(adminModule).toBeDefined();
    expect(adminModule.default).toBeDefined();
  });

  it("should be a valid Hono app instance", async () => {
    const adminModule = await import("../../../src/routes/admin");
    const adminRoute = adminModule.default;

    // Check if it has basic Hono app properties
    expect(typeof adminRoute).toBe("object");
    expect(typeof adminRoute.request).toBe("function");
  });

  it("should handle basic route structure", async () => {
    const adminModule = await import("../../../src/routes/admin");

    // Test that the module loads without errors
    expect(adminModule.default).toBeTruthy();
  });
});
