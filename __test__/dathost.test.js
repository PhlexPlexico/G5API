/**
 * Unit tests for DatHost service (isDathostConfigured, releaseManagedServer with null).
 * Does not require app or database.
 */
import { isDathostConfigured, releaseManagedServer } from "../src/services/dathost.js";

describe("DatHost service", () => {
  it("isDathostConfigured returns false when user dathost is not configured", async () => {
    await expect(isDathostConfigured(1)).resolves.toBe(false);
  });

  it("releaseManagedServer(null) resolves without throwing", async () => {
    await expect(releaseManagedServer(null)).resolves.toBeUndefined();
  });

  it("releaseManagedServer(undefined) resolves without throwing", async () => {
    await expect(releaseManagedServer(undefined)).resolves.toBeUndefined();
  });
});
