/**
 * AGT-LST-014 — agent transparency into a multi-agency canonical property.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { findAll, findOne, insert } from "../../db.js";
import { assertOwnsProperty } from "../authz.js";

const disputeSchema = z
  .object({
    mandate_type: z.literal("exclusive"),
    mandate_reference: z.string().trim().min(3).max(160),
    evidence_notes: z.string().trim().min(10).max(3000),
  })
  .strict();

function route(handler) {
  return (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);
}

function isNotFound(error) {
  return error?.status === 404 || error?.name === "NotFoundError";
}

function serializeDispute(row) {
  if (!row) return null;
  return {
    id: row.id,
    canonical_id: row.canonical_id,
    listing_id: row.listing_id,
    mandate_type: row.mandate_type,
    mandate_reference: row.mandate_reference,
    evidence_notes: row.evidence_notes || null,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
  };
}

function serializeSibling(
  row,
  { primaryListingId, callerListingId, agencies, agents },
) {
  return {
    id: row.id,
    title: row.title || "Untitled listing",
    price: row.price == null ? null : Number(row.price),
    currency: row.price_unit || "USD",
    status: row.status || "active",
    agency: row.agency_id
      ? {
          id: row.agency_id,
          name:
            agencies.get(row.agency_id)?.name || row.agency_name || "Agency",
        }
      : null,
    agent: {
      id: row.agent_id,
      name:
        agents.get(row.agent_id)?.name || row.agent_name || "Independent agent",
    },
    listed_at: row.listed_date || row.created_at || null,
    updated_at: row.updated_at || row.created_at || null,
    is_primary: row.id === primaryListingId,
    is_mine: row.id === callerListingId,
  };
}

async function loadCanonicalView({ listing, agentId }) {
  const canonicalId = listing.canonical_id;
  if (!canonicalId) return null;

  const siblings = await findAll(
    "properties",
    (property) =>
      property.canonical_id === canonicalId &&
      property.status !== "deleted" &&
      !property.ungroup_override,
  );
  if (siblings.length < 2) return null;

  const canonical = await findOne(
    "canonical_properties",
    (row) => row.id === canonicalId,
  );
  const primaryListingId = canonical?.primary_listing_id || siblings[0].id;
  const agencyIds = new Set(
    siblings.map((row) => row.agency_id).filter(Boolean),
  );
  const agentIds = new Set(siblings.map((row) => row.agent_id).filter(Boolean));
  const [agencyRows, agentRows, disputes] = await Promise.all([
    findAll("agencies", (row) => agencyIds.has(row.id)),
    findAll("agents", (row) => agentIds.has(row.id)),
    findAll(
      "canonical_primary_disputes",
      (row) =>
        row.canonical_id === canonicalId &&
        row.requester_agent_id === agentId &&
        row.status === "pending",
    ),
  ]);
  const agencies = new Map(agencyRows.map((row) => [row.id, row]));
  const agents = new Map(agentRows.map((row) => [row.id, row]));
  const dispute =
    disputes.sort((left, right) =>
      String(right.created_at).localeCompare(String(left.created_at)),
    )[0] || null;
  const state =
    listing.id === primaryListingId
      ? "primary"
      : dispute
        ? "disputed"
        : "secondary";

  return {
    canonical: {
      id: canonicalId,
      location: canonical?.location || listing.location || null,
      city: canonical?.city || listing.city || null,
      neighborhood: canonical?.neighborhood || listing.neighborhood || null,
      primary_listing_id: primaryListingId,
      sibling_count: siblings.length,
    },
    state,
    can_contest: state === "secondary",
    dispute: serializeDispute(dispute),
    listings: siblings
      .map((row) =>
        serializeSibling(row, {
          primaryListingId,
          callerListingId: listing.id,
          agencies,
          agents,
        }),
      )
      .sort((left, right) => {
        if (left.is_primary !== right.is_primary)
          return left.is_primary ? -1 : 1;
        if (left.is_mine !== right.is_mine) return left.is_mine ? -1 : 1;
        return String(right.updated_at).localeCompare(String(left.updated_at));
      }),
  };
}

export function registerRoutes(app, { authMiddleware }) {
  app.get(
    "/api/properties/:id/canonical",
    authMiddleware,
    route(async (req, res) => {
      let listing;
      try {
        listing = await assertOwnsProperty(req.user.id, req.params.id);
      } catch (error) {
        if (isNotFound(error)) {
          return res.status(404).json({ error: "Listing not found" });
        }
        throw error;
      }
      res.json({
        canonical_view: await loadCanonicalView({
          listing,
          agentId: req.user.id,
        }),
      });
    }),
  );

  app.post(
    "/api/properties/:id/canonical/disputes",
    authMiddleware,
    route(async (req, res) => {
      let listing;
      try {
        listing = await assertOwnsProperty(req.user.id, req.params.id);
      } catch (error) {
        if (isNotFound(error)) {
          return res.status(404).json({ error: "Listing not found" });
        }
        throw error;
      }

      const parsed = disputeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid primary dispute",
          details: parsed.error.flatten(),
        });
      }
      const canonicalView = await loadCanonicalView({
        listing,
        agentId: req.user.id,
      });
      if (!canonicalView) {
        return res
          .status(400)
          .json({ error: "This listing has no canonical siblings" });
      }
      if (canonicalView.state === "primary") {
        return res
          .status(409)
          .json({ error: "This listing is already the canonical primary" });
      }
      if (canonicalView.dispute) {
        return res.status(409).json({
          error: "A primary dispute is already pending",
          dispute: canonicalView.dispute,
        });
      }

      const now = new Date().toISOString();
      const row = {
        id: randomUUID(),
        canonical_id: canonicalView.canonical.id,
        listing_id: listing.id,
        requester_agent_id: req.user.id,
        requester_agency_id: listing.agency_id || null,
        mandate_type: parsed.data.mandate_type,
        mandate_reference: parsed.data.mandate_reference,
        evidence_notes: parsed.data.evidence_notes,
        status: "pending",
        created_at: now,
        updated_at: now,
      };
      await insert("canonical_primary_disputes", row);
      res.status(201).json({ dispute: serializeDispute(row) });
    }),
  );
}
