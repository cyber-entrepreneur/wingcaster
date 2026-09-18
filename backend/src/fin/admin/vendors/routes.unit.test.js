import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getVendorAdmin: vi.fn(),
  getVendorMarginAdmin: vi.fn(),
  getVendorStatementAdmin: vi.fn(),
  listVendorRatesAdmin: vi.fn(),
  listVendorStatementsAdmin: vi.fn(),
  listVendorsAdmin: vi.fn(),
}));

vi.mock("../../../db.js", () => ({
  transaction: async (work) => work({}),
}));

vi.mock("./reads.js", () => mocks);

vi.mock("./writes.js", () => ({
  applyVendorRate: vi.fn(),
  deprecateVendorRate: vi.fn(),
  reconcileVendorStatement: vi.fn(),
}));

import { registerFinVendorAdminRoutes } from "./routes.js";

const VENDOR_ID = "00000000-0000-0000-0000-000000000123";

function makeApp() {
  const app = express();
  app.use(express.json());
  const authenticate = (req, _res, next) => {
    req.user = {
      id: "admin-1",
      platform_role: req.get("X-Test-Role") || "platform_admin",
      fin_environment: req.get("X-Wingcaster-Env") || "LIVE",
    };
    req.fin = { now: "2026-09-18T12:00:00Z" };
    next();
  };
  const authorize = (req, res, next) => {
    if (req.user.platform_role !== "platform_admin") {
      return res.status(403).json({ code: "PLATFORM_ADMIN_REQUIRED" });
    }
    next();
  };
  registerFinVendorAdminRoutes(app, {
    readGuards: [authenticate, authorize],
    writeGuards: [authenticate, authorize],
  });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getVendorAdmin.mockResolvedValue({
    id: VENDOR_ID,
    name: "OpenAI",
    environment: "LIVE",
    products: [],
    rate_schedule: [],
  });
  mocks.listVendorRatesAdmin.mockResolvedValue({ rates: [] });
  mocks.listVendorStatementsAdmin.mockResolvedValue({ statements: [] });
  mocks.getVendorMarginAdmin.mockResolvedValue({
    vendor_id: VENDOR_ID,
    features: [],
  });
});

describe("PA-VEN-002 vendor detail routes", () => {
  it("returns an environment-scoped vendor detail", async () => {
    const res = await request(makeApp()).get(
      `/api/admin/fin/vendors/${VENDOR_ID}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("OpenAI");
    expect(mocks.getVendorAdmin).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ environment: "LIVE", id: VENDOR_ID }),
    );
  });

  it("strictly validates vendor ids before persistence access", async () => {
    const res = await request(makeApp()).get(
      "/api/admin/fin/vendors/not-a-uuid/rates",
    );

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_VENDOR_ID");
    expect(mocks.listVendorRatesAdmin).not.toHaveBeenCalled();
  });

  it("returns leak-safe 404 for a vendor outside the selected environment", async () => {
    mocks.getVendorAdmin.mockResolvedValueOnce(null);
    const res = await request(makeApp())
      .get(`/api/admin/fin/vendors/${VENDOR_ID}`)
      .set("X-Wingcaster-Env", "TEST");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ code: "NOT_FOUND" });
    expect(mocks.getVendorAdmin).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ environment: "TEST", id: VENDOR_ID }),
    );
  });

  it("requires platform-admin authorization", async () => {
    const res = await request(makeApp())
      .get(`/api/admin/fin/vendors/${VENDOR_ID}`)
      .set("X-Test-Role", "agent");

    expect(res.status).toBe(403);
    expect(mocks.getVendorAdmin).not.toHaveBeenCalled();
  });
});
