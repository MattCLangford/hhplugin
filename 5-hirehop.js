(function () {
  "use strict";

  /*
   * Shared HireHop integration contract for the Wise proposal platform.
   * This module names the HireHop UI surfaces and endpoints the editor depends on.
   */
  var hirehop = {
    version: "2026-05-18.4",
    purpose: "Centralises HireHop selectors, endpoints, depot gating, retry timings, search helpers, and tree item prefixes.",

    selectors: {
      itemsTab: "#items_tab",
      toolbarHost: "#items_tab > div:first-child",
      tree: "#items_tab .jstree",
      treeNodes: "#items_tab li.jstree-node,#items_tab a.jstree-anchor",
      treeClicked: "#items_tab .jstree-clicked",
      treeSelectedFallback: "#items_tab li.jstree-node.jstree-clicked, #items_tab li.jstree-selected, #items_tab li[aria-selected='true'], #items_tab a.jstree-anchor[aria-selected='true']",
      depotHeader: ".hh-header-depot",
      depotHeaderSelect: ".hh-header-depot select",
      depotLabel: "[data-label=\"depotTxt\"]",
      depotCandidates: ".hh-header-depot select,select,input,textarea,.hh_base_select,.hh_depots_select,[data-depot-id],[data-current-depot-id],[data-branch-id],[data-current-branch-id],[data-location-id],[data-site-id]"
    },

    endpoints: {
      itemsSave: "/php_functions/items_save.php",
      itemsDelete: "/php_functions/items_delete.php",
      searchList: "/php_functions/search_list.php"
    },

    depot: {
      allowedIds: [],
      allowedNames: ["Proposal Creation"],
      blockWhenUndetected: true,
      fieldNames: ["depot_id", "depot", "branch_id", "branch", "location_id", "location", "site_id", "site", "warehouse_id", "warehouse"],
      labelText: ["warehouse name", "warehouse", "depot", "branch", "location", "site"]
    },

    timings: {
      bootstrapMaxTries: 120,
      bootstrapRetryMs: 500,
      writeThrottleMs: 1150,
      rateLimitRetryMs: 65000,
      saveMaxAttempts: 2,
      previewAttachRetryDelays: [10, 180, 720, 1600],
      listedItemMenuRetryDelays: [350, 900, 1500, 2300]
    },

    kindPrefixes: {
      0: "a",
      1: "b",
      2: "c",
      3: "d",
      4: "e",
      5: "f",
      6: "g"
    }
  };

  var $ = window.jQuery;

  hirehop.depot.normaliseId = normaliseDepotId;
  hirehop.depot.normaliseText = normaliseDepotText;
  hirehop.depot.getActiveContext = getActiveDepotContext;
  hirehop.depot.isAllowed = isAllowedDepot;
  hirehop.depot.resolveName = resolveDepotNameFromId;
  hirehop.depot.resolveId = resolveDepotIdFromName;
  hirehop.depot.debug = debugDepotDetection;

  hirehop.describe = function () {
    return {
      version: hirehop.version,
      selectors: hirehop.selectors,
      endpoints: hirehop.endpoints,
      depot: hirehop.depot,
      timings: hirehop.timings,
      kindPrefixes: hirehop.kindPrefixes,
      activeDepotContext: getActiveDepotContext()
    };
  };

  function getActiveDepotContext(options) {
    options = options || {};

    if (options.useCache && window.__wiseHireHopDepotContext) {
      return normaliseDepotContext(window.__wiseHireHopDepotContext);
    }

    var candidates = [
      readHeaderDepotContext(),
      readVisibleCurrentDepotContext(),
      readNamedDepotContext(),
      readAttributeDepotContext(),
      readUrlDepotContext(),
      readWindowDepotContext(),
      readStoredDepotContext()
    ];
    var context = normaliseDepotContext(selectBestDepotContext(candidates, hirehop.depot.allowedIds, hirehop.depot.allowedNames));

    if (context.id && !context.name) {
      context.name = resolveDepotNameFromId(context.id);
    } else if (context.name && !context.id) {
      context.id = resolveDepotIdFromName(context.name);
    }

    context = normaliseDepotContext(context);
    window.__wiseHireHopDepotContext = context;
    return context;
  }

  function isAllowedDepot(context, options) {
    options = options || {};

    var rule = options.rule && typeof options.rule === "object" ? options.rule : hirehop.depot;
    var enabled = rule.enabled !== false;
    if (!enabled) return true;

    var allowedIds = normaliseAllowedDepotValues(options.allowedIds || rule.allowedIds, true);
    var allowedNames = normaliseAllowedDepotValues(options.allowedNames || rule.allowedNames, false);
    var blockWhenUndetected = options.blockWhenUndetected;
    if (blockWhenUndetected !== true && blockWhenUndetected !== false) {
      blockWhenUndetected = rule.blockWhenUndetected !== false;
    }

    context = normaliseDepotContext(context || getActiveDepotContext());

    if (context.id && allowedIds.indexOf(context.id) !== -1) return true;
    if (context.name && allowedNames.indexOf(normaliseDepotText(context.name)) !== -1) return true;

    var currentContext = readVisibleCurrentDepotContext(allowedIds, allowedNames);
    if (contextMatchesAllowedDepot(currentContext, allowedIds, allowedNames)) {
      window.__wiseHireHopDepotContext = currentContext;
      return true;
    }

    return context.id || context.name ? false : !blockWhenUndetected;
  }

  function readHeaderDepotContext() {
    var select = findHeaderDepotSelect();
    if (select) {
      return readControlDepotContext(select);
    }

    var labelled = findContextNearDepotLabel();
    if (labelled.id || labelled.name) return labelled;

    return {};
  }

  function findHeaderDepotSelect() {
    if (!ensureJQuery()) return null;

    var headerSelect = findExplicitHeaderDepotSelect();
    if (headerSelect) return headerSelect;

    var label = findDepotLabelElement();
    var near = findDepotCandidateNear(label, true);
    if (near) return near;

    var fields = hirehop.depot.fieldNames || [];
    var found = null;

    $("select,input").each(function () {
      if (found) return false;
      if (!matchesDepotField(this, fields)) return;
      found = this;
      return false;
    });

    return found;
  }

  function findExplicitHeaderDepotSelect() {
    if (!ensureJQuery()) return null;

    var selector = hirehop.selectors && hirehop.selectors.depotHeaderSelect;
    var select = selector ? $(selector).filter(":visible").first() : $();
    if (select.length) return select.get(0);

    var headerSelector = hirehop.selectors && hirehop.selectors.depotHeader;
    var header = headerSelector ? $(headerSelector).filter(":visible").first() : $();
    select = header.length ? header.find("select").filter(":visible").first() : $();
    return select.length ? select.get(0) : null;
  }

  function findContextNearDepotLabel() {
    if (!ensureJQuery()) return {};

    var label = findDepotLabelElement();
    var candidate = findDepotCandidateNear(label, false);
    return candidate ? readControlDepotContext(candidate) : {};
  }

  function findDepotLabelElement() {
    if (!ensureJQuery()) return null;

    var labelSelector = hirehop.selectors && hirehop.selectors.depotLabel;
    var label = labelSelector ? $(labelSelector).first() : $();
    if (label.length) return label;

    var labelValues = buildFieldLookup(hirehop.depot.labelText || []);
    return $("b,strong,label,span,td,th,div").filter(function () {
      var text = normaliseDepotText($(this).text() || "");
      return !!labelValues[normaliseFieldKey(text)];
    }).first();
  }

  function findDepotCandidateNear(label, controlsOnly) {
    if (!ensureJQuery() || !label || !label.length) return null;

    var selector = controlsOnly ? "select,input" : hirehop.selectors.depotCandidates;
    var scopes = [
      label.siblings(selector),
      label.nextAll(selector),
      label.parent().find(selector),
      label.closest("td,th,li,div,span,form").find(selector),
      label.closest("tr").find(selector)
    ];

    for (var i = 0; i < scopes.length; i++) {
      var candidate = firstUsefulCandidate(scopes[i]);
      if (candidate) return candidate;
    }

    return null;
  }

  function firstUsefulCandidate(candidates) {
    if (!ensureJQuery() || !candidates || !candidates.length) return null;

    var fields = hirehop.depot.fieldNames || [];
    var first = null;

    candidates.each(function () {
      if (first) return false;
      if (this === document.body || this === document.documentElement) return;
      if (isLikelyDropdownList(this)) return;
      if (matchesDepotField(this, fields) || readControlDepotContext(this).id || readControlDepotContext(this).name) {
        first = this;
        return false;
      }
    });

    return first;
  }

  function isLikelyDropdownList(element) {
    if (!ensureJQuery() || !element) return false;
    var el = $(element);
    return !!el.closest(".ui-menu,.ui-dialog,.popup,.modal,.context-menu").length;
  }

  function readNamedDepotContext() {
    if (!ensureJQuery()) return {};

    var fields = hirehop.depot.fieldNames || [];
    var id = "";
    var name = "";

    $("input,select,textarea").each(function () {
      if (id && name) return false;
      if (!matchesDepotField(this, fields)) return;

      var next = readControlDepotContext(this);
      if (!id && next.id) id = next.id;
      if (!name && next.name) name = next.name;
    });

    return { id: id, name: name };
  }

  function readVisibleCurrentDepotContext(allowedIds, allowedNames) {
    if (!ensureJQuery()) return {};

    allowedIds = normaliseAllowedDepotValues(allowedIds || hirehop.depot.allowedIds, true);
    allowedNames = normaliseAllowedDepotValues(allowedNames || hirehop.depot.allowedNames, false);
    if (!allowedIds.length && !allowedNames.length) return {};

    var selectors = [
      ".hh-header-depot select",
      "select",
      "input",
      "textarea",
      "[data-depot-id]",
      "[data-current-depot-id]",
      "[data-depot-name]",
      "[data-current-depot-name]",
      ".hh_base_select",
      ".hh_depots_select"
    ].join(",");
    var context = {};

    $(selectors).each(function () {
      if (context.id || context.name) return false;
      if (!isCurrentDepotCandidate(this)) return;

      var text = getCurrentDepotElementText(this);
      if (!text || text.length > 160) return;

      var matchedName = matchAllowedDepotNameFromText(text, allowedNames);
      if (matchedName) {
        context = normaliseDepotContext({
          id: resolveDepotIdFromName(matchedName),
          name: matchedName
        });
        return false;
      }

      var matchedId = matchAllowedDepotIdFromText(text, allowedIds);
      if (matchedId) {
        context = normaliseDepotContext({
          id: matchedId,
          name: resolveDepotNameFromId(matchedId)
        });
        return false;
      }
    });

    return context;
  }

  function isCurrentDepotCandidate(element) {
    if (!element || !ensureJQuery()) return false;
    if (element.tagName && /^(script|style)$/i.test(element.tagName)) return false;

    var el = $(element);
    if (!el.is(":visible") && !el.is("select,input,textarea")) return false;
    if (el.closest("script,style,#wise-doc-preview-panel,#wise-proposal-page-editor-modal,#wise-capacity-tracker-modal").length) return false;
    if (el.closest(hirehop.selectors.depotHeader || ".hh-header-depot").length) return true;
    if (matchesDepotField(element, hirehop.depot.fieldNames || [])) return true;
    if (readDataValue(el, ["depotId", "currentDepotId", "depotName", "currentDepotName"])) return true;

    var label = findDepotLabelElement();
    var scope = label && label.length ? label.closest("tr,td,th,li,div,span,form") : $();
    if (scope.length && (scope.get(0) === element || scope.has(element).length)) return true;

    return false;
  }

  function getCurrentDepotElementText(element) {
    if (!element || !ensureJQuery()) return "";

    var el = $(element);
    var selected = el.is("select") ? el.find("option:selected").first() : $();

    return normaliseDepotText(firstNonEmpty([
      selected.length ? selected.text() : "",
      readDataValue(el, ["depotName", "currentDepotName", "name", "label", "text"]),
      el.is("input,textarea,select") ? el.val() : "",
      el.attr("aria-label"),
      el.attr("title"),
      el.text()
    ]), true);
  }

  function matchAllowedDepotNameFromText(text, allowedNames) {
    var normalisedText = normaliseComparableDepotName(stripDepotLabelText(text));
    if (!normalisedText) return "";

    for (var i = 0; i < allowedNames.length; i++) {
      var allowed = normaliseDepotText(allowedNames[i], true);
      var normalisedAllowed = normaliseComparableDepotName(allowed);
      if (!normalisedAllowed) continue;

      if (normalisedText === normalisedAllowed) {
        return allowed;
      }
    }

    return "";
  }

  function stripDepotLabelText(value) {
    return normaliseDepotText(value, true).replace(/^(?:current\s+)?(?:warehouse\s+name|warehouse|depot|branch|location|site)\s*:?\s*/i, "");
  }

  function matchAllowedDepotIdFromText(text, allowedIds) {
    var id = normaliseDepotId(text);
    if (!id) return "";
    return allowedIds.indexOf(id) !== -1 ? id : "";
  }

  function readControlDepotContext(element) {
    if (!ensureJQuery() || !element) return {};

    var el = $(element);
    var selected = el.is("select") ? el.find("option:selected").first() : $();
    var value = firstNonEmpty([
      readDataValue(el, ["depotId", "currentDepotId", "branchId", "currentBranchId", "locationId", "siteId", "id", "value", "selected"]),
      el.val && el.val() != null ? el.val() : "",
      selected.length ? selected.attr("value") : "",
      el.attr("value")
    ]);
    var name = firstNonEmpty([
      readDataValue(el, ["depotName", "currentDepotName", "branchName", "currentBranchName", "locationName", "siteName", "name", "label", "text"]),
      selected.length ? selected.text() : "",
      el.is("input,textarea,select") ? "" : el.text()
    ]);

    return normaliseDepotContext({ id: value, name: cleanDepotDisplayText(name) });
  }

  function readDataValue(el, keys) {
    if (!ensureJQuery() || !el || !el.length) return "";

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var dataValue = "";
      try { dataValue = el.data(key); } catch (e) {}
      if (dataValue != null && dataValue !== "") return dataValue;

      var attrName = key.replace(/[A-Z]/g, function (m) { return "-" + m.toLowerCase(); });
      var attrValue = el.attr("data-" + attrName);
      if (attrValue != null && attrValue !== "") return attrValue;
    }

    return "";
  }

  function readAttributeDepotContext() {
    if (!ensureJQuery()) return {};

    var candidates = [
      { selector: "[data-depot-id]", id: "data-depot-id", name: "data-depot-name" },
      { selector: "[data-current-depot-id]", id: "data-current-depot-id", name: "data-current-depot-name" },
      { selector: "[data-branch-id]", id: "data-branch-id", name: "data-branch-name" },
      { selector: "[data-current-branch-id]", id: "data-current-branch-id", name: "data-current-branch-name" },
      { selector: "[data-location-id]", id: "data-location-id", name: "data-location-name" },
      { selector: "[data-site-id]", id: "data-site-id", name: "data-site-name" }
    ];

    for (var i = 0; i < candidates.length; i++) {
      var candidate = candidates[i];
      var el = $(candidate.selector).first();
      if (!el.length) continue;

      var context = normaliseDepotContext({
        id: el.attr(candidate.id),
        name: el.attr(candidate.name) || el.text()
      });
      if (context.id || context.name) return context;
    }

    return {};
  }

  function readUrlDepotContext() {
    try {
      var keys = hirehop.depot.fieldNames || [];
      var params = new URLSearchParams(window.location.search || "");
      var lookup = buildFieldLookup(keys);
      var id = "";

      params.forEach(function (paramValue, key) {
        if (id) return;
        if (!lookup[normaliseFieldKey(key)]) return;
        id = paramValue;
      });

      if (!id) {
        var match = String(window.location.href || "").match(/\/(?:depots?|warehouses?|branches?|locations?|sites?)\/(\d+)(?:\/|$|\?)/i);
        id = match && match[1] ? match[1] : "";
      }

      return { id: id, name: "" };
    } catch (e) {
      return {};
    }
  }

  function readWindowDepotContext() {
    var id = firstWindowValue([
      "depot_id",
      "depotId",
      "current_depot_id",
      "currentDepotId",
      "branch_id",
      "branchId",
      "current_branch_id",
      "currentBranchId",
      "location_id",
      "locationId",
      "site_id",
      "siteId",
      "warehouse_id",
      "warehouseId"
    ]);
    var name = firstWindowValue([
      "depot_name",
      "depotName",
      "current_depot_name",
      "currentDepotName",
      "branch_name",
      "branchName",
      "current_branch_name",
      "currentBranchName",
      "location_name",
      "locationName",
      "site_name",
      "siteName",
      "warehouse_name",
      "warehouseName"
    ]);

    if (window.user && typeof window.user === "object") {
      id = id || firstObjectValue(window.user, [
        "DEPOT_ID",
        "depot_id",
        "DEFAULT_DEPOT_ID",
        "default_depot_id",
        "BRANCH_ID",
        "branch_id",
        "WAREHOUSE_ID",
        "warehouse_id"
      ]);
      name = name || firstObjectValue(window.user, [
        "DEPOT",
        "depot",
        "DEPOT_NAME",
        "depot_name",
        "DEFAULT_DEPOT",
        "default_depot",
        "WAREHOUSE",
        "warehouse"
      ]);
    }

    return { id: id, name: name };
  }

  function readStoredDepotContext() {
    var stores = [];
    try { stores.push(window.sessionStorage); } catch (e) {}
    try { stores.push(window.localStorage); } catch (e2) {}

    for (var s = 0; s < stores.length; s++) {
      var store = stores[s];
      if (!store) continue;

      for (var i = 0; i < store.length; i++) {
        var key = String(store.key(i) || "");
        if (!/(current|selected|active).*(depot|branch|warehouse|location|site)|(depot|branch|warehouse|location|site).*(current|selected|active)/i.test(key)) continue;

        var value = store.getItem(key);
        var context = parseStoredDepotValue(value);
        if (context.id || context.name) return context;
      }
    }

    return {};
  }

  function parseStoredDepotValue(value) {
    if (!value) return {};

    try {
      var data = JSON.parse(value);
      if (data && typeof data === "object") {
        return {
          id: firstObjectValue(data, ["id", "ID", "depot_id", "DEPOT_ID", "branch_id", "warehouse_id", "value"]),
          name: firstObjectValue(data, ["name", "NAME", "depot", "DEPOT", "depot_name", "warehouse", "text", "label"])
        };
      }
    } catch (e) {}

    return { id: value, name: "" };
  }

  function selectBestDepotContext(contexts, allowedIds, allowedNames) {
    var first = {};

    for (var i = 0; i < contexts.length; i++) {
      var context = normaliseDepotContext(contexts[i]);
      if (!context.id && !context.name) continue;

      if (!first.id && !first.name) first = context;
      if (contextMatchesAllowedDepot(context, allowedIds, allowedNames)) return context;
    }

    return first;
  }

  function contextMatchesAllowedDepot(context, allowedIds, allowedNames) {
    context = normaliseDepotContext(context);
    allowedIds = normaliseAllowedDepotValues(allowedIds || hirehop.depot.allowedIds, true);
    allowedNames = normaliseAllowedDepotValues(allowedNames || hirehop.depot.allowedNames, false);

    if (context.id && allowedIds.indexOf(context.id) !== -1) return true;
    if (context.name && allowedNames.indexOf(normaliseDepotText(context.name)) !== -1) return true;

    return false;
  }

  function normaliseDepotContext(context) {
    context = context || {};
    var rawId = trimText(context.id);
    var name = normaliseDepotText(context.name, true);

    if (!name && rawId && !/\d/.test(rawId)) {
      name = normaliseDepotText(rawId, true);
    }

    return {
      id: normaliseDepotId(rawId),
      name: name
    };
  }

  function normaliseAllowedDepotValues(values, isId) {
    var list = [];

    for (var i = 0; i < (values || []).length; i++) {
      var normalised = isId ? normaliseDepotId(values[i]) : normaliseDepotText(values[i]);
      if (!normalised || list.indexOf(normalised) !== -1) continue;
      list.push(normalised);
    }

    return list;
  }

  function normaliseDepotId(value) {
    if (Array.isArray(value)) value = value.length ? value[0] : "";

    var text = trimText(value);
    if (!text) return "";

    var match = text.match(/(\d+)/);
    return match && match[1] ? match[1] : text.toLowerCase();
  }

  function normaliseDepotText(value, preserveCase) {
    var text = trimText(value).replace(/\u00a0/g, " ").replace(/\s+/g, " ");
    if (!text) return "";
    return preserveCase ? text : text.toLowerCase();
  }

  function cleanDepotDisplayText(value) {
    var text = normaliseDepotText(value, true);
    if (!text) return "";

    var parts = text.split(/\s{2,}|\n|\r|\t/);
    return normaliseDepotText(parts[0] || text, true);
  }

  function resolveDepotNameFromId(id) {
    id = normaliseDepotId(id);
    if (!id || !window.depots || typeof window.depots !== "object") return "";

    var match = "";
    eachObject(window.depots, function (key, depot) {
      if (match) return false;

      var depotId = normaliseDepotId(firstObjectValue(depot, ["ID", "id", "DEPOT_ID", "depot_id"]) || key);
      if (depotId !== id) return;

      match = normaliseDepotText(firstObjectValue(depot, ["DEPOT", "depot", "NAME", "name", "TEXT", "text"]), true);
      return false;
    });

    return match;
  }

  function resolveDepotIdFromName(name) {
    var target = normaliseComparableDepotName(name);
    if (!target || !window.depots || typeof window.depots !== "object") return "";

    var match = "";
    eachObject(window.depots, function (key, depot) {
      if (match) return false;

      var depotName = normaliseComparableDepotName(firstObjectValue(depot, ["DEPOT", "depot", "NAME", "name", "TEXT", "text"]));
      if (depotName !== target) return;

      match = normaliseDepotId(firstObjectValue(depot, ["ID", "id", "DEPOT_ID", "depot_id"]) || key);
      return false;
    });

    return match;
  }

  function normaliseComparableDepotName(value) {
    return normaliseDepotText(value).replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
  }

  function matchesDepotField(element, fieldNames) {
    if (!element) return false;

    var lookup = buildFieldLookup(fieldNames || []);
    var keys = [
      element.name,
      element.id,
      element.getAttribute && element.getAttribute("data-name"),
      element.getAttribute && element.getAttribute("data-field"),
      element.getAttribute && element.getAttribute("data-label")
    ];

    for (var i = 0; i < keys.length; i++) {
      var key = normaliseFieldKey(keys[i]);
      if (key && lookup[key]) return true;
      if (/(^|_)(depot|branch|warehouse|location|site)($|_)/.test(key)) return true;
    }

    return false;
  }

  function buildFieldLookup(values) {
    var lookup = {};

    for (var i = 0; i < (values || []).length; i++) {
      var key = normaliseFieldKey(values[i]);
      if (key) lookup[key] = true;
    }

    return lookup;
  }

  function normaliseFieldKey(value) {
    return trimText(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i++) {
      var text = trimText(values[i]);
      if (text) return text;
    }

    return "";
  }

  function firstWindowValue(keys) {
    for (var i = 0; i < keys.length; i++) {
      var value = window[keys[i]];
      if (value != null && value !== "") return value;
    }

    return "";
  }

  function firstObjectValue(object, keys) {
    if (!object || typeof object !== "object") return "";

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (object[key] != null && object[key] !== "") return object[key];
    }

    return "";
  }

  function eachObject(object, fn) {
    for (var key in object) {
      if (!Object.prototype.hasOwnProperty.call(object, key)) continue;
      if (fn(key, object[key]) === false) break;
    }
  }

  function trimText(value) {
    if (value == null) return "";
    return String(value).replace(/^\s+|\s+$/g, "");
  }

  function ensureJQuery() {
    if (!$ && window.jQuery) $ = window.jQuery;
    return $;
  }

  function debugDepotDetection() {
    var candidates = {
      header: readHeaderDepotContext(),
      visibleCurrent: readVisibleCurrentDepotContext(),
      named: readNamedDepotContext(),
      attribute: readAttributeDepotContext(),
      url: readUrlDepotContext(),
      windowValue: readWindowDepotContext(),
      stored: readStoredDepotContext()
    };

    return {
      candidates: candidates,
      selected: getActiveDepotContext(),
      allowed: isAllowedDepot(),
      allowedIds: hirehop.depot.allowedIds.slice(),
      allowedNames: hirehop.depot.allowedNames.slice()
    };
  }

  window.WiseProposalSectionBuilderHireHop = hirehop;
})();
