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
  const rspTotalStart = commercial.indexOf("  function calculateRspLineTotal");
  const rspTotalEnd = commercial.indexOf("  function isInventoryLine", rspTotalStart);
  const firstDefinedStart = commercial.indexOf("  function firstDefinedValue");
  const firstDefinedEnd = commercial.indexOf("  function stripInventoryTitleMarkup", firstDefinedStart);
  const nodeSourcesStart = commercial.indexOf("  function getNodeDataSources");
  const nodeSourcesEnd = commercial.indexOf("  function parseCustomFieldBag", nodeSourcesStart);
  const titleStart = commercial.indexOf("  function looksLikeItemEditorTitle");
  const titleEnd = commercial.indexOf("  function findDialogAncestor", titleStart);
  const normaliseTextStart = commercial.indexOf("  function normaliseText");
  const normaliseTextEnd = commercial.indexOf("  function escapeAttr", normaliseTextStart);
  assert([readerStart, readerEnd, nameStart, nameEnd, moneyStart, moneyEnd, integerStart, integerEnd, revenueStart, revenueEnd, rspTotalStart, rspTotalEnd, firstDefinedStart, firstDefinedEnd, nodeSourcesStart, nodeSourcesEnd, titleStart, titleEnd, normaliseTextStart, normaliseTextEnd].every(index => index >= 0), "commercial test helpers should be discoverable");

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
      commercial.slice(firstDefinedStart, firstDefinedEnd) +
      commercial.slice(nodeSourcesStart, nodeSourcesEnd) +
      commercial.slice(rspTotalStart, rspTotalEnd) +
      commercial.slice(titleStart, titleEnd) +
      commercial.slice(normaliseTextStart, normaliseTextEnd) +
      '; result = {' +
        'field: readCustomFieldResult({ Markup: { value: "0" }, "items:_Markup": { value: "-100" } }, [], "Markup"),' +
        'ascii: normaliseIntegerInput("-100"),' +
        'unicode: normaliseIntegerInput("−100"),' +
        'revenue: calculateRevenue(84, "-100"),' +
        'rspLineTotal: calculateRspLineTotal("100.00", 2),' +
        'selectionKey: getRspSelectionKey({ id: "temporary-node", data: { ID: 42 } }),' +
        'retainedMissing: retainMissingRspSelection("line:missing"),' +
        'stillSelected: !!state.rspSelected["line:missing"],' +
        'hireTitle: looksLikeItemEditorTitle("Edit Hire Item"),' +
        'salesTitle: looksLikeItemEditorTitle("Edit - Sales Item"),' +
        'genericTitle: looksLikeItemEditorTitle("Edit Item"),' +
        'jobTitle: looksLikeItemEditorTitle("Edit Job")' +
      '};',
    context
  );
  assert.strictEqual(context.result.field.value, "-100", "items:_Markup should outrank a generic Markup value");
  assert.strictEqual(context.result.field.key, "items:_Markup", "the selected custom-field key should remain inspectable");
  assert.strictEqual(context.result.ascii, "-100", "text markup should preserve an ASCII negative value");
  assert.strictEqual(context.result.unicode, "-100", "text markup should normalise a Unicode minus value");
  assert.strictEqual(context.result.revenue, 0, "-100 markup should calculate zero revenue");
  assert.strictEqual(context.result.rspLineTotal, 200, "two units at £100 RSP should display and total as a £200 line");
  assert.strictEqual(context.result.selectionKey, "line:42", "RSP selection should use the stable supplying-line ID instead of a transient node ID");
  assert.strictEqual(context.result.retainedMissing, true, "a row missing during redraw should enter the retention window");
  assert.strictEqual(context.result.stillSelected, true, "the first missing-row refresh must not erase an RSP selection");
  assert.strictEqual(context.result.hireTitle, true, "the native hire-item title should be detected");
  assert.strictEqual(context.result.salesTitle, true, "punctuated sales-item titles should be detected");
  assert.strictEqual(context.result.genericTitle, true, "a reused generic Edit Item title should be detected");
  assert.strictEqual(context.result.jobTitle, false, "non-item editors should not match the commercial popup title detector");
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

  const shared = fs.readFileSync(path.join(root, "5-hirehop.js"), "utf8");
  assert(shared.includes('allowedIds: ["14"]'), "Proposal Creation depot ID should be an explicit stable gate");
  assert(shared.includes("function findSupplyingToolbarHost"), "toolbar discovery should use native action detection instead of child position");
  assert(!shared.includes('toolbarHost: "#items_tab > div:first-child"'), "commercial UI inserted above the toolbar must not break toolbar discovery");

  const preview = fs.readFileSync(path.join(root, "1-docprev.js"), "utf8");
  assert(preview.includes("maintainPreviewUi"), "preview UI should recover after supplying-root replacement");
  assert(preview.includes("forceDepotScan: true"), "preview bootstrap should not remain blocked by an early cached depot context");
  assert(preview.includes('doc: "169"'), "proposal preview should use the QTC V4 document");
  assert(!preview.includes('doc: "167"'), "proposal preview should not retain the previous QTC document");
  assert(preview.includes('ps: "a4"'), "QTC V4 preview should explicitly request A4 output");
  assert(!preview.includes("wise-rsp-selection-summary"), "Job Performance must not own, replace or remove the RSP calculator");

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
  assert(commercial.includes("function installDialogObserver"), "item editors should be observed outside the supplying-list DOM root");
  assert(commercial.includes("dialogObserverRoot === document.body"), "the popup observer should recover if HireHop replaces the document body");
  assert(commercial.includes("characterData: true"), "reused popup title and content changes should trigger editor recovery");
  assert(commercial.includes("function queueDialogMaintenanceChecks"), "item editor opening should receive bounded delayed recovery checks");
  assert(commercial.includes("1800, 3200, 5200"), "popup recovery should remain active during slower reused-dialog rebuilds");
  assert(commercial.includes("function scoreItemEditorDialog"), "item editor detection should have a structural fallback beyond exact title text");
  assert(commercial.includes("function getActiveDialogContent"), "reused dialog wrappers should target their current visible content pane");
  assert(commercial.includes('if ($visible.length) return $visible.last()'), "the newest visible popup content should outrank hidden stale panes");
  assert(commercial.includes("!looksLikeItemDialogShell($owner)"), "stale commercial fields should not remain in an unrelated reused dialog");
  assert(commercial.includes("looksLikeEditItemTrigger(event.target)"), "Edit actions should trigger recovery from the capture phase");
  assert(commercial.includes('addEventListener("dblclick"'), "row double-click recovery should not depend on bubbling through HireHop handlers");
  assert(commercial.includes("closedActiveEditor || containedCommercialPanel"), "unrelated dialog closes must not reset the active commercial editor");
  assert(commercial.includes("click.wiseSupplyingCommercialPopup dblclick.wiseSupplyingCommercialPopup"), "native Edit and row double-click interactions should trigger popup recovery");
  assert(commercial.includes("function alignSupplyingCommercialColumns"), "commercial columns should share a dedicated alignment pass");
  assert(commercial.includes("commercialColumnWidths: { cos: 96, markup: 64, revenue: 88, rsp: 96 }"), "commercial header and row widths should use one geometry contract");
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
  assert(commercial.includes('$cell.insertAfter($revenue)'), "native RSP cells should remain immediately after Revenue during redraws");
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
  testCommercialTextMarkup();
  await testRequestManager();
  console.log("Runtime reliability tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
