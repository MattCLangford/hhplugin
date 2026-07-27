(function () {
  "use strict";

  if (window.__wiseHireHopEnhancementLoaderLoaded) return;
  window.__wiseHireHopEnhancementLoaderLoaded = true;

  var CFG = {
    version: "2026-07-21.21",
    fallbackBaseUrl: "https://mattclangford.github.io/hhplugin/",
    initialDelayMs: 180,
    routeDebounceMs: 220,
    recoveryIntervalMs: 2500,
    recoveryChecks: 12,
    scripts: {
      hirehop: { file: "5-hirehop.js", version: "1.2" },
      docprev: { file: "1-docprev.js", version: "2.3" },
      autopull: { file: "2-apselall.js", version: "0.5" },
      meta: { file: "3-meta.js", version: "0.2" },
      layout: { file: "4-layout.js", version: "0.2" },
      editor: { file: "6-editor2.js", version: "1.8", enabled: false },
      captrack: { file: "7-captrack.js", version: "3.1" },
      stage: { file: "8-stagedesigner.js", version: "2.4" },
      checklist: { file: "9-jobchecklist.js", version: "1.2" },
      projectJobs: { file: "10-projectjobs-qol.js", version: "1.0" },
      projectJourney: { file: "11-projectjourney.js", version: "0.7" },
      projectGroups: { file: "12-projectgroups.js", version: "0.13" },
      proposalPageIcons: { file: "13-proposalpageicons.js", version: "0.8" },
      jobGroups: { file: "14-jobgroups.js", version: "1.1" },
      supplyingCommercial: { file: "15-supplyingcommercial.js", version: "2.4" },
      externalMod: { file: "16-externalmod.js", version: "0.2" }
    }
  };

  var baseUrl = resolveBaseUrl();
  var loaded = {};
  var loading = {};
  var failures = {};
  var moduleState = {};
  var runtimeErrors = [];
  var routeTimer = null;
  var recoveryTimer = null;
  var recoveryCount = 0;
  var jqueryBindAttempts = 0;
  var supplyingRoot = null;

  boot();

  function boot() {
    scheduleRouteCheck(CFG.initialDelayMs);
    bindBrowserEvents();
    bindJQueryEventsSoon();
    installRouteObserver();
    startRecoveryChecks();
    installRuntimeErrorDiagnostics();

    window.WiseHireHopEnhancementLoader = {
      version: CFG.version,
      loaded: loaded,
      failures: failures,
      check: function () { checkRoutes(); },
      load: loadScript,
      describe: describeLoader
    };
  }

  function resolveBaseUrl() {
    var src = "";
    var current = document.currentScript;
    if (current && current.src) src = current.src;

    if (!src) {
      var scripts = document.getElementsByTagName("script");
      for (var i = scripts.length - 1; i >= 0; i--) {
        if (/0-loader\.js(?:[?#]|$)/i.test(scripts[i].src || "")) {
          src = scripts[i].src;
          break;
        }
      }
    }

    if (!src) return CFG.fallbackBaseUrl;
    return src.replace(/[^\/?#]+(?:[?#].*)?$/, "");
  }

  function bindBrowserEvents() {
    addEvent(window, "load", function () { scheduleRouteCheck(CFG.routeDebounceMs); });
    addEvent(window, "focus", function () { scheduleRouteCheck(CFG.routeDebounceMs); });
    addEvent(window, "hashchange", function () { scheduleRouteCheck(CFG.routeDebounceMs); });
    addEvent(window, "popstate", function () { scheduleRouteCheck(CFG.routeDebounceMs); });
  }

  function bindJQueryEventsSoon() {
    if (window.jQuery) {
      window.jQuery(document)
        .on("ajaxComplete.wiseEnhancementLoader", function () {
          scheduleRouteCheck(CFG.routeDebounceMs);
        })
        .on("dialogopen.wiseEnhancementLoader", ".ui-dialog-content", function () {
          scheduleRouteCheck(40);
        });
      return;
    }

    jqueryBindAttempts += 1;
    if (jqueryBindAttempts < 40) setTimeout(bindJQueryEventsSoon, 250);
  }

  function installRouteObserver() {
    if (!window.MutationObserver || !document.documentElement) return;

    var observer = new MutationObserver(function (mutations) {
      if (mutationsMayAffectRoutes(mutations)) scheduleRouteCheck(CFG.routeDebounceMs);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function startRecoveryChecks() {
    recoveryTimer = setInterval(function () {
      if (document.hidden) return;
      recoveryCount += 1;
      scheduleRouteCheck(0);
      if (recoveryCount >= CFG.recoveryChecks) {
        clearInterval(recoveryTimer);
        recoveryTimer = null;
      }
    }, CFG.recoveryIntervalMs);
  }

  function scheduleRouteCheck(delay) {
    if (routeTimer) clearTimeout(routeTimer);
    routeTimer = setTimeout(function () {
      routeTimer = null;
      checkRoutes();
    }, Math.max(0, Number(delay) || 0));
  }

  function checkRoutes() {
    if (!window.jQuery) {
      scheduleRouteCheck(250);
      return;
    }

    // The external bridge uses the shared authoritative depot detector and
    // requests its configured URL only in Proposal Creation.
    loadAfterShared(["externalMod"]).then(function () {
      callModuleMethod("externalMod", window.WiseHireHopExternalMod, "check");
    });

    var nextSupplyingRoot = document.getElementById("items_tab");
    if (nextSupplyingRoot) {
      var supplyingRootChanged = nextSupplyingRoot !== supplyingRoot;
      supplyingRoot = nextSupplyingRoot;
      loadProposalSupplyingBundle().then(function () {
        if (supplyingRootChanged) refreshSupplyingModuleHealth();
      });
    } else {
      supplyingRoot = null;
    }
    if (isHomePage()) loadAfterShared(["captrack"]);
    if (hasProjectOrJobTabs()) loadAfterShared(["checklist", "projectJourney", "jobGroups"]);
    if (hasProjectJobsPage()) loadAfterShared(["projectJobs", "projectGroups"]);
    if (hasJobDetailsPage()) {
      loadAfterShared(["jobGroups"]).then(function () {
        callModuleMethod("jobGroups", window.__wiseJobGroups, "refresh");
      });
    }
    if (hasAutopullDialog()) loadIndependent(["autopull"]);
  }

  function loadProposalSupplyingBundle() {
    return loadAfterShared(["docprev", "meta", "layout", "editor", "stage", "proposalPageIcons", "supplyingCommercial"]);
  }

  function loadAfterShared(keys) {
    return loadScript("hirehop").then(
      function () { return loadIndependent(filterModulesForActiveDepot(keys)); },
      function (error) {
        // These modules read the shared selectors, depot rules and request
        // service during bootstrap. Loading them without that dependency can
        // leave their single-run guard set around an incomplete instance.
        reportModuleFailure("hirehop", error);
        return [];
      }
    );
  }

  function filterModulesForActiveDepot(keys) {
    if (keys.indexOf("stage") === -1) return keys;

    var shared = window.WiseProposalSectionBuilderHireHop;
    var isProposalCreation = false;
    try {
      isProposalCreation = !!(shared && shared.depot &&
        typeof shared.depot.isProposalCreation === "function" &&
        shared.depot.isProposalCreation());
    } catch (ignore) {}
    if (!isProposalCreation) return keys;

    moduleState.stage = {
      status: "blocked-depot",
      at: Date.now(),
      file: CFG.scripts.stage.file,
      reason: "Stage Designer is disabled in Proposal Creation."
    };
    return keys.filter(function (key) { return key !== "stage"; });
  }

  function refreshSupplyingModuleHealth() {
    setTimeout(function () {
      callModuleMethod("docprev", window.__wiseDocPreview, "refresh");
      callModuleMethod("stage", window.__wiseStageDesigner, "refresh");
      callModuleMethod("proposalPageIcons", window.__wiseProposalPageIcons, "refresh");
      callModuleMethod("supplyingCommercial", window.__wiseSupplyingCommercial, "refresh");
    }, 80);
  }

  function callModuleMethod(name, module, method) {
    try {
      if (module && typeof module[method] === "function") module[method]();
    } catch (error) {
      try { console.warn("[WiseHireHop:loader] Module health refresh failed: " + name, error); } catch (ignore) {}
    }
  }

  function loadIndependent(keys) {
    var requests = [];
    for (var i = 0; i < keys.length; i++) {
      (function (key) {
        requests.push(loadScript(key).catch(function (error) {
          reportModuleFailure(key, error);
          return null;
        }));
      })(keys[i]);
    }
    return Promise.all(requests);
  }

  function loadScript(key) {
    var item = CFG.scripts[key];
    if (!item) return Promise.reject(new Error("Unknown Wise HireHop module: " + key));
    if (item.enabled === false) return Promise.resolve();
    if (loaded[key]) return Promise.resolve();
    if (loading[key]) return loading[key];
    var failed = failures[key];
    if (failed && failed.nextRetryAt > Date.now()) return Promise.reject(failed.error);

    loading[key] = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      var settled = false;
      var timeout = setTimeout(function () {
        fail(new Error("Timed out loading Wise HireHop module: " + item.file));
      }, 15000);
      script.async = false;
      script.src = baseUrl + item.file + "?v=" + encodeURIComponent(item.version);
      script.onload = function () {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        loaded[key] = true;
        moduleState[key] = { status: "loaded", at: Date.now(), file: item.file };
        delete failures[key];
        delete loading[key];
        scheduleRouteCheck(60);
        resolve();
      };
      script.onerror = function () { fail(new Error("Could not load Wise HireHop module: " + item.file)); };

      function fail(error) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (script.parentNode) script.parentNode.removeChild(script);
        delete loading[key];
        var previous = failures[key];
        var attempts = (previous && previous.attempts || 0) + 1;
        var backoff = Math.min(5 * 60 * 1000, 2000 * Math.pow(2, Math.min(attempts - 1, 7)));
        backoff += Math.floor(Math.random() * 750);
        failures[key] = { attempts: attempts, nextRetryAt: Date.now() + backoff, error: error, file: item.file };
        moduleState[key] = { status: "failed", at: Date.now(), attempts: attempts, retryInMs: backoff, file: item.file };
        reject(error);
      }
      (document.head || document.documentElement).appendChild(script);
    });

    return loading[key];
  }

  function reportModuleFailure(key, error) {
    var failure = failures[key];
    if (failure && failure.reportedAttempt === failure.attempts) return;
    if (failure) failure.reportedAttempt = failure.attempts;
    try {
      console.warn("[WiseHireHop:loader] Module failed independently; other modules will continue.", {
        module: key,
        file: failure && failure.file,
        attempt: failure && failure.attempts,
        retryInMs: failure ? Math.max(0, failure.nextRetryAt - Date.now()) : 0,
        message: String(error && error.message || error || "Unknown error")
      });
    } catch (ignore) {}
  }

  function describeLoader() {
    var failed = {};
    Object.keys(failures).forEach(function (key) {
      failed[key] = {
        file: failures[key].file,
        attempts: failures[key].attempts,
        retryInMs: Math.max(0, failures[key].nextRetryAt - Date.now()),
        message: String(failures[key].error && failures[key].error.message || "")
      };
    });
    return {
      version: CFG.version,
      baseUrl: baseUrl,
      loaded: Object.keys(loaded).filter(function (key) { return !!loaded[key]; }),
      loading: Object.keys(loading),
      failures: failed,
      modules: moduleState,
      runtimeErrors: runtimeErrors.slice()
    };
  }

  function installRuntimeErrorDiagnostics() {
    addEvent(window, "error", function (event) {
      var filename = String(event && event.filename || "");
      var key = findModuleKeyForFilename(filename);
      if (!key) return;
      recordRuntimeError(key, String(event && event.message || "Runtime error"));
    });
    addEvent(window, "unhandledrejection", function (event) {
      var reason = event && event.reason;
      var stack = String(reason && reason.stack || "");
      var key = findModuleKeyForFilename(stack);
      if (!key) return;
      recordRuntimeError(key, String(reason && reason.message || reason || "Unhandled rejection"));
    });
  }

  function findModuleKeyForFilename(value) {
    value = String(value || "");
    var keys = Object.keys(CFG.scripts);
    for (var i = 0; i < keys.length; i++) {
      if (value.indexOf(CFG.scripts[keys[i]].file) !== -1) return keys[i];
    }
    return "";
  }

  function recordRuntimeError(key, message) {
    var signature = key + "|" + message;
    for (var i = 0; i < runtimeErrors.length; i++) {
      if (runtimeErrors[i].signature === signature) return;
    }
    runtimeErrors.push({ signature: signature, module: key, message: message, at: Date.now() });
    if (runtimeErrors.length > 20) runtimeErrors.shift();
    moduleState[key] = { status: "runtime-error", at: Date.now(), file: CFG.scripts[key] && CFG.scripts[key].file, message: message };
    try { console.warn("[WiseHireHop:loader] Runtime error isolated to module " + key + ": " + message); } catch (ignore) {}
  }

  function hasSupplyingList() {
    return !!document.getElementById("items_tab");
  }

  function isHomePage() {
    return /\/home\.php(?:[?#]|$)/i.test(String(window.location.pathname || "") + String(window.location.search || ""));
  }

  function hasProjectJobsPage() {
    return !!(document.getElementById("details_tab") &&
      document.getElementById("proj_info") &&
      document.getElementById("gbox_jobs_grid"));
  }

  function hasJobDetailsPage() {
    if (isNonDetailJobTabCurrent() || isSupplyingPanelCurrent()) return false;
    var candidates = [
      document.getElementById("job_info"),
      document.getElementById("job_details"),
      document.getElementById("job_detail"),
      document.getElementById("job_info_container"),
      document.getElementById("details_tab"),
      query(document, "[data-page='job-details']")
    ];

    for (var i = 0; i < candidates.length; i++) {
      var candidate = candidates[i];
      if (!candidate || closest(candidate, "#items_tab") || closest(candidate, "#proj_info")) continue;
      if (query(candidate, "#proj_info") || query(candidate, "#gbox_jobs_grid")) continue;
      if (looksLikeJobDetailsText(candidate.textContent || "")) return true;
    }

    // Some HireHop job-detail variants do not provide a stable content ID.
    // Use the full, distinctive native field signature as a safe fallback.
    // Loading the module is non-destructive unless it independently finds a
    // valid Proposal Creation job-details root.
    if (document.body && looksLikeJobDetailsText(document.body.textContent || "")) return true;
    return false;
  }

  function looksLikeJobDetailsText(value) {
    var text = normaliseText(value);
    return text.indexOf("job id") !== -1 &&
      text.indexOf("kit booking start") !== -1 &&
      countContains(text, ["job memo", "client reference", "price structure", "warehouse name"]) >= 2;
  }

  function isSupplyingPanelCurrent() {
    var panel = document.getElementById("items_tab");
    if (!panel) return false;
    var ariaHidden = String(panel.getAttribute && panel.getAttribute("aria-hidden") || "").toLowerCase();
    if (ariaHidden === "true") return false;
    if (ariaHidden === "false") return true;
    if (matches(panel, ".ui-tabs-hide,[hidden]")) return false;
    var style = window.getComputedStyle ? window.getComputedStyle(panel) : panel.style;
    return !style || (style.display !== "none" && style.visibility !== "hidden");
  }

  function isNonDetailJobTabCurrent() {
    var active = document.querySelectorAll(
      "#tabs > ul li.ui-tabs-active,#tabs > ul li.ui-state-active,#tabs > ul li.active,#tabs > ul [aria-selected='true']," +
      ".hh-framework_tabs > ul li.ui-tabs-active,.hh-framework_tabs > ul li.ui-state-active,.hh-framework_tabs > ul li.active,.hh-framework_tabs > ul [aria-selected='true']," +
      ".ui-tabs > ul.ui-tabs-nav li.ui-tabs-active,.ui-tabs > ul.ui-tabs-nav li.ui-state-active,.ui-tabs > ul.ui-tabs-nav li.active,.ui-tabs > ul.ui-tabs-nav [aria-selected='true']"
    );
    for (var i = 0; i < active.length; i++) {
      var host = closest(active[i], "ul");
      var hostText = normaliseText(host && host.textContent || "");
      if (hostText.indexOf("job details") === -1 || hostText.indexOf("supplying") === -1) continue;
      var label = normaliseText(active[i].textContent || "");
      return label.indexOf("job details") === -1 && label.indexOf("event requirements") === -1;
    }
    return false;
  }

  function hasProjectOrJobTabs() {
    var hosts = document.querySelectorAll("#tabs > ul, .hh-framework_tabs > ul, .ui-tabs > ul.ui-tabs-nav, ul.ui-tabs-nav");
    for (var i = 0; i < hosts.length; i++) {
      if (isProjectOrJobTabsHost(hosts[i])) return true;
    }
    return false;
  }

  function isProjectOrJobTabsHost(host) {
    if (!host || closest(host, "#items_tab")) return false;
    var text = normaliseText(host.textContent || "");
    if (!text) return false;

    var project = text.indexOf("project details") !== -1 &&
      countContains(text, ["tasks", "notes", "files", "schedule", "emails"]) >= 2;
    var job = (text.indexOf("event requirements") !== -1 || text.indexOf("job details") !== -1) &&
      countContains(text, ["tasks", "notes", "files", "supplying", "archive", "billing", "purchase orders", "schedule", "emails"]) >= 2;

    return project || job;
  }

  function hasAutopullDialog() {
    var dialogs = document.querySelectorAll(".ui-dialog");
    for (var i = 0; i < dialogs.length; i++) {
      if (isAutopullDialog(dialogs[i])) return true;
    }
    return false;
  }

  function isAutopullDialog(dialog) {
    if (!dialog || !isVisible(dialog)) return false;
    var title = dialog.querySelector(".ui-dialog-title");
    if (normaliseText(title ? title.textContent : "") !== "autopull") return false;
    return !!dialog.querySelector("input.auto_add_check[type='checkbox']");
  }

  function mutationsMayAffectRoutes(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var nodes = mutations[i].addedNodes || [];
      for (var n = 0; n < nodes.length; n++) {
        if (nodeMayAffectRoutes(nodes[n])) return true;
      }
    }
    return false;
  }

  function nodeMayAffectRoutes(node) {
    if (!node || node.nodeType !== 1) return false;
    return matches(node, "#items_tab,#details_tab,#proj_info,#job_info,#job_details,#job_detail,#job_info_container,[data-page='job-details'],#gbox_jobs_grid,#tabs,.hh-framework_tabs,.ui-tabs,.ui-tabs-nav,.ui-dialog,.ui-dialog-content,.auto_add_check") ||
      !!query(node, "#items_tab,#details_tab,#proj_info,#job_info,#job_details,#job_detail,#job_info_container,[data-page='job-details'],#gbox_jobs_grid,#tabs,.hh-framework_tabs,.ui-tabs,.ui-tabs-nav,.ui-dialog,.ui-dialog-content,.auto_add_check");
  }

  function countContains(text, needles) {
    var count = 0;
    for (var i = 0; i < needles.length; i++) {
      if (text.indexOf(needles[i]) !== -1) count += 1;
    }
    return count;
  }

  function normaliseText(value) {
    return String(value || "").replace(/\(\s*\d+\s*\)/g, "").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "").toLowerCase();
  }

  function isVisible(element) {
    return !!(element && (element.offsetWidth || element.offsetHeight || element.getClientRects().length));
  }

  function query(node, selector) {
    try { return node.querySelector && node.querySelector(selector); } catch (e) { return null; }
  }

  function matches(node, selector) {
    var fn = node.matches || node.msMatchesSelector || node.webkitMatchesSelector;
    if (!fn) return false;
    try { return fn.call(node, selector); } catch (e) { return false; }
  }

  function closest(node, selector) {
    while (node && node.nodeType === 1) {
      if (matches(node, selector)) return node;
      node = node.parentNode;
    }
    return null;
  }

  function addEvent(target, name, handler) {
    if (target && target.addEventListener) target.addEventListener(name, handler, false);
  }
})();
