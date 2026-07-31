(function () {
  "use strict";

  if (window.__wiseHireHopExternalModBridgeLoaded) return;
  window.__wiseHireHopExternalModBridgeLoaded = true;

  var CONFIG = {
    // Load the pinned tool directly. The upstream loader currently rejects
    // HireHop API 1.31 because it compares the numeric value with 1.3.
    url: "https://cdn.jsdelivr.net/gh/AdamYesEvents/HH-YES-Plugins@v0.1.56/loader-stage-designer.js",

    // Optional: paste a SHA-256/384/512 Subresource Integrity value supplied
    // by the mod owner. Leave blank if the owner does not provide one.
    integrity: "",

    timeoutMs: 20000
  };

  var currentScriptUrl = document.currentScript && document.currentScript.src || "";
  var script = null;
  var timeout = null;
  var menuTimer = null;
  var registry = [];
  var state = {
    version: "0.3",
    status: "waiting-for-depot-check",
    source: "",
    error: "",
    menuStatus: "waiting",
    check: loadExternalMod,
    retry: loadExternalMod
  };

  window.WiseHireHopExternalMod = state;
  loadExternalMod();

  function loadExternalMod() {
    if (state.status === "loading") return;
    if (state.status === "loaded") {
      maintainToolMenus();
      return;
    }

    var shared = window.WiseProposalSectionBuilderHireHop;
    if (!shared || !shared.depot || typeof shared.depot.isProposalCreation !== "function") {
      state.status = "blocked-no-depot-detector";
      state.source = "";
      state.error = "";
      state.menuStatus = "blocked-no-depot-detector";
      return;
    }

    try {
      if (!shared.depot.isProposalCreation()) {
        state.status = "blocked-depot";
        state.source = "";
        state.error = "";
        state.menuStatus = "blocked-depot";
        removeToolMenus();
        return;
      }
    } catch (error) {
      state.status = "blocked-depot";
      state.source = "";
      state.error = "";
      state.menuStatus = "blocked-depot";
      removeToolMenus();
      return;
    }

    var externalUrl;
    try {
      externalUrl = validateUrl(CONFIG.url);
    } catch (error) {
      fail(error);
      return;
    }

    if (!externalUrl) {
      state.status = "not-configured";
      state.error = "";
      state.menuStatus = "not-configured";
      return;
    }

    clearPendingLoad();
    installToolRegistry();
    startMenuMaintenance();
    state.status = "loading";
    state.source = externalUrl.origin + externalUrl.pathname;
    state.error = "";
    state.menuStatus = "waiting-for-tool";

    script = document.createElement("script");
    script.id = "wise-hirehop-external-mod";
    script.async = true;
    script.src = externalUrl.href;
    script.referrerPolicy = "no-referrer";

    var integrity = String(CONFIG.integrity || "").replace(/^\s+|\s+$/g, "");
    if (integrity) {
      if (!/^sha(?:256|384|512)-[A-Za-z0-9+/]+={0,2}(?:\s+sha(?:256|384|512)-[A-Za-z0-9+/]+={0,2})*$/.test(integrity)) {
        fail(new Error("The external mod integrity value is not a valid SHA-256, SHA-384 or SHA-512 SRI value."));
        return;
      }
      script.integrity = integrity;
      script.crossOrigin = "anonymous";
    }

    script.onload = function () {
      clearTimeout(timeout);
      timeout = null;
      state.status = "loaded";
      state.error = "";
      maintainToolMenus();
    };
    script.onerror = function () {
      fail(new Error("The external mod could not be downloaded. Check its URL and hosting permissions."));
    };

    timeout = setTimeout(function () {
      fail(new Error("The external mod download timed out."));
    }, normaliseTimeout(CONFIG.timeoutMs));

    (document.head || document.documentElement).appendChild(script);
  }

  function installToolRegistry() {
    var tools = window.HHTools && typeof window.HHTools === "object" ? window.HHTools : {};
    if (tools.__wiseProposalCreationAdapter) return;

    var previousRegister = typeof tools.register === "function" ? tools.register : null;
    tools.register = function (tool) {
      registerTool(tool);
      if (previousRegister) {
        try { previousRegister.call(tools, tool); } catch (ignore) {}
      }
    };
    tools.__wiseProposalCreationAdapter = true;
    window.HHTools = tools;
  }

  function registerTool(tool) {
    if (!tool || !tool.id) return;
    var id = safeToolId(tool.id);
    if (!id) return;

    for (var i = 0; i < registry.length; i++) {
      if (registry[i].id === id) return;
    }

    registry.push({
      id: id,
      label: String(tool.label || id),
      icon: String(tool.icon || "ui-icon-image"),
      onClick: tool.onClick
    });
    maintainToolMenus();
  }

  function startMenuMaintenance() {
    if (menuTimer) return;
    menuTimer = setInterval(maintainToolMenus, 1000);
  }

  function maintainToolMenus() {
    if (!isProposalCreationDepot()) {
      state.menuStatus = "blocked-depot";
      removeToolMenus();
      return;
    }
    if (!isSupportedHireHopRuntime()) {
      state.menuStatus = "waiting-for-hirehop";
      return;
    }
    if (!registry.length) {
      state.menuStatus = "waiting-for-tool";
      return;
    }

    var $ = window.jQuery;
    var frameCount = 0;
    var instanceCount = 0;

    $(".custom_itemsFrame").each(function () {
      frameCount += 1;
      var inst = $(this).data("custom-items");
      if (!inst) return;
      instanceCount += 1;

      if (inst.new_item_popup_menu) {
        ensureMenuSection($, inst, inst.new_item_popup_menu, inst.new_item_popup_menu);
      }
      if (inst.new_menu && inst.popup_menu) {
        ensureMenuSection($, inst, inst.new_menu, inst.popup_menu);
      }
    });

    state.menuStatus = instanceCount ? "ready" : (frameCount ? "waiting-for-instance" : "waiting-for-frame");
  }

  function isSupportedHireHopRuntime() {
    if (!window.jQuery || typeof window.user === "undefined" || typeof window.doc_type === "undefined") {
      return false;
    }

    var apiVersion = Number(window.hh_api_version);
    // The tool targets HireHop API 1.x. Treat 1.31 as a 1.x release instead
    // of applying the upstream loader's incorrect numeric <= 1.3 comparison.
    return isFinite(apiVersion) && apiVersion >= 1 && apiVersion < 2;
  }

  function ensureMenuSection($, inst, menu, refreshTarget) {
    if (!menu || !menu.length) return;
    var changed = false;

    if (!menu.find("hr.hhtool_sep").length) {
      $("<hr>", { "class": "hhtool_sep" }).appendTo(menu);
      changed = true;
    }

    for (var i = 0; i < registry.length; i++) {
      var tool = registry[i];
      if (menu.find("li.hhtool_" + tool.id).length) continue;
      buildMenuEntry($, tool, inst).appendTo(menu);
      changed = true;
    }

    if (changed) {
      try { refreshTarget.menu("refresh"); } catch (ignore) {}
    }
  }

  function buildMenuEntry($, tool, inst) {
    return $("<li>", {
      "class": "hhtool_" + tool.id,
      html: "<div><span class=\"ui-icon " + safeIconClass(tool.icon) + "\"></span>" + escapeHtml(tool.label) + "</div>"
    }).click(function () {
      $(".ui-menu").hide();
      if ($(this).hasClass("ui-state-disabled")) return;
      try {
        if (typeof tool.onClick === "function") tool.onClick(inst);
      } catch (error) {
        try { console.warn("[WiseHireHop:external-mod] External tool failed to open.", error); } catch (ignore) {}
      }
    });
  }

  function removeToolMenus() {
    if (!window.jQuery || !registry.length) return;
    var $ = window.jQuery;

    for (var i = 0; i < registry.length; i++) {
      $("li.hhtool_" + registry[i].id).remove();
    }

    $("hr.hhtool_sep").each(function () {
      var separator = $(this);
      if (!separator.siblings("li[class*=\"hhtool_\"]").length) separator.remove();
    });
  }

  function isProposalCreationDepot() {
    var shared = window.WiseProposalSectionBuilderHireHop;
    try {
      return !!(shared && shared.depot &&
        typeof shared.depot.isProposalCreation === "function" &&
        shared.depot.isProposalCreation());
    } catch (ignore) {
      return false;
    }
  }

  function safeToolId(value) {
    return String(value || "").replace(/[^A-Za-z0-9_-]/g, "");
  }

  function safeIconClass(value) {
    return String(value || "ui-icon-image").replace(/[^A-Za-z0-9_\-\s]/g, "");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function validateUrl(value) {
    value = String(value || "").replace(/^\s+|\s+$/g, "");
    if (!value) return null;
    if (value.length > 4096 || /[\u0000-\u001f\u007f]/.test(value)) {
      throw new Error("The external mod URL is malformed.");
    }
    if (!window.URL) {
      throw new Error("This browser cannot safely validate the external mod URL.");
    }

    var parsed;
    try {
      parsed = new window.URL(value);
    } catch (ignore) {
      throw new Error("The external mod URL is invalid.");
    }

    if (parsed.protocol !== "https:" || !parsed.hostname) {
      throw new Error("The external mod URL must be a complete HTTPS URL.");
    }
    if (parsed.username || parsed.password) {
      throw new Error("The external mod URL must not contain a username or password.");
    }

    if (currentScriptUrl) {
      try {
        var current = new window.URL(currentScriptUrl);
        if (parsed.origin === current.origin && parsed.pathname === current.pathname) {
          throw new Error("The external mod URL points back to this bridge file.");
        }
      } catch (error) {
        if (error && /points back/.test(String(error.message || ""))) throw error;
      }
    }

    return parsed;
  }

  function normaliseTimeout(value) {
    value = Number(value);
    if (!isFinite(value)) return 20000;
    return Math.max(5000, Math.min(60000, value));
  }

  function clearPendingLoad() {
    if (timeout) clearTimeout(timeout);
    timeout = null;
    if (script && script.parentNode) script.parentNode.removeChild(script);
    script = null;
  }

  function fail(error) {
    clearPendingLoad();
    if (menuTimer) clearInterval(menuTimer);
    menuTimer = null;
    removeToolMenus();
    state.status = "failed";
    state.menuStatus = "failed";
    state.error = String(error && error.message || error || "Unknown external mod error");
    try {
      console.warn("[WiseHireHop:external-mod] " + state.error);
    } catch (ignore) {}
  }
})();
