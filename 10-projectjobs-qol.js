(function () {
  "use strict";

  var $ = window.jQuery;
  if (!$) return;

  var LOG_PREFIX = "[Wise Project Jobs QOL]";
  var EXTERNAL_CONFIG = window.WiseProjectJobsQolConfig && typeof window.WiseProjectJobsQolConfig === "object"
    ? window.WiseProjectJobsQolConfig
    : {};

  var CFG = {
    version: "2026-06-24.2",
    stylesId: "wise-project-jobs-qol-styles",
    buttonId: "wise-project-jobs-compact-btn",
    summaryId: "wise-project-jobs-compact-summary",
    storageKey: "wise-project-jobs-qol:project-details-compact",
    maintainRecoveryMs: asNumber(EXTERNAL_CONFIG.maintainRecoveryMs, 5000),
    minPanelHeight: asNumber(EXTERNAL_CONFIG.minPanelHeight, 320),
    bottomPadding: asNumber(EXTERNAL_CONFIG.bottomPadding, 12)
  };

  var state = {
    maintainTimer: null,
    maintainScheduled: null,
    pendingMaintainOptions: null,
    lastDetailsEl: null,
    lastProjectInfoEl: null,
    projectInfoRowsMarked: false,
    projectKitBookingFieldsMarked: false,
    lastHiddenProjectKitBookingCount: 0,
    lastScrollMaxHeight: ""
  };

  bootstrap();

  function bootstrap() {
    installStyles();
    scheduleMaintainProjectJobsLayout(0, { forceScan: true });
    state.maintainTimer = setInterval(function () {
      scheduleMaintainProjectJobsLayout(0, {});
    }, CFG.maintainRecoveryMs);

    $(window).on("load.wiseProjectJobsQol focus.wiseProjectJobsQol resize.wiseProjectJobsQol hashchange.wiseProjectJobsQol", function () {
      scheduleMaintainProjectJobsLayout(60, { forceScan: true });
    });
    $(document).on("ajaxComplete.wiseProjectJobsQol", function () {
      scheduleMaintainProjectJobsLayout(80, { forceScan: true });
    });
  }

  function scheduleMaintainProjectJobsLayout(delay, options) {
    state.pendingMaintainOptions = mergeMaintainOptions(state.pendingMaintainOptions, options);
    if (state.maintainScheduled) clearTimeout(state.maintainScheduled);

    state.maintainScheduled = setTimeout(function () {
      var pending = state.pendingMaintainOptions || {};
      state.pendingMaintainOptions = null;
      state.maintainScheduled = null;
      maintainProjectJobsLayout(pending);
    }, Math.max(0, Number(delay) || 0));
  }

  function mergeMaintainOptions(current, next) {
    current = current || {};
    next = next || {};
    return {
      forceScan: !!(current.forceScan || next.forceScan)
    };
  }

  function maintainProjectJobsLayout(options) {
    options = options || {};
    var page = findProjectDetailsPage();
    if (!page.ready) {
      state.lastDetailsEl = null;
      state.lastProjectInfoEl = null;
      state.projectInfoRowsMarked = false;
      state.projectKitBookingFieldsMarked = false;
      state.lastHiddenProjectKitBookingCount = 0;
      state.lastScrollMaxHeight = "";
      removeOrphanedEnhancements();
      return;
    }

    var projectInfoEl = page.projectInfo.get(0);
    if (state.lastDetailsEl !== page.details.get(0)) {
      state.lastDetailsEl = page.details.get(0);
      state.lastScrollMaxHeight = "";
    }

    var shouldScanProjectInfo = options.forceScan ||
      state.lastProjectInfoEl !== projectInfoEl ||
      !state.projectInfoRowsMarked ||
      !state.projectKitBookingFieldsMarked;

    page.details.addClass("wise-project-jobs-scroll");
    ensureSummaryStrip(page);
    if (shouldScanProjectInfo) {
      markCompactProjectInfoRows(page);
      markProjectLevelKitBookingFields(page);
      state.lastProjectInfoEl = projectInfoEl;
      state.projectInfoRowsMarked = true;
      state.projectKitBookingFieldsMarked = true;
    }
    installCompactButton(page);
    applyCompactState(page, readCompactState());
    applyScrollSizing(page);
  }

  function findProjectDetailsPage() {
    var $details = $("#details_tab").first();
    var $projectInfo = $("#proj_info").first();
    var $jobsGrid = $("#gbox_jobs_grid").first();
    var $projectButtons = $("#proj_buttons").first();

    return {
      ready: !!($details.length && $projectInfo.length && $jobsGrid.length),
      details: $details,
      projectInfo: $projectInfo,
      jobsGrid: $jobsGrid,
      projectButtons: $projectButtons
    };
  }

  function installCompactButton(page) {
    if (!page.projectButtons.length) return;

    var $button = $("#" + CFG.buttonId);
    if ($button.length && !$button.parent().is(page.projectButtons)) {
      $button.detach();
    }

    if (!$button.length) {
      $button = $('<button type="button"></button>')
        .attr("id", CFG.buttonId)
        .addClass("ui-button ui-corner-all ui-widget wise-project-jobs-compact-button")
        .css("width", getButtonWidth(page.projectButtons));
    }

    if ($button.attr("data-wise-project-jobs-bound") !== "1") {
      $button.off(".wiseProjectJobsQol");
      $button.attr("data-wise-project-jobs-bound", "1");
      $button.on("click.wiseProjectJobsQol", function (event) {
        event.preventDefault();
        var currentPage = findProjectDetailsPage();
        if (!currentPage.ready) return;
        var collapsed = !readCompactState();
        writeCompactState(collapsed);
        applyCompactState(currentPage, collapsed);
        applyScrollSizing(currentPage);
      });
    }

    var $menu = page.projectButtons.children("#menuBtn,#menu_btn").first();
    if ($menu.length && !$button.next().is($menu)) {
      $button.insertBefore($menu);
    } else if (!$button.parent().length) {
      page.projectButtons.append($button);
    }

    updateCompactButton($button, readCompactState());
  }

  function ensureSummaryStrip(page) {
    var $summary = $("#" + CFG.summaryId);
    if (!$summary.length) {
      $summary = $('<div></div>')
        .attr("id", CFG.summaryId)
        .addClass("wise-project-jobs-compact-summary ui-corner-all")
        .text("Project details collapsed. Use Show details to restore the full project information section.");
    }

    if (!$summary.prev().is(page.projectInfo)) {
      $summary.detach().insertAfter(page.projectInfo);
    }
  }

  function applyCompactState(page, collapsed) {
    if (collapsed && (!state.projectInfoRowsMarked || state.lastProjectInfoEl !== page.projectInfo.get(0))) {
      markCompactProjectInfoRows(page);
      state.lastProjectInfoEl = page.projectInfo.get(0);
      state.projectInfoRowsMarked = true;
    }
    page.details.toggleClass("wise-project-jobs-compact", collapsed);
    $("#" + CFG.summaryId).attr("aria-hidden", collapsed && !page.projectInfo.hasClass("wise-project-jobs-compact-has-row") ? "false" : "true");
    updateCompactButton($("#" + CFG.buttonId), collapsed);
  }

  function markCompactProjectInfoRows(page) {
    if (!page || !page.projectInfo || !page.projectInfo.length) return;

    clearCompactProjectInfoRows(page.projectInfo);

    var $rows = findCompactProjectInfoRows(page.projectInfo);
    if (!$rows.length) return;

    page.projectInfo.addClass("wise-project-jobs-compact-has-row");
    $rows.each(function (index) {
      var $row = $(this);
      $row
        .addClass("wise-project-jobs-compact-keep")
        .attr("data-wise-project-jobs-compact-keep", index === 0 ? "header" : "name");
      $row.parentsUntil(page.projectInfo).addClass("wise-project-jobs-compact-path");
    });
  }

  function clearCompactProjectInfoRows($projectInfo) {
    $projectInfo.removeClass("wise-project-jobs-compact-has-row");
    $projectInfo
      .find(".wise-project-jobs-compact-path,.wise-project-jobs-compact-keep")
      .removeClass("wise-project-jobs-compact-path wise-project-jobs-compact-keep")
      .removeAttr("data-wise-project-jobs-compact-keep");
  }

  function markProjectLevelKitBookingFields(page) {
    if (!page || !page.projectInfo || !page.projectInfo.length) return;

    var $projectInfo = page.projectInfo;
    var hiddenCount = 0;
    clearProjectLevelKitBookingFields($projectInfo);

    $projectInfo.find("label,td,th,span,b,strong").each(function () {
      var $label = $(this);
      if (!isProjectLevelKitBookingField($label)) return;
      hiddenCount += hideProjectLevelKitBookingField($label, $projectInfo);
    });

    getProjectInfoRows($projectInfo).each(function () {
      var $row = $(this);
      if ($row.hasClass("wise-project-kitbooking-hidden")) return;
      if (!isProjectLevelKitBookingText(getElementSearchText($row))) return;
      if (containsProjectWrapperDateText($row)) return;

      hiddenCount += markProjectKitBookingHidden($row);
    });

    state.lastHiddenProjectKitBookingCount = hiddenCount;
  }

  function clearProjectLevelKitBookingFields($projectInfo) {
    $projectInfo
      .find(".wise-project-kitbooking-hidden")
      .removeClass("wise-project-kitbooking-hidden")
      .removeAttr("data-wise-project-kitbooking-hidden");
  }

  function hideProjectLevelKitBookingField($label, $projectInfo) {
    var hidden = 0;
    var $row = $label.closest("tr");

    if ($row.length && $projectInfo.has($row).length && !containsProjectWrapperDateText($row)) {
      return markProjectKitBookingHidden($row);
    }

    var $cell = $label.closest("td,th");
    if ($cell.length && $projectInfo.has($cell).length) {
      hidden += markProjectKitBookingHidden($cell);

      var $next = $cell.next("td,th");
      if ($next.length && isLikelyKitBookingValueCell($next)) {
        hidden += markProjectKitBookingHidden($next);
      }
    }

    var control = getLabelledControl($label);
    if (control && $projectInfo.has(control).length) {
      hidden += hideProjectLevelKitBookingControl($(control), $projectInfo);
    }

    if (!hidden) {
      hidden += markProjectKitBookingHidden($label);
    }

    return hidden;
  }

  function hideProjectLevelKitBookingControl($control, $projectInfo) {
    var $target = $control.closest("td,th,.field-row,.form-row,.row,.ui-helper-clearfix,li");
    if (!$target.length || !$projectInfo.has($target).length || containsProjectWrapperDateText($target)) {
      $target = $control;
    }

    return markProjectKitBookingHidden($target);
  }

  function getLabelledControl($label) {
    var id = $label.attr("for");
    if (!id) return null;

    try {
      return document.getElementById(id);
    } catch (err) {
      return null;
    }
  }

  function markProjectKitBookingHidden($target) {
    if (!$target || !$target.length) return 0;
    if ($target.hasClass("wise-project-kitbooking-hidden")) return 0;
    $target
      .addClass("wise-project-kitbooking-hidden")
      .attr("data-wise-project-kitbooking-hidden", "1");
    return 1;
  }

  function isLikelyKitBookingValueCell($cell) {
    if (!$cell || !$cell.length) return false;
    if (containsProjectWrapperDateText($cell)) return false;
    if ($cell.find("input,textarea,select,.hasDatepicker").length) return true;
    if ($cell.find("label,b,strong").length) return false;
    return !!compactText($cell.text());
  }

  function isProjectLevelKitBookingField($element) {
    if (!$element || !$element.length) return false;
    if (isProjectLevelKitBookingText(ownText($element))) return true;

    var bits = [
      $element.attr("id"),
      $element.attr("name"),
      $element.attr("for"),
      $element.attr("title"),
      $element.attr("aria-label"),
      $element.attr("data-label"),
      $element.attr("data-name"),
      $element.attr("data-field")
    ];
    return isProjectLevelKitBookingText(bits.join(" "));
  }

  function isProjectLevelKitBookingText(value) {
    var text = compactText(value).toLowerCase().replace(/[_-]+/g, " ");
    if (!text) return false;
    return /\boutgoing\s+(date\s*)?time\b/.test(text) ||
      /\breturn\s+(date\s*)?time\b/.test(text) ||
      /\bkit\s+booking\s+(start|end|from|to|starts|ends)\b/.test(text) ||
      /\b(start|end|from|to)\s+(?:of\s+)?kit\s+booking\b/.test(text) ||
      /\bkit\s+book(?:ing)?\s+(start|end)\b/.test(text);
  }

  function containsProjectWrapperDateText($element) {
    var text = getElementSearchText($element);
    return /\bstart\s+date\s+time\b/.test(text) ||
      /\bproject\s+end\s+date\s+time\b/.test(text) ||
      /\b(project|onsite|on site|wise event|event wrapper|salesforce)\b.*\b(start|end|from|to)\b/.test(text) ||
      /\b(start|end|from|to)\b.*\b(project|onsite|on site|wise event|event wrapper|salesforce)\b/.test(text);
  }

  function findCompactProjectInfoRows($projectInfo) {
    var $header = findProjectHeaderRow($projectInfo);
    if (!$header.length) return $();

    var $name = findProjectNameRow($projectInfo, $header);
    return $name.length && !$name.is($header) ? $header.add($name) : $header;
  }

  function findProjectHeaderRow($projectInfo) {
    var $rows = getProjectInfoRows($projectInfo);
    if (!$rows.length) return $();

    var best = null;
    var bestScore = -Infinity;
    $rows.each(function (index) {
      var $row = $(this);
      var score = scoreProjectHeaderRow($row, index);
      if (score > bestScore) {
        bestScore = score;
        best = this;
      }
    });

    return best ? $(best) : $rows.first();
  }

  function findProjectNameRow($projectInfo, $header) {
    var $rows = getProjectInfoRows($projectInfo);
    var best = null;
    var bestScore = 0;

    $rows.each(function () {
      var $row = $(this);
      var score = scoreProjectNameRow($row);
      if ($header && $header.length && $row.is($header)) score -= 4;
      if (score > bestScore) {
        bestScore = score;
        best = this;
      }
    });

    return bestScore >= 12 && best ? $(best) : $();
  }

  function getProjectInfoRows($projectInfo) {
    var $rows = $projectInfo.find("tr").filter(function () {
      return hasUsefulProjectInfoContent($(this));
    });
    if ($rows.length) return $rows;

    $rows = $projectInfo.find(".row,.form-row,.field-row,.ui-helper-clearfix").filter(function () {
      return hasUsefulProjectInfoContent($(this));
    });
    if ($rows.length) return $rows;

    return $projectInfo.children().filter(function () {
      return hasUsefulProjectInfoContent($(this));
    });
  }

  function scoreProjectHeaderRow($row, index) {
    var text = getElementSearchText($row);
    var score = Math.max(0, 20 - index);

    if (/\b(project|proj)\b.*\b(no|number|num|ref|id|#)\b/.test(text)) score += 24;
    if (/\b(no|number|num|ref|id|#)\b.*\b(project|proj)\b/.test(text)) score += 24;
    if (/\b(manager|managed|assigned|owner)\b/.test(text)) score += 14;
    if (/\b(created by|created|creator)\b/.test(text)) score += 14;
    if (/\b(colour|color|status)\b/.test(text)) score += 8;

    return score;
  }

  function scoreProjectNameRow($row) {
    var text = getElementSearchText($row);
    var score = 0;

    if (/\b(project|proj|event|job)\b.*\b(name|title)\b/.test(text)) score += 22;
    if (/\b(name|title)\b.*\b(project|proj|event|job)\b/.test(text)) score += 22;
    if (/\bname\b/.test(text)) score += 12;
    if (/\btitle\b/.test(text)) score += 10;
    if (/\b(manager|assigned|created|creator|client|contact|venue|depot|status|colour|color)\b/.test(text)) score -= 10;

    return score;
  }

  function hasUsefulProjectInfoContent($element) {
    if (compactText($element.text())) return true;

    var useful = false;
    $element.find("input,textarea,select,[title],[aria-label]").each(function () {
      if (compactText(getElementSearchText($(this)))) {
        useful = true;
        return false;
      }
      return true;
    });
    return useful;
  }

  function getElementSearchText($element) {
    var bits = [
      $element.text(),
      $element.attr("id"),
      $element.attr("name"),
      $element.attr("title"),
      $element.attr("aria-label"),
      $element.attr("placeholder")
    ];

    $element.find("input,textarea,select,[title],[aria-label]").each(function () {
      var $field = $(this);
      bits.push(
        $field.val(),
        $field.attr("id"),
        $field.attr("name"),
        $field.attr("title"),
        $field.attr("aria-label"),
        $field.attr("placeholder")
      );
    });

    return compactText(bits.join(" ")).toLowerCase();
  }

  function compactText(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
  }

  function ownText($element) {
    if (!$element || !$element.length) return "";

    var text = "";
    $element.contents().each(function () {
      if (this.nodeType === 3) text += this.nodeValue;
    });
    return compactText(text || $element.text());
  }

  function applyScrollSizing(page) {
    if (!page.details.length) return;

    var el = page.details.get(0);
    if (state.lastDetailsEl !== el) {
      state.lastDetailsEl = el;
      state.lastScrollMaxHeight = "";
    }

    var rect = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 700;
    var top = rect && isFinite(rect.top) ? Math.max(0, rect.top) : 0;
    var maxHeight = Math.max(CFG.minPanelHeight, Math.floor(viewportHeight - top - CFG.bottomPadding));
    var heightKey = String(maxHeight);

    if (state.lastScrollMaxHeight === heightKey) return;
    state.lastScrollMaxHeight = heightKey;

    page.details.css({
      maxHeight: maxHeight + "px",
      overflowY: "auto",
      overflowX: "hidden"
    });
  }

  function updateCompactButton($button, collapsed) {
    if (!$button || !$button.length) return;

    var icon = collapsed ? "ui-icon-caret-1-s" : "ui-icon-caret-1-n";
    var label = collapsed ? "Show details" : "Compact";
    var title = collapsed
      ? "Show project details above the jobs list"
      : "Collapse project details to give the jobs list more room";
    var stateKey = collapsed ? "collapsed" : "expanded";
    if ($button.attr("data-wise-project-jobs-state") === stateKey) return;

    $button
      .attr("data-wise-project-jobs-state", stateKey)
      .attr("aria-pressed", collapsed ? "true" : "false")
      .attr("title", title)
      .html('<span class="ui-button-icon ui-icon ' + icon + '"></span><span class="ui-button-icon-space"> </span>' + esc(label));
  }

  function removeOrphanedEnhancements() {
    if (!$("#proj_buttons").length) {
      $("#" + CFG.buttonId).remove();
    }
    if (!$("#proj_info").length) {
      $("#" + CFG.summaryId).remove();
      $(".wise-project-jobs-scroll").removeClass("wise-project-jobs-scroll wise-project-jobs-compact");
    }
  }

  function getButtonWidth($buttons) {
    var $sample = $buttons.children("button:visible").first();
    var width = $sample.length ? Math.round($sample.outerWidth()) : 155;
    return Math.max(116, width) + "px";
  }

  function readCompactState() {
    try {
      return window.localStorage.getItem(CFG.storageKey) === "1";
    } catch (err) {
      log("Could not read compact state", err);
      return false;
    }
  }

  function writeCompactState(collapsed) {
    try {
      window.localStorage.setItem(CFG.storageKey, collapsed ? "1" : "0");
    } catch (err) {
      log("Could not store compact state", err);
    }
  }

  function installStyles() {
    if ($("#" + CFG.stylesId).length) return;

    var css = [
      "#details_tab.wise-project-jobs-scroll{box-sizing:border-box;scrollbar-gutter:stable;}",
      "#details_tab.wise-project-jobs-compact #proj_info{display:block!important;margin-bottom:6px!important;overflow:visible!important;}",
      "#details_tab.wise-project-jobs-compact #proj_info:not(.wise-project-jobs-compact-has-row){display:none!important;}",
      "#details_tab.wise-project-jobs-compact #proj_info.wise-project-jobs-compact-has-row>:not(.wise-project-jobs-compact-path):not(.wise-project-jobs-compact-keep){display:none!important;}",
      "#details_tab.wise-project-jobs-compact #proj_info.wise-project-jobs-compact-has-row .wise-project-jobs-compact-path>:not(.wise-project-jobs-compact-path):not(.wise-project-jobs-compact-keep){display:none!important;}",
      "#details_tab.wise-project-jobs-compact #proj_info.wise-project-jobs-compact-has-row table.wise-project-jobs-compact-path{width:100%;}",
      "#details_tab.wise-project-jobs-compact #proj_info.wise-project-jobs-compact-has-row tr.wise-project-jobs-compact-keep>td{padding-top:2px!important;padding-bottom:2px!important;}",
      "#details_tab.wise-project-jobs-compact #proj_info.wise-project-jobs-compact-has-row+#wise-project-jobs-compact-summary{display:none!important;}",
      "#details_tab:not(.wise-project-jobs-compact) #wise-project-jobs-compact-summary{display:none!important;}",
      "#details_tab #proj_info .wise-project-kitbooking-hidden{display:none!important;}",
      "#wise-project-jobs-compact-summary{margin:0 0 6px;padding:6px 8px;border:1px solid #a1a1a1;background:#f0f0f0;color:#333;font-weight:bold;box-sizing:border-box;}",
      "#wise-project-jobs-compact-btn{margin-right:0.4em;}",
      "#wise-project-jobs-compact-btn .ui-button-icon{margin-left:0;}"
    ].join("\n");

    $("<style></style>", { id: CFG.stylesId, text: css }).appendTo("head");
  }

  function asNumber(value, fallback) {
    var number = Number(value);
    return isFinite(number) && number > 0 ? number : fallback;
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function log() {
    if (!window.console || !window.console.log) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift(LOG_PREFIX);
    window.console.log.apply(window.console, args);
  }

  window.__wiseProjectJobsQol = {
    version: CFG.version,
    refresh: function () {
      maintainProjectJobsLayout({ forceScan: true });
    },
    collapse: function () {
      var page = findProjectDetailsPage();
      if (!page.ready) return;
      writeCompactState(true);
      applyCompactState(page, true);
      applyScrollSizing(page);
    },
    expand: function () {
      var page = findProjectDetailsPage();
      if (!page.ready) return;
      writeCompactState(false);
      applyCompactState(page, false);
      applyScrollSizing(page);
    },
    isCompact: readCompactState,
    describe: function () {
      var page = findProjectDetailsPage();
      return {
        version: CFG.version,
        projectPageFound: page.ready,
        compact: readCompactState(),
        detailsScrollable: page.details.hasClass("wise-project-jobs-scroll"),
        hiddenProjectKitBookingFields: state.lastHiddenProjectKitBookingCount
      };
    }
  };
})();

/* ===========================================================================
 * Wise Project Layout
 * ---------------------------------------------------------------------------
 * Regroups the native Project Details fields (in #proj_info) into clearer
 * sections — Wise Project Details, Project Ownership, Operational Timings,
 * Working Links — plus a muted "System Details" remainder and a relabelled
 * jobs table caption. This is presentation-only:
 *   - Fields are MOVED, never cloned or removed, so native names/ids/
 *     values/event listeners are untouched and nothing native breaks.
 *   - Every lookup is by visible label text (no fixed IDs to rely on), and
 *     every step is wrapped so a missing/renamed field is skipped quietly
 *     instead of breaking the page.
 *   - Colours are derived from whatever HireHop/Salesforce already applied
 *     to this project; the HireHop orange is only a last-resort fallback.
 * Restricted to the Proposal Creation depot only (see isProposalCreationDepot
 * below) — other depots keep the plain native layout untouched. This is
 * distinct from the date/kit-booking field hiding in the module above,
 * which intentionally still applies across all depots.
 * Runs independently of the "compact toggle" module above so a failure in
 * one never affects the other or the native HireHop screen.
 * ========================================================================= */
(function () {
  "use strict";

  var $ = window.jQuery;
  if (!$) return;

  var LOG_PREFIX = "[Wise Project Layout]";

  var CFG = {
    version: "2026-07-02.3",
    stylesId: "wise-project-layout-styles",
    rootId: "wise-project-layout-root",
    rootClass: "wise-project-layout-active",
    maintainRecoveryMs: 5000,
    fallbackAccent: "#f97316" // Safe fallback only — real accent is detected per project.
  };

  // Label aliases are matched case-insensitively against the *visible* text
  // HireHop already renders for a field's label (colon/whitespace ignored).
  // ASSUMPTION: exact label wording is unconfirmed, so each entry lists the
  // reasonable variants; anything that doesn't match is left in place
  // untouched rather than guessed at.
  var WISE_FIELDS = [
    { aliases: ["wise status", "sf status", "salesforce status"], label: "Status" },
    { aliases: ["tier", "client tier"], label: "Tier" },
    { aliases: ["client", "customer", "account", "client name"], label: "Client" },
    { aliases: ["type of event", "event type"], label: "Type of Event" },
    { aliases: ["ye promo budget allocation", "ye promo budget", "promo budget allocation"], label: "YE Promo Budget Allocation" },
    { aliases: ["project name"], label: "Project Name" },
    { aliases: ["sf project name", "salesforce project name"], label: "SF Project Name" },
    { aliases: ["venue", "venue name"], label: "Venue" },
    { aliases: ["revenue"], label: "Revenue" },
    { aliases: ["probability"], label: "Probability" },
    { aliases: ["wise job number", "wise job no", "wise job #"], label: "Wise Job Number" },
    { aliases: ["project/onsite start", "project onsite start", "onsite start"], label: "Project/Onsite Start" },
    { aliases: ["project/onsite end", "project onsite end", "onsite end"], label: "Project/Onsite End" },
    { aliases: ["delivery address", "delivery/contact address"], label: "Delivery Address" },
    { aliases: ["contact address", "site address"], label: "Contact Address" }
  ];

  var OWNERSHIP_FIELDS = [
    { aliases: ["project manager"], label: "Project Manager" },
    { aliases: ["designer assigned", "designer"], label: "Designer" },
    { aliases: ["tpm assigned", "tpm", "technical pm"], label: "Technical PM" },
    { aliases: ["production assigned", "production lead", "production"], label: "Production Lead" }
  ];

  var TIMING_FIELDS = [
    { aliases: ["install start"], label: "Install Start" },
    { aliases: ["show start"], label: "Show Start" },
    { aliases: ["show end"], label: "Show End" },
    { aliases: ["derig start"], label: "Derig Start" }
  ];

  var PLAN_FIELD = { aliases: ["plan url", "planner url", "plan link", "ms planner", "microsoft planner"], buttonLabel: "Open Plan" };
  var LOOP_FIELD = { aliases: ["loop url", "loop link", "cover sheet", "ms loop", "microsoft loop"], buttonLabel: "Open Cover Sheet" };

  var state = {
    sections: null,
    lastProjectInfoEl: null,
    maintainTimer: null,
    maintainScheduled: null
  };

  bootstrap();

  function bootstrap() {
    installStyles();
    scheduleMaintain(0);
    state.maintainTimer = setInterval(function () { scheduleMaintain(0); }, CFG.maintainRecoveryMs);

    $(window).on("load.wiseProjectLayout focus.wiseProjectLayout resize.wiseProjectLayout hashchange.wiseProjectLayout", function () {
      scheduleMaintain(60);
    });
    $(document).on("ajaxComplete.wiseProjectLayout", function () {
      scheduleMaintain(80);
    });
  }

  function scheduleMaintain(delay) {
    if (state.maintainScheduled) clearTimeout(state.maintainScheduled);
    state.maintainScheduled = setTimeout(function () {
      state.maintainScheduled = null;
      // Safety net: this module must never be able to take the native
      // HireHop screen down with it, so every pass is caught here.
      try {
        maintainLayout();
      } catch (err) {
        log("maintain failed, native screen unaffected", err);
      }
    }, Math.max(0, Number(delay) || 0));
  }

  function maintainLayout() {
    var $projectInfo = $("#proj_info").first();
    if (!$projectInfo.length) {
      teardown();
      return;
    }

    // This visual regrouping is Proposal Creation-only by request — other
    // depots keep the plain native layout. The date/kit-booking field
    // hiding above (the first module in this file) is deliberately NOT
    // gated here, since that should keep applying across all depots.
    if (!isProposalCreationDepot()) {
      teardown();
      return;
    }

    // Rebuild from a clean slate only when #proj_info is a genuinely new
    // DOM node (project switch / full native re-render). Detecting this by
    // node identity — rather than hashing visible text, which this module
    // itself keeps changing as it relocates fields — avoids false
    // positives that would otherwise re-run the "first build" path (and
    // duplicate the section/caption chrome) on every ordinary refresh.
    if (state.lastProjectInfoEl && state.lastProjectInfoEl !== $projectInfo.get(0)) {
      $("#" + CFG.rootId).remove();
      $(".wise-pl-system-caption").remove();
      state.sections = null;
    }
    state.lastProjectInfoEl = $projectInfo.get(0);

    // Self-heal: if an earlier bug (or an unexpected duplicate ajax burst)
    // ever left more than one caption/root behind, collapse back to one
    // instead of letting them accumulate.
    $("#" + CFG.rootId).slice(1).remove();
    $(".wise-pl-system-caption").slice(1).remove();

    buildLayout($projectInfo);
  }

  function teardown() {
    $("#" + CFG.rootId).remove();
    $(".wise-pl-system-caption").remove();
    $("body").removeClass(CFG.rootClass);
    state.sections = null;
    state.lastProjectInfoEl = null;
  }

  // ---- Depot gate ----------------------------------------------------------
  // Reuses the shared, already-tested depot-detection module from
  // 5-hirehop.js (loaded alongside this file for the project details route
  // — see 0-loader.js) rather than re-implementing depot detection here.
  // Its default rule is already "Proposal Creation" only, which is exactly
  // what this visual regrouping should be limited to.
  // ASSUMPTION: if the shared module hasn't finished loading yet, or can't
  // detect a depot at all on this page, this fails *closed* (treats the
  // depot as not allowed) rather than guessing — the native layout is
  // always a safe fallback, so a missed detection just means one extra
  // maintain pass before the sections appear once the module is ready.
  function isProposalCreationDepot() {
    var shared = window.WiseProposalSectionBuilderHireHop;
    if (!shared || !shared.depot || typeof shared.depot.isAllowed !== "function") return false;

    try {
      return !!shared.depot.isAllowed();
    } catch (err) {
      log("depot check failed, layout left inactive as a precaution", err);
      return false;
    }
  }

  // ---------------------------------------------------------------------
  // Layout build — runs on every maintain pass. Idempotent: fields already
  // relocated on a previous pass are found again (search scope covers both
  // #proj_info and the section root) and simply re-appended in place, so
  // repeated calls never duplicate or drop anything.
  // ---------------------------------------------------------------------
  function buildLayout($projectInfo) {
    var $root = $("#" + CFG.rootId);
    var firstBuild = !$root.length;

    if (firstBuild) {
      $root = $("<div></div>").attr("id", CFG.rootId).addClass("wise-pl-root");
      $projectInfo.before($root);
      state.sections = buildSectionChrome($root);
    } else if (!isBeforeInDocument($root, $projectInfo)) {
      // Only reposition when truly out of place. Requiring $root to sit
      // *immediately* before #proj_info would fight the System Details
      // caption for that exact slot every pass (the caption also wants to
      // be adjacent to #proj_info) and needlessly reorder the DOM.
      $root.detach();
      $projectInfo.before($root);
    }

    $("body").addClass(CFG.rootClass);
    $root.get(0).style.setProperty("--wise-project-accent", detectProjectAccentColour());

    var claimed = [];
    var $scope = getSearchScope($projectInfo, $root);

    WISE_FIELDS.forEach(function (field) {
      moveFieldToSection(field.aliases, state.sections.wise.$body, field.label, $scope, claimed);
    });
    OWNERSHIP_FIELDS.forEach(function (field) {
      moveFieldToSection(field.aliases, state.sections.ownership.$body, field.label, $scope, claimed);
    });
    TIMING_FIELDS.forEach(function (field) {
      moveFieldToSection(field.aliases, state.sections.timings.$body, field.label, $scope, claimed, { normaliseEmpty: true });
    });

    buildWorkingLinks($scope, claimed);

    hideSectionIfEmpty(state.sections.wise);
    hideSectionIfEmpty(state.sections.ownership);
    hideSectionIfEmpty(state.sections.timings);
    hideSectionIfEmpty(state.sections.links);

    applySystemDetailsTreatment($projectInfo);
    relabelDeliveryPackages();
  }

  function isImmediatelyBefore($el, $reference) {
    return !!($el.length && $reference.length && $el.next().is($reference));
  }

  function isBeforeInDocument($el, $reference) {
    if (!$el.length || !$reference.length) return false;
    var position = $el.get(0).compareDocumentPosition($reference.get(0));
    return !!(position & Node.DOCUMENT_POSITION_FOLLOWING);
  }

  function getSearchScope($projectInfo, $root) {
    return $projectInfo.add($root);
  }

  function buildSectionChrome($root) {
    var wise = createSection("Wise Project Details", { key: "wise", primary: true });
    var ownership = createSection("Project Ownership", { key: "ownership" });
    var timings = createSection("Operational Timings", { key: "timings" });
    var links = createSection("Working Links", { key: "links" });

    $root.append(wise.$section, ownership.$section, timings.$section, links.$section);

    return { wise: wise, ownership: ownership, timings: timings, links: links };
  }

  function hideSectionIfEmpty(section) {
    if (!section) return;
    section.$section.toggleClass("wise-pl-section--empty", section.$body.children().length === 0);
  }

  // ---- Helper: createSection ---------------------------------------------
  // Builds a native-looking grey panel (thin border, small caption, thin
  // accent-coloured top rule) and returns the <tbody> fields get appended
  // into. `options.primary` gives it a lighter/prominent header;
  // `options.secondary` mutes it; `options.collapsible` adds a
  // native-looking "Show more" toggle, collapsed by default.
  function createSection(title, options) {
    options = options || {};
    var $section = $("<section></section>")
      .addClass("wise-pl-section")
      .attr("data-wise-pl-section", options.key || "");
    if (options.primary) $section.addClass("wise-pl-section--primary");
    if (options.secondary) $section.addClass("wise-pl-section--secondary");

    var $hdr = $("<div></div>").addClass("wise-pl-section-hdr").appendTo($section);
    $("<h3></h3>").addClass("wise-pl-section-title").text(title).appendTo($hdr);

    if (options.collapsible) {
      $section.addClass("wise-pl-section--collapsible is-collapsed");
      $("<button></button>")
        .attr("type", "button")
        .addClass("wise-pl-toggle")
        .text("Show more")
        .on("click.wiseProjectLayout", function (event) {
          event.preventDefault();
          var collapsed = $section.toggleClass("is-collapsed").hasClass("is-collapsed");
          $(this).text(collapsed ? "Show more" : "Show less");
        })
        .appendTo($hdr);
    }

    var $table = $("<table></table>").addClass("wise-pl-table").appendTo($section);
    var $body = $("<tbody></tbody>").appendTo($table);

    return { $section: $section, $body: $body, $hdr: $hdr };
  }

  // ---- Helper: findFieldByLabel -------------------------------------------
  // Finds a visible label matching one of `aliases` within `$scope`.
  // Returns null (never throws) when nothing matches so callers can skip
  // the field safely — this is the module's core "safe fallback".
  function findFieldByLabel(aliases, $scope, claimed) {
    if (!$scope || !$scope.length) return null;

    var wanted = aliases.map(normaliseLabelText);
    var result = null;

    $scope.find("label,td,th,span,b,strong,dt,div").each(function () {
      if (result) return false;
      if (claimed && claimed.indexOf(this) !== -1) return;

      var text = normaliseLabelText(ownText($(this)));
      if (!text || wanted.indexOf(text) === -1) return;

      result = $(this);
      return false;
    });

    if (!result) return null;
    if (claimed) claimed.push(result.get(0));

    // $row is kept only as a fallback/search context — HireHop packs
    // several unrelated label/value pairs into a single native <tr>, so
    // the row itself must never be moved wholesale (see
    // appendFieldToSection): only $label and $valueCell/control, which are
    // scoped tightly to this one field, are ever relocated.
    var $row = result.closest("tr");
    if (!$row.length) $row = result.closest(".row,.form-row,.field-row,li,.ui-helper-clearfix");
    if (!$row.length) $row = result.parent();

    var $valueCell = result.is("td,th") ? result.nextAll("td,th").first() : $();
    var control = null;
    var forId = result.attr("for");
    if (forId) {
      try { control = document.getElementById(forId); } catch (err) { control = null; }
    }
    if (!control) {
      // Only look inside the matched value cell (or the label's own
      // immediate parent when there is no separate cell) — never the whole
      // row, which may contain other fields' controls too.
      var $controlScope = $valueCell.length ? $valueCell : result.parent();
      var $control = $controlScope.find("input,textarea,select").addBack("input,textarea,select").first();
      if ($control.length) control = $control.get(0);
    }

    return { $label: result, $row: $row, $valueCell: $valueCell, control: control };
  }

  function normaliseLabelText(value) {
    return compactText(value).toLowerCase().replace(/[:：]\s*$/, "");
  }

  function ownText($element) {
    if (!$element || !$element.length) return "";
    var text = "";
    $element.contents().each(function () {
      if (this.nodeType === 3) text += this.nodeValue;
    });
    text = compactText(text);
    return text || compactText($element.text());
  }

  // ---- Helper: moveFieldToSection -----------------------------------------
  // Physically relocates a field into a section's <tbody>. Only the
  // matched label and its value cell/control are moved (appendTo, never
  // cloned) — never the whole native row, because HireHop often packs
  // several unrelated label/value pairs into one <tr> and moving the row
  // wholesale would drag those unrelated fields along with it. Names/ids/
  // values/bound listeners are untouched — this is a reparent, not a
  // redraw. `newLabel`, if given, only rewrites the *label's own text
  // node* — the underlying control's name/id/value are never touched.
  function moveFieldToSection(aliases, $sectionBody, newLabel, $scope, claimed, options) {
    options = options || {};
    var field = findFieldByLabel(aliases, $scope, claimed);
    if (!field) {
      log("Field not found, left in native position:", aliases[0]);
      return false;
    }

    if (newLabel) relabel(field.$label, newLabel);
    appendFieldToSection(field, $sectionBody);
    if (options.normaliseEmpty) normaliseEmptyValue(field);
    return true;
  }

  // Builds one small <tr> per field inside the target section, containing
  // only that field's own label and value/control — never any sibling
  // content from a shared native row. Idempotent: if this exact field was
  // already relocated on an earlier pass, its row is found (the label is
  // still inside it) and simply re-appended rather than rebuilt, so
  // repeated maintain passes never leave orphaned empty rows behind.
  function appendFieldToSection(field, $sectionBody) {
    var $existingRow = field.$label.closest(".wise-pl-field-row");
    if ($existingRow.length && $sectionBody.find($existingRow).length) {
      $sectionBody.append($existingRow);
      return;
    }

    var $wrapRow = $("<tr></tr>").addClass("wise-pl-field-row");
    $wrapRow.append(asRowCell(field.$label));

    if (field.$valueCell && field.$valueCell.length) {
      $wrapRow.append(asRowCell(field.$valueCell));
    } else if (field.control) {
      $wrapRow.append(asRowCell($(field.control)));
    }

    $sectionBody.append($wrapRow);
  }

  function asRowCell($el) {
    if ($el.is("td,th")) return $el;
    return $("<td></td>").addClass("wise-pl-wrap-cell").append($el);
  }

  function relabel($label, newLabel) {
    if (!$label || !$label.length) return;
    var node = $label.get(0);
    var textNode = null;
    for (var i = 0; i < node.childNodes.length; i++) {
      if (node.childNodes[i].nodeType === 3 && compactText(node.childNodes[i].nodeValue)) {
        textNode = node.childNodes[i];
        break;
      }
    }
    var hadColon = /[:：]\s*$/.test(compactText($label.text()));
    var nextText = newLabel + (hadColon ? ":" : "");
    if (textNode) textNode.nodeValue = nextText;
    else $label.text(nextText);
  }

  // ---- Helper: normaliseEmptyValue ----------------------------------------
  // Blank display-only values read as "Not set" instead of empty space.
  // Never rewrites an <input>/<select>/<textarea>'s value — those only get
  // a muted CSS class, since changing their value would change saved data.
  // Scoped strictly to this field's own value cell/control — never the
  // wider native row (see moveFieldToSection) — so a blank value never
  // wipes out unrelated sibling fields that happen to share that row.
  function normaliseEmptyValue(field) {
    if (field.control) {
      if (!compactText(field.control.value)) $(field.control).addClass("wise-pl-empty-control");
      return;
    }

    var $target = field.$valueCell;
    if (!$target || !$target.length) return; // no safely-scoped target — leave native display as-is

    if (!compactText($target.text())) {
      $target.addClass("wise-pl-empty-value").html('<span class="wise-pl-empty-dash">Not set</span>');
    }
  }

  // ---- Section: Working Links ----------------------------------------------
  // Plan/Loop links become native-looking buttons that open in a new tab.
  // When HireHop already renders a real <a href>, that element is restyled
  // in place (href/target/listeners untouched) rather than replaced.
  function buildWorkingLinks($scope, claimed) {
    appendLinkRow(PLAN_FIELD, state.sections.links.$body, $scope, claimed);
    appendLinkRow(LOOP_FIELD, state.sections.links.$body, $scope, claimed);
  }

  function appendLinkRow(fieldDef, $sectionBody, $scope, claimed) {
    var field = findFieldByLabel(fieldDef.aliases, $scope, claimed);
    if (!field) {
      log("Link field not found, left in native position:", fieldDef.aliases[0]);
      return false;
    }

    var $btn = makeLinkButton(field, fieldDef.buttonLabel);
    if (!$btn) return false;

    appendFieldToSection(field, $sectionBody);
    return true;
  }

  // ---- Helper: makeLinkButton ----------------------------------------------
  // Scoped to this field's own value cell/control only — never the whole
  // native row, which (per moveFieldToSection above) may hold unrelated
  // fields too and must never be searched or moved wholesale.
  function makeLinkButton(field, label) {
    var $valueScope = field.$valueCell && field.$valueCell.length ? field.$valueCell : field.$label;
    var $existingAnchor = $valueScope.find("a[href]").addBack("a[href]").first();
    if ($existingAnchor.length) {
      $existingAnchor
        .addClass("wise-pl-link-btn ui-button ui-corner-all ui-widget")
        .attr("target", "_blank")
        .attr("rel", "noopener noreferrer")
        .text(label);
      return $existingAnchor;
    }

    var url = extractUrl(field);
    if (!url) return null;

    var $existingBtn = $valueScope.find(".wise-pl-link-btn").first();
    if ($existingBtn.length) return $existingBtn; // already built on an earlier pass

    var $btn = $("<a></a>")
      .addClass("wise-pl-link-btn ui-button ui-corner-all ui-widget")
      .attr({ href: url, target: "_blank", rel: "noopener noreferrer" })
      .text(label);

    // Keep the raw control/text in the DOM (so any native save logic bound
    // to it keeps running) but hide it visually behind the new button.
    if (field.control) $(field.control).addClass("wise-pl-visually-hidden");
    else if (field.$valueCell && field.$valueCell.length) field.$valueCell.addClass("wise-pl-visually-hidden");

    if (field.$valueCell && field.$valueCell.length) $btn.appendTo(field.$valueCell);
    else $btn.insertAfter(field.$label);
    return $btn;
  }

  function extractUrl(field) {
    var candidates = [];
    if (field.control) candidates.push(field.control.value);
    if (field.$valueCell && field.$valueCell.length) candidates.push(field.$valueCell.text());
    else candidates.push(field.$label.text());

    for (var i = 0; i < candidates.length; i++) {
      var match = String(candidates[i] || "").match(/https?:\/\/\S+/);
      if (match) return match[0].replace(/[),.]+$/, "");
    }
    return "";
  }

  // ---- Helper: detectProjectAccentColour -----------------------------------
  // Reuses whatever colour HireHop/Salesforce already applied to this
  // project (a status swatch near the project fields, or a coloured jobs
  // grid row). Falls back to the existing HireHop orange only when nothing
  // usable is found — never a hard-coded brand colour otherwise.
  function detectProjectAccentColour() {
    return findColourSwatch() || findJobRowColour() || CFG.fallbackAccent;
  }

  function findColourSwatch() {
    var found = "";
    $("#proj_info [class*='colour'],#proj_info [class*='color'],#proj_info [style*='background']").each(function () {
      if (found) return false;
      var hex = rgbToHex($(this).css("background-color"));
      if (hex && !isNeutralColour(hex)) found = hex;
    });
    return found;
  }

  function findJobRowColour() {
    var found = "";
    $("#jobs_grid tr,#project_jobs_grid tr").each(function () {
      if (found) return false;
      var hex = rgbToHex($(this).css("background-color"));
      if (hex && !isNeutralColour(hex)) found = hex;
    });
    return found;
  }

  function rgbToHex(value) {
    var match = String(value || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return "";
    return "#" +
      ("0" + parseInt(match[1], 10).toString(16)).slice(-2) +
      ("0" + parseInt(match[2], 10).toString(16)).slice(-2) +
      ("0" + parseInt(match[3], 10).toString(16)).slice(-2);
  }

  function isNeutralColour(hex) {
    var match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!match) return true;
    var r = parseInt(match[1], 16), g = parseInt(match[2], 16), b = parseInt(match[3], 16);
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    return (max - min) < 12 || max > 250; // greyscale or near-white counts as "no real colour"
  }

  // ---- Section: Delivery Packages (jobs table) -----------------------------
  // The native jobs grid itself is never touched — only a caption is added
  // above it, and (best-effort) its jqGrid title bar text is relabelled.
  function relabelDeliveryPackages() {
    var $grid = $("#gbox_jobs_grid").first();
    if (!$grid.length) return;

    if (!$grid.prev().is(".wise-pl-jobs-caption")) {
      $("<div></div>").addClass("wise-pl-jobs-caption").text("Delivery Packages (Jobs)").insertBefore($grid);
    }

    var $titleBar = $grid.find(".ui-jqgrid-titlebar .ui-jqgrid-title").first();
    if ($titleBar.length && !$titleBar.attr("data-wise-pl-original-title")) {
      $titleBar.attr("data-wise-pl-original-title", $titleBar.text() || "1");
      $titleBar.text("Delivery Packages (Jobs)");
    }

    applyJobStatusBadges();
  }

  // Lightly badges job rows using whatever status/row colour HireHop has
  // already applied — additive only (an inset box-shadow), never replaces
  // native row styling, and does nothing if no colour is detectable.
  function applyJobStatusBadges() {
    $("#jobs_grid tr[role='row']").each(function () {
      var $row = $(this);
      var hex = rgbToHex($row.css("background-color"));
      if (!hex || isNeutralColour(hex)) return;
      $row.find("td").first().css("box-shadow", "inset 3px 0 0 " + hex);
    });
  }

  // ---- Section: System Details (HireHop) -----------------------------------
  // Left in its native table/position — nothing here is moved — so any
  // HireHop behaviour bound to these rows keeps working exactly as before.
  // Rows with a value stay visible (just visually muted/secondary); rows
  // with no value are hidden behind a native-looking "Show more" toggle.
  function applySystemDetailsTreatment($projectInfo) {
    if (!$projectInfo.length) return;
    $projectInfo.addClass("wise-pl-system");

    // Look up the caption by class rather than by "is it my immediate
    // previous sibling" — $root can legitimately get re-inserted directly
    // before #proj_info on a later pass (see buildLayout), which would
    // otherwise push the existing caption out of that position and fool a
    // positional check into creating a duplicate every pass.
    var $caption = $(".wise-pl-system-caption").first();
    if (!$caption.length) {
      $caption = $("<div></div>").addClass("wise-pl-system-caption");
      $("<span></span>").addClass("wise-pl-section-title").text("System Details (HireHop)").appendTo($caption);
      $("<button></button>")
        .attr("type", "button")
        .addClass("wise-pl-toggle")
        .text("Show more")
        .on("click.wiseProjectLayout", function (event) {
          event.preventDefault();
          var expanded = $projectInfo.toggleClass("wise-pl-system-expanded").hasClass("wise-pl-system-expanded");
          $(this).text(expanded ? "Show less" : "Show more");
        })
        .appendTo($caption);
    }
    if (!isImmediatelyBefore($caption, $projectInfo)) {
      $caption.insertBefore($projectInfo);
    }

    $projectInfo.find("tr").each(function () {
      var $row = $(this);
      if ($row.closest(".wise-pl-section").length) return; // already relocated into a named section
      $row.toggleClass("wise-pl-blank-row", !hasVisibleValue($row));
    });
  }

  // A native row may still hold several unrelated label/value pairs (see
  // moveFieldToSection), so there is no single reliable "value cell" to
  // check in isolation here. To avoid ever hiding a row that actually has
  // visible content, this only counts a row as blank when *nothing* in it
  // — no cell text, no control value — is non-empty.
  function hasVisibleValue($row) {
    var hasValue = false;
    $row.find("input,textarea,select").each(function () {
      if (compactText($(this).val())) hasValue = true;
    });
    if (hasValue) return true;

    return !!compactText($row.text());
  }

  function installStyles() {
    if ($("#" + CFG.stylesId).length) return;

    var accentVar = "var(--wise-project-accent," + CFG.fallbackAccent + ")";
    var css = [
      "#" + CFG.rootId + "{margin:0 0 8px;box-sizing:border-box;}",
      ".wise-pl-section{background:#f7f7f7;border:1px solid #c9c9c9;border-radius:3px;margin-bottom:8px;box-sizing:border-box;overflow:hidden;}",
      ".wise-pl-section--empty{display:none;}",
      ".wise-pl-section-hdr{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 8px;background:#ececec;border-bottom:1px solid #c9c9c9;border-top:3px solid " + accentVar + ";box-sizing:border-box;}",
      ".wise-pl-section--primary{border-color:" + accentVar + ";}",
      ".wise-pl-section--primary>.wise-pl-section-hdr{background:#fff;}",
      ".wise-pl-section-title{font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.04em;color:#333;margin:0;}",
      ".wise-pl-toggle{font-size:11px;border:1px solid #c9c9c9;background:#fff;border-radius:3px;padding:2px 8px;cursor:pointer;color:#333;}",
      ".wise-pl-toggle:hover{background:#f0f0f0;}",
      ".wise-pl-section--collapsible.is-collapsed .wise-pl-table{display:none;}",
      ".wise-pl-table{width:100%;border-collapse:collapse;font-size:12px;}",
      ".wise-pl-table tr>td:first-child,.wise-pl-table tr>th:first-child{width:38%;padding:3px 8px;color:#555;vertical-align:top;}",
      ".wise-pl-table tr>td:last-child,.wise-pl-table tr>th:last-child{padding:3px 8px;color:#111;}",
      ".wise-pl-table tr:nth-child(even){background:rgba(0,0,0,.03);}",
      ".wise-pl-wrap-cell{padding:3px 8px;}",
      ".wise-pl-empty-value{color:#999;}",
      ".wise-pl-empty-dash{font-style:italic;color:#999;}",
      ".wise-pl-empty-control{opacity:.6;}",
      ".wise-pl-visually-hidden{display:none!important;}",
      ".wise-pl-link-btn{display:inline-block;text-decoration:none;padding:3px 10px;font-size:12px;}",
      "#proj_info.wise-pl-system{font-size:11px;color:#555;background:#fafafa;}",
      "#proj_info.wise-pl-system tr.wise-pl-blank-row{display:none;}",
      "#proj_info.wise-pl-system.wise-pl-system-expanded tr.wise-pl-blank-row{display:table-row;}",
      ".wise-pl-system-caption{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 8px;border-top:3px solid " + accentVar + ";background:#ececec;border:1px solid #c9c9c9;border-bottom:0;box-sizing:border-box;}",
      ".wise-pl-jobs-caption{font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:.04em;color:#333;padding:4px 2px;border-top:3px solid " + accentVar + ";margin-top:4px;}"
    ].join("\n");

    $("<style></style>", { id: CFG.stylesId, text: css }).appendTo("head");
  }

  function compactText(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
  }

  function log() {
    if (!window.console || !window.console.log) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift(LOG_PREFIX);
    window.console.log.apply(window.console, args);
  }

  window.__wiseProjectLayout = {
    version: CFG.version,
    refresh: function () {
      $("#" + CFG.rootId).remove();
      $(".wise-pl-system-caption").remove();
      state.sections = null;
      state.lastProjectInfoEl = null;
      scheduleMaintain(0);
    }
  };
})();
