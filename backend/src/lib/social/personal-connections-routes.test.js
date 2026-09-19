import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  findAll: vi.fn(),
  findOne: vi.fn(),
  insert: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(async (work) => work()),
}));

vi.mock("../../db.js", () => db);
vi.mock("../../auth.js", () => ({
  requireElevated: () => (req, res, next) => {
    if (req.get("x-test-elevated") === "yes") return next();
    return res.status(401).json({ code: "step_up_required" });
  },
}));

import {
  findAgentPrimaryConnection,
  registerRoutes,
} from "./personal-connections-routes.js";

function createApp() {
  const app = express();
  app.use(express.json());
  registerRoutes(app, {
    authMiddleware: (req, _res, next) => {
      req.user = { id: "agent-1" };
      next();
    },
  });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  db.findAll.mockResolvedValue([]);
  db.findOne.mockResolvedValue(null);
  db.insert.mockResolvedValue(undefined);
  db.remove.mockResolvedValue(1);
  db.update.mockResolvedValue(1);
  db.transaction.mockImplementation(async (work) => work());
});

describe("personal channel account routes", () => {
  it("lists only the authenticated agent accounts and never returns credentials", async () => {
    const rows = [
      {
        id: "mine-2",
        agent_id: "agent-1",
        platform: "instagram",
        account_name: "Personal",
        handle: "@personal",
        status: "connected",
        is_primary: false,
        credentials: { access_token: "never-return" },
      },
      {
        id: "mine-1",
        agent_id: "agent-1",
        platform: "instagram",
        account_name: "Business",
        handle: "@business",
        status: "connected",
        is_primary: true,
        settings: { credentials: { access_token_encrypted: "ciphertext" } },
      },
      {
        id: "theirs",
        agent_id: "agent-2",
        platform: "instagram",
        account_name: "Other",
        status: "connected",
      },
    ];
    db.findAll.mockImplementation(async (_collection, predicate) =>
      rows.filter(predicate),
    );

    const response = await request(createApp()).get(
      "/api/social-channels/my-connections",
    );

    expect(response.status).toBe(200);
    expect(
      response.body.connections.map((connection) => connection.id),
    ).toEqual(["mine-1", "mine-2"]);
    expect(JSON.stringify(response.body)).not.toContain("never-return");
    expect(JSON.stringify(response.body)).not.toContain("ciphertext");
  });

  it("rejects unknown list filters through a strict schema", async () => {
    const response = await request(createApp()).get(
      "/api/social-channels/my-connections?agent_id=agent-2",
    );

    expect(response.status).toBe(400);
    expect(db.findAll).not.toHaveBeenCalled();
  });

  it("requires step-up for every mutation", async () => {
    const response = await request(createApp())
      .post("/api/social-channels/my-connections")
      .send({
        platform: "instagram",
        account_name: "Personal",
        handle: "@personal",
      });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("step_up_required");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("creates the first account as primary and validates strict input", async () => {
    const app = createApp();
    const invalid = await request(app)
      .post("/api/social-channels/my-connections")
      .set("x-test-elevated", "yes")
      .send({
        platform: "instagram",
        account_name: "Personal",
        handle: "@personal",
        credentials: "not-allowed",
      });
    expect(invalid.status).toBe(400);

    const response = await request(app)
      .post("/api/social-channels/my-connections")
      .set("x-test-elevated", "yes")
      .send({
        platform: "instagram",
        account_name: "Personal",
        handle: "@personal",
      });

    expect(response.status).toBe(201);
    expect(response.body.is_primary).toBe(true);
    expect(db.insert).toHaveBeenCalledWith(
      "marketplace_connections",
      expect.objectContaining({
        agent_id: "agent-1",
        platform: "instagram",
        handle: "@personal",
        is_primary: true,
      }),
    );
  });

  it("rejects a duplicate handle on the same platform", async () => {
    db.findAll.mockResolvedValue([
      {
        id: "existing",
        handle: "@personal",
        platform: "instagram",
        status: "connected",
      },
    ]);

    const response = await request(createApp())
      .post("/api/social-channels/my-connections")
      .set("x-test-elevated", "yes")
      .send({
        platform: "instagram",
        account_name: "Duplicate",
        handle: "@PERSONAL",
      });

    expect(response.status).toBe(409);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("sets a primary account and returns 404 for another agent account", async () => {
    db.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "account-2",
      agent_id: "agent-1",
      platform: "instagram",
      account_name: "Personal",
      handle: "@personal",
      status: "connected",
      is_primary: false,
    });

    const denied = await request(createApp())
      .put("/api/social-channels/my-connections/theirs")
      .set("x-test-elevated", "yes")
      .send({ is_primary: true });
    expect(denied.status).toBe(404);

    const response = await request(createApp())
      .put("/api/social-channels/my-connections/account-2")
      .set("x-test-elevated", "yes")
      .send({ is_primary: true });

    expect(response.status).toBe(200);
    expect(response.body.is_primary).toBe(true);
    expect(db.update).toHaveBeenCalledTimes(2);
  });

  it("promotes the oldest sibling when the primary account is removed", async () => {
    db.findOne.mockResolvedValue({
      id: "primary",
      agent_id: "agent-1",
      platform: "instagram",
      status: "connected",
      is_primary: true,
    });
    db.findAll.mockResolvedValue([
      {
        id: "next",
        agent_id: "agent-1",
        platform: "instagram",
        status: "connected",
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);

    const response = await request(createApp())
      .delete("/api/social-channels/my-connections/primary")
      .set("x-test-elevated", "yes");

    expect(response.status).toBe(200);
    expect(response.body.new_primary_id).toBe("next");
    expect(db.remove).toHaveBeenCalled();
    expect(db.update).toHaveBeenCalled();
  });
});

describe("findAgentPrimaryConnection", () => {
  it("selects the explicit primary and falls back to the oldest connected account", async () => {
    const rows = [
      {
        id: "new",
        agent_id: "agent-1",
        platform: "x",
        status: "connected",
        created_at: "2026-02-01",
      },
      {
        id: "old",
        agent_id: "agent-1",
        platform: "x",
        status: "connected",
        created_at: "2026-01-01",
      },
    ];
    db.findAll.mockImplementation(async (_collection, predicate) =>
      rows.filter(predicate),
    );
    expect((await findAgentPrimaryConnection("agent-1", "x")).id).toBe("old");

    rows[0].is_primary = true;
    expect((await findAgentPrimaryConnection("agent-1", "x")).id).toBe("new");
  });
});
