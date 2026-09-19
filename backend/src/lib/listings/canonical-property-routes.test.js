import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  findAll: vi.fn(),
  findOne: vi.fn(),
  insert: vi.fn(),
}));
const authz = vi.hoisted(() => ({
  assertOwnsProperty: vi.fn(),
  NotFoundError: class NotFoundError extends Error {
    constructor() {
      super("not found");
      this.name = "NotFoundError";
      this.status = 404;
    }
  },
}));

vi.mock("../../db.js", () => db);
vi.mock("../authz.js", () => authz);

import { registerRoutes } from "./canonical-property-routes.js";

const MINE = {
  id: "listing-mine",
  agent_id: "agent-1",
  agency_id: "agency-1",
  canonical_id: "canonical-1",
  title: "Marina residence",
  price: 2100000,
  price_unit: "AED",
  status: "active",
  updated_at: "2026-09-18T10:00:00Z",
};
const PRIMARY = {
  id: "listing-primary",
  agent_id: "agent-2",
  agency_id: "agency-2",
  canonical_id: "canonical-1",
  title: "Marina home",
  price: "2050000",
  price_unit: "AED",
  status: "active",
  updated_at: "2026-09-17T10:00:00Z",
};

function createApp() {
  const app = express();
  app.use(express.json());
  registerRoutes(app, {
    authMiddleware: (req, _res, next) => {
      req.user = { id: "agent-1" };
      next();
    },
  });
  app.use((error, _req, res, _next) => {
    res.status(500).json({ error: error.message });
  });
  return app;
}

function mockCanonicalData({
  mine = MINE,
  siblings = [MINE, PRIMARY],
  primaryListingId = "listing-primary",
  disputes = [],
} = {}) {
  authz.assertOwnsProperty.mockResolvedValue(mine);
  db.findOne.mockImplementation(async (collection, predicate) => {
    if (collection === "canonical_properties") {
      const rows = [
        {
          id: "canonical-1",
          primary_listing_id: primaryListingId,
          location: "Dubai Marina",
          city: "Dubai",
          neighborhood: "Marina",
        },
      ];
      return rows.find(predicate) || null;
    }
    return null;
  });
  db.findAll.mockImplementation(async (collection, predicate) => {
    const rowsByCollection = {
      properties: siblings,
      agencies: [
        { id: "agency-1", name: "Harbour Realty" },
        { id: "agency-2", name: "Marina Partners" },
      ],
      agents: [
        { id: "agent-1", name: "Amina Agent" },
        { id: "agent-2", name: "Omar Agent" },
      ],
      canonical_primary_disputes: disputes,
    };
    return (rowsByCollection[collection] || []).filter(predicate);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  db.insert.mockResolvedValue(undefined);
  mockCanonicalData();
});

describe("GET /api/properties/:id/canonical", () => {
  it("returns sibling listings, agency labels, primary state, and numeric prices", async () => {
    const response = await request(createApp()).get(
      "/api/properties/listing-mine/canonical",
    );

    expect(response.status).toBe(200);
    expect(response.body.canonical_view.state).toBe("secondary");
    expect(response.body.canonical_view.can_contest).toBe(true);
    expect(response.body.canonical_view.canonical.sibling_count).toBe(2);
    expect(response.body.canonical_view.listings[0]).toMatchObject({
      id: "listing-primary",
      price: 2050000,
      is_primary: true,
      agency: { id: "agency-2", name: "Marina Partners" },
    });
    expect(response.body.canonical_view.listings[1].is_mine).toBe(true);
  });

  it("returns the I-am-primary state without a contest action", async () => {
    mockCanonicalData({ primaryListingId: "listing-mine" });

    const response = await request(createApp()).get(
      "/api/properties/listing-mine/canonical",
    );

    expect(response.status).toBe(200);
    expect(response.body.canonical_view.state).toBe("primary");
    expect(response.body.canonical_view.can_contest).toBe(false);
  });

  it("returns the disputed state and pending request", async () => {
    mockCanonicalData({
      disputes: [
        {
          id: "dispute-1",
          canonical_id: "canonical-1",
          listing_id: "listing-mine",
          requester_agent_id: "agent-1",
          mandate_type: "exclusive",
          mandate_reference: "EX-2026-18",
          evidence_notes: "Signed exclusive mandate is on file.",
          status: "pending",
          created_at: "2026-09-18T11:00:00Z",
        },
      ],
    });

    const response = await request(createApp()).get(
      "/api/properties/listing-mine/canonical",
    );

    expect(response.body.canonical_view.state).toBe("disputed");
    expect(response.body.canonical_view.can_contest).toBe(false);
    expect(response.body.canonical_view.dispute.id).toBe("dispute-1");
  });

  it("returns a null view when there are no other canonical siblings", async () => {
    mockCanonicalData({ siblings: [MINE] });

    const response = await request(createApp()).get(
      "/api/properties/listing-mine/canonical",
    );

    expect(response.status).toBe(200);
    expect(response.body.canonical_view).toBeNull();
  });

  it("returns a leak-safe 404 when the caller cannot access the listing", async () => {
    authz.assertOwnsProperty.mockRejectedValue(new authz.NotFoundError());

    const response = await request(createApp()).get(
      "/api/properties/private/canonical",
    );

    expect(response.status).toBe(404);
    expect(db.findAll).not.toHaveBeenCalled();
  });
});

describe("POST /api/properties/:id/canonical/disputes", () => {
  const validBody = {
    mandate_type: "exclusive",
    mandate_reference: "EX-2026-18",
    evidence_notes:
      "Signed exclusive mandate is on file and available for review.",
  };

  it("creates a pending primary-mandate dispute", async () => {
    const response = await request(createApp())
      .post("/api/properties/listing-mine/canonical/disputes")
      .send(validBody);

    expect(response.status).toBe(201);
    expect(response.body.dispute).toMatchObject({
      canonical_id: "canonical-1",
      listing_id: "listing-mine",
      status: "pending",
      mandate_reference: "EX-2026-18",
    });
    expect(db.insert).toHaveBeenCalledWith(
      "canonical_primary_disputes",
      expect.objectContaining({
        requester_agent_id: "agent-1",
        requester_agency_id: "agency-1",
      }),
    );
  });

  it("rejects invalid and unknown fields through the strict schema", async () => {
    const response = await request(createApp())
      .post("/api/properties/listing-mine/canonical/disputes")
      .send({
        ...validBody,
        mandate_reference: "x",
        primary_listing_id: "listing-mine",
      });

    expect(response.status).toBe(400);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("rejects a dispute from the current primary listing", async () => {
    mockCanonicalData({ primaryListingId: "listing-mine" });

    const response = await request(createApp())
      .post("/api/properties/listing-mine/canonical/disputes")
      .send(validBody);

    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/already the canonical primary/i);
  });

  it("does not create a second pending dispute", async () => {
    mockCanonicalData({
      disputes: [
        {
          id: "dispute-1",
          canonical_id: "canonical-1",
          listing_id: "listing-mine",
          requester_agent_id: "agent-1",
          mandate_type: "exclusive",
          mandate_reference: "EX-OLD",
          evidence_notes: "Existing evidence already submitted.",
          status: "pending",
          created_at: "2026-09-18T11:00:00Z",
        },
      ],
    });

    const response = await request(createApp())
      .post("/api/properties/listing-mine/canonical/disputes")
      .send(validBody);

    expect(response.status).toBe(409);
    expect(response.body.dispute.id).toBe("dispute-1");
    expect(db.insert).not.toHaveBeenCalled();
  });
});
