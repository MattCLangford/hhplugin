(function () {
  "use strict";

  if (window.__wiseHireHopAutopullSelectAllLoaded) return;
  window.__wiseHireHopAutopullSelectAllLoaded = true;

  try { console.warn("[WiseHireHop] autopull select-all loaded - v2026-06-22.4"); } catch (e) {}

  var $ = window.jQuery;
  if (!$) return;

  var HIREHOP_MODULE_GLOBAL = "WiseProposalSectionBuilderHireHop";

  var CFG = {
    version: "2026-06-22.4",
    stylesId: "wise-autopull-select-all-styles",
    buttonClass: "wise-autopull-select-all",
    buttonDoneClass: "wise-autopull-select-all-complete",
    applyDebounceMs: 60,
    bootstrapMaxTries: 120,
    bootstrapRetryMs: 500,
    depotRule: {
      enabled: false,
      allowedIds: [],
      allowedNames: [],
      blockWhenUndetected: false
    }
  };

  var autopullUiInitialised = false;
  var applyTimer = null;
  var pendingDialog = null;
  var lastDepotDecisionSignature = "";

  boot();

  function boot() {
    function start() {
      if (CFG.depotRule.enabled) {
        waitForAllowedDepotAndInit();
        return;
      }

      initialiseAutopullUi();
    }

    if (document.readyState === "loading") $(start);
    else start();
  }

  function waitForAllowedDepotAndInit() {
    var tries = 0;

    function stopWatching() {
      $(window).off(".wiseAutopullDepot");
      $(document).off(".wiseAutopullDepot");
    }

    function attempt() {
      if (autopullUiInitialised) return;

      tries += 1;

      if (isAllowedDepot(getActiveDepotContext())) {
        stopWatching();
        initialiseAutopullUi();
        return;
      }

      if (tries < CFG.bootstrapMaxTries) {
        setTimeout(attempt, CFG.bootstrapRetryMs);
      }
    }

    attempt();
    $(window).on("load.wiseAutopullDepot focus.wiseAutopullDepot", attempt);
    $(document).on("ajaxComplete.wiseAutopullDepot", attempt);
    $(document).on("change.wiseAutopullDepot input.wiseAutopullDepot", "select,input", attempt);
  }

  function initialiseAutopullUi() {
    if (autopullUiInitialised) return;
    autopullUiInitialised = true;

    injectStyles();

    $(document).on("dialogopen.wiseAutopullSelectAll", ".ui-dialog-content", function () {
      var $dialog = $(this).closest(".ui-dialog");
      if (!isAutopullDialog($dialog)) return;

      applyToAutopullDialog($dialog);
      setTimeout(function () {
        applyToAutopullDialog($dialog);
      }, 120);
    });

    $(document).on("click.wiseAutopullSelectAll change.wiseAutopullSelectAll", ".ui-dialog .auto_add_check", function () {
      var $dialog = $(this).closest(".ui-dialog");
      if (!isAutopullDialog($dialog)) return;
      scheduleApply($dialog);
    });

    $(window).on("load.wiseAutopullSelectAll focus.wiseAutopullSelectAll", function () {
      scheduleApply();
    });

    $(document).on("ajaxComplete.wiseAutopullSelectAll", function () {
      scheduleApply();
    });

    if (window.MutationObserver && (document.body || document.documentElement)) {
      var observer = new MutationObserver(function (mutations) {
        if (mutationsMayAffectAutopullDialogs(mutations)) {
          scheduleApply();
        }
      });

      observer.observe(document.body || document.documentElement, {
        subtree: true,
        childList: true
      });
    }

    scheduleApply();
  }

  function scheduleApply(dialog) {
    pendingDialog = dialog && dialog.length ? dialog : null;

    clearTimeout(applyTimer);
    applyTimer = setTimeout(function () {
      var $target = pendingDialog;
      pendingDialog = null;

      if ($target && $target.length) {
        applyToAutopullDialog($target);
        return;
      }

      processVisibleAutopullDialogs();
    }, CFG.applyDebounceMs);
  }

  function processVisibleAutopullDialogs() {
    $(".ui-dialog:visible").each(function () {
      var $dialog = $(this);
      if (isAutopullDialog($dialog)) {
        applyToAutopullDialog($dialog);
      }
    });
  }

  function applyToAutopullDialog($dialog) {
    if (!$dialog || !$dialog.length) return;

    if (CFG.depotRule.enabled && !isAllowedDepot(getActiveDepotContext(), { silent: true })) {
      $dialog.find("." + CFG.buttonClass).remove();
      return;
    }

    var $buttonPane = $dialog.find(".ui-dialog-buttonpane .ui-dialog-buttonset").first();
    if (!$buttonPane.length) return;

    var $checkboxes = getAutopullCheckboxes($dialog);
    if (!$checkboxes.length) return;

    var $button = ensureSelectAllButton($dialog, $buttonPane);
    updateButtonState($dialog, $button);
  }

  function ensureSelectAllButton($dialog, $buttonPane) {
    var $button = $buttonPane.find("." + CFG.buttonClass).first();
    if ($button.length) return $button;

    $button = $(
      '<button type="button" class="ui-button ui-widget ui-state-default ui-corner-all ui-button-text-icon-primary ' + CFG.buttonClass + '" role="button">' +
        '<span class="ui-button-icon-primary ui-icon ui-icon-check"></span>' +
        '<span class="ui-button-text">Select all</span>' +
      "</button>"
    );

    $button.on("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      selectAllAutopullOptions($dialog, $(this));
    });

    var $saveButton = getSaveButton($dialog);
    if ($saveButton.length) $button.insertBefore($saveButton.first());
    else $buttonPane.prepend($button);

    return $button;
  }

  function selectAllAutopullOptions($dialog, $button) {
    var changed = 0;

    getAutopullCheckboxes($dialog).each(function () {
      if (!isSelectableCheckbox(this)) return;

      if (!this.checked) {
        try {
          this.click();
        } catch (e) {}

        if (!this.checked) {
          this.checked = true;
          $(this).trigger("input").trigger("change");
        }

        changed += 1;
      }
    });

    if (!changed) {
      updateButtonState($dialog, $button);
      return;
    }

    setTimeout(function () {
      updateButtonState($dialog, $button);
    }, 0);

    setTimeout(function () {
      updateButtonState($dialog, $button);
    }, 120);
  }

  function updateButtonState($dialog, $button) {
    if (!$button || !$button.length) return;

    var summary = getSelectionSummary($dialog);
    var allSelected = summary.total > 0 && summary.selected >= summary.total;
    var disabled = summary.total === 0;
    var label = allSelected ? "All selected" : "Select all";

    $button.find(".ui-button-text").text(label);
    $button.attr("title", summary.total ? (summary.selected + " of " + summary.total + " selected") : "No options available");
    $button.prop("disabled", disabled);
    $button.attr("aria-disabled", disabled ? "true" : "false");
    $button.toggleClass("ui-state-disabled", disabled);
    $button.toggleClass(CFG.buttonDoneClass, allSelected);
  }

  function getSelectionSummary($dialog) {
    var summary = {
      total: 0,
      selected: 0
    };

    getAutopullCheckboxes($dialog).each(function () {
      if (!isSelectableCheckbox(this)) return;

      summary.total += 1;
      if (this.checked) summary.selected += 1;
    });

    return summary;
  }

  function getAutopullCheckboxes($dialog) {
    return $dialog.find('input.auto_add_check[type="checkbox"]');
  }

  function isSelectableCheckbox(checkbox) {
    return !!(checkbox && checkbox.type === "checkbox" && !checkbox.disabled);
  }

  function getSaveButton($dialog) {
    var $buttons = $dialog.find(".ui-dialog-buttonpane button, .ui-dialog-buttonpane input[type='button'], .ui-dialog-buttonpane input[type='submit']");
    var $exact = $buttons.filter(function () {
      return /^save\b/i.test($.trim($(this).text() || $(this).val() || ""));
    }).first();

    if ($exact.length) return $exact;
    return $buttons.filter("[type='submit']").first();
  }

  function isAutopullDialog($dialog) {
    if (!$dialog || !$dialog.length || !$dialog.is(":visible")) return false;

    var title = $.trim($dialog.find(".ui-dialog-title").first().text()).toLowerCase();
    if (title !== "autopull") return false;

    return getAutopullCheckboxes($dialog).length > 0;
  }

  function mutationsMayAffectAutopullDialogs(mutations) {
    if (!mutations || !mutations.length) return false;

    for (var i = 0; i < mutations.length; i += 1) {
      var mutation = mutations[i];

      if (mutation.type === "childList") {
        if (nodeListTouchesAutopullDialog(mutation.addedNodes)) return true;
      }
    }

    return false;
  }

  function nodeListTouchesAutopullDialog(nodes) {
    if (!nodes || !nodes.length) return false;

    for (var i = 0; i < nodes.length; i += 1) {
      if (isWithinAutopullDialogContext(nodes[i])) return true;
    }

    return false;
  }

  function isWithinAutopullDialogContext(node) {
    if (!node || node.nodeType !== 1) return false;

    var $node = $(node);
    return (
      $node.is(".ui-dialog, .ui-dialog-content, .auto_add_check") ||
      !!$node.closest(".ui-dialog, .ui-dialog-content").length ||
      !!$node.find(".ui-dialog, .ui-dialog-content, .auto_add_check").length
    );
  }

  function injectStyles() {
    if ($("#" + CFG.stylesId).length) return;

    var css = [
      "." + CFG.buttonClass + "{margin-right:8px;}",
      "." + CFG.buttonClass + "." + CFG.buttonDoneClass + "{border-color:#4c9a2a;color:#2f6b16;}",
      "." + CFG.buttonClass + ".ui-state-disabled{opacity:.65;cursor:default;}"
    ].join("");

    $("head").append('<style id="' + CFG.stylesId + '">' + css + "</style>");
  }

  function isAllowedDepot(context, options) {
    options = options || {};

    if (!CFG.depotRule.enabled) return true;

    var sharedDepot = getSharedDepotModule();
    if (sharedDepot && typeof sharedDepot.isAllowed === "function") {
      var allowed = sharedDepot.isAllowed(context, {
        rule: CFG.depotRule,
        allowedIds: CFG.depotRule.allowedIds,
        allowedNames: CFG.depotRule.allowedNames,
        blockWhenUndetected: CFG.depotRule.blockWhenUndetected
      });
      var sharedContext = context || getActiveDepotContext();
      var hasSharedDepot = !!(sharedContext && (sharedContext.id || sharedContext.name));

      logDepotDecision(
        allowed ? "matched" : (hasSharedDepot ? "blocked" : "undetected"),
        allowed
          ? "[WiseHireHop] autopull select-all depot matched"
          : (hasSharedDepot ? "[WiseHireHop] autopull select-all blocked outside allowed depot" : "[WiseHireHop] autopull select-all blocked because no depot could be detected"),
        sharedContext,
        options
      );

      return allowed;
    }

    var allowedIds = normaliseAllowedDepotValues(CFG.depotRule.allowedIds, true);
    var allowedNames = normaliseAllowedDepotValues(CFG.depotRule.allowedNames, false);
    var hasRule = allowedIds.length || allowedNames.length;
    var hasDetectedDepot = !!(context && (context.id || context.name));

    if (!hasRule) {
      logDepotDecision("misconfigured", "[WiseHireHop] autopull select-all depot rule has no configured depots", context, options);
      return !CFG.depotRule.blockWhenUndetected;
    }

    if (context && context.id && allowedIds.indexOf(normaliseDepotId(context.id)) !== -1) {
      logDepotDecision("matched", "[WiseHireHop] autopull select-all depot matched", context, options);
      return true;
    }

    if (context && context.name && allowedNames.indexOf(normaliseDepotText(context.name)) !== -1) {
      logDepotDecision("matched", "[WiseHireHop] autopull select-all depot matched", context, options);
      return true;
    }

    logDepotDecision(
      hasDetectedDepot ? "blocked" : "undetected",
      hasDetectedDepot
        ? "[WiseHireHop] autopull select-all blocked outside allowed depot"
        : "[WiseHireHop] autopull select-all blocked because no depot could be detected",
      context,
      options
    );

    return hasDetectedDepot ? false : !CFG.depotRule.blockWhenUndetected;
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
    var sharedDepot = getSharedDepotModule();
    if (sharedDepot && typeof sharedDepot.getActiveContext === "function") {
      var sharedContext = sharedDepot.getActiveContext();
      window.__wiseHireHopDepotContext = sharedContext;
      return sharedContext;
    }

    var cached = window.__wiseHireHopDepotContext || {};
    var context = {
      id: normaliseDepotId(cached.id || ""),
      name: normaliseDepotText(cached.name || "", true)
    };

    if (context.id || context.name) return context;

    var $headerSelect = findHeaderDepotSelect();
    var $selectedOption = $headerSelect.length ? $headerSelect.find("option:selected").first() : $();

    context.id = firstNonEmpty([
      $headerSelect.length ? ($headerSelect.val() || $selectedOption.attr("value") || "") : "",
      readFirstValue([
        'input[name="depot_id"]',
        'input[name="depot"]',
        'select[name="depot_id"]',
        'select[name="depot"]',
        "#depot_id",
        "#depot"
      ]),
      getDepotIdFromUrl()
    ]);

    context.name = firstNonEmpty([
      $selectedOption.length ? ($selectedOption.text() || "") : "",
      readFirstText([
        'select[name="depot_id"] option:selected',
        'select[name="depot"] option:selected',
        "#depot_id option:selected",
        "#depot option:selected",
        "#depot_name",
        ".depot-name"
      ])
    ]);

    context.id = normaliseDepotId(context.id);
    context.name = normaliseDepotText(context.name, true);
    window.__wiseHireHopDepotContext = context;

    return context;
  }

  function getSharedHireHopModule() {
    var module = window[HIREHOP_MODULE_GLOBAL];
    return module && typeof module === "object" ? module : null;
  }

  function getSharedDepotModule() {
    var module = getSharedHireHopModule();
    var depot = module && module.depot;
    return depot && typeof depot === "object" ? depot : null;
  }

  function getSharedDepotValue(key, fallback) {
    var depot = getSharedDepotModule();
    var value = depot && depot[key];
    return value == null || value === "" ? fallback : value;
  }

  function getSharedDepotArrayValue(key, fallback) {
    var value = getSharedDepotValue(key, fallback);
    return Array.isArray(value) ? value.slice() : fallback.slice();
  }

  function getSharedDepotBooleanValue(key, fallback) {
    var value = getSharedDepotValue(key, fallback);
    return value === true || value === false ? value : fallback;
  }

  function findHeaderDepotSelect() {
    var $label = $('[data-label="depotTxt"]').first();

    if ($label.length) {
      var $scope = $label.closest("tr, td, div, form");
      var $select = $scope.find("select").first();
      if ($select.length) return $select;
    }

    return $(
      'select[name="depot_id"], select[name="depot"], #depot_id, #depot'
    ).first();
  }

  function getDepotIdFromUrl() {
    var search = String((window.location && window.location.search) || "");
    var match = search.match(/[?&](?:depot_id|depot|branch_id|branch)=([^&#]+)/i);
    return match && match[1] ? decodeURIComponent(match[1]) : "";
  }

  function readFirstValue(selectors) {
    for (var i = 0; i < selectors.length; i += 1) {
      var value = $(selectors[i]).first().val();
      if (value != null && $.trim(String(value)) !== "") return value;
    }

    return "";
  }

  function readFirstText(selectors) {
    for (var i = 0; i < selectors.length; i += 1) {
      var text = $(selectors[i]).first().text();
      if (text != null && $.trim(String(text)) !== "") return text;
    }

    return "";
  }

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i += 1) {
      var value = $.trim(String(values[i] == null ? "" : values[i]));
      if (value) return value;
    }

    return "";
  }

  function normaliseAllowedDepotValues(values, isId) {
    var list = [];

    for (var i = 0; i < (values || []).length; i += 1) {
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
})();
