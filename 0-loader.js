(function () {
  "use strict";

  if (window.__wiseHireHopEnhancementLoaderLoaded) return;
  window.__wiseHireHopEnhancementLoaderLoaded = true;

  var CFG = {
    version: "2026-06-24.6",
    fallbackBaseUrl: "https://mattclangford.github.io/hhplugin/",
    initialDelayMs: 180,
    routeDebounceMs: 220,
    recoveryIntervalMs: 2500,
    recoveryChecks: 12,
    scripts: {
      hirehop: { file: "5-hirehop.js", version: "0.7" },
      docprev: { file: "1-docprev.js", version: "0.6" },
      autopull: { file: "2-apselall.js", version: "0.5" },
      meta: { file: "3-meta.js", version: "0.1" },
      layout: { file: "4-layout.js", version: "0.1" },
      editor: { file: "6-editor2.js", version: "1.6" },
      captrack: { file: "7-captrack.js", version: "3.0" },
      stage: { file: "8-stagedesigner.js", version: "2.0" },
      checklist: { file: "9-jobchecklist.js", version: "1.0" },
      projectJobs: { file: "10-projectjobs-qol.js", version: "0.9" },
      projectJourney: { file: "11-projectjourney.js", version: "0.6" },
      projectGroups: { file: "12-projectgroups.js", version: "0.5" }
    }
  };

  var baseUrl = resolveBaseUrl();
  var loaded = {};
  var loading = {};
  var routeTimer = null;
  var recoveryTimer = null;
  var recoveryCount = 0;
  var jqueryBindAttempts = 0;

  boot();

  function boot() {
    scheduleRouteCheck(CFG.initialDelayMs);
    bindBrowserEvents();
    bindJQueryEventsSoon();
    installRouteObserver();
    startRecoveryChecks();

    window.WiseHireHopEnhancementLoader = {
      version: CFG.version,
      loaded: loaded,
      check: function () { checkRoutes(); },
      load: loadScript
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

    if (hasSupplyingList()) loadProposalSupplyingBundle();
    if (isHomePage()) loadSequence(["hirehop", "captrack"]);
    if (hasProjectOrJobTabs()) loadSequence(["checklist", "projectJourney"]);
    if (hasProjectJobsPage()) loadSequence(["hirehop", "projectJobs", "projectGroups"]);
    if (hasAutopullDialog()) loadSequence(["autopull"]);
  }

  function loadProposalSupplyingBundle() {
    loadSequence(["hirehop", "docprev", "meta", "layout", "editor", "stage"]);
  }

  function loadSequence(keys) {
    var chain = Promise.resolve();
    for (var i = 0; i < keys.length; i++) {
      (function (key) {
        chain = chain.then(function () { return loadScript(key); });
      })(keys[i]);
    }
    return chain;
  }

  function loadScript(key) {
    var item = CFG.scripts[key];
    if (!item) return Promise.reject(new Error("Unknown Wise HireHop module: " + key));
    if (loaded[key]) return Promise.resolve();
    if (loading[key]) return loading[key];

    loading[key] = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.async = false;
      script.src = baseUrl + item.file + "?v=" + encodeURIComponent(item.version);
      script.onload = function () {
        loaded[key] = true;
        delete loading[key];
        scheduleRouteCheck(60);
        resolve();
      };
      script.onerror = function () {
        delete loading[key];
        reject(new Error("Could not load Wise HireHop module: " + item.file));
      };
      (document.head || document.documentElement).appendChild(script);
    });

    return loading[key];
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
    return matches(node, "#items_tab,#details_tab,#proj_info,#gbox_jobs_grid,#tabs,.hh-framework_tabs,.ui-tabs,.ui-tabs-nav,.ui-dialog,.ui-dialog-content,.auto_add_check") ||
      !!query(node, "#items_tab,#details_tab,#proj_info,#gbox_jobs_grid,#tabs,.hh-framework_tabs,.ui-tabs,.ui-tabs-nav,.ui-dialog,.ui-dialog-content,.auto_add_check");
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
