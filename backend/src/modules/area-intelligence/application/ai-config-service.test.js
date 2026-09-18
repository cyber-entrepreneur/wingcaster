import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  findAllModule: vi.fn(),
  findOneModule: vi.fn(),
  insertModule: vi.fn(),
  updateModule: vi.fn(),
  removeModule: vi.fn(),
}));

vi.mock("../infrastructure/db.js", () => db);

import { createAiConfigService } from "./ai-config-service.js";

const logger = { error: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  db.insertModule.mockImplementation(async (_collection, row) => row);
  db.updateModule.mockResolvedValue(undefined);
});

describe("AI config prompt versioning", () => {
  it("records version one when a config is created", async () => {
    const service = createAiConfigService({ config: {}, logger });
    const created = await service.create(
      {
        name: "Area quality",
        provider: "gemini",
        model: "gemini-1.5-flash",
        system_prompt: "System prompt content",
        scoring_prompt_template: "Scoring prompt template content",
        is_active: true,
      },
      "admin-1",
    );

    expect(created.version).toBe(1);
    expect(db.insertModule).toHaveBeenNthCalledWith(
      1,
      "ai_scoring_configs",
      expect.objectContaining({ version: 1 }),
    );
    expect(db.insertModule).toHaveBeenNthCalledWith(
      2,
      "ai_scoring_config_versions",
      expect.objectContaining({
        config_id: created.id,
        version: 1,
        created_by: "admin-1",
      }),
    );
  });

  it("increments the config version and stores an immutable snapshot", async () => {
    const service = createAiConfigService({ config: {}, logger });
    db.findOneModule.mockResolvedValue({
      id: "cfg-1",
      name: "Area quality",
      provider: "gemini",
      model: "gemini-1.5-flash",
      version: 3,
      is_active: true,
    });

    const updated = await service.update(
      "cfg-1",
      { model: "gemini-2.5-flash" },
      "admin-2",
    );

    expect(updated.version).toBe(4);
    expect(updated.model).toBe("gemini-2.5-flash");
    expect(db.insertModule).toHaveBeenCalledWith(
      "ai_scoring_config_versions",
      expect.objectContaining({
        config_id: "cfg-1",
        version: 4,
        created_by: "admin-2",
      }),
    );
  });
});
