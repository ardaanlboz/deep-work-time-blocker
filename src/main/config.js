const Store = require("electron-store");
const { z } = require("zod");
const { normalizeDomain, toBlockVariants } = require("./domainUtils");

const configSchema = z.object({
  blockedDomains: z.array(z.string()).default([]),
  blockedApps: z.array(z.string()).default([]),
  allowedApps: z.array(z.string()).default([]),
  allowOnlySelectedApps: z.boolean().default(false),
  appCloseWarningSeconds: z.number().int().min(0).max(60).default(5),
  videoUrl: z.string().default(""),
  sessionMinutes: z.number().int().min(1).max(600).default(50),
  lockStopMinutes: z.number().int().min(0).max(600).default(0),
  strictMode: z.boolean().default(true),
  profiles: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        createdAt: z.string(),
        settings: z.object({
          blockedDomains: z.array(z.string()).optional(),
          blockedApps: z.array(z.string()).optional(),
          allowedApps: z.array(z.string()).optional(),
          allowOnlySelectedApps: z.boolean().optional(),
          appCloseWarningSeconds: z.number().int().min(0).max(60).optional(),
          videoUrl: z.string().optional(),
          sessionMinutes: z.number().int().min(1).max(600).optional(),
          lockStopMinutes: z.number().int().min(0).max(600).optional(),
          strictMode: z.boolean().optional(),
        }),
      })
    )
    .default([]),
  activityReports: z
    .array(
      z.object({
        id: z.string(),
        startedAt: z.string(),
        endedAt: z.string(),
        durationSeconds: z.number().int().min(0),
        blockedSiteHits: z.number().int().min(0),
        reminderPopupsShown: z.number().int().min(0),
        appsWarned: z.number().int().min(0),
        appsClosed: z.number().int().min(0),
        appsForceKilled: z.number().int().min(0),
        appsClosedNames: z.array(z.string()).default([]),
      })
    )
    .default([]),
  sessionCounter: z.number().int().min(0).default(0),
  currentSessionNoteDraft: z.string().default(""),
  sessionNotes: z
    .array(
      z.object({
        sessionNumber: z.number().int().min(1),
        day: z.string(),
        startAt: z.string(),
        endAt: z.string(),
        text: z.string(),
      })
    )
    .default([]),
  lastSession: z
    .object({
      active: z.boolean().default(false),
      startAt: z.string().optional(),
      endAt: z.string().optional(),
      sessionNumber: z.number().int().min(1).optional(),
    })
    .default({ active: false }),
});

const store = new Store({
  name: "deepwork-config",
  clearInvalidConfig: true,
  defaults: configSchema.parse({}),
});

function getConfig() {
  const parsed = configSchema.safeParse(store.store);
  if (!parsed.success) {
    store.store = configSchema.parse({});
    return store.store;
  }
  return parsed.data;
}

function setConfig(patch) {
  const current = getConfig();
  const next = configSchema.parse({
    ...current,
    ...patch,
  });
  store.store = next;
  return next;
}

module.exports = {
  getConfig,
  setConfig,
  normalizeDomain,
  toBlockVariants,
};
