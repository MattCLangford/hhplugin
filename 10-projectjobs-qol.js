(function () {
  "use strict";

  var $ = window.jQuery;
  if (!$) return;

  var LOG_PREFIX = "[Wise Project Jobs QOL]";
  var EXTERNAL_CONFIG = window.WiseProjectJobsQolConfig && typeof window.WiseProjectJobsQolConfig === "object"
    ? window.WiseProjectJobsQolConfig
    : {};

  var CFG = {
    version: "2026-06-22.3",
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
      !state.projectInfoRowsMarked;

    page.details.addClass("wise-project-jobs-scroll");
    ensureSummaryStrip(page);
    if (shouldScanProjectInfo) {
      markCompactProjectInfoRows(page);
      state.lastProjectInfoEl = projectInfoEl;
      state.projectInfoRowsMarked = true;
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
        detailsScrollable: page.details.hasClass("wise-project-jobs-scroll")
      };
    }
  };
})();
