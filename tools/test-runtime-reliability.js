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

  let conditionalCalls = 0;
  const conditionalOptions = {
    minGapMs: 0,
    cacheTtlMs: 1000,
    sessionCache: true,
    shouldCache: value => value.cache === true
  };
  await requests.request("conditional-cache", () => {
    conditionalCalls += 1;
    return Promise.resolve({ cache: false });
  }, conditionalOptions);
  await requests.request("conditional-cache", () => {
    conditionalCalls += 1;
    return Promise.resolve({ cache: false });
  }, conditionalOptions);
  assert.strictEqual(conditionalCalls, 2, "a successful empty lookup should be able to opt out of caching");

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

function testCommercialTextMarkup() {
  const commercial = fs.readFileSync(path.join(root, "15-supplyingcommercial.js"), "utf8");
  const preview = fs.readFileSync(path.join(root, "1-docprev.js"), "utf8");
  const readerStart = commercial.indexOf("  function readCustomFieldResult");
  const readerEnd = commercial.indexOf("  function setCustomField", readerStart);
  const nameStart = commercial.indexOf("  function normaliseCustomFieldName");
  const nameEnd = commercial.indexOf("  /* ------------------------------ Formatting", nameStart);
  const integerStart = commercial.indexOf("  function normaliseIntegerInput");
  const integerEnd = commercial.indexOf("  function rawMoney", integerStart);
  const moneyStart = commercial.indexOf("  function normaliseMoneyInput");
  const moneyEnd = integerStart;
  const revenueStart = commercial.indexOf("  function calculateRevenue");
  const revenueEnd = commercial.indexOf("  function calculateMarkup", revenueStart);
  const markupStart = revenueEnd;
  const markupEnd = commercial.indexOf("  function setCalculationStatus", markupStart);
  const rspTotalStart = commercial.indexOf("  function calculateRspLineTotal");
  const lineTypesStart = commercial.indexOf("  function isSupplyingItemLine");
  const lineTypesEnd = commercial.indexOf("  /* --------------------- Dedicated commercial editor", lineTypesStart);
  const rspTotalEnd = lineTypesStart;
  const firstDefinedStart = commercial.indexOf("  function firstDefinedValue");
  const firstDefinedEnd = commercial.indexOf("  function stripInventoryTitleMarkup", firstDefinedStart);
  const nodeSourcesStart = commercial.indexOf("  function getNodeDataSources");
  const nodeSourcesEnd = commercial.indexOf("  function parseCustomFieldBag", nodeSourcesStart);
  const titleStart = commercial.indexOf("  function looksLikeItemEditorTitle");
  const titleEnd = commercial.indexOf("  function findDialogAncestor", titleStart);
  const partialSaveStart = commercial.indexOf("  function buildLineCommercialSavePayload");
  const partialSaveEnd = commercial.indexOf("  function getSupplyingLineDataId", partialSaveStart);
  const lineIdStart = partialSaveEnd;
  const lineIdEnd = commercial.indexOf("  function getSupplyingLineTitle", lineIdStart);
  const inventoryIdStart = commercial.indexOf("  function normaliseInventoryId");
  const inventoryIdEnd = commercial.indexOf("  function collectNodeCustomFields", inventoryIdStart);
  const jobLineTypeStart = preview.indexOf("  function isJobPerformanceSupplyingItemLine");
  const jobLineTypeEnd = preview.indexOf("  function getJobPerformanceNodeSources", jobLineTypeStart);
  const jobTotalsStart = preview.indexOf("  function readSupplyingLineCommercialTotals");
  const jobTotalsEnd = preview.indexOf("  function getJobPerformanceSupplyingTree", jobTotalsStart);
  const jobMoneyStart = preview.indexOf("  function parseJobPerformanceMoney");
  const jobMoneyEnd = preview.indexOf("  function formatJobPerformanceMoney", jobMoneyStart);
  const normaliseTextStart = commercial.indexOf("  function normaliseText");
  const normaliseTextEnd = commercial.indexOf("  function escapeAttr", normaliseTextStart);
  assert([readerStart, readerEnd, nameStart, nameEnd, moneyStart, moneyEnd, integerStart, integerEnd, revenueStart, revenueEnd, markupStart, markupEnd, rspTotalStart, rspTotalEnd, lineTypesStart, lineTypesEnd, firstDefinedStart, firstDefinedEnd, nodeSourcesStart, nodeSourcesEnd, titleStart, titleEnd, partialSaveStart, partialSaveEnd, lineIdStart, lineIdEnd, inventoryIdStart, inventoryIdEnd, jobLineTypeStart, jobLineTypeEnd, jobTotalsStart, jobTotalsEnd, jobMoneyStart, jobMoneyEnd, normaliseTextStart, normaliseTextEnd].every(index => index >= 0), "commercial test helpers should be discoverable");

  const context = vm.createContext({
    result: null,
    CFG: { rspSelectionRetentionMs: 15000 },
    state: { rspSelected: { "line:missing": true }, rspSelectionMissingSince: {} },
    $: {
      trim: value => String(value == null ? "" : value).trim(),
      isPlainObject: value => !!value && typeof value === "object" && !Array.isArray(value)
    },
    Object,
    Array,
    String,
    Number,
    RegExp,
    Math,
    isFinite
  });
  vm.runInContext(
      commercial.slice(readerStart, readerEnd) +
      commercial.slice(nameStart, nameEnd) +
      commercial.slice(moneyStart, moneyEnd) +
      commercial.slice(integerStart, integerEnd) +
      commercial.slice(revenueStart, revenueEnd) +
      commercial.slice(markupStart, markupEnd) +
      commercial.slice(firstDefinedStart, firstDefinedEnd) +
      commercial.slice(nodeSourcesStart, nodeSourcesEnd) +
      commercial.slice(rspTotalStart, rspTotalEnd) +
      commercial.slice(lineTypesStart, lineTypesEnd) +
      commercial.slice(titleStart, titleEnd) +
      commercial.slice(partialSaveStart, partialSaveEnd) +
      commercial.slice(lineIdStart, lineIdEnd) +
      commercial.slice(inventoryIdStart, inventoryIdEnd) +
      preview.slice(jobLineTypeStart, jobLineTypeEnd) +
      preview.slice(jobTotalsStart, jobTotalsEnd) +
      preview.slice(jobMoneyStart, jobMoneyEnd) +
      commercial.slice(normaliseTextStart, normaliseTextEnd) +
      '; function getJobPerformanceSupplyingTree() { return {}; }' +
      '; function getJobPerformanceTreeNodes() { return [' +
        '{ id: "b1", data: { Revenue: 500, TOTAL: 84 } },' +
        '{ id: "c2", data: { Revenue: 100, TOTAL: 24.5 } },' +
        '{ id: "d3", data: { Revenue: 200, TOTAL: 100 } },' +
        '{ id: "e4", data: { Revenue: 700, TOTAL: 350 } },' +
        '{ id: "f5", data: { Revenue: 60, TOTAL: 50 } },' +
        '{ id: "a5", data: { Revenue: 9999, TOTAL: 9999 } }' +
      ']; }' +
      '; function readJobPerformanceRevenueField(node) { return node.data.Revenue; }' +
      '; function readJobPerformanceNativeTotal(node) { return node.data.TOTAL; }' +
      '; function unwrapJobPerformanceValue(value) { return value == null ? "" : value; }' +
      '; function getInventoryMasterKey(node) { return String(node && node.data && node.data.LIST_ID || ""); }' +
      '; result = {' +
        'field: readCustomFieldResult({ Markup: { value: "0" }, "items:_Markup": { value: "-100" } }, [], "Markup"),' +
        'ascii: normaliseIntegerInput("-100"),' +
        'unicode: normaliseIntegerInput("−100"),' +
        'revenue: calculateRevenue(84, "-100"),' +
        'reconciledMarkup: calculateRevenuePreservingMarkup("250.00", "500.00"),' +
        'zeroCosMarkup: calculateRevenuePreservingMarkup("0.00", "500.00"),' +
        'rspLineTotal: calculateRspLineTotal("100.00", 2),' +
        'selectionKey: getRspSelectionKey({ id: "temporary-node", data: { ID: 42 } }),' +
        'retainedMissing: retainMissingRspSelection("line:missing"),' +
        'stillSelected: !!state.rspSelected["line:missing"],' +
        'hireTitle: looksLikeItemEditorTitle("Edit Hire Item"),' +
        'salesTitle: looksLikeItemEditorTitle("Edit - Sales Item"),' +
        'customTitle: looksLikeItemEditorTitle("Edit Custom Item"),' +
        'labourTitle: looksLikeItemEditorTitle("Edit Labour"),' +
        'genericTitle: looksLikeItemEditorTitle("Edit Item"),' +
        'jobTitle: looksLikeItemEditorTitle("Edit Job")' +
        ',partialPayload: buildLineCommercialSavePayload({ id: "b42", data: { ID: 999, JOB_ID: 77, QTY: 9, TOTAL: 250 } }, { customFields: { Revenue: "400", Markup: "60" } })' +
        ',salesPayload: buildLineCommercialSavePayload({ id: "c_43", data: { JOB: 77 } }, { customFields: {} })' +
        ',customPayload: buildLineCommercialSavePayload({ id: "d44", data: { JOB: 77 } }, { customFields: {} })' +
        ',labourPayload: buildLineCommercialSavePayload({ id: "e-45", data: { JOB: 77 } }, { customFields: {} })' +
        ',otherPayload: buildLineCommercialSavePayload({ id: "f46", data: { JOB: 77 } }, { customFields: {} })' +
        ',commercialKinds: ["b1", "c2", "d3", "e4", "f5", "g6"].map(function (id) { return isSupplyingItemLine({ id: id }); })' +
        ',inventoryMasterKinds: [{ id: "b1", data: { LIST_ID: 10 } }, { id: "c2", data: { LIST_ID: 20 } }, { id: "e3", data: { LIST_ID: 30 } }, { id: "d4", data: {} }].map(function (node) { return hasInventoryMasterLine(node); })' +
        ',jobPerformanceKinds: ["b1", "c2", "d3", "e4", "f5", "g6"].map(function (id) { return isJobPerformanceSupplyingItemLine({ id: id }); })' +
        ',blankKindFallback: [isSupplyingItemLine({ id: "b7", data: { kind: "" } }), isJobPerformanceSupplyingItemLine({ id: "b7", data: { kind: "" } })]' +
        ',unsupportedKinds: ["a1", "root"].map(function (id) { return isSupplyingItemLine({ id: id }); })' +
        ',jobPerformanceTotals: readSupplyingLineCommercialTotals()' +
      '};',
    context
  );
  assert.strictEqual(context.result.field.value, "-100", "items:_Markup should outrank a generic Markup value");
  assert.strictEqual(context.result.field.key, "items:_Markup", "the selected custom-field key should remain inspectable");
  assert.strictEqual(context.result.ascii, "-100", "text markup should preserve an ASCII negative value");
  assert.strictEqual(context.result.unicode, "-100", "text markup should normalise a Unicode minus value");
  assert.strictEqual(context.result.revenue, 0, "-100 markup should calculate zero revenue");
  assert.strictEqual(context.result.reconciledMarkup, "100", "a native CoS change must retain Revenue and recalculate whole-number Markup");
  assert.strictEqual(context.result.zeroCosMarkup, "", "a zero-CoS Revenue line should retain Revenue with Markup not applicable");
  assert.strictEqual(context.result.rspLineTotal, 200, "two units at £100 RSP should display and total as a £200 line");
  assert.strictEqual(context.result.selectionKey, "line:42", "RSP selection should use the stable supplying-line ID instead of a transient node ID");
  assert.strictEqual(context.result.retainedMissing, true, "a row missing during redraw should enter the retention window");
  assert.strictEqual(context.result.stillSelected, true, "the first missing-row refresh must not erase an RSP selection");
  assert.strictEqual(context.result.hireTitle, true, "the native hire-item title should be detected");
  assert.strictEqual(context.result.salesTitle, true, "punctuated sales-item titles should be detected");
  assert.strictEqual(context.result.customTitle, true, "custom-item titles should be detected for post-save reconciliation");
  assert.strictEqual(context.result.labourTitle, true, "labour titles should be detected for post-save reconciliation");
  assert.strictEqual(context.result.genericTitle, true, "a reused generic Edit Item title should be detected");
  assert.strictEqual(context.result.jobTitle, false, "non-item editors should not match the commercial popup title detector");
  assert.deepStrictEqual(Object.keys(context.result.partialPayload).sort(), ["custom_fields", "id", "job", "kind"], "standalone commercial saves should contain only routing identity and custom fields");
  assert.strictEqual(context.result.partialPayload.id, "42", "the native tree node ID should outrank an ambiguous row-data ID");
  assert.strictEqual(context.result.partialPayload.job, "77", "standalone commercial saves should include the current HireHop job routing ID");
  assert.strictEqual(context.result.partialPayload.kind, "1", "hire rows should derive kind 1 from their native b-prefix when row data omits kind");
  assert.strictEqual(context.result.salesPayload.id, "43", "underscored native tree IDs should retain their supplying-line ID");
  assert.strictEqual(context.result.salesPayload.kind, "2", "sales rows should derive kind 2 from their native c-prefix");
  assert.strictEqual(context.result.customPayload.kind, "3", "custom rows should derive kind 3 from their native d-prefix");
  assert.strictEqual(context.result.labourPayload.kind, "4", "labour rows should derive kind 4 from their native e-prefix");
  assert.strictEqual(context.result.otherPayload.kind, "5", "other native supplying items should derive their kind without a commercial allowlist");
  assert.deepStrictEqual(Array.from(context.result.commercialKinds), [true, true, true, true, true, true], "every non-heading native supplying item kind should expose commercial fields");
  assert.deepStrictEqual(Array.from(context.result.inventoryMasterKinds), [true, true, true, false], "RSP/default behavior should depend on an actual inventory master rather than an item-type allowlist");
  assert.deepStrictEqual(Array.from(context.result.jobPerformanceKinds), [true, true, true, true, true, true], "Job Performance should include every non-heading supplying item kind");
  assert.deepStrictEqual(Array.from(context.result.blankKindFallback), [true, true], "blank kind metadata should fall back to the native item identity rather than filtering out a real line");
  assert.deepStrictEqual(Array.from(context.result.unsupportedKinds), [false, false], "structural heading/root rows should remain outside the commercial totals to prevent subtotal double-counting");
  assert.strictEqual(context.result.jobPerformanceTotals.revenue, 1560, "Job Performance should sum Revenue across every supplying item type");
  assert.strictEqual(context.result.jobPerformanceTotals.cos, 608.5, "Job Performance should sum native CoS across every supplying item type");
  assert.strictEqual(context.result.jobPerformanceTotals.lineCount, 5, "Job Performance should exclude only structural rows from its commercial line count");
}

