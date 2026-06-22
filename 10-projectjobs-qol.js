(function () {
  "use strict";

  var $ = window.jQuery;
  if (!$) return;

  var LOG_PREFIX = "[Wise Project Jobs QOL]";
  var EXTERNAL_CONFIG = window.WiseProjectJobsQolConfig && typeof window.WiseProjectJobsQolConfig === "object"
    ? window.WiseProjectJobsQolConfig
    : {};

  var CFG = {
    version: "2026-06-22.1",
    stylesId: "wise-project-jobs-qol-styles",
    buttonId: "wise-project-jobs-compact-btn",
    summaryId: "wise-project-jobs-compact-summary",
    storageKey: "wise-project-jobs-qol:project-details-compact",
    minPanelHeight: asNumber(EXTERNAL_CONFIG.minPanelHeight, 320),
    bottomPadding: asNumber(EXTERNAL_CONFIG.bottomPadding, 12)
  };

  var state = {
    maintainTimer: null
  };

  bootstrap();

  function bootstrap() {
    installStyles();
    maintainProjectJobsLayout();
    state.maintainTimer = setInterval(maintainProjectJobsLayout, 900);

    $(window).on("load.wiseProjectJobsQol focus.wiseProjectJobsQol resize.wiseProjectJobsQol hashchange.wiseProjectJobsQol", function () {
      setTimeout(maintainProjectJobsLayout, 60);
    });
    $(document).on("ajaxComplete.wiseProjectJobsQol", function () {
      setTimeout(maintainProjectJobsLayout, 80);
    });
  }

  function maintainProjectJobsLayout() {
    var page = findProjectDetailsPage();
    if (!page.ready) {
      removeOrphanedEnhancements();
      return;
    }

    page.details.addClass("wise-project-jobs-scroll");
    ensureSummaryStrip(page);
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

    $button.off(".wiseProjectJobsQol").on("click.wiseProjectJobsQol", function (event) {
      event.preventDefault();
      var collapsed = !readCompactState();
      writeCompactState(collapsed);
      applyCompactState(page, collapsed);
      applyScrollSizing(page);
    });

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
    page.details.toggleClass("wise-project-jobs-compact", collapsed);
    $("#" + CFG.summaryId).attr("aria-hidden", collapsed ? "false" : "true");
    updateCompactButton($("#" + CFG.buttonId), collapsed);
  }

  function applyScrollSizing(page) {
    if (!page.details.length) return;

    var el = page.details.get(0);
    var rect = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 700;
    var top = rect && isFinite(rect.top) ? Math.max(0, rect.top) : 0;
    var maxHeight = Math.max(CFG.minPanelHeight, Math.floor(viewportHeight - top - CFG.bottomPadding));

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

    $button
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
      "#details_tab.wise-project-jobs-compact #proj_info{display:none!important;}",
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
    refresh: maintainProjectJobsLayout,
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
