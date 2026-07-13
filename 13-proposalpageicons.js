/* ===========================================================================
 * Wise Proposal Page Icons
 * ---------------------------------------------------------------------------
 * Supplying-list-only visual helper for the Proposal Creation depot.
 *
 * Heading naming contract:
 *   Section: ...       document page (rendered by the proposal generator)
 *   Dept: ...          document page (rendered by the proposal generator)
 *   // Section: ...    muted/prohibited page (not rendered)
 *   // Dept: ...       muted/prohibited page (not rendered)
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
    version: "2026-07-13.2",
    styleId: "wise-proposal-page-icon-styles",
    tree: getHireHopSelector("tree", "#items_tab .jstree"),
    refreshDelayMs: 70,
    recoveryIntervalMs: 1200,
    recoveryChecks: 15
  };

  var ACTIVE_CLASS = "wise-proposal-page-icon";
  var DISABLED_CLASS = "wise-proposal-page-icon-disabled";
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
    disabledCount: 0
  };

  bootstrap();

  function bootstrap() {
    installStyles();
    bindEvents();
    scheduleRefresh(0);

    state.recoveryTimer = setInterval(function () {
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

    $treeHost.find("li.jstree-node").each(function () {
      var $li = $(this);
      var node = getTreeNode(tree, $li.attr("id"));
      var $icon = getThemeIcon($li);
      if (!$icon.length) return;

      if (!isHeadingNode(node)) {
        clearIcon($icon);
        return;
      }

      var pageType = classifyHeadingTitle(getNodeRawTitle(node));
      if (!pageType) {
        clearIcon($icon);
        return;
      }

      $icon.addClass(ACTIVE_CLASS)
        .toggleClass(DISABLED_CLASS, pageType.disabled)
        .attr("data-wise-proposal-page", pageType.disabled ? "disabled" : "active");

      if (pageType.disabled) disabledCount += 1;
      else activeCount += 1;
    });

    state.activeCount = activeCount;
    state.disabledCount = disabledCount;
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
  }

  function clearIcon($icon) {
    if (!$icon || !$icon.length || !$icon.hasClass(ACTIVE_CLASS)) return;
    $icon.removeClass(ACTIVE_CLASS + " " + DISABLED_CLASS)
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
    if (node.data) {
      candidates.push(node.data.title, node.data.TITLE, node.data.name, node.data.NAME);
    }
    if (node.original) {
      candidates.push(node.original.title, node.original.text, node.original.name);
    }
    candidates.push(node.text);

    for (var i = 0; i < candidates.length; i++) {
      var value = $.trim(String(candidates[i] == null ? "" : candidates[i]));
      if (classifyHeadingTitle(value)) return value;
    }
    return "";
  }

  function classifyHeadingTitle(value) {
    var raw = $.trim(String(value == null ? "" : value));
    var disabled = /^\/\/\s*/.test(raw);
    if (disabled) raw = raw.replace(/^\/\/\s*/, "");

    var match = raw.match(/^(section|dept)\s*:\s*/i);
    if (!match) return null;
    return { type: String(match[1]).toLowerCase(), disabled: disabled };
  }

  // The depot gate intentionally reads window.user. The shared page-wide
  // detector is useful elsewhere, but has previously matched unrelated form
  // controls on some HireHop screens. Failing closed keeps other depots native.
  function isProposalCreationDepot() {
    var shared = window.WiseProposalSectionBuilderHireHop;
    if (!shared || !shared.depot) return false;

    try {
      var raw = readCurrentUserDepotValue();
      if (raw == null || raw === "") return false;

      var rawId = shared.depot.normaliseId ? shared.depot.normaliseId(raw) : "";
      var allowedId = (typeof shared.depot.resolveId === "function" &&
        shared.depot.resolveId("Proposal Creation")) || KNOWN_PROPOSAL_CREATION_DEPOT_ID;
      if (rawId && allowedId && rawId === allowedId) return true;

      var rawText = shared.depot.normaliseText
        ? shared.depot.normaliseText(raw)
        : String(raw).trim().toLowerCase();
      return rawText === "proposal creation";
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

    var activeSvg = svgDataUri(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 30">' +
        '<defs><linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffdf2"/><stop offset="1" stop-color="#f0dfa5"/></linearGradient></defs>' +
        '<path d="M7.8 3.8h9.1l4.3 4.4v18.1H7.8z" fill="#b9a15f" opacity=".28" transform="translate(1 1)"/>' +
        '<path d="M7.8 3.8h9.1l4.3 4.4v18.1H7.8z" fill="url(#paper)" stroke="#ad9553" stroke-width="1.25" stroke-linejoin="round"/>' +
        '<path d="M16.9 4.1v4.1h4" fill="#e5cf89" stroke="#ad9553" stroke-width="1.1" stroke-linejoin="round"/>' +
        '<path d="M10.7 13.3h7.7M10.7 17h7.7M10.7 20.7h5.5" fill="none" stroke="#99813e" stroke-width="1.2" stroke-linecap="round"/>' +
      '</svg>'
    );
    var disabledSvg = svgDataUri(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 30">' +
        '<defs><linearGradient id="muted" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f5f5f2"/><stop offset="1" stop-color="#d8dad8"/></linearGradient></defs>' +
        '<path d="M7.8 3.8h9.1l4.3 4.4v18.1H7.8z" fill="#9fa39f" opacity=".2" transform="translate(1 1)"/>' +
        '<path d="M7.8 3.8h9.1l4.3 4.4v18.1H7.8z" fill="url(#muted)" stroke="#929792" stroke-width="1.2" stroke-linejoin="round"/>' +
        '<path d="M16.9 4.1v4.1h4" fill="#d1d4d1" stroke="#929792" stroke-width="1.05" stroke-linejoin="round"/>' +
        '<path d="M10.7 13.3h7.2M10.7 17h5.7" fill="none" stroke="#a5aaa5" stroke-width="1.15" stroke-linecap="round"/>' +
        '<path d="M9.6 23.3l10.2-11.1" fill="none" stroke="#777d78" stroke-width="1.7" stroke-linecap="round" opacity=".9"/>' +
      '</svg>'
    );

    var style = document.createElement("style");
    style.id = CFG.styleId;
    style.textContent =
      CFG.tree + " .jstree-themeicon." + ACTIVE_CLASS + "{" +
        "background-image:url(\"" + activeSvg + "\")!important;" +
        "background-position:center!important;background-repeat:no-repeat!important;" +
        "background-size:20px 22px!important;opacity:.96!important;" +
      "}" +
      CFG.tree + " .jstree-themeicon." + ACTIVE_CLASS + "." + DISABLED_CLASS + "{" +
        "background-image:url(\"" + disabledSvg + "\")!important;opacity:.82!important;" +
      "}";
    (document.head || document.documentElement).appendChild(style);
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
    describe: function () {
      return {
        version: CFG.version,
        supplyingListFound: !!$(CFG.tree).length,
        depotAllowed: isProposalCreationDepot(),
        activePageIcons: state.activeCount,
        disabledPageIcons: state.disabledCount
      };
    }
  };
})();
