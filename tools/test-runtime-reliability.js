"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

function createStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index) { return Array.from(values.keys())[index] || null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); }
  };
}

function createSharedRuntime() {
  function jquery() {
    return {
      filter() { return this; },
      first() { return this; },
      get() { return null; },
      each() { return this; },
      closest() { return this; },
      find() { return this; },
      siblings() { return this; },
      nextAll() { return this; },
      parent() { return this; },
      is() { return false; },
      attr() { return ""; },
      text() { return ""; },
      val() { return ""; },
      data() { return ""; },
      has() { return this; },
      add() { return this; },
      get length() { return 0; }
    };
  }
  jquery.extend = function () { return Object.assign.apply(Object, arguments); };

  const document = {
    hidden: false,
    body: {},
    documentElement: {},
    addEventListener() {},
    querySelectorAll() { return []; }
  };
  const window = {
    jQuery: jquery,
    document,
    location: { search: "", href: "", pathname: "" },
    sessionStorage: createStorage(),
    localStorage: createStorage(),
    // HireHop can expose several depot-shaped user fields with different
    // meanings. The Proposal Creation match may not be the first one.
    user: { DEPOT_ID: "5", DEPOT: "Operations", DEFAULT_DEPOT: "Proposal Creation" }
  };
  const context = vm.createContext({
    window,
    document,
    console,
    Promise,
    Date,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    RegExp,
    URLSearchParams,
    encodeURIComponent,
    decodeURIComponent,
    isFinite,
    setTimeout,
    clearTimeout
  });
  vm.runInContext(fs.readFileSync(path.join(root, "5-hirehop.js"), "utf8"), context);
  return window.WiseProposalSectionBuilderHireHop;
}

async function testRequestManager() {
  const shared = createSharedRuntime();
  const requests = shared.requests;
  assert(shared.depot.isProposalCreation(), "Proposal Creation should match when any authoritative user depot field identifies it");
  let calls = 0;
  const first = requests.request("dedupe", () => {
    calls += 1;
    return new Promise(resolve => setTimeout(() => resolve({ ok: true }), 15));
  }, { minGapMs: 0, cacheTtlMs: 1000, sessionCache: true });
  const second = requests.request("dedupe", () => {
    calls += 1;
    return Promise.resolve({ ok: false });
  }, { minGapMs: 0 });
  const values = await Promise.all([first, second]);
  assert.strictEqual(calls, 1, "identical in-flight requests should share one factory call");
  assert.deepStrictEqual(values[0], values[1], "deduplicated consumers should receive the same result");

  await requests.request("dedupe", () => {
    calls += 1;
    return Promise.resolve({ ok: false });
  }, { minGapMs: 0, cacheTtlMs: 1000, sessionCache: true });
  assert.strictEqual(calls, 1, "fresh cached requests should not execute again");

  let active = 0;
  let maxActive = 0;
  function serialFactory(value) {
    return () => new Promise(resolve => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      setTimeout(() => {
        active -= 1;
        resolve(value);
      }, 10);
    });
  }
  await Promise.all([
    requests.request("serial-a", serialFactory("a"), { minGapMs: 0 }),
    requests.request("serial-b", serialFactory("b"), { minGapMs: 0 })
  ]);
  assert.strictEqual(maxActive, 1, "HireHop reads should respect the configured concurrency limit");

  const limited = new Error("Too many transactions");
  limited.status = 429;
  limited.retryAfterMs = 35;
  await requests.request("limited", () => Promise.reject(limited), { minGapMs: 0 }).catch(() => {});
  const started = Date.now();
  await requests.request("after-limit", () => Promise.resolve(true), { minGapMs: 0 });
  assert(Date.now() - started >= 25, "a server rate limit should delay subsequent queued work");

  const summary = requests.describe();
  assert(summary.stats.deduplicated >= 1, "diagnostics should count request deduplication");
  assert(summary.stats.cacheHits >= 1, "diagnostics should count cache hits");
  assert(summary.stats.rateLimits >= 1, "diagnostics should count rate limits");
}

function testSourceGuards() {
  const loader = fs.readFileSync(path.join(root, "0-loader.js"), "utf8");
  assert(loader.includes("loadIndependent"), "loader should initialize independent modules independently");
  assert(loader.includes("nextRetryAt"), "loader should retain module retry cooldown state");
  assert(loader.includes("refreshSupplyingModuleHealth"), "loader should refresh module health after HireHop replaces the supplying root");
  assert(loader.includes("Loading them without that dependency"), "dependent modules must not initialize before the shared module");

  const shared = fs.readFileSync(path.join(root, "5-hirehop.js"), "utf8");
  assert(shared.includes('allowedIds: ["14"]'), "Proposal Creation depot ID should be an explicit stable gate");
  assert(shared.includes("function findSupplyingToolbarHost"), "toolbar discovery should use native action detection instead of child position");
  assert(!shared.includes('toolbarHost: "#items_tab > div:first-child"'), "commercial UI inserted above the toolbar must not break toolbar discovery");

  const preview = fs.readFileSync(path.join(root, "1-docprev.js"), "utf8");
  assert(preview.includes("maintainPreviewUi"), "preview UI should recover after supplying-root replacement");
  assert(preview.includes("forceDepotScan: true"), "preview bootstrap should not remain blocked by an early cached depot context");
  assert(!preview.includes("wise-rsp-selection-summary"), "Job Performance must not own, replace or remove the RSP calculator");

  const commercial = fs.readFileSync(path.join(root, "15-supplyingcommercial.js"), "utf8");
  assert(commercial.includes("inventory-defaults:"), "inventory defaults should use the shared keyed request queue");
  assert(commercial.includes("sessionCache: true"), "inventory defaults should use session-level caching");
  assert(commercial.includes("maintainCommercialTopSwitcher"), "RSP and Job Performance should share a display-only view switch");
  assert(commercial.includes("restoreTopCommercialViews"), "removing the RSP enhancement should restore Job Performance visibility");
  assert(commercial.includes('topView: "job-performance"'), "Job Performance should be the default commercial view on each page");

  const journey = fs.readFileSync(path.join(root, "11-projectjourney.js"), "utf8");
  const buildJourney = journey.slice(journey.indexOf("function buildJourneyHtml"), journey.indexOf("function buildHeaderSummary"));
  assert(!buildJourney.includes("maybePreloadJobData"), "rendering a hidden Journey panel must not start network requests");
  assert(!journey.includes('jqGrid("getGridParam", "url")'), "Journey must reuse the native grid response instead of duplicating its request");

  const checklist = fs.readFileSync(path.join(root, "9-jobchecklist.js"), "utf8");
  assert(checklist.includes("checklistEnabled: false"), "the prototype Checklist tab should remain disabled");

  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  for (const entry of manifest.lazyScripts) {
    const escaped = entry.file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = loader.match(new RegExp('file:\\s*"' + escaped + '",\\s*version:\\s*"([^"]+)"'));
    assert(match, `loader should register ${entry.file}`);
    assert.strictEqual(match[1], String(entry.cacheVersion), `loader and manifest cache versions should match for ${entry.file}`);
  }
}

(async function run() {
  testSourceGuards();
  await testRequestManager();
  console.log("Runtime reliability tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
