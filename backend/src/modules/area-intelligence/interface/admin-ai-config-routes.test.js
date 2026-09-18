import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  aiSynthesis: vi.fn(),
}));

vi.mock("../../../auth.js", () => ({
  authMiddleware: (req, _res, next) => {
    req.user = {
      id: "admin-1",
      platform_role: req.get("X-Test-Role") || "platform_admin",
    };
    next();
  },
  requireElevated: () => (req, res, next) => {
    if (req.get("X-Elevated-Token") !== "valid") {
      return res.status(401).json({ code: "STEP_UP_REQUIRED" });
    }
    next();
  },
}));

vi.mock("../../../lib/auth-guards.js", () => ({
  requirePlatformAdmin: (req, res, next) => {
    if (req.user?.platform_role !== "platform_admin") {
      return res.status(403).json({ code: "PLATFORM_ADMIN_REQUIRED" });
    }
    next();
  },
}));

vi.mock("../domain/scoring/ai-synthesis.js", () => ({
  aiSynthesis: mocks.aiSynthesis,
}));

import { registerAdminRoutes } from "./admin-routes.js";

function unusedService() {
  return {
    list: vi.fn(async () => ({ items: [] })),
    getById: vi.fn(async () => null),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    listForArea: vi.fn(async () => []),
    listSubmissions: vi.fn(async () => []),
    verify: vi.fn(),
    reject: vi.fn(),
    manualOverride: vi.fn(),
    calculateForArea: vi.fn(async () => []),
    listUsage: vi.fn(async () => []),
    getMonthlySpend: vi.fn(async () => 0),
  };
}

function makeApp(overrides = {}) {
  const aiConfigService = {
    ...unusedService(),
    list: vi.fn(async () => []),
    getById: vi.fn(async (id) =>
      id === "cfg-1"
        ? {
            id,
            name: "Area quality synthesis",
            provider: "gemini",
            model: "gemini-1.5-flash",
            version: 3,
          }
        : null,
    ),
    listVersions: vi.fn(async () => []),
    create: vi.fn(async (body) => ({ id: "cfg-new", ...body, version: 1 })),
    update: vi.fn(async (id, body) => ({ id, ...body, version: 4 })),
    ...overrides.aiConfigService,
  };
  const areaService = {
    ...unusedService(),
    getById: vi.fn(async (id) =>
      id === "area-1" ? { id, name: "Dubai Marina" } : null,
    ),
  };
  const dimensionService = {
    ...unusedService(),
    getById: vi.fn(async (id) =>
      id === "dimension-1"
        ? {
            id,
            name: "Walkability",
            slug: "walkability",
          }
        : null,
    ),
  };
  const signalService = {
    ...unusedService(),
    list: vi.fn(async () => ({
      items: [{ id: "signal-1", signal_type: "transit" }],
    })),
  };
  const app = express();
  app.use(express.json());
  registerAdminRoutes(app, {
    areaService,
    dimensionService,
    sourceTypeService: unusedService(),
    sourceService: unusedService(),
    signalService,
    scoreService: unusedService(),
    aiConfigService,
    googleService: unusedService(),
    inspectorService: unusedService(),
    googleRefreshWorker: { refreshOneArea: vi.fn() },
    config: {},
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  });
  return { app, aiConfigService };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.aiSynthesis.mockResolvedValue({
    score: 8.4,
    confidence: 0.92,
    rationale: "Strong transit and amenity coverage.",
  });
});

describe("PA-SCR-002 AI config routes", () => {
  it("creates a strictly validated, versioned config with elevation", async () => {
    const { app, aiConfigService } = makeApp();
    const body = {
      name: "Area quality synthesis",
      description: "Scores verified signals.",
      provider: "gemini",
      model: "gemini-1.5-flash",
      temperature: 0.3,
      max_tokens: 2048,
      system_prompt: "You are a careful location intelligence analyst.",
      scoring_prompt_template:
        "Analyze the supplied area signals and return a structured score.",
      output_schema: {},
      is_active: true,
    };

    const res = await request(app)
      .post("/api/admin/scoring/ai-configs")
      .set("X-Elevated-Token", "valid")
      .send(body);

    expect(res.status).toBe(201);
    expect(res.body.version).toBe(1);
    expect(aiConfigService.create).toHaveBeenCalledWith(body, "admin-1");
  });

  it("rejects unknown fields and missing elevation", async () => {
    const { app, aiConfigService } = makeApp();
    const noElevation = await request(app)
      .put("/api/admin/scoring/ai-configs/cfg-1")
      .send({ model: "gemini-2.5-flash" });
    expect(noElevation.status).toBe(401);

    const invalid = await request(app)
      .put("/api/admin/scoring/ai-configs/cfg-1")
      .set("X-Elevated-Token", "valid")
      .send({ model: "gemini-2.5-flash", unexpected: true });
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe("VALIDATION_ERROR");
    expect(aiConfigService.update).not.toHaveBeenCalled();
  });

  it("runs a metered preview for an owned config and sample area", async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post("/api/admin/scoring/ai-configs/cfg-1/preview")
      .set("X-Elevated-Token", "valid")
      .send({ area_id: "area-1", dimension_id: "dimension-1" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      config_id: "cfg-1",
      config_version: 3,
      result: { score: 8.4, confidence: 0.92 },
    });
    expect(mocks.aiSynthesis).toHaveBeenCalledOnce();
  });

  it("returns leak-safe 404 and enforces platform-admin authorization", async () => {
    const { app } = makeApp();
    const missing = await request(app)
      .post("/api/admin/scoring/ai-configs/missing/preview")
      .set("X-Elevated-Token", "valid")
      .send({ area_id: "area-1", dimension_id: "dimension-1" });
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe("PREVIEW_INPUT_NOT_FOUND");

    const forbidden = await request(app)
      .get("/api/admin/scoring/ai-configs")
      .set("X-Test-Role", "agent");
    expect(forbidden.status).toBe(403);
  });
});
