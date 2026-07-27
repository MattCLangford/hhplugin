(function () {
  "use strict";

  if (window.__wiseHireHopExternalModBridgeLoaded) return;
  window.__wiseHireHopExternalModBridgeLoaded = true;

  var CONFIG = {
    // Paste the complete external mod URL between these quotes.
    // Leave this blank until you are ready to enable the mod.
    url: "https://cdn.jsdelivr.net/gh/AdamYesEvents/HH-YES-Plugins@v0.1.45/loader-stage-designer.js",

    // Optional: paste a SHA-256/384/512 Subresource Integrity value supplied
    // by the mod owner. Leave blank if the owner does not provide one.
    integrity: "",

    timeoutMs: 20000
  };

  var currentScriptUrl = document.currentScript && document.currentScript.src || "";
  var script = null;
  var timeout = null;
  var state = {
    version: "0.2",
    status: "waiting-for-depot-check",
    source: "",
    error: "",
    check: loadExternalMod,
    retry: loadExternalMod
  };

  window.WiseHireHopExternalMod = state;
  loadExternalMod();

  function loadExternalMod() {
    if (state.status === "loading" || state.status === "loaded") return;

    var shared = window.WiseProposalSectionBuilderHireHop;
    if (!shared || !shared.depot || typeof shared.depot.isProposalCreation !== "function") {
      state.status = "blocked-no-depot-detector";
      state.source = "";
      state.error = "";
      return;
    }

    try {
      if (!shared.depot.isProposalCreation()) {
        state.status = "blocked-depot";
        state.source = "";
        state.error = "";
        return;
      }
    } catch (error) {
      state.status = "blocked-depot";
      state.source = "";
      state.error = "";
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
      return;
    }

    clearPendingLoad();
    state.status = "loading";
    state.source = externalUrl.origin + externalUrl.pathname;
    state.error = "";

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
    };
    script.onerror = function () {
      fail(new Error("The external mod could not be downloaded. Check its URL and hosting permissions."));
    };

    timeout = setTimeout(function () {
      fail(new Error("The external mod download timed out."));
    }, normaliseTimeout(CONFIG.timeoutMs));

    (document.head || document.documentElement).appendChild(script);
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
    state.status = "failed";
    state.error = String(error && error.message || error || "Unknown external mod error");
    try {
      console.warn("[WiseHireHop:external-mod] " + state.error);
    } catch (ignore) {}
  }
})();
