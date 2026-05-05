(function () {
  "use strict";

  try { console.warn("[WiseHireHop] docked doc preview loaded - v2026-04-25.14"); } catch (e) {}

  var $ = window.jQuery;
  if (!$) return;

  var DEPOT_RULE = {
    enabled: true,
    allowedIds: [
      "14"
    ],
    allowedNames: [
      "Project Costs"
    ],
    blockWhenUndetected: true
  };

  var DEPOT_BOOTSTRAP_MAX_TRIES = 120;
  var DEPOT_BOOTSTRAP_RETRY_MS = 500;
  var activeDepotContext = {
    id: "",
    name: ""
  };
  var lastDepotDecisionSignature = "";
  var docPreviewBootstrapStarted = false;

  var TOGGLE_ID = "wise-doc-preview-toggle";
  var OUTER_WRAP_ID = "wise-doc-preview-workspace";
  var LEFT_PANE_ID = "wise-doc-preview-left-pane";
  var RIGHT_PANE_ID = "wise-doc-preview-right-pane";
  var PANEL_ID = "wise-doc-preview-panel";
  var IFRAME_VIEWPORT_ID = "wise-doc-preview-viewport";
  var IFRAME_PRIMARY_ID = "wise-doc-preview-iframe-primary";
  var IFRAME_SECONDARY_ID = "wise-doc-preview-iframe-secondary";
  var VARIANT_SELECT_ID = "wise-doc-preview-variant";

  var PREVIEW_CONFIG = {
    minPreviewWidth: 360,
    refreshDebounceMs: 1500,
    timezone: "Europe/London",
    mergeHtmlPath: "/modules/docmaker/merge-html.php",
    defaultDocumentVariantKey: "proposal_default",
    documentVariants: [
      {
        key: "proposal_default",
        family: "Proposal",
        label: "Default",
        previewMode: "page",
        params: {
          doc: "166",
          engine: "1"
        }
      },
      {
        key: "jobtrack_gp_predictor",
        family: "Job Track",
        label: "GP% Predictor",
        previewMode: "wide",
        params: {
          doc: "162",
          engine: "0"
        }
      }
    ],
    staticParams: {
      type: "1",
      sub_id: "0",
      sub_type: "16",
      format: "html",
      stn: "0",
      or: "0",
      nums: "0"
    },
    refreshUrlPatterns: [
      /\/php_functions\/items_(?:save|delete|sort|move|copy|duplicate|load)(?:\.php)?(?:\?|$)/i,
      /\/php_functions\/items?(?:_[a-z]+)?(?:\.php)?(?:\?|$)/i
    ],
    selectionAttributeFilter: ["class", "aria-selected"],
    previewLoadActivateDelayMs: 180,
    previewLoadFollowUpDelaysMs: [55, 120],
    widePreviewMinWidth: 620,
    widePreviewWidthPercent: 42,
    widePreviewScaleThreshold: 0.72
  };

  var MIN_PREVIEW_WIDTH = PREVIEW_CONFIG.minPreviewWidth;
  var REFRESH_DEBOUNCE_MS = PREVIEW_CONFIG.refreshDebounceMs;

  var panelOpen = false;
  var autoRefreshEnabled = true;
  var refreshTimer = null;
  var domObserver = null;

  var lastIframeScrollTop = 0;
  var lastIframeScrollRatio = 0;
  var previewRefreshInFlight = false;
  var pendingRefreshReason = null;
  var activePreviewFrameId = IFRAME_PRIMARY_ID;
  var previewHasLoaded = false;
  var lastSelectedNodeIdsKey = "";
  var activeDocumentVariantKey = getDefaultDocumentVariantKey();
  var nextPreviewLoadId = 1;

  waitForAllowedDepotAndInit();

  function waitForAllowedDepotAndInit() {
    var tries = 0;

    function stopWatching() {
      $(window).off(".wiseDocPreviewDepot");
      $(document).off(".wiseDocPreviewDepot");
    }

    function attempt() {
      if (docPreviewBootstrapStarted) return;

      tries++;
      activeDepotContext = getActiveDepotContext();

      if (isAllowedDepot(activeDepotContext)) {
        docPreviewBootstrapStarted = true;
        stopWatching();
        waitForItemsTabAndInit();
        return;
      }

      if (tries < DEPOT_BOOTSTRAP_MAX_TRIES) {
        setTimeout(attempt, DEPOT_BOOTSTRAP_RETRY_MS);
      }
    }

    if (document.readyState === "loading") {
      $(attempt);
    } else {
      attempt();
    }

    $(window).on("load.wiseDocPreviewDepot focus.wiseDocPreviewDepot", attempt);
    $(document).on("ajaxComplete.wiseDocPreviewDepot", attempt);
  }

  function isAllowedDepot(context, options) {
    options = options || {};

    if (!DEPOT_RULE.enabled) return true;

    var allowedIds = normaliseAllowedDepotValues(DEPOT_RULE.allowedIds, true);
    var allowedNames = normaliseAllowedDepotValues(DEPOT_RULE.allowedNames, false);
    var hasRule = allowedIds.length || allowedNames.length;
    var hasDetectedDepot = !!(context && (context.id || context.name));

    if (!hasRule) {
      logDepotDecision("misconfigured", "[WiseHireHop] depot rule enabled but no allowed depots configured", context, options);
      return !DEPOT_RULE.blockWhenUndetected;
    }

    if (context && context.id && allowedIds.indexOf(normaliseDepotId(context.id)) !== -1) {
      logDepotDecision("matched", "[WiseHireHop] depot matched", context, options);
      return true;
    }

    if (context && context.name && allowedNames.indexOf(normaliseDepotText(context.name)) !== -1) {
      logDepotDecision("matched", "[WiseHireHop] depot matched", context, options);
      return true;
    }

    logDepotDecision(
      hasDetectedDepot ? "blocked" : "undetected",
      hasDetectedDepot
        ? "[WiseHireHop] blocked outside allowed depot"
        : "[WiseHireHop] blocked because no depot could be detected",
      context,
      options
    );

    return hasDetectedDepot ? false : !DEPOT_RULE.blockWhenUndetected;
  }

  function logDepotDecision(key, message, context, options) {
    if (options && options.silent) return;

    var signature = [
      key,
      String((context && context.id) || ""),
      String((context && context.name) || "")
    ].join("|");

    if (signature === lastDepotDecisionSignature) return;
    lastDepotDecisionSignature = signature;

    try {
      console.warn(message, context);
    } catch (e) {}
  }

  function getActiveDepotContext() {
    var headerDepotContext = getHeaderDepotContext();
    var context = {
      id: "",
      name: ""
    };

    context.id = firstNonEmpty([
      headerDepotContext.id,
      getDepotIdFromUrl(),
      readFirstNamedFieldValue([
        "depot_id",
        "depot",
        "branch_id",
        "branch",
        "location_id",
        "location",
        "site_id",
        "site"
      ]),
      readFirstValue([
        'input[name="depot_id"]',
        'input[name="depot"]',
        'input[name="branch_id"]',
        'input[name="branch"]',
        'input[name="location_id"]',
        'input[name="location"]',
        'input[name="site_id"]',
        'input[name="site"]',
        'select[name="depot_id"]',
        'select[name="depot"]',
        'select[name="branch_id"]',
        'select[name="branch"]',
        'select[name="location_id"]',
        'select[name="location"]',
        'select[name="site_id"]',
        'select[name="site"]',
        '#depot_id',
        '#depot',
        '#branch_id',
        '#branch',
        '#location_id',
        '#location',
        '#site_id',
        '#site'
      ]),
      readFirstAttribute([
        { selector: "[data-depot-id]", attr: "data-depot-id" },
        { selector: "[data-current-depot-id]", attr: "data-current-depot-id" },
        { selector: "[data-branch-id]", attr: "data-branch-id" },
        { selector: "[data-current-branch-id]", attr: "data-current-branch-id" },
        { selector: "[data-location-id]", attr: "data-location-id" },
        { selector: "[data-site-id]", attr: "data-site-id" }
      ]),
      readWindowValue([
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
        "siteId"
      ])
    ]);

    context.name = firstNonEmpty([
      headerDepotContext.name,
      readFirstNamedSelectText([
        "depot_id",
        "depot",
        "branch_id",
        "branch",
        "location_id",
        "location",
        "site_id",
        "site"
      ]),
      readFirstText([
        'select[name="depot_id"] option:selected',
        'select[name="depot"] option:selected',
        'select[name="branch_id"] option:selected',
        'select[name="branch"] option:selected',
        'select[name="location_id"] option:selected',
        'select[name="location"] option:selected',
        'select[name="site_id"] option:selected',
        'select[name="site"] option:selected',
        '#depot_id option:selected',
        '#depot option:selected',
        '#branch_id option:selected',
        '#branch option:selected',
        '#location_id option:selected',
        '#location option:selected',
        '#site_id option:selected',
        '#site option:selected',
        "#depot_name",
        "#branch_name",
        "#location_name",
        "#site_name",
        ".depot-name",
        ".branch-name",
        ".location-name",
        ".site-name"
      ]),
      readFirstAttribute([
        { selector: "[data-depot-name]", attr: "data-depot-name" },
        { selector: "[data-current-depot-name]", attr: "data-current-depot-name" },
        { selector: "[data-branch-name]", attr: "data-branch-name" },
        { selector: "[data-current-branch-name]", attr: "data-current-branch-name" },
        { selector: "[data-location-name]", attr: "data-location-name" },
        { selector: "[data-site-name]", attr: "data-site-name" }
      ]),
      readWindowValue([
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
        "siteName"
      ])
    ]);

    context.id = normaliseDepotId(context.id);
    context.name = normaliseDepotText(context.name, true);
    window.__wiseHireHopDepotContext = context;

    return context;
  }

  function getHeaderDepotContext() {
    var $select = findHeaderDepotSelect();
    var $selected = $select.length ? $select.find("option:selected").first() : $();

    return {
      id: $.trim(String($select.length ? ($select.val() || $selected.attr("value") || "") : "")),
      name: $.trim(String($selected.length ? ($selected.text() || "") : ""))
    };
  }

  function findHeaderDepotSelect() {
    var $label = $('[data-label="depotTxt"]').first();
    var $select = findSelectNearDepotLabel($label);
    if ($select.length) return $select;

    var $textLabel = $("b, strong, label, span, td, th").filter(function () {
      var text = $.trim(String($(this).text() || "")).replace(/\s+/g, " ");
      return /^warehouse name\s*:?\s*$/i.test(text) || /^depot\s*:?\s*$/i.test(text);
    }).first();

    $select = findSelectNearDepotLabel($textLabel);
    if ($select.length) return $select;

    return $();
  }

  function findSelectNearDepotLabel($label) {
    if (!$label || !$label.length) return $();

    var $select = $label.siblings("select").first();
    if ($select.length) return $select;

    $select = $label.nextAll("select").first();
    if ($select.length) return $select;

    $select = $label.parent().find("select").first();
    if ($select.length) return $select;

    $select = $label.closest("td, th, div, span").find("select").first();
    if ($select.length) return $select;

    return $();
  }

  function getDepotIdFromUrl() {
    try {
      var keys = ["depot_id", "depot", "branch_id", "branch", "location_id", "location", "site_id", "site"];
      var fromQuery = readQueryParamValue(keys);

      if (fromQuery) return fromQuery;

      var href = String(window.location.href || "");
      var match =
        href.match(/[?&](?:depot_id|depot|branch_id|branch|location_id|location|site_id|site)=([^&#]+)/i) ||
        href.match(/\/(?:depots?|branches?|locations?|sites?)\/(\d+)(?:\/|$|\?)/i);

      if (match && match[1]) {
        return $.trim(String(decodeURIComponent(match[1]).replace(/\+/g, " ")));
      }
    } catch (e) {}

    return "";
  }

  function readQueryParamValue(keys) {
    try {
      var params = new URLSearchParams(window.location.search || "");
      var keyLookup = buildFieldLookup(keys);
      var value = "";

      params.forEach(function (paramValue, key) {
        if (value) return;
        if (!keyLookup[normaliseFieldKey(key)]) return;
        value = $.trim(String(paramValue || ""));
      });

      return value;
    } catch (e) {
      return "";
    }
  }

  function readFirstValue(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var $el = $(selectors[i]).first();
      if (!$el.length) continue;

      var value = $.trim(String($el.val() || ""));
      if (value) return value;
    }

    return "";
  }

  function readFirstNamedFieldValue(fieldNames) {
    var lookup = buildFieldLookup(fieldNames);
    var value = "";

    $("input, select, textarea").each(function () {
      if (value) return false;
      if (!matchesNamedField(this, lookup)) return;

      var nextValue = $.trim(String($(this).val() || ""));
      if (!nextValue) return;

      value = nextValue;
      return false;
    });

    return value;
  }

  function readFirstNamedSelectText(fieldNames) {
    var lookup = buildFieldLookup(fieldNames);
    var text = "";

    $("select").each(function () {
      if (text) return false;
      if (!matchesNamedField(this, lookup)) return;

      var nextText = $.trim(String($(this).find("option:selected").text() || ""));
      if (!nextText) return;

      text = nextText;
      return false;
    });

    return text;
  }

  function readFirstText(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var $el = $(selectors[i]).first();
      if (!$el.length) continue;

      var text = $.trim(String($el.text() || $el.val() || ""));
      if (text) return text;
    }

    return "";
  }

  function readFirstAttribute(candidates) {
    for (var i = 0; i < candidates.length; i++) {
      var candidate = candidates[i];
      var $el = $(candidate.selector).first();
      if (!$el.length) continue;

      var value = $.trim(String($el.attr(candidate.attr) || ""));
      if (value) return value;
    }

    return "";
  }

  function readWindowValue(keys) {
    for (var i = 0; i < keys.length; i++) {
      var value = window[keys[i]];
      if (value == null) continue;

      var text = $.trim(String(value));
      if (text) return text;
    }

    return "";
  }

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i++) {
      if (values[i]) return values[i];
    }

    return "";
  }

  function buildFieldLookup(values) {
    var lookup = {};

    for (var i = 0; i < (values || []).length; i++) {
      var key = normaliseFieldKey(values[i]);
      if (!key) continue;
      lookup[key] = true;
    }

    return lookup;
  }

  function matchesNamedField(element, lookup) {
    if (!element) return false;

    var nameKey = normaliseFieldKey(element.name);
    var idKey = normaliseFieldKey(element.id);
    return !!(lookup[nameKey] || lookup[idKey]);
  }

  function normaliseFieldKey(value) {
    return $.trim(String(value == null ? "" : value)).toLowerCase();
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
    var text = $.trim(String(value == null ? "" : value));
    if (!text) return "";

    var match = text.match(/(\d+)/);
    return match && match[1] ? match[1] : text.toLowerCase();
  }

  function normaliseDepotText(value, preserveCase) {
    var text = $.trim(String(value == null ? "" : value)).replace(/\s+/g, " ");
    if (!text) return "";

    return preserveCase ? text : text.toLowerCase();
  }

  // =========================================================
  // BOOTSTRAP
  // =========================================================
  function waitForItemsTabAndInit() {
    var tries = 0;

    function attempt() {
      tries++;

      if ($("#items_tab").length) {
        injectBaseStyles();
        tryAddPreviewButton();
        installAjaxHooks();
        installFetchHooks();

        $(window).off("resize.wiseDocPreview").on("resize.wiseDocPreview", function () {
          if (!panelOpen) return;

          var iframe = getActivePreviewIframe();
          if (!iframe || !iframe.contentDocument) return;

          try {
            fitPreviewToPane(iframe, iframe.contentDocument, getActivePreviewMode());
          } catch (e) {}
        });

        return;
      }

      if (tries < 40) {
        setTimeout(attempt, 500);
      }
    }

    attempt();
  }

  // =========================================================
  // STYLES
  // =========================================================
  function injectBaseStyles() {
    if ($("#wise-doc-preview-styles").length) return;

    var css = [
      '<style id="wise-doc-preview-styles">',
      '#' + OUTER_WRAP_ID + ' {',
      '  display:flex;',
      '  width:100%;',
      '  gap:0;',
      '  align-items:stretch;',
      '  min-height:700px;',
      '}',
      '#' + LEFT_PANE_ID + ' {',
      '  flex:1 1 auto;',
      '  min-width:0;',
      '}',
      '#' + RIGHT_PANE_ID + ' {',
      '  flex:0 0 max(' + MIN_PREVIEW_WIDTH + 'px, 25%);',
      '  width:max(' + MIN_PREVIEW_WIDTH + 'px, 25%);',
      '  min-width:' + MIN_PREVIEW_WIDTH + 'px;',
      '  border-left:1px solid #d9d9d9;',
      '  background:#fff;',
      '  display:flex;',
      '  flex-direction:column;',
      '}',
      '#' + RIGHT_PANE_ID + '.is-wide-doc {',
      '  flex-basis:max(' + PREVIEW_CONFIG.widePreviewMinWidth + 'px, ' + PREVIEW_CONFIG.widePreviewWidthPercent + '%);',
      '  width:max(' + PREVIEW_CONFIG.widePreviewMinWidth + 'px, ' + PREVIEW_CONFIG.widePreviewWidthPercent + '%);',
      '  min-width:' + PREVIEW_CONFIG.widePreviewMinWidth + 'px;',
      '}',
      '#' + PANEL_ID + ' {',
      '  display:flex;',
      '  flex-direction:column;',
      '  height:100%;',
      '  min-height:700px;',
      '}',
      '#' + PANEL_ID + ' .wise-doc-preview-toolbar {',
      '  display:flex;',
      '  align-items:center;',
      '  justify-content:space-between;',
      '  flex-wrap:wrap;',
      '  gap:10px;',
      '  padding:6px 10px 6px 12px;',
      '  border-bottom:1px solid #e3e3e3;',
      '  background:#f7f7f7;',
      '  min-height:44px;',
      '  flex:0 0 auto;',
      '}',
      '#' + PANEL_ID + ' .wise-doc-preview-toolbar-left {',
      '  display:flex;',
      '  align-items:center;',
      '  gap:10px;',
      '  min-width:0;',
      '  flex:1 1 auto;',
      '}',
      '#' + PANEL_ID + ' .wise-doc-preview-toolbar-title {',
      '  font-size:13px;',
      '  font-weight:600;',
      '  white-space:nowrap;',
      '}',
      '#' + PANEL_ID + ' .wise-doc-preview-render {',
      '  display:flex;',
      '  align-items:center;',
      '  gap:6px;',
      '  min-width:0;',
      '}',
      '#' + PANEL_ID + ' .wise-doc-preview-render span {',
      '  font-size:12px;',
      '  white-space:nowrap;',
      '}',
      '#' + PANEL_ID + ' .wise-doc-preview-render select {',
      '  min-width:170px;',
      '  max-width:230px;',
      '}',
      '#' + PANEL_ID + ' .wise-doc-preview-toolbar-right {',
      '  display:flex;',
      '  align-items:center;',
      '  flex-wrap:wrap;',
      '  justify-content:flex-end;',
      '  gap:8px;',
      '}',
      '#' + PANEL_ID + ' .wise-doc-preview-status {',
      '  display:none;',
      '  padding:6px 10px;',
      '  font-size:12px;',
      '  border-bottom:1px solid #ececec;',
      '  background:#fff8e1;',
      '  color:#6b5a00;',
      '}',
      '#' + IFRAME_VIEWPORT_ID + ' {',
      '  position:relative;',
      '  flex:1 1 auto;',
      '  min-height:640px;',
      '  background:#fff;',
      '  overflow:hidden;',
      '}',
      '#' + IFRAME_VIEWPORT_ID + '.is-wide-doc {',
      '  overflow:visible;',
      '}',
      '#' + PANEL_ID + ' .wise-doc-preview-frame {',
      '  position:absolute;',
      '  inset:0;',
      '  display:block;',
      '  width:100%;',
      '  height:100%;',
      '  border:0;',
      '  background:#fff;',
      '  opacity:0;',
      '  visibility:hidden;',
      '  pointer-events:none;',
      '  transition:none;',
      '}',
      '#' + PANEL_ID + ' .wise-doc-preview-frame.is-active {',
      '  opacity:1;',
      '  visibility:visible;',
      '  pointer-events:auto;',
      '  z-index:2;',
      '}',
      '#' + PANEL_ID + ' .wise-doc-preview-frame.is-buffer {',
      '  z-index:1;',
      '}',
      '</style>'
    ].join("");

    $("head").append(css);
  }

  // =========================================================
  // BUTTON
  // =========================================================
  function tryAddPreviewButton() {
    if ($("#" + TOGGLE_ID).length) return;

    var $host = findToolbarHost();
    if (!$host.length) {
      setTimeout(tryAddPreviewButton, 1000);
      return;
    }

    var $btn = $(
      '<button id="' + TOGGLE_ID + '" type="button" ' +
        'class="items_func_btn ui-button ui-widget ui-state-default ui-corner-all ui-button-text-icon-primary" ' +
        'style="width: 140px; margin: 0px 0.5em;" ' +
        'role="button">' +
        '<span class="ui-button-icon-primary ui-icon ui-icon-search"></span>' +
        '<span class="ui-button-text">Preview</span>' +
      '</button>'
    );

    $btn.on("click", function () {
      if (panelOpen) closeDockedPreview();
      else openDockedPreview();
    });

    var $gearBtn = $host.children("button.fixed_width").first();

    if ($gearBtn.length) {
      $btn.insertBefore($gearBtn);
    } else {
      $host.append($btn);
    }
  }

  function findToolbarHost() {
    return $("#items_tab > div:first-child");
  }

  // =========================================================
  // DOCKED LAYOUT
  // =========================================================
  function openDockedPreview() {
    if (panelOpen) return;

    var $itemsTab = $("#items_tab");
    if (!$itemsTab.length) return;

    if (!$("#" + OUTER_WRAP_ID).length) {
      buildDockedLayout($itemsTab);
    }

    panelOpen = true;
    $("#" + RIGHT_PANE_ID).show();
    setButtonActive(true);
    applyPreviewVariantLayout();
    activePreviewFrameId = IFRAME_PRIMARY_ID;
    previewHasLoaded = false;
    lastSelectedNodeIdsKey = getSelectedNodeIdsKey();
    bindPreviewIframeLoad();
    refreshPreviewNow("open");
    installTargetedDomObserver();
  }

  function closeDockedPreview() {
    panelOpen = false;
    clearTimeout(refreshTimer);
    previewRefreshInFlight = false;
    pendingRefreshReason = null;
    activePreviewFrameId = IFRAME_PRIMARY_ID;
    previewHasLoaded = false;
    lastSelectedNodeIdsKey = "";
    resetPreviewFrameState();
    removeTargetedDomObserver();

    var $workspace = $("#" + OUTER_WRAP_ID);
    if ($workspace.length) {
      unwrapDockedLayout();
    }

    setButtonActive(false);
  }

  function buildDockedLayout($itemsTab) {
    var $children = $itemsTab.children().detach();

    var $workspace = $('<div id="' + OUTER_WRAP_ID + '"></div>');
    var $left = $('<div id="' + LEFT_PANE_ID + '"></div>');
    var $right = $('<div id="' + RIGHT_PANE_ID + '"></div>');

    $left.append($children);
    $right.append(buildPreviewPanelHtml());

    $workspace.append($left).append($right);
    $itemsTab.append($workspace);

    bindPreviewPanelEvents();
  }

  function unwrapDockedLayout() {
    var $itemsTab = $("#items_tab");
    var $workspace = $("#" + OUTER_WRAP_ID);
    if (!$itemsTab.length || !$workspace.length) return;

    var $left = $("#" + LEFT_PANE_ID);
    var $children = $left.children().detach();

    $workspace.remove();
    $itemsTab.append($children);
  }

  function buildPreviewPanelHtml() {
    return $(
      '<div id="' + PANEL_ID + '">' +
        '<div class="wise-doc-preview-toolbar">' +
          '<div class="wise-doc-preview-toolbar-left">' +
            '<div class="wise-doc-preview-toolbar-title">Document Preview</div>' +
            '<label class="wise-doc-preview-render">' +
              '<span>Render</span>' +
              '<select id="' + VARIANT_SELECT_ID + '">' +
                buildDocumentVariantOptionsHtml() +
              '</select>' +
            '</label>' +
          '</div>' +
          '<div class="wise-doc-preview-toolbar-right">' +
            '<label style="display:flex; align-items:center; gap:6px; font-size:12px; white-space:nowrap;">' +
              '<input type="checkbox" id="wise-doc-preview-auto" checked> Auto' +
            '</label>' +
            '<button type="button" id="wise-doc-preview-refresh">Refresh</button>' +
            '<button type="button" id="wise-doc-preview-open-tab">Open</button>' +
            '<button type="button" id="wise-doc-preview-close">Close</button>' +
          '</div>' +
        '</div>' +
        '<div class="wise-doc-preview-status" id="wise-doc-preview-status"></div>' +
        '<div id="' + IFRAME_VIEWPORT_ID + '">' +
          '<iframe id="' + IFRAME_PRIMARY_ID + '" class="wise-doc-preview-frame is-active"></iframe>' +
          '<iframe id="' + IFRAME_SECONDARY_ID + '" class="wise-doc-preview-frame"></iframe>' +
        '</div>' +
      '</div>'
    );
  }

  function bindPreviewPanelEvents() {
    syncActiveDocumentVariantControl();
    applyPreviewVariantLayout();

    $("#wise-doc-preview-close").off("click").on("click", function () {
      closeDockedPreview();
    });

    $("#wise-doc-preview-refresh").off("click").on("click", function () {
      refreshPreviewNow("manual");
    });

    $("#wise-doc-preview-open-tab").off("click").on("click", function () {
      var url = buildPreviewUrl();
      if (url) window.open(url, "_blank");
    });

    $("#" + VARIANT_SELECT_ID).off("change").on("change", function () {
      setActiveDocumentVariant($(this).val() || "");

      if (!panelOpen) return;

      refreshPreviewNow("variant");
    });

    $("#wise-doc-preview-auto").off("change").on("change", function () {
      autoRefreshEnabled = $(this).prop("checked");
    });
  }

  function bindPreviewIframeLoad() {
    var frames = getPreviewFrames();

    for (var i = 0; i < frames.length; i++) {
      bindPreviewIframeLoadHandler(frames[i]);
    }
  }

  function setButtonActive(isActive) {
    var $btn = $("#" + TOGGLE_ID);
    if (!$btn.length) return;

    if (isActive) {
      $btn.addClass("ui-state-active");
      $btn.find(".ui-button-text").text("Hide Preview");
    } else {
      $btn.removeClass("ui-state-active");
      $btn.find(".ui-button-text").text("Preview");
    }
  }

  // =========================================================
  // PREVIEW URL
  // =========================================================
  function buildPreviewUrl() {
    var jobId = getCurrentJobId();
    var activeVariant = getActiveDocumentVariant();

    if (!activeVariant) {
      setStatus("No preview document renders are configured.");
      return "";
    }

    if (!jobId) {
      setStatus("Could not determine the current job ID.");
      return "";
    }

    clearStatus();

    var params = new URLSearchParams();
    params.set("main_id", jobId);

    var staticParamKeys = Object.keys(PREVIEW_CONFIG.staticParams);
    for (var k = 0; k < staticParamKeys.length; k++) {
      var key = staticParamKeys[k];
      params.set(key, PREVIEW_CONFIG.staticParams[key]);
    }

    var variantParamKeys = Object.keys(activeVariant.params || {});
    for (var v = 0; v < variantParamKeys.length; v++) {
      var variantKey = variantParamKeys[v];
      params.set(variantKey, activeVariant.params[variantKey]);
    }

    params.set("local", formatLocalDateTime(new Date()));
    params.set("tz", PREVIEW_CONFIG.timezone);

    var selectedIds = getSelectedSupplyingNodeIds();
    for (var i = 0; i < selectedIds.length; i++) {
      params.append("params[selected][]", selectedIds[i]);
    }

    params.set("_ts", String(Date.now()));

    return PREVIEW_CONFIG.mergeHtmlPath + "?" + params.toString();
  }

  function buildDocumentVariantOptionsHtml() {
    var variants = getDocumentVariants();
    var groups = {};
    var groupOrder = [];
    var html = [];

    for (var i = 0; i < variants.length; i++) {
      var variant = variants[i];
      var family = $.trim(String(variant.family || ""));

      if (!family) {
        html.push(buildDocumentVariantOptionHtml(variant));
        continue;
      }

      if (!groups[family]) {
        groups[family] = [];
        groupOrder.push(family);
      }

      groups[family].push(variant);
    }

    for (var j = 0; j < groupOrder.length; j++) {
      var groupName = groupOrder[j];
      html.push('<optgroup label="' + escapeHtml(groupName) + '">');

      var groupVariants = groups[groupName];
      for (var k = 0; k < groupVariants.length; k++) {
        html.push(buildDocumentVariantOptionHtml(groupVariants[k]));
      }

      html.push('</optgroup>');
    }

    return html.join("");
  }

  function buildDocumentVariantOptionHtml(variant) {
    if (!variant || !variant.key) return "";

    var isSelected = variant.key === activeDocumentVariantKey;
    return '<option value="' + escapeHtml(variant.key) + '"' + (isSelected ? ' selected' : '') + '>' +
      escapeHtml(String(variant.label || variant.key)) +
    '</option>';
  }

  function getDocumentVariants() {
    return PREVIEW_CONFIG.documentVariants || [];
  }

  function getDocumentVariantByKey(key) {
    var variants = getDocumentVariants();

    for (var i = 0; i < variants.length; i++) {
      if (variants[i].key === key) return variants[i];
    }

    return null;
  }

  function getDefaultDocumentVariantKey() {
    var configured = String(PREVIEW_CONFIG.defaultDocumentVariantKey || "");
    if (configured && getDocumentVariantByKey(configured)) return configured;

    var variants = getDocumentVariants();
    return variants.length ? String(variants[0].key || "") : "";
  }

  function getActiveDocumentVariant() {
    return getDocumentVariantByKey(activeDocumentVariantKey) ||
      getDocumentVariantByKey(getDefaultDocumentVariantKey()) ||
      null;
  }

  function setActiveDocumentVariant(key) {
    var next = getDocumentVariantByKey(key) || getActiveDocumentVariant();

    activeDocumentVariantKey = next ? next.key : getDefaultDocumentVariantKey();
    syncActiveDocumentVariantControl();
    applyPreviewVariantLayout();
  }

  function syncActiveDocumentVariantControl() {
    var $select = $("#" + VARIANT_SELECT_ID);
    if (!$select.length) return;

    var selectedKey = activeDocumentVariantKey || getDefaultDocumentVariantKey();
    if ($select.find('option[value="' + selectedKey + '"]').length) {
      $select.val(selectedKey);
    } else if ($select.find("option").length) {
      $select.prop("selectedIndex", 0);
      activeDocumentVariantKey = String($select.val() || "");
    }
  }

  function getPreviewModeForVariant(variant) {
    return String((variant && variant.previewMode) || "page").toLowerCase() === "wide" ? "wide" : "page";
  }

  function getActivePreviewMode() {
    return getPreviewModeForVariant(getActiveDocumentVariant());
  }

  function applyPreviewVariantLayout() {
    var previewMode = getActivePreviewMode();
    var isWide = previewMode === "wide";
    var $rightPane = $("#" + RIGHT_PANE_ID);
    var $viewport = $("#" + IFRAME_VIEWPORT_ID);

    if ($rightPane.length) {
      $rightPane.toggleClass("is-wide-doc", isWide);
    }

    if ($viewport.length) {
      $viewport.toggleClass("is-wide-doc", isWide);
    }

    var iframe = getActivePreviewIframe();
    if (iframe && iframe.contentDocument) {
      try {
        fitPreviewToPane(iframe, iframe.contentDocument, previewMode);
      } catch (e) {}
    }
  }

  function getCurrentJobId() {
    var href = window.location.href || "";
    var m =
      href.match(/[?&](?:job|job_id|main_id|id)=(\d+)/i) ||
      href.match(/\/job\/(\d+)/i) ||
      href.match(/\/jobs\/(\d+)/i);

    if (m && m[1]) return m[1];

    var selectors = [
      'input[name="job"]',
      'input[name="job_id"]',
      'input[name="main_id"]',
      'input[name="id"]',
      '#job_id',
      '#main_id'
    ];

    for (var i = 0; i < selectors.length; i++) {
      var $el = $(selectors[i]).first();
      if ($el.length) {
        var val = $.trim(String($el.val() || ""));
        if (/^\d+$/.test(val)) return val;
      }
    }

    if (window.main_id && /^\d+$/.test(String(window.main_id))) return String(window.main_id);
    if (window.job_id && /^\d+$/.test(String(window.job_id))) return String(window.job_id);

    return "";
  }

  function getSelectedSupplyingNodeIds() {
    var overrideIds = getProposalEditorPreviewSelectionOverride();
    if (overrideIds.length) return overrideIds;

    var nodes = getSelectedSupplyingNodes();
    var ids = [];

    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].id) ids.push(nodes[i].id);
    }

    return ids;
  }

  function getProposalEditorPreviewSelectionOverride() {
    var source = window.wiseProposalEditorPreviewSelectionIds;
    if (!Array.isArray(source)) return [];

    var ids = [];
    for (var i = 0; i < source.length; i++) {
      var id = $.trim(String(source[i] == null ? "" : source[i]));
      if (id && ids.indexOf(id) === -1) ids.push(id);
    }

    return ids;
  }

  function getSelectedSupplyingNodes() {
    var nodes = [];
    var seen = {};

    collectSelectedSupplyingNodes($("#items_tab .jstree-clicked"), nodes, seen, true);

    if (!nodes.length) {
      collectSelectedSupplyingNodes(
        $("#items_tab li.jstree-node.jstree-clicked, #items_tab li.jstree-selected, #items_tab li[aria-selected='true']"),
        nodes,
        seen,
        false
      );
    }

    return nodes;
  }

  function collectSelectedSupplyingNodes($elements, out, seen, anchorMode) {
    $elements.each(function () {
      var $el = $(this);
      var $li = $el.is("li") ? $el : $el.closest("li");
      if (!$li.length) return;

      var meta = buildSelectedSupplyingNodeMeta($li, anchorMode ? $el : null);
      if (!meta || !meta.id || seen[meta.id]) return;

      seen[meta.id] = true;
      out.push(meta);
    });
  }

  function buildSelectedSupplyingNodeMeta($li, $anchorHint) {
    if (!$li || !$li.length) return null;

    var id = $.trim(String($li.attr("id") || ""));
    if (!id) return null;

    return {
      id: id,
      text: getTreeNodeText($li, $anchorHint)
    };
  }

  function getTreeNodeText($li, $anchorHint) {
    var $anchor = getTreeNodeAnchor($li, $anchorHint);
    var text = $.trim(String(($anchor.length ? $anchor.text() : "") || ""));

    if (text) return normaliseWhitespace(text);

    var $clone = $li.clone();
    $clone.children("ul").remove();
    return normaliseWhitespace(String($clone.text() || ""));
  }

  function getTreeNodeAnchor($li, $anchorHint) {
    if ($anchorHint && $anchorHint.length && $anchorHint.is("a")) {
      return $anchorHint.first();
    }

    var $anchor = $li.children("a.jstree-anchor").first();
    if ($anchor.length) return $anchor;

    return $li.find("a.jstree-anchor").first();
  }

  function getSelectedNodeIdsKey() {
    return getSelectedSupplyingNodeIds().join("|");
  }

  function formatLocalDateTime(date) {
    function pad(n) { return String(n).padStart(2, "0"); }

    return [
      date.getFullYear(),
      "-",
      pad(date.getMonth() + 1),
      "-",
      pad(date.getDate()),
      " ",
      pad(date.getHours()),
      ":",
      pad(date.getMinutes()),
      ":",
      pad(date.getSeconds())
    ].join("");
  }

  // =========================================================
  // REFRESH
  // =========================================================
  function refreshPreviewSoon(reason) {
    if (!panelOpen || !autoRefreshEnabled) return;

    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function () {
      refreshPreviewNow(reason || "debounced");
    }, REFRESH_DEBOUNCE_MS);
  }

  function refreshPreviewNow(reason) {
    if (!panelOpen) return;

    if (previewRefreshInFlight) {
      pendingRefreshReason = reason || "queued";
      return;
    }

    var activeVariant = getActiveDocumentVariant();
    var url = buildPreviewUrl();
    if (!url) return;

    var iframe = getRefreshTargetIframe();
    if (!iframe) return;

    captureIframeScrollState(getActivePreviewIframe());

    var loadState = {
      loadId: nextPreviewLoadId++,
      reason: reason || "",
      documentVariantKey: activeVariant ? activeVariant.key : activeDocumentVariantKey,
      previewMode: getPreviewModeForVariant(activeVariant),
      scrollTop: lastIframeScrollTop,
      scrollRatio: lastIframeScrollRatio
    };

    previewRefreshInFlight = true;
    iframe._wiseDocPreviewAwaitingSwap = true;
    iframe._wiseDocPreviewLoadState = loadState;
    clearAllPreviewFrameTimers();
    clearStatus();

    iframe.src = url;
  }

  function isDirectRefreshReason(reason) {
    return reason === "open" || reason === "manual" || reason === "variant";
  }

  function captureIframeScrollState(iframe) {
    if (!iframe) {
      lastIframeScrollTop = 0;
      lastIframeScrollRatio = 0;
      return;
    }

    try {
      var win = iframe.contentWindow;
      var doc = iframe.contentDocument;
      if (!win || !doc) {
        lastIframeScrollTop = 0;
        lastIframeScrollRatio = 0;
        return;
      }

      var scrollTop = win.scrollY || doc.documentElement.scrollTop || doc.body.scrollTop || 0;
      var maxScroll = Math.max(
        1,
        (doc.documentElement.scrollHeight || 0) - (win.innerHeight || 0)
      );

      lastIframeScrollTop = Math.max(0, scrollTop);
      lastIframeScrollRatio = scrollTop / maxScroll;
      if (!isFinite(lastIframeScrollRatio) || lastIframeScrollRatio < 0) {
        lastIframeScrollRatio = 0;
      }
    } catch (e) {
      lastIframeScrollTop = 0;
      lastIframeScrollRatio = 0;
    }
  }

  function applyPreviewFrameLayoutAndScroll(iframe, loadState) {
    if (!isCurrentPreviewLoadState(iframe, loadState)) return false;

    var doc = iframe.contentDocument;
    if (!doc) return false;

    ensurePreviewStyleTag(doc, loadState ? loadState.previewMode : getActivePreviewMode());
    fitPreviewToPane(iframe, doc, loadState ? loadState.previewMode : getActivePreviewMode());
    return applyPreviewScrollState(iframe, loadState);
  }

  function applyPreviewScrollState(iframe, loadState) {
    return applyPreviewSavedScrollState(iframe, loadState);
  }

  function applyPreviewSavedScrollState(iframe, loadState) {
    try {
      var win = iframe.contentWindow;
      var doc = iframe.contentDocument;
      if (!win || !doc) return;

      var scrollTop = Number(loadState && loadState.scrollTop);
      var scrollRatio = Number(loadState && loadState.scrollRatio);

      var maxScroll = Math.max(
        0,
        (doc.documentElement.scrollHeight || 0) - (win.innerHeight || 0)
      );

      var targetTop = 0;

      if (isFinite(scrollTop) && scrollTop > 0) {
        targetTop = Math.min(scrollTop, maxScroll);

        if (targetTop === maxScroll && isFinite(scrollRatio) && scrollRatio > 0 && scrollTop > maxScroll) {
          targetTop = Math.round(maxScroll * Math.min(scrollRatio, 1));
        }
      } else if (isFinite(scrollRatio) && scrollRatio > 0) {
        targetTop = Math.round(maxScroll * Math.min(scrollRatio, 1));
      }

      win.scrollTo(0, Math.max(0, targetTop));
      return true;
    } catch (e) {}
    return false;
  }

  function ensurePreviewStyleTag(doc, previewMode) {
    var style = doc.getElementById("wise-preview-fit-style");
    if (!style) {
      style = doc.createElement("style");
      style.id = "wise-preview-fit-style";
      style.type = "text/css";
      (doc.head || doc.documentElement).appendChild(style);
    }

    style.textContent = getPreviewFitStyleText(previewMode);
  }

  function getPreviewFitStyleText(previewMode) {
    if (previewMode === "wide") {
      return (
        "html, body {" +
          "margin:0 !important;" +
          "padding:0 !important;" +
          "overflow:auto !important;" +
          "scroll-behavior:auto !important;" +
          "background:#ffffff !important;" +
        "}" +
        "body {" +
          "transform-origin:top left !important;" +
          "margin:0 !important;" +
          "padding:0 !important;" +
        "}" +
        "img, svg, canvas {" +
          "max-width:none !important;" +
        "}"
      );
    }

    return (
      "html, body {" +
        "margin:0 !important;" +
        "padding:0 !important;" +
        "overflow-x:hidden !important;" +
        "scroll-behavior:auto !important;" +
        "background:#e9eaec !important;" +
      "}" +
      "body {" +
        "margin-left:auto !important;" +
        "margin-right:auto !important;" +
        "transform-origin:top left !important;" +
      "}" +
      "img, svg, canvas {" +
        "max-width:none !important;" +
      "}"
    );
  }

  function fitPreviewToPane(iframe, doc, previewMode) {
    var body = doc.body;
    var html = doc.documentElement;
    if (!body || !html) return;

    body.style.zoom = "";
    body.style.transform = "";
    body.style.width = "";
    body.style.marginLeft = "auto";
    body.style.marginRight = "auto";

    if (previewMode === "wide") {
      body.style.marginLeft = "0";
      body.style.marginRight = "0";
      fitWidePreviewToPane(iframe, doc, body, html);
      return;
    }

    var iframeWidth = iframe.clientWidth || 0;
    if (!iframeWidth) return;

    var sourceWidth = getPreviewSourceWidth(doc, body, html);
    if (!sourceWidth) return;

    var availableWidth = Math.max(100, iframeWidth - 24);
    var scale = Math.min(1, availableWidth / sourceWidth);

    if (!isFinite(scale) || scale <= 0) scale = 1;

    if ("zoom" in body.style) {
      body.style.zoom = String(scale);
    } else {
      body.style.transform = "scale(" + scale + ")";
      body.style.transformOrigin = "top left";
      body.style.width = (100 / scale) + "%";
    }
  }

  function fitWidePreviewToPane(iframe, doc, body, html) {
    var iframeWidth = iframe.clientWidth || 0;
    if (!iframeWidth) return;

    var sourceWidth = getWidePreviewSourceWidth(doc, body, html);
    if (!sourceWidth) return;

    var availableWidth = Math.max(100, iframeWidth - 16);
    if (sourceWidth <= availableWidth) return;

    var scale = availableWidth / sourceWidth;
    if (!isFinite(scale) || scale <= 0) return;
    if (scale < PREVIEW_CONFIG.widePreviewScaleThreshold) return;

    if ("zoom" in body.style) {
      body.style.zoom = String(scale);
    } else {
      body.style.transform = "scale(" + scale + ")";
      body.style.transformOrigin = "top left";
      body.style.width = (100 / scale) + "%";
    }
  }

  function getWidePreviewSourceWidth(doc, body, html) {
    var selectors = [
      "table",
      ".ui-jqgrid",
      ".jqgrow",
      ".summary",
      ".report",
      ".hh_table",
      "[style*='width']"
    ];
    var best = 0;

    for (var i = 0; i < selectors.length; i++) {
      var nodes = doc.querySelectorAll(selectors[i]);
      for (var j = 0; j < nodes.length && j < 24; j++) {
        var el = nodes[j];
        var w = getElementNaturalWidth(el);
        if (w > best) best = w;
      }
      if (best > (iframeWidthGuessFromDocument(doc) * 1.2)) {
        break;
      }
    }

    if (!best) {
      best = Math.max(
        body.scrollWidth || 0,
        html.scrollWidth || 0,
        body.offsetWidth || 0,
        html.offsetWidth || 0
      );
    }

    return best;
  }

  function iframeWidthGuessFromDocument(doc) {
    try {
      var win = doc.defaultView;
      return win && win.innerWidth ? win.innerWidth : 0;
    } catch (e) {
      return 0;
    }
  }

  function getPreviewSourceWidth(doc, body, html) {
    var selectors = [
      ".page",
      ".print-page",
      ".doc-page",
      ".paper",
      ".sheet",
      "[data-page]",
      "[style*='210mm']",
      "[style*='297mm']",
      "[style*='2480px']",
      "[style*='1240px']",
      "[style*='1123px']"
    ];

    var best = 0;

    for (var i = 0; i < selectors.length; i++) {
      var nodes = doc.querySelectorAll(selectors[i]);
      for (var j = 0; j < nodes.length && j < 6; j++) {
        var el = nodes[j];
        var w = getElementNaturalWidth(el);
        if (w > best) best = w;
      }
      if (best) break;
    }

    if (!best) {
      best = Math.max(
        body.scrollWidth || 0,
        html.scrollWidth || 0,
        body.offsetWidth || 0,
        html.offsetWidth || 0
      );
    }

    return best;
  }

  function getElementNaturalWidth(el) {
    if (!el) return 0;

    return Math.max(
      el.scrollWidth || 0,
      el.offsetWidth || 0,
      Math.round((el.getBoundingClientRect && el.getBoundingClientRect().width) || 0)
    );
  }

  function getPreviewFrames() {
    var ids = [IFRAME_PRIMARY_ID, IFRAME_SECONDARY_ID];
    var frames = [];

    for (var i = 0; i < ids.length; i++) {
      var iframe = document.getElementById(ids[i]);
      if (iframe) frames.push(iframe);
    }

    return frames;
  }

  function clearPreviewFrameTimers(iframe) {
    if (!iframe) return;

    var timers = iframe._wiseDocPreviewTimers || [];
    for (var i = 0; i < timers.length; i++) {
      clearTimeout(timers[i]);
    }

    iframe._wiseDocPreviewTimers = [];
  }

  function clearAllPreviewFrameTimers() {
    var frames = getPreviewFrames();

    for (var i = 0; i < frames.length; i++) {
      clearPreviewFrameTimers(frames[i]);
    }
  }

  function queuePreviewFrameTimer(iframe, fn, delay) {
    if (!iframe) return 0;

    if (!iframe._wiseDocPreviewTimers) {
      iframe._wiseDocPreviewTimers = [];
    }

    var timerId = setTimeout(function () {
      removePreviewFrameTimer(iframe, timerId);
      fn();
    }, delay);

    iframe._wiseDocPreviewTimers.push(timerId);
    return timerId;
  }

  function removePreviewFrameTimer(iframe, timerId) {
    if (!iframe || !iframe._wiseDocPreviewTimers) return;

    var next = [];
    for (var i = 0; i < iframe._wiseDocPreviewTimers.length; i++) {
      if (iframe._wiseDocPreviewTimers[i] !== timerId) {
        next.push(iframe._wiseDocPreviewTimers[i]);
      }
    }

    iframe._wiseDocPreviewTimers = next;
  }

  function resetPreviewFrameState() {
    var frames = getPreviewFrames();

    for (var i = 0; i < frames.length; i++) {
      clearPreviewFrameTimers(frames[i]);
      frames[i]._wiseDocPreviewAwaitingSwap = false;
      frames[i]._wiseDocPreviewLoadState = null;
    }
  }

  function getActivePreviewIframe() {
    var iframe = document.getElementById(activePreviewFrameId);
    if (iframe) return iframe;

    var frames = getPreviewFrames();
    return frames.length ? frames[0] : null;
  }

  function getRefreshTargetIframe() {
    var frames = getPreviewFrames();
    if (!frames.length) return null;

    if (!previewHasLoaded) {
      return getActivePreviewIframe() || frames[0];
    }

    var active = getActivePreviewIframe();

    for (var i = 0; i < frames.length; i++) {
      if (!active || frames[i].id !== active.id) {
        return frames[i];
      }
    }

    return active || frames[0];
  }

  function bindPreviewIframeLoadHandler(iframe) {
    if (!iframe || iframe._wiseDocPreviewBound) return;

    iframe.addEventListener("load", function () {
      if (!iframe._wiseDocPreviewAwaitingSwap) return;

      var loadState = iframe._wiseDocPreviewLoadState;
      if (!loadState) return;

      try {
        beginPreviewFrameActivation(iframe, loadState);
      } catch (err) {
        try { console.warn("[WiseHireHop] iframe load patch failed", err); } catch (e) {}
        completePreviewRefreshCycle(loadState);
      }
    });

    iframe._wiseDocPreviewBound = true;
  }

  function setActivePreviewIframe(iframe) {
    var frames = getPreviewFrames();
    if (!iframe) return;

    for (var i = 0; i < frames.length; i++) {
      var isActive = frames[i].id === iframe.id;
      frames[i].classList.toggle("is-active", isActive);
      frames[i].classList.toggle("is-buffer", !isActive);
    }

    activePreviewFrameId = iframe.id;
    previewHasLoaded = true;
  }

  function beginPreviewFrameActivation(iframe, loadState) {
    if (!isCurrentPreviewLoadState(iframe, loadState)) return;

    clearPreviewFrameTimers(iframe);
    applyPreviewFrameLayoutAndScroll(iframe, loadState);

    queuePreviewFrameTimer(iframe, function () {
      if (!isCurrentPreviewLoadState(iframe, loadState)) return;

      applyPreviewFrameLayoutAndScroll(iframe, loadState);
      setActivePreviewIframe(iframe);
      completePreviewRefreshCycle(loadState);
    }, PREVIEW_CONFIG.previewLoadActivateDelayMs);

    var followUpDelays = PREVIEW_CONFIG.previewLoadFollowUpDelaysMs || [];
    for (var i = 0; i < followUpDelays.length; i++) {
      queuePreviewFrameTimer(iframe, createPreviewFollowUpHandler(iframe, loadState), followUpDelays[i]);
    }
  }

  function createPreviewFollowUpHandler(iframe, loadState) {
    return function () {
      if (!isCurrentPreviewLoadState(iframe, loadState)) return;
      applyPreviewFrameLayoutAndScroll(iframe, loadState);
    };
  }

  function completePreviewRefreshCycle(loadState) {
    previewRefreshInFlight = false;

    var frames = getPreviewFrames();
    for (var i = 0; i < frames.length; i++) {
      if (!loadState || !frames[i]._wiseDocPreviewLoadState) continue;
      if (frames[i]._wiseDocPreviewLoadState.loadId === loadState.loadId) {
        frames[i]._wiseDocPreviewAwaitingSwap = false;
      }
    }

    if (pendingRefreshReason) {
      var queued = pendingRefreshReason;
      pendingRefreshReason = null;
      if (isDirectRefreshReason(queued)) {
        refreshPreviewNow(queued);
      } else {
        refreshPreviewSoon(queued);
      }
    }
  }

  function isCurrentPreviewLoadState(iframe, loadState) {
    return !!(
      iframe &&
      loadState &&
      iframe._wiseDocPreviewLoadState &&
      iframe._wiseDocPreviewLoadState.loadId === loadState.loadId
    );
  }

  function normaliseWhitespace(value) {
    return $.trim(String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " "));
  }

  // =========================================================
  // AJAX / FETCH HOOKS
  // =========================================================
  function installAjaxHooks() {
    if (window.__wiseDocPreviewXhrInstalled) return;
    window.__wiseDocPreviewXhrInstalled = true;

    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this._wiseDocPreviewMeta = {
        method: method,
        url: url
      };
      return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
      var xhr = this;

      xhr.addEventListener("load", function () {
        try {
          var meta = xhr._wiseDocPreviewMeta || {};
          var url = String(meta.url || "");

          if (shouldTriggerPreviewRefresh(url, xhr.status)) {
            refreshPreviewSoon("xhr");
          }
        } catch (e) {}
      });

      return origSend.apply(this, arguments);
    };
  }

  function installFetchHooks() {
    if (!window.fetch || window.__wiseDocPreviewFetchInstalled) return;
    window.__wiseDocPreviewFetchInstalled = true;

    var origFetch = window.fetch;

    window.fetch = function () {
      var args = arguments;
      var url = String(args[0] || "");

      return origFetch.apply(window, args).then(function (response) {
        try {
          if (shouldTriggerPreviewRefresh(url, response && response.status)) {
            refreshPreviewSoon("fetch");
          }
        } catch (e) {}
        return response;
      });
    };
  }

  function shouldTriggerPreviewRefresh(url, status) {
    if (status && Number(status) >= 400) return false;

    url = String(url || "");

    for (var i = 0; i < PREVIEW_CONFIG.refreshUrlPatterns.length; i++) {
      if (PREVIEW_CONFIG.refreshUrlPatterns[i].test(url)) {
        return true;
      }
    }

    return false;
  }

  // =========================================================
  // TARGETED DOM OBSERVER
  // =========================================================
  function installTargetedDomObserver() {
    removeTargetedDomObserver();

    var target =
      $("#items_tab .items_tree").get(0) ||
      $("#items_tab .items_tree_container").get(0) ||
      $("#items_tab .entire_tree_container").get(0);

    if (!target) return;

    domObserver = new MutationObserver(function (mutations) {
      if (!panelOpen) return;

      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];

        if (m.type === "childList") {
          if (mutationTouchesTreeNodes(m)) {
            lastSelectedNodeIdsKey = getSelectedNodeIdsKey();
            if (!autoRefreshEnabled) continue;
            refreshPreviewSoon("dom-child");
            return;
          }
        }

        if (m.type === "attributes") {
          if (!isSelectionMutation(m.target, m.attributeName)) continue;

          var nextSelectionKey = getSelectedNodeIdsKey();
          if (nextSelectionKey === lastSelectedNodeIdsKey) continue;

          lastSelectedNodeIdsKey = nextSelectionKey;
          if (!autoRefreshEnabled) continue;
          refreshPreviewSoon("selection");
          return;
        }
      }
    });

    domObserver.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: PREVIEW_CONFIG.selectionAttributeFilter
    });

    lastSelectedNodeIdsKey = getSelectedNodeIdsKey();
  }

  function removeTargetedDomObserver() {
    if (domObserver) {
      domObserver.disconnect();
      domObserver = null;
    }
  }

  function mutationTouchesTreeNodes(mutation) {
    return nodeListTouchesTree(mutation.addedNodes) || nodeListTouchesTree(mutation.removedNodes);
  }

  function nodeListTouchesTree(nodes) {
    if (!nodes || !nodes.length) return false;

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node || node.nodeType !== 1) continue;

      var $node = $(node);
      if ($node.is("li.jstree-node, a.jstree-anchor")) return true;
      if ($node.find("li.jstree-node, a.jstree-anchor").length) return true;
    }

    return false;
  }

  function isSelectionMutation(target, attributeName) {
    if (!target || target.nodeType !== 1) return false;
    if (attributeName && attributeName !== "class" && attributeName !== "aria-selected") return false;

    var $target = $(target);
    return (
      $target.is("li.jstree-node, li[aria-selected], a.jstree-anchor, .jstree-clicked") ||
      !!$target.closest("li.jstree-node").length
    );
  }

  // =========================================================
  // STATUS
  // =========================================================
  function setStatus(msg) {
    $("#wise-doc-preview-status").text(msg).show();
  }

  function clearStatus() {
    $("#wise-doc-preview-status").hide().text("");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

})();
