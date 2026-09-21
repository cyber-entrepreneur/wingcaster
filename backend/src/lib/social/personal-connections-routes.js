/**
 * AGT-CHN-003 — multiple personal channel accounts.
 *
 * Credential material is intentionally absent from every serializer. Mutations
 * are step-up gated because changing the selected publishing identity is a
 * sensitive action.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireElevated } from "../../auth.js";
import {
  findAll,
  findOne,
  insert,
  remove,
  transaction,
  update,
} from "../../db.js";
import { withAgentTenant, resolveAgentAgencyId } from "./marketplace-tenant.js";

const PLATFORMS = [
  "facebook",
  "instagram",
  "linkedin",
  "tiktok",
  "x",
  "whatsapp",
];

const listSchema = z.object({}).strict();
const createSchema = z
  .object({
    platform: z.enum(PLATFORMS),
    account_name: z.string().trim().min(1).max(120),
    handle: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^\S+$/, "Handle cannot contain spaces"),
    is_primary: z.boolean().optional(),
  })
  .strict();
const updateSchema = z
  .object({
    account_name: z.string().trim().min(1).max(120).optional(),
    handle: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^\S+$/, "Handle cannot contain spaces")
      .optional(),
    is_primary: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required",
  );

function serializeConnection(row) {
  return {
    id: row.id,
    platform: row.platform,
    account_name:
      row.account_name || row.settings?.handle || `${row.platform} account`,
    handle: row.handle || row.settings?.handle || null,
    is_primary: Boolean(row.is_primary),
    status: row.status || "connected",
    health: row.health || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || row.created_at || null,
  };
}

function compareConnections(left, right) {
  if (left.platform !== right.platform)
    return left.platform.localeCompare(right.platform);
  if (Boolean(left.is_primary) !== Boolean(right.is_primary))
    return left.is_primary ? -1 : 1;
  return String(left.account_name || "").localeCompare(
    String(right.account_name || ""),
  );
}

function sameHandle(left, right) {
  return (
    String(left || "")
      .trim()
      .toLocaleLowerCase() ===
    String(right || "")
      .trim()
      .toLocaleLowerCase()
  );
}

function route(handler) {
  return (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);
}

async function clearPrimary(agentId, platform, exceptId = null) {
  await update(
    "marketplace_connections",
    (connection) =>
      connection.agent_id === agentId &&
      connection.platform === platform &&
      connection.id !== exceptId &&
      connection.is_primary,
    (connection) => ({ ...connection, is_primary: false }),
  );
}

export async function findAgentPrimaryConnection(agentId, platform, getActiveAffiliation = null) {
  const connections = await withAgentTenant(
    agentId,
    () =>
      findAll(
        "marketplace_connections",
        (connection) =>
          connection.agent_id === agentId &&
          connection.platform === platform &&
          connection.status !== "disconnected",
      ),
    getActiveAffiliation,
  );
  return (
    connections.find((connection) => connection.is_primary) ||
    connections.sort((left, right) =>
      String(left.created_at).localeCompare(String(right.created_at)),
    )[0] ||
    null
  );
}

export function registerRoutes(app, { authMiddleware, getActiveAffiliation = null }) {
  const elevated = requireElevated();
  const tenantOpts = getActiveAffiliation || undefined;

  app.get(
    "/api/social-channels/my-connections",
    authMiddleware,
    route(async (req, res) => {
      const parsed = listSchema.safeParse(req.query);
      if (!parsed.success) {
        return res
          .status(400)
          .json({
            error: "Invalid connection filters",
            details: parsed.error.flatten(),
          });
      }
      const connections = await withAgentTenant(
        req.user.id,
        () =>
          findAll(
            "marketplace_connections",
            (connection) =>
              connection.agent_id === req.user.id &&
              connection.status !== "disconnected",
          ),
        tenantOpts,
      );
      connections.sort(compareConnections);
      res.json({ connections: connections.map(serializeConnection) });
    }),
  );

  app.post(
    "/api/social-channels/my-connections",
    authMiddleware,
    elevated,
    route(async (req, res) => {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({
            error: "Invalid connection",
            details: parsed.error.flatten(),
          });
      }
      const existing = await withAgentTenant(
        req.user.id,
        () =>
          findAll(
            "marketplace_connections",
            (connection) =>
              connection.agent_id === req.user.id &&
              connection.platform === parsed.data.platform &&
              connection.status !== "disconnected",
          ),
        tenantOpts,
      );
      if (
        existing.some((connection) =>
          sameHandle(
            connection.handle || connection.settings?.handle,
            parsed.data.handle,
          ),
        )
      ) {
        return res
          .status(409)
          .json({ error: "This account is already connected" });
      }

      const agencyId = await resolveAgentAgencyId(req.user.id, tenantOpts);
      const now = new Date().toISOString();
      const row = {
        id: randomUUID(),
        agent_id: req.user.id,
        agency_id: agencyId,
        platform: parsed.data.platform,
        account_name: parsed.data.account_name,
        handle: parsed.data.handle,
        is_primary: Boolean(
          parsed.data.is_primary ||
          !existing.some((connection) => connection.is_primary),
        ),
        status: "connected",
        health: "healthy",
        settings: { handle: parsed.data.handle },
        created_at: now,
        updated_at: now,
      };
      await withAgentTenant(req.user.id, () =>
        transaction(async () => {
          if (row.is_primary) await clearPrimary(req.user.id, row.platform);
          await insert("marketplace_connections", row);
        }),
        tenantOpts,
      );
      res.status(201).json(serializeConnection(row));
    }),
  );

  app.put(
    "/api/social-channels/my-connections/:id",
    authMiddleware,
    elevated,
    route(async (req, res) => {
      const connection = await withAgentTenant(
        req.user.id,
        () =>
          findOne(
            "marketplace_connections",
            (candidate) =>
              candidate.id === req.params.id &&
              candidate.agent_id === req.user.id &&
              candidate.status !== "disconnected",
          ),
        tenantOpts,
      );
      if (!connection)
        return res.status(404).json({ error: "Connection not found" });

      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({
            error: "Invalid connection update",
            details: parsed.error.flatten(),
          });
      }
      if (parsed.data.is_primary === false && connection.is_primary) {
        return res
          .status(400)
          .json({ error: "Set another account as primary instead" });
      }
      if (parsed.data.handle) {
        const siblings = await withAgentTenant(
          req.user.id,
          () =>
            findAll(
              "marketplace_connections",
              (candidate) =>
                candidate.agent_id === req.user.id &&
                candidate.platform === connection.platform &&
                candidate.id !== connection.id &&
                candidate.status !== "disconnected",
            ),
          tenantOpts,
        );
        if (
          siblings.some((candidate) =>
            sameHandle(
              candidate.handle || candidate.settings?.handle,
              parsed.data.handle,
            ),
          )
        ) {
          return res
            .status(409)
            .json({ error: "This account is already connected" });
        }
      }

      const updated = {
        ...connection,
        ...parsed.data,
        settings: {
          ...(connection.settings || {}),
          ...(parsed.data.handle ? { handle: parsed.data.handle } : {}),
        },
        updated_at: new Date().toISOString(),
      };
      await withAgentTenant(req.user.id, () =>
        transaction(async () => {
          if (parsed.data.is_primary) {
            await clearPrimary(req.user.id, connection.platform, connection.id);
          }
          await update(
            "marketplace_connections",
            (candidate) =>
              candidate.id === connection.id &&
              candidate.agent_id === req.user.id,
            () => updated,
          );
        }),
        tenantOpts,
      );
      res.json(serializeConnection(updated));
    }),
  );

  app.delete(
    "/api/social-channels/my-connections/:id",
    authMiddleware,
    elevated,
    route(async (req, res) => {
      const connection = await withAgentTenant(
        req.user.id,
        () =>
          findOne(
            "marketplace_connections",
            (candidate) =>
              candidate.id === req.params.id &&
              candidate.agent_id === req.user.id &&
              candidate.status !== "disconnected",
          ),
        tenantOpts,
      );
      if (!connection)
        return res.status(404).json({ error: "Connection not found" });

      let promoted = null;
      await withAgentTenant(req.user.id, () =>
        transaction(async () => {
          await remove(
            "marketplace_connections",
            (candidate) =>
              candidate.id === connection.id &&
              candidate.agent_id === req.user.id,
          );
          if (connection.is_primary) {
            const remaining = await findAll(
              "marketplace_connections",
              (candidate) =>
                candidate.agent_id === req.user.id &&
                candidate.platform === connection.platform &&
                candidate.id !== connection.id &&
                candidate.status !== "disconnected",
            );
            remaining.sort((left, right) =>
              String(left.created_at).localeCompare(String(right.created_at)),
            );
            promoted = remaining[0] || null;
            if (promoted) {
              await update(
                "marketplace_connections",
                (candidate) =>
                  candidate.id === promoted.id &&
                  candidate.agent_id === req.user.id,
                (candidate) => ({
                  ...candidate,
                  is_primary: true,
                  updated_at: new Date().toISOString(),
                }),
              );
            }
          }
        }),
        tenantOpts,
      );
      res.json({ success: true, new_primary_id: promoted?.id || null });
    }),
  );
}
