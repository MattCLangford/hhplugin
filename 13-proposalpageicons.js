/* ===========================================================================
 * Wise Proposal Page Icons
 * ---------------------------------------------------------------------------
 * Supplying-list-only visual helper for the Proposal Creation depot.
 *
 * QTC-V4 Heading custom-field contract:
 *   CreatePage/PageTemplate identify proposal pages and their broad layout.
 *   Include controls the active or muted/not-rendered icon state.
 *   Legacy Section:/Dept: and // markers remain read-only fallbacks.
 *   Technical Summary  client-visible revenue medallion (support heading)
 *
 * Every other HireHop tree icon is left untouched. This module changes only
 * the rendered jsTree icon class; it never changes heading names or item data.
 * ======================================================================== */
(function () {
  "use strict";

  if (window.__wiseProposalPageIconsLoaded) return;
  window.__wiseProposalPageIconsLoaded = true;

  var $ = window.jQuery;
  if (!$) return;

  var CFG = {
    version: "2026-07-21.4",
    styleId: "wise-proposal-page-icon-styles",
    tree: getHireHopSelector("tree", "#items_tab .jstree"),
    refreshDelayMs: 70,
    recoveryIntervalMs: 1200,
    recoveryChecks: 15
  };

  var ACTIVE_CLASS = "wise-proposal-page-icon";
  var DISABLED_CLASS = "wise-proposal-page-icon-disabled";
  var SECTION_CLASS = "wise-proposal-page-icon-section";
  var DEPT_CLASS = "wise-proposal-page-icon-dept";
  var TECHNICAL_SUMMARY_CLASS = "wise-proposal-page-icon-technical-summary";
  var USER_DEPOT_KEYS = [
    "DEPOT_ID", "depot_id", "DEFAULT_DEPOT_ID", "default_depot_id",
    "BRANCH_ID", "branch_id", "WAREHOUSE_ID", "warehouse_id",
    "DEPOT", "depot", "DEPOT_NAME", "depot_name",
    "DEFAULT_DEPOT", "default_depot", "WAREHOUSE", "warehouse"
  ];
  var KNOWN_PROPOSAL_CREATION_DEPOT_ID = "14";
  var state = {
    timer: null,
    recoveryTimer: null,
    recoveryCount: 0,
    observer: null,
    observedTree: null,
    activeCount: 0,
    disabledCount: 0,
    technicalSummaryCount: 0
  };

  bootstrap();

  function bootstrap() {
    installStyles();
    bindEvents();
    scheduleRefresh(0);

    state.recoveryTimer = setInterval(function () {
      if (document.hidden) return;
      state.recoveryCount += 1;
      scheduleRefresh(0);
      if (state.recoveryCount >= CFG.recoveryChecks) {
        clearInterval(state.recoveryTimer);
        state.recoveryTimer = null;
      }
    }, CFG.recoveryIntervalMs);
  }

  function bindEvents() {
    $(window).on("load.wiseProposalPageIcons focus.wiseProposalPageIcons", function () {
      scheduleRefresh(CFG.refreshDelayMs);
    });

    $(document)
      .on("ajaxComplete.wiseProposalPageIcons", function () {
        scheduleRefresh(CFG.refreshDelayMs);
      })
      .on(
        "ready.jstree.wiseProposalPageIcons refresh.jstree.wiseProposalPageIcons " +
        "redraw.jstree.wiseProposalPageIcons rename_node.jstree.wiseProposalPageIcons " +
        "load_node.jstree.wiseProposalPageIcons open_node.jstree.wiseProposalPageIcons",
        CFG.tree,
        function () { scheduleRefresh(CFG.refreshDelayMs); }
      );
  }

  function scheduleRefresh(delay) {
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(function () {
      state.timer = null;
      refreshIcons();
    }, Math.max(0, Number(delay) || 0));
  }

  function refreshIcons() {
    var $treeHost = $(CFG.tree).first();
    maintainObserver($treeHost.get(0));

    if (!$treeHost.length || !isProposalCreationDepot()) {
      clearIcons($treeHost);
      return;
    }

    var tree = getTree($treeHost);
    if (!tree) return;

    var activeCount = 0;
    var disabledCount = 0;
    var technicalSummaryCount = 0;

    $treeHost.find("li.jstree-node").each(function () {
      var $li = $(this);
      var node = getTreeNode(tree, $li.attr("id"));
      var $icon = getThemeIcon($li);
      if (!$icon.length) return;

      if (!isHeadingNode(node)) {
        clearIcon($icon);
        return;
      }

      var pageType = classifyHeadingNode(node);
      if (!pageType) {
        clearIcon($icon);
        return;
      }

      $icon.addClass(ACTIVE_CLASS)
        .toggleClass(SECTION_CLASS, pageType.type === "section")
        .toggleClass(DEPT_CLASS, pageType.type === "dept")
        .toggleClass(TECHNICAL_SUMMARY_CLASS, pageType.type === "technical-summary")
        .toggleClass(DISABLED_CLASS, pageType.disabled)
        .attr("data-wise-proposal-page", pageType.type + (pageType.disabled ? "-disabled" : ""));

      if (pageType.type === "technical-summary") technicalSummaryCount += 1;
      else if (pageType.disabled) disabledCount += 1;
      else activeCount += 1;
    });

    state.activeCount = activeCount;
    state.disabledCount = disabledCount;
    state.technicalSummaryCount = technicalSummaryCount;
  }

  function maintainObserver(treeHost) {
    if (state.observedTree === treeHost) return;
    if (state.observer) state.observer.disconnect();

    state.observer = null;
    state.observedTree = treeHost || null;
    if (!treeHost || !window.MutationObserver) return;

    state.observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].type === "childList" || mutations[i].type === "characterData") {
          scheduleRefresh(CFG.refreshDelayMs);
          return;
        }
      }
    });
    state.observer.observe(treeHost, { childList: true, subtree: true, characterData: true });
  }

  function clearIcons($scope) {
    if ($scope && $scope.length) {
      $scope.find("." + ACTIVE_CLASS).each(function () { clearIcon($(this)); });
    }
    state.activeCount = 0;
    state.disabledCount = 0;
    state.technicalSummaryCount = 0;
  }

  function clearIcon($icon) {
    if (!$icon || !$icon.length || !$icon.hasClass(ACTIVE_CLASS)) return;
    $icon.removeClass(ACTIVE_CLASS + " " + DISABLED_CLASS + " " + SECTION_CLASS + " " + DEPT_CLASS + " " + TECHNICAL_SUMMARY_CLASS)
      .removeAttr("data-wise-proposal-page");
  }

  function getTree($treeHost) {
    try {
      return $treeHost.jstree(true) || null;
    } catch (err) {
      return null;
    }
  }

  function getTreeNode(tree, nodeId) {
    if (!tree || !nodeId) return null;
    try { return tree.get_node(String(nodeId)); } catch (err) { return null; }
  }

  function getThemeIcon($li) {
    var $anchor = $li.children("a.jstree-anchor").first();
    if (!$anchor.length) $anchor = $li.children("a").first();
    return $anchor.children("i.jstree-themeicon").first();
  }

  function isHeadingNode(node) {
    if (!node || !node.data) return false;
    var kind = node.data.kind;
    if (kind == null) kind = node.data.KIND;
    return Number(kind) === 0;
  }

  function getNodeRawTitle(node) {
    if (!node) return "";
    var candidates = [];
    var fallback = "";
    if (node.data) {
      candidates.push(node.data.title, node.data.TITLE, node.data.name, node.data.NAME);
    }
    if (node.original) {
      candidates.push(node.original.title, node.original.text, node.original.name);
    }
    candidates.push(node.text);

    for (var i = 0; i < candidates.length; i++) {
      var value = $.trim(String(candidates[i] == null ? "" : candidates[i]));
      if (!fallback && value) fallback = value;
      if (classifyHeadingTitle(value)) return value;
    }
    return fallback;
  }

  function classifyHeadingTitle(value) {
    var raw = $.trim(String(value == null ? "" : value));
    var disabled = /^\/\/\s*/.test(raw);
    if (disabled) raw = raw.replace(/^\/\/\s*/, "");

    if (!disabled && /^technical\s+summary$/i.test(raw)) {
      return { type: "technical-summary", disabled: false };
    }

    var match = raw.match(/^(section|dept)\s*:\s*/i);
    if (!match) return null;
    return { type: String(match[1]).toLowerCase(), disabled: disabled };
  }

  function classifyHeadingNode(node) {
    var rawTitle = getNodeRawTitle(node);
    var fields = readHeadingCustomFields(node);

    if (!fields.hasCustomContract && /^technical\s+summary$/i.test($.trim(rawTitle))) {
      return { type: "technical-summary", disabled: false };
    }

    if (fields.createPage.present && !isTruthyCustomField(fields.createPage.value)) return null;
    if (fields.templateValues.length) {
      var template = fields.templateValues[0];
      var sectionTemplates = ["1", "2", "16"];
      return {
        type: sectionTemplates.indexOf(template) !== -1 ? "section" : "dept",
        disabled: fields.include.present ? !isTruthyCustomField(fields.include.value) : false
      };
    }

    return classifyHeadingTitle(rawTitle);
  }

  function readHeadingCustomFields(node) {
    var data = node && node.data ? node.data : {};
    var raw = data.CUSTOM_FIELDS || data.custom_fields || data.customFields || {};
    var bag = raw;
    if (typeof raw === "string") {
      try { bag = JSON.parse(raw); } catch (err) { bag = {}; }
    }
    if (!bag || typeof bag !== "object" || Array.isArray(bag)) bag = {};

    var template = findCustomField(bag, data, "PageTemplate");
    var createPage = findCustomField(bag, data, "CreatePage");
    var include = findCustomField(bag, data, "Include");
    return {
      templateValues: normaliseSelections(template.value),
      createPage: createPage,
      include: include,
      hasCustomContract: template.present || createPage.present || include.present
    };
  }

  function findCustomField(bag, data, logicalName) {
    var target = String(logicalName || "").toLowerCase();
    var sources = [bag || {}, data || {}];
    for (var s = 0; s < sources.length; s++) {
      var keys = Object.keys(sources[s]);
      for (var i = 0; i < keys.length; i++) {
        if (String(keys[i]).replace(/^[_~]+/, "").toLowerCase() !== target) continue;
        var value = sources[s][keys[i]];
        if (value && typeof value === "object" && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, "value")) value = value.value;
        return { present: true, value: value };
      }
    }
    return { present: false, value: "" };
  }

  function normaliseSelections(value) {
    if (Array.isArray(value)) return value.map(function (item) {
      if (item && typeof item === "object" && Object.prototype.hasOwnProperty.call(item, "value")) item = item.value;
      return $.trim(String(item || ""));
    }).filter(Boolean);
    if (value && typeof value === "object") {
      if (Object.prototype.hasOwnProperty.call(value, "value")) return normaliseSelections(value.value);
      return Object.keys(value).filter(function (key) {
        var optionValue = value[key];
        var optionText = $.trim(String(optionValue == null ? "" : optionValue)).toLowerCase();
        return isTruthyCustomField(optionValue) || (optionText && ["0", "false", "no", "n", "off"].indexOf(optionText) === -1);
      });
    }
    var text = $.trim(String(value == null ? "" : value));
    if (!text) return [];
    if (/^[\[{]/.test(text)) {
      try { return normaliseSelections(JSON.parse(text)); } catch (err) {}
    }
    return text.split(/\s*[,;|]\s*/).filter(Boolean);
  }

  function isTruthyCustomField(value) {
    if (value && typeof value === "object" && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, "value")) value = value.value;
    if (value === true || value === 1) return true;
    return ["1", "true", "yes", "y", "on", "include", "included"].indexOf($.trim(String(value == null ? "" : value)).toLowerCase()) !== -1;
  }

  function isProposalCreationDepot() {
    var shared = window.WiseProposalSectionBuilderHireHop;
    if (!shared || !shared.depot) return false;

    try {
      var allowedId = (typeof shared.depot.resolveId === "function" &&
        shared.depot.resolveId("Proposal Creation")) || KNOWN_PROPOSAL_CREATION_DEPOT_ID;
      var context = typeof shared.depot.getUserContext === "function" ? shared.depot.getUserContext() : {};
      if (!context || (!context.id && !context.name)) {
        context = typeof shared.depot.getActiveContext === "function"
          ? shared.depot.getActiveContext({ useCache: false })
          : { id: readCurrentUserDepotValue(), name: "" };
      }
      return typeof shared.depot.isAllowed === "function" && shared.depot.isAllowed(context, {
        allowedIds: [allowedId],
        allowedNames: ["Proposal Creation"],
        blockWhenUndetected: true
      });
    } catch (err) {
      return false;
    }
  }

  function readCurrentUserDepotValue() {
    if (!window.user || typeof window.user !== "object") return "";
    for (var i = 0; i < USER_DEPOT_KEYS.length; i++) {
      var value = window.user[USER_DEPOT_KEYS[i]];
      if (value != null && value !== "") return value;
    }
    return "";
  }

  function getHireHopSelector(key, fallback) {
    var shared = window.WiseProposalSectionBuilderHireHop;
    var value = shared && shared.selectors && shared.selectors[key];
    return value ? String(value) : fallback;
  }

  function installStyles() {
    if (document.getElementById(CFG.styleId)) return;

    var sectionSvg = svgDataUri(proposalPageSvg("section", false));
    var deptSvg = svgDataUri(proposalPageSvg("dept", false));
    var disabledSectionSvg = svgDataUri(proposalPageSvg("section", true));
    var disabledDeptSvg = svgDataUri(proposalPageSvg("dept", true));
    var technicalSummarySvg = svgDataUri(clientRevenueSvg());

    var style = document.createElement("style");
    style.id = CFG.styleId;
    style.textContent =
      CFG.tree + " .jstree-themeicon." + ACTIVE_CLASS + "{" +
        "background-position:center!important;background-repeat:no-repeat!important;" +
        "background-size:24px 18px!important;opacity:.98!important;" +
      "}" +
      CFG.tree + " .jstree-themeicon." + ACTIVE_CLASS + "." + SECTION_CLASS + "{" +
        "background-image:url(\"" + sectionSvg + "\")!important;" +
      "}" +
      CFG.tree + " .jstree-themeicon." + ACTIVE_CLASS + "." + DEPT_CLASS + "{" +
        "background-image:url(\"" + deptSvg + "\")!important;" +
      "}" +
      CFG.tree + " .jstree-themeicon." + ACTIVE_CLASS + "." + SECTION_CLASS + "." + DISABLED_CLASS + "{" +
        "background-image:url(\"" + disabledSectionSvg + "\")!important;opacity:.84!important;" +
      "}" +
      CFG.tree + " .jstree-themeicon." + ACTIVE_CLASS + "." + DEPT_CLASS + "." + DISABLED_CLASS + "{" +
        "background-image:url(\"" + disabledDeptSvg + "\")!important;opacity:.84!important;" +
      "}" +
      CFG.tree + " .jstree-themeicon." + ACTIVE_CLASS + "." + TECHNICAL_SUMMARY_CLASS + "{" +
        "background-image:url(\"" + technicalSummarySvg + "\")!important;" +
        "background-size:23px 19px!important;opacity:1!important;" +
      "}";
    (document.head || document.documentElement).appendChild(style);
  }

  function proposalPageSvg(type, disabled) {
    var paperTop = disabled ? "#f4f4f1" : "#fffdf5";
    var paperBottom = disabled ? "#d8dad7" : "#ead99b";
    var frame = disabled ? "#8c928d" : "#9f8744";
    var ink = disabled ? "#818681" : "#182a3a";
    var imageTop = disabled ? "#b8bcba" : "#263f52";
    var imageBottom = disabled ? "#8f9591" : "#102535";
    var gold = disabled ? "#b1b4b1" : "#d4b455";
    var content = "";

    if (type === "section") {
      content =
        '<rect x="3.8" y="3.8" width="28.4" height="18.4" rx="1.3" fill="url(#hero)"/>' +
        '<circle cx="26.6" cy="8" r="2.1" fill="' + gold + '" opacity=".95"/>' +
        '<path d="M4.2 17.2l7-6.2 4.1 3.5 3.6-3 7.1 5.7z" fill="' + (disabled ? "#929792" : "#35566b") + '"/>' +
        '<path d="M4.2 18.4l8.9-5 4.2 3.1 3.1-2.1 11.4 5.4v2H4.2z" fill="' + (disabled ? "#777d78" : "#1b3546") + '"/>' +
        '<rect x="9" y="11.2" width="18" height="4.8" rx="1" fill="' + paperTop + '" stroke="' + gold + '" stroke-width=".65"/>' +
        '<path d="M12.2 13.05h11.6M14.6 14.45h6.8" stroke="' + ink + '" stroke-width=".85" stroke-linecap="round"/>';
    } else {
      content =
        '<path d="M3.8 3.8h13.9v18.4H3.8z" fill="url(#hero)"/>' +
        '<circle cx="13.9" cy="8" r="1.8" fill="' + gold + '" opacity=".95"/>' +
        '<path d="M4.2 17.7l5.3-6 3 3.2 2.1-2.1 2.7 3.3v5.7H4.2z" fill="' + (disabled ? "#838884" : "#28495d") + '"/>' +
        '<path d="M17.7 3.8v18.4" stroke="' + frame + '" stroke-width=".75"/>' +
        '<path d="M20.3 7h9.3M20.3 9.1h6.4" stroke="' + ink + '" stroke-width="1" stroke-linecap="round"/>' +
        '<path d="M20.2 12h9.7v7.1h-9.7zM20.2 14.35h9.7M20.2 16.7h9.7M23.25 12v7.1" fill="none" stroke="' + frame + '" stroke-width=".65"/>';
    }

    if (disabled) {
      content += '<path d="M6.2 21L29.8 5" fill="none" stroke="#6f7570" stroke-width="2.1" stroke-linecap="round" opacity=".94"/>';
    }

    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 26">' +
      '<defs>' +
        '<linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + paperTop + '"/><stop offset="1" stop-color="' + paperBottom + '"/></linearGradient>' +
        '<linearGradient id="hero" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + imageTop + '"/><stop offset="1" stop-color="' + imageBottom + '"/></linearGradient>' +
        '<filter id="shadow" x="-20%" y="-20%" width="150%" height="160%"><feDropShadow dx=".7" dy="1" stdDeviation=".8" flood-color="#2d3640" flood-opacity=".28"/></filter>' +
      '</defs>' +
      '<g filter="url(#shadow)"><rect x="2.5" y="2.5" width="31" height="21" rx="2" fill="url(#paper)" stroke="' + frame + '" stroke-width="1.15"/>' + content + '</g>' +
    '</svg>';
  }

  function clientRevenueSvg() {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 26">' +
      '<defs>' +
        '<linearGradient id="eye" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf4"/><stop offset="1" stop-color="#ead89a"/></linearGradient>' +
        '<radialGradient id="coin" cx="38%" cy="32%" r="72%"><stop offset="0" stop-color="#38566b"/><stop offset="1" stop-color="#102535"/></radialGradient>' +
        '<filter id="shadow" x="-20%" y="-30%" width="150%" height="170%"><feDropShadow dx=".6" dy="1" stdDeviation=".75" flood-color="#2d3640" flood-opacity=".3"/></filter>' +
      '</defs>' +
      '<g filter="url(#shadow)">' +
        '<path d="M2.7 13C6.4 7.1 10.9 4.2 16 4.2S25.6 7.1 29.3 13C25.6 18.9 21.1 21.8 16 21.8S6.4 18.9 2.7 13z" fill="url(#eye)" stroke="#9f8744" stroke-width="1.25" stroke-linejoin="round"/>' +
        '<circle cx="16" cy="13" r="6.7" fill="url(#coin)" stroke="#d4b455" stroke-width="1.15"/>' +
        '<path d="M18.75 9.45c-.72-.72-1.55-1.08-2.52-1.08-1.55 0-2.55 1-2.55 2.5 0 .82.23 1.52.62 2.25m-2.05 0h5.15m-5.05 4.18h6.35m-4.4-4.18c.2 1.63-.28 2.82-1.95 4.18" fill="none" stroke="#fff8dc" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<circle cx="5.75" cy="13" r=".78" fill="#d4b455"/><circle cx="26.25" cy="13" r=".78" fill="#d4b455"/>' +
      '</g>' +
    '</svg>';
  }

  function svgDataUri(svg) {
    return "data:image/svg+xml," + encodeURIComponent(svg)
      .replace(/%20/g, " ")
      .replace(/%3D/g, "=")
      .replace(/%3A/g, ":")
      .replace(/%2F/g, "/");
  }

  window.__wiseProposalPageIcons = {
    version: CFG.version,
    refresh: function () { scheduleRefresh(0); },
    classify: classifyHeadingTitle,
    classifyNode: classifyHeadingNode,
    describe: function () {
      return {
        version: CFG.version,
        supplyingListFound: !!$(CFG.tree).length,
        depotAllowed: isProposalCreationDepot(),
        activePageIcons: state.activeCount,
        disabledPageIcons: state.disabledCount,
        technicalSummaryIcons: state.technicalSummaryCount
      };
    }
  };
})();