function testExternalModBridge() {
  const source = fs.readFileSync(path.join(root, "16-externalmod.js"), "utf8");

  function runWithUrl(url, isProposalCreation) {
    const appended = [];
    const head = {
      appendChild(node) {
        node.parentNode = head;
        appended.push(node);
      },
      removeChild(node) {
        node.parentNode = null;
      }
    };
    const document = {
      currentScript: { src: "https://example.test/hhplugin/16-externalmod.js?v=0.1" },
      head,
      documentElement: head,
      createElement() { return {}; }
    };
    const window = {
      document,
      URL,
      WiseProposalSectionBuilderHireHop: {
        depot: {
          isProposalCreation() { return isProposalCreation !== false; }
        }
      }
    };
    const context = vm.createContext({
      window,
      document,
      console: { warn() {} },
      URL,
      Number,
      String,
      RegExp,
      isFinite,
      setTimeout() { return 1; },
      clearTimeout() {}
    });
    vm.runInContext(source.replace(/url:\s*"[^"\r\n]*"/, `url: ${JSON.stringify(url)}`), context);
    return { window, appended };
  }

  const disabled = runWithUrl("");
  assert.strictEqual(disabled.appended.length, 0, "a blank external mod URL should not inject a script");
  assert.strictEqual(disabled.window.WiseHireHopExternalMod.status, "not-configured", "a blank URL should report that configuration is required");

  const unsafe = runWithUrl("javascript:alert(1)");
  assert.strictEqual(unsafe.appended.length, 0, "a non-HTTPS external mod URL should be rejected");
  assert.strictEqual(unsafe.window.WiseHireHopExternalMod.status, "failed", "an unsafe URL should expose a failed diagnostic state");

  const otherDepot = runWithUrl("https://mods.example.test/unique.js", false);
  assert.strictEqual(otherDepot.appended.length, 0, "the external mod URL should not be requested outside Proposal Creation");
  assert.strictEqual(otherDepot.window.WiseHireHopExternalMod.status, "blocked-depot", "a non-Proposal Creation depot should expose a blocked diagnostic state");

  const safe = runWithUrl("https://mods.example.test/unique.js?company=wise");
  assert.strictEqual(safe.appended.length, 1, "a valid HTTPS mod URL should inject exactly one script");
  assert.strictEqual(safe.appended[0].referrerPolicy, "no-referrer", "the external request should not disclose its HireHop page URL");
  safe.appended[0].onload();
  safe.window.WiseHireHopExternalMod.retry();
  assert.strictEqual(safe.appended.length, 1, "a loaded external mod should not be injected twice");
}

function testLoaderDepotRestrictions() {
  const loader = fs.readFileSync(path.join(root, "0-loader.js"), "utf8");
  const start = loader.indexOf("  function filterModulesForActiveDepot");
  const end = loader.indexOf("  function refreshSupplyingModuleHealth", start);
  assert(start >= 0 && end > start, "the loader depot filter should be discoverable");

  function filter(isProposalCreation) {
    const context = vm.createContext({
      result: null,
      moduleState: {},
      CFG: { scripts: { stage: { file: "8-stagedesigner.js" } } },
      window: {
        WiseProposalSectionBuilderHireHop: {
          depot: { isProposalCreation() { return isProposalCreation; } }
        }
      },
      Date
    });
    vm.runInContext(
      loader.slice(start, end) +
      '; result = filterModulesForActiveDepot(["docprev", "stage", "supplyingCommercial"]);',
      context
    );
    return Array.from(context.result);
  }

  assert.deepStrictEqual(
    filter(true),
    ["docprev", "supplyingCommercial"],
    "Proposal Creation should exclude only Stage Designer from the supplying bundle"
  );
  assert.deepStrictEqual(
    filter(false),
    ["docprev", "stage", "supplyingCommercial"],
    "every other depot should retain Stage Designer"
  );
}

function testSourceGuards() {
  const loader = fs.readFileSync(path.join(root, "0-loader.js"), "utf8");
  assert(loader.includes("loadIndependent"), "loader should initialize independent modules independently");
  assert(loader.includes("nextRetryAt"), "loader should retain module retry cooldown state");
  assert(loader.includes("refreshSupplyingModuleHealth"), "loader should refresh module health after HireHop replaces the supplying root");
  assert(loader.includes('return loadAfterShared(["docprev"'), "supplying health recovery should receive the bundle load promise");
  assert(loader.includes("Loading them without that dependency"), "dependent modules must not initialize before the shared module");
  assert(loader.includes("looksLikeJobDetailsText(document.body.textContent"), "ID-less job-detail pages should still load the grouped front-page module");
  assert(loader.includes('callModuleMethod("jobGroups"'), "an already-loaded job layout should refresh after HireHop route changes");
  assert(loader.includes("isNonDetailJobTabCurrent() || isSupplyingPanelCurrent()"), "the job-details route fallback must yield to every non-detail job tab");
  assert(loader.includes('loadAfterShared(["externalMod"])'), "the external mod bridge should wait for the shared authoritative depot detector");
  assert(loader.includes('callModuleMethod("externalMod"'), "the external mod bridge should recheck its depot gate after HireHop route changes");
  assert(loader.includes("filterModulesForActiveDepot(keys)"), "shared-dependent modules should pass through depot restrictions");
  assert(loader.includes('return key !== "stage"'), "Stage Designer should be excluded from Proposal Creation before its script is requested");

  const externalMod = fs.readFileSync(path.join(root, "16-externalmod.js"), "utf8");
  assert(/url:\s*"[^"\r\n]*"/.test(externalMod), "the external mod should retain one quoted URL configuration field");
  assert(externalMod.includes('parsed.protocol !== "https:"'), "the external mod bridge should reject non-HTTPS script URLs");
  assert(externalMod.includes("parsed.username || parsed.password"), "the external mod bridge should reject URL-embedded credentials");
  assert(externalMod.includes("shared.depot.isProposalCreation()"), "the external mod URL should only load in Proposal Creation");
  assert(externalMod.includes("script.integrity = integrity"), "the external mod bridge should support optional Subresource Integrity");
  assert(externalMod.includes("state.status === \"loading\" || state.status === \"loaded\""), "the external mod bridge should prevent duplicate script loads");

  const shared = fs.readFileSync(path.join(root, "5-hirehop.js"), "utf8");
  assert(shared.includes('allowedIds: ["14"]'), "Proposal Creation depot ID should be an explicit stable gate");
  assert(shared.includes("function findSupplyingToolbarHost"), "toolbar discovery should use native action detection instead of child position");
  assert(!shared.includes('toolbarHost: "#items_tab > div:first-child"'), "commercial UI inserted above the toolbar must not break toolbar discovery");

  const stage = fs.readFileSync(path.join(root, "8-stagedesigner.js"), "utf8");
  assert(stage.includes("function deactivateInProposalCreation"), "Stage Designer should have a runtime Proposal Creation guard");
  assert(stage.includes('$("#" + CFG.buttonId + ",#" + CFG.overlayId).remove()'), "Stage Designer should remove existing UI after a depot change into Proposal Creation");
  assert(stage.includes("if (deactivateInProposalCreation()) return;"), "Stage Designer entry points should stop in Proposal Creation");

  const preview = fs.readFileSync(path.join(root, "1-docprev.js"), "utf8");
  assert(preview.includes("maintainPreviewUi"), "preview UI should recover after supplying-root replacement");
  assert(preview.includes("forceDepotScan: true"), "preview bootstrap should not remain blocked by an early cached depot context");
  assert(preview.includes('doc: "169"'), "proposal preview should use the QTC V4 document");
  assert(!preview.includes('doc: "167"'), "proposal preview should not retain the previous QTC document");
  assert(preview.includes('ps: "a4"'), "QTC V4 preview should explicitly request A4 output");
  assert(!preview.includes("wise-rsp-selection-summary"), "Job Performance must not own, replace or remove the RSP calculator");
  const performanceTotalReader = preview.slice(
    preview.indexOf("  function readJobPerformanceNativeTotal"),
    preview.indexOf("  function readJobPerformanceRenderedTotal")
  );
  assert(
    performanceTotalReader.indexOf("readJobPerformanceRenderedTotal") < performanceTotalReader.indexOf('readJobPerformanceSourceValue(sources, "TOTAL")'),
    "Job Performance CoS must prefer the same rendered row value visible to the user"
  );

  const commercial = fs.readFileSync(path.join(root, "15-supplyingcommercial.js"), "utf8");
  assert(commercial.includes("inventory-defaults:v3:"), "inventory defaults should use a versioned shared request key");
  assert(commercial.includes("sessionCache: true"), "inventory defaults should use session-level caching");
  assert(commercial.includes("shouldCache: hasInventoryCommercialDefaults"), "empty inventory responses must not be cached as durable defaults");
  assert(commercial.includes('stockListEndpoint: getHireHopEndpoint("stockList", "/modules/stock/list.php")'), "RSP lookup should use HireHop's stock record endpoint");
  assert(commercial.includes("unq: info.listId"), "stock lookup should request the exact inventory master ID");
  assert(commercial.includes("function customFieldKeyPriority"), "custom-field aliases should have deterministic precedence");
  assert(commercial.includes('scope === "items" || scope === "item" || scope === "line"'), "line-level namespaced fields should outrank generic row properties");
  assert(commercial.includes('replace(/[−–—]/g, "-")'), "text markups should accept common minus characters");
  assert(commercial.includes("refreshAfterAt: Date.now() + CFG.inventoryCacheTtlMs"), "successful inventory defaults should eventually refresh in a long-lived page");
  const commercialBoot = commercial.slice(commercial.indexOf("  function boot"), commercial.indexOf("  function bindEvents"));
  assert(commercialBoot.includes("installLineCommercialEditorCapture"), "the line-level Revenue icon should own commercial editing");
  assert(commercialBoot.includes("installNativeCommercialReconciliation"), "successful native item saves should reconcile Markup against the updated CoS");
  assert(!commercialBoot.includes("installDialogObserver"), "commercial editing must not depend on observing HireHop's native item popup");
  assert(!commercialBoot.includes("installNativeSaveCapture"), "the retired native-popup field injection must remain disabled");
  assert(!commercialBoot.includes("installAjaxSaveBridge"), "commercial editing must use its own partial custom-field save");
  assert(commercial.includes("function calculateRevenuePreservingMarkup"), "native CoS reconciliation should have an explicit Revenue-preserving calculation");
  assert(commercial.includes("wiseCommercialReconcile: true"), "the follow-up Markup write should be tagged so it cannot be mistaken for another native save");
  assert(commercial.includes("settings.wiseCommercialStandalone || settings.wiseCommercialReconcile"), "commercial-only saves must not recursively trigger native reconciliation");
  const nativeReconcile = commercial.slice(
    commercial.indexOf("  function persistRevenuePreservingMarkup"),
    commercial.indexOf("  function notifyNativeCommercialReconciliationFailure")
  );
  assert(nativeReconcile.includes("setCustomField(customFields, CFG.revenueField, pending.revenue)"), "native reconciliation must retain the line's existing Revenue");
  assert(nativeReconcile.includes("setCustomField(customFields, CFG.markupField, markup)"), "native reconciliation must persist the Markup calculated from the new CoS");
  assert(!/\b(?:qty|unit_price|price|memo|parent)\s*:/.test(nativeReconcile), "post-native-save reconciliation must not resubmit unrelated native item fields");
  assert(commercial.includes("function removeLegacyProposalEditColumns"), "the retired Proposal edit column should be removed");
  assert(commercial.includes("function renderProposalEditButtons"), "supported commercial Revenue cells should receive compact edit controls");
  assert(commercial.includes("wise-revenue-edit-host"), "the edit control should share the projected Revenue value host");
  assert(!commercial.includes("<b>Edit</b>"), "the Revenue edit control should remain icon-only");
  assert(commercial.includes("function openLineCommercialEditor"), "Revenue edit icons should open the dedicated commercial editor");
  assert(preview.includes("wise:supplying-commercial-line-saved.wiseJobPerformance"), "a successful Revenue/Markup save should explicitly refresh Job Performance");
  assert(commercial.includes("function buildLineCommercialSavePayload"), "the dedicated editor should build a minimal partial-update payload");
  const partialSave = commercial.slice(commercial.indexOf("  function buildLineCommercialSavePayload"), commercial.indexOf("  function getSupplyingLineDataId"));
  assert(partialSave.includes("custom_fields"), "the line editor should post the merged custom-field bag");
  assert(!/\b(?:qty|unit_price|price|memo|parent)\s*:/.test(partialSave), "the partial save must not resubmit unrelated native hire-item values");
  assert(commercial.includes("function alignSupplyingCommercialColumns"), "commercial columns should share a dedicated alignment pass");
  assert(commercial.includes("commercialColumnWidths: { cos: 96, markup: 64, revenue: 88, rsp: 96 }"), "commercial header and row widths should use one geometry contract without a separate edit column");
  assert(commercial.includes("function alignNativeHeaderToRows"), "separate native header and row tables should be geometrically reconciled");
  assert(commercial.includes("function maintainAlignmentObserver"), "column alignment should recover after supplying-layout resizes");
  assert(commercial.includes("restoreCommercialGeometry"), "removing the enhancement should restore native inline geometry");
  assert(commercial.includes("formatSterling(lineTotal)"), "the RSP column should display the quantity-extended line value");
  assert(commercial.includes("total += calculateRspLineTotal(rsp, quantity)"), "the RSP summary should add each quantity-extended line exactly once");
  assert(commercial.includes('addEventListener("click", handleRspSelectionCapture, true)'), "RSP selection should be captured before HireHop row click handlers");
  assert(commercial.includes("function getRspSelectionKey"), "RSP selection should survive row redraws through a stable line identity");
  assert(commercial.includes("function queueRspUiReconciliation"), "RSP controls should receive bounded post-click redraw reconciliation");
  assert(commercial.includes("function setImportantStyle"), "commercial geometry updates should be idempotent to avoid mutation-refresh loops");
  assert(commercial.includes("isManagedCommercialGeometryMutation"), "managed geometry mutations should not trigger full supplying refreshes");
  assert(commercial.includes("function retainMissingRspSelection"), "RSP selections should survive a short missing-row redraw window");
  assert(commercial.includes("if (!available && rsp.resolved)"), "an unresolved loading RSP must not erase an existing selection");
  assert(commercial.includes("if (rspResult.resolved) removeRspSelection(selectionKey)"), "the calculator should remove a selection only after RSP absence is resolved");
  assert(commercial.includes("maintainCommercialTopSwitcher"), "RSP and Job Performance should share a display-only view switch");
  assert(commercial.includes("restoreTopCommercialViews"), "removing the RSP enhancement should restore Job Performance visibility");
  assert(commercial.includes('topView: "job-performance"'), "Job Performance should be the default commercial view on each page");
  assert(commercial.includes("function ensureRspSelectionColumn"), "RSP controls should use a dedicated supplying-list column");
  assert(commercial.includes("function findRspColumnHost"), "RSP checkboxes should mount only in the dedicated RSP column");
  assert(commercial.includes("wise-rsp-calculator-view"), "the RSP column should be visible only in calculator view");
  assert(commercial.includes('$cell.insertAfter($anchor)'), "native RSP cells should remain after Revenue during redraws");
  assert(commercial.includes("pointer-events:auto"), "dedicated RSP checkboxes should remain clickable above HireHop row handlers");
  assert(!commercial.includes('.filter(".name_cell,.item_cell.node_desc,.item_cell").last()'), "RSP controls must not fall through to commercial value cells");

  const jobGroups = fs.readFileSync(path.join(root, "14-jobgroups.js"), "utf8");
  assert(jobGroups.includes('label.indexOf("job id ") === 0'), "combined Job ID label/value cells should be accepted as job-detail anchors");
  assert(jobGroups.includes("restoreJobInfoLayouts"), "job cards should restore HireHop's shared content before Supplying renders");
  assert(jobGroups.includes("restoreStaleJobInfoLayouts"), "job cards should relinquish a content root that HireHop has repurposed");
  assert(jobGroups.includes("findNativeJobSourceNodes"), "job cards should hide only positively identified native field blocks");
  assert(!jobGroups.includes('root + "{display:block!important'), "job cards must not force layout onto HireHop's shared route wrapper");
  assert(jobGroups.includes('click.wiseJobGroups'), "job tab clicks should trigger immediate layout ownership checks");

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
  testExternalModBridge();
  testLoaderDepotRestrictions();
  testCommercialTextMarkup();
  await testRequestManager();
  console.log("Runtime reliability tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
