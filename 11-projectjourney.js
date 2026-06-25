(function () {
  "use strict";

  var $ = window.jQuery;
  if (!$) return;

  var LOG_PREFIX = "[Wise Project Journey]";
  var EXTERNAL_CONFIG = window.WiseProjectJourneyConfig && typeof window.WiseProjectJourneyConfig === "object"
    ? window.WiseProjectJourneyConfig
    : {};

  var STATUS_LABELS = ["Not Started", "In Progress", "Complete", "At Risk", "Blocked", "Missing"];
  var ISSUE_PRIORITY = {
    "Blocked": 1,
    "At Risk": 2,
    "Missing Data": 3,
    "Warning": 4
  };
  var DEPARTMENTS = [
    "Project Management",
    "Technical",
    "Production",
    "Suppliers"
  ];
  var FIELD_MAP = {
    projectSystem: {
      outgoingDateTime: {
        name: "Kit Booking Start",
        logicalName: "{{project.out_datetime}}",
        objectKeys: ["OUT_DATE", "out_date", "DATE_OUT", "date_out", "DATEOUT", "dateOut", "out_datetime", "OUT_DATETIME", "OUT_DATE_TIME", "out_date_time", "outDateTime", "OUTGOING_DATE_TIME", "outgoing_date_time", "outgoingDateTime", "OUTGOING", "outgoing"],
        dateKeys: ["OUT_DATE", "out_date", "DATE_OUT", "date_out", "DATEOUT"],
        timeKeys: ["TIME_OUT", "time_out", "TIMEOUT"],
        labels: ["kit booking start", "outgoing date time", "outgoing datetime", "outgoing time"],
        note: "No kit is assigned to a project; kept only as a system field."
      },
      startDateTime: {
        name: "Project/Onsite Start",
        logicalName: "{{project.start_datetime}}",
        upstream: "Event_Start_Date__c",
        objectKeys: ["START_DATE", "start_date", "DATE", "date", "DATETIME", "datetime", "start_datetime", "START_DATETIME", "START_DATE_TIME", "start_date_time", "startDateTime", "START", "start", "PROJECT_DATE", "PROJECT_START_DATE_TIME", "project_start_date_time"],
        dateKeys: ["START_DATE", "start_date", "DATE", "date", "PROJECT_DATE", "project_date"],
        timeKeys: ["TIME", "time", "START_TIME", "start_time", "PROJECT_TIME", "project_time"],
        labels: ["project/onsite start", "project onsite start", "start date time", "start datetime", "event start", "project start"],
        note: "First day where Wise has responsibility or action on the event site."
      },
      projectEndDateTime: {
        name: "Project/Onsite End",
        logicalName: "{{project.end_datetime}}",
        upstream: "Event_End_Date__c",
        objectKeys: ["END_DATE", "end_date", "DATE_END", "date_end", "DATEEND", "dateEnd", "end_datetime", "END_DATETIME", "PROJECT_END_DATE_TIME", "project_end_date_time", "projectEndDateTime", "END_DATE_TIME", "end_date_time", "endDateTime", "PROJECT_END", "project_end"],
        dateKeys: ["END_DATE", "end_date", "DATE_END", "date_end", "DATEEND"],
        timeKeys: ["TIME_END", "time_end", "TIMEEND", "END_TIME", "end_time"],
        labels: ["project/onsite end", "project onsite end", "project end date time", "project end datetime", "event end", "project end"],
        note: "Last day where Wise has responsibility or action on the event site."
      },
      returnDateTime: {
        name: "Kit Booking End",
        logicalName: "{{project.return_datetime}}",
        objectKeys: ["RETURN_DATE", "return_date", "DATE_RETURN", "date_return", "DATERETURN", "dateReturn", "return_datetime", "RETURN_DATETIME", "RETURN_DATE_TIME", "return_date_time", "returnDateTime", "RETURN", "return"],
        dateKeys: ["RETURN_DATE", "return_date", "DATE_RETURN", "date_return", "DATERETURN"],
        timeKeys: ["TIME_RETURN", "time_return", "TIMERETURN", "RETURN_TIME", "return_time"],
        labels: ["kit booking end", "return date time", "return datetime", "return time"],
        note: "No kit is assigned to a project; kept only as a system field."
      }
    },
    projectOperational: {
      installStart: {
        name: "Install start",
        logicalName: "{{project._Install}}",
        objectKeys: ["_Install", "~_Install", "INSTALL", "install", "install_start", "INSTALL_START"],
        labels: ["install start", "earliest install activity"]
      },
      showStart: {
        name: "Show start",
        logicalName: "{{project._ShowStart}}",
        objectKeys: ["_ShowStart", "~_ShowStart", "SHOW_START", "show_start", "showStart"],
        labels: ["show start", "event to begin", "guests to enter"]
      },
      showEnd: {
        name: "Show end",
        logicalName: "{{project._ShowEnd}}",
        objectKeys: ["_ShowEnd", "~_ShowEnd", "SHOW_END", "show_end", "showEnd"],
        labels: ["show end", "event to fully end", "guests to leave"]
      },
      derigStart: {
        name: "Derig start",
        logicalName: "{{project._Derig}}",
        objectKeys: ["_Derig", "~_Derig", "DERIG", "derig", "derig_start", "DERIG_START"],
        labels: ["derig start", "earliest derig activity"]
      }
    },
    jobSystem: {
      kitBookingStart: {
        name: "Kit Booking Start",
        logicalName: "{{job.out_datetime}}",
        aggregate: "earliest",
        objectKeys: ["out_datetime", "OUT_DATETIME", "OUT_DATE_TIME", "out_date_time", "OUT_DATE", "out_date", "outDateTime", "outDate", "KIT_BOOKING_START", "kit_booking_start"],
        labels: ["kit booking start", "first day of chargeable kit time"],
        dateKeys: ["OUT_DATE", "out_date", "KIT_BOOKING_START_DATE", "kit_booking_start_date"],
        timeKeys: ["OUT_TIME", "out_time", "KIT_BOOKING_START_TIME", "kit_booking_start_time"]
      },
      onsiteStart: {
        name: "Project/Onsite Start",
        logicalName: "{{job.start_datetime}}",
        aggregate: "earliest",
        objectKeys: ["start_datetime", "START_DATETIME", "START_DATE_TIME", "start_date_time", "JOB_DATE", "job_date", "startDateTime", "jobDate", "ONSITE_START"],
        labels: ["project/onsite start", "project onsite start", "job onsite start"],
        dateKeys: ["JOB_DATE", "job_date", "START_DATE", "start_date", "ONSITE_START_DATE"],
        timeKeys: ["JOB_TIME", "job_time", "START_TIME", "start_time", "ONSITE_START_TIME"]
      },
      onsiteEnd: {
        name: "Project/Onsite End",
        logicalName: "{{job.end_datetime}}",
        aggregate: "latest",
        objectKeys: ["end_datetime", "END_DATETIME", "END_DATE_TIME", "end_date_time", "JOB_END", "job_end", "endDateTime", "jobEnd", "ONSITE_END"],
        labels: ["project/onsite end", "project onsite end", "job onsite end", "clear of site"],
        dateKeys: ["JOB_END", "job_end", "END_DATE", "end_date", "ONSITE_END_DATE"],
        timeKeys: ["JOB_END_TIME", "job_end_time", "END_TIME", "end_time", "ONSITE_END_TIME"]
      },
      kitBookingEnd: {
        name: "Kit Booking End",
        logicalName: "{{job.return_datetime}}",
        aggregate: "latest",
        objectKeys: ["return_datetime", "RETURN_DATETIME", "RETURN_DATE_TIME", "return_date_time", "RETURN_DATE", "return_date", "returnDateTime", "returnDate", "KIT_BOOKING_END", "kit_booking_end"],
        labels: ["kit booking end", "last day of chargeable kit time"],
        dateKeys: ["RETURN_DATE", "return_date", "KIT_BOOKING_END_DATE", "kit_booking_end_date"],
        timeKeys: ["RETURN_TIME", "return_time", "KIT_BOOKING_END_TIME", "kit_booking_end_time"]
      }
    },
    jobOperational: {
      preProd: {
        name: "Pre-prod Sign off/meeting",
        logicalName: "{{job._PreProd}}",
        aggregate: "latest",
        targetDaysBeforeStart: 21,
        objectKeys: ["_PreProd", "~_PreProd", "PREPROD", "preprod", "pre_prod", "preProd"],
        labels: ["pre-prod sign off/meeting", "pre-prod sign off", "pre production sign off"]
      },
      supplier: {
        name: "Supplier engaged",
        logicalName: "{{job._Supplier}}",
        aggregate: "latest",
        targetDaysBeforeStart: 21,
        objectKeys: ["_Supplier", "~_Supplier", "SUPPLIER", "supplier", "supplier_engaged", "supplierEngaged"],
        labels: ["supplier engaged", "supplier visibility"]
      },
      wisePrep: {
        name: "Wise prep start",
        logicalName: "{{job._WisePrep}}",
        aggregate: "earliest",
        objectKeys: ["_WisePrep", "~_WisePrep", "WISE_PREP", "wise_prep", "wisePrep"],
        labels: ["wise prep start", "first wise required prep activity"]
      },
      load: {
        name: "Vehicle Load",
        logicalName: "{{job._Load}}",
        aggregate: "earliest",
        objectKeys: ["_Load", "~_Load", "LOAD", "load", "vehicle_load", "vehicleLoad"],
        labels: ["vehicle load", "planned load"]
      },
      vehicleInstall: {
        name: "Vehicle Onsite - Install",
        logicalName: "{{job._VehicleInstall}}",
        aggregate: "earliest",
        objectKeys: ["_VehicleInstall", "~_VehicleInstall", "VEHICLE_INSTALL", "vehicle_install", "vehicleInstall"],
        labels: ["vehicle onsite - install", "vehicle install"]
      },
      vehicleDerig: {
        name: "Vehicle Onsite - Derig",
        logicalName: "{{job._VehicleDerig}}",
        aggregate: "latest",
        objectKeys: ["_VehicleDerig", "~_VehicleDerig", "VEHICLE_DERIG", "vehicle_derig", "vehicleDerig"],
        labels: ["vehicle onsite - derig", "vehicle derig"]
      },
      vehicleTip: {
        name: "Vehicle Tip",
        logicalName: "{{job._Tip}}",
        aggregate: "latest",
        objectKeys: ["_Tip", "~_Tip", "TIP", "tip", "vehicle_tip", "vehicleTip"],
        labels: ["vehicle tip"]
      }
    }
  };

  var CFG = {
    version: "2026-06-25.6",
    buttonId: "wise-project-journey-tab",
    panelId: "wise-project-journey-panel",
    stylesId: "wise-project-journey-styles",
    defaultButtonLabel: asText(EXTERNAL_CONFIG.buttonLabel) || "Journey",
    defaultButtonTitle: asText(EXTERNAL_CONFIG.buttonTitle) || "Open project journey",
    maintainRecoveryMs: asNumber(EXTERNAL_CONFIG.maintainRecoveryMs, 5000),
    minPanelHeight: asNumber(EXTERNAL_CONFIG.minPanelHeight, 360),
    bottomPadding: asNumber(EXTERNAL_CONFIG.bottomPadding, 12),
    mockWhenEmpty: EXTERNAL_CONFIG.mockWhenEmpty !== false
  };

  var state = {
    maintainTimer: null,
    maintainScheduled: null,
    pendingMaintainOptions: null,
    lastHost: null,
    showCriticalOnly: false,
    overrideData: null,
    lastAnalysis: null,
    lastPanelMaxHeight: "",
    cachedJobRows: null,
    cachedProjectData: null
  };

  bootstrap();

  function bootstrap() {
    installStyles();
    scheduleMaintainProjectJourney(0, { forceScan: true });

    state.maintainTimer = setInterval(function () {
      scheduleMaintainProjectJourney(0, {});
    }, CFG.maintainRecoveryMs);

    $(window).on("load.wiseProjectJourney focus.wiseProjectJourney resize.wiseProjectJourney hashchange.wiseProjectJourney", function () {
      scheduleMaintainProjectJourney(60, { forceScan: true });
      applyJourneyPanelSizing($("#" + CFG.panelId));
    });
    $(document).on("ajaxComplete.wiseProjectJourney", function (event, xhr) {
      tryCacheProjectFromResponse(xhr);
      tryCacheJobsFromResponse(xhr);
      scheduleMaintainProjectJourney(80, { forceScan: true });
    });
  }

  function scheduleMaintainProjectJourney(delay, options) {
    state.pendingMaintainOptions = mergeMaintainOptions(state.pendingMaintainOptions, options);
    if (state.maintainScheduled) clearTimeout(state.maintainScheduled);

    state.maintainScheduled = setTimeout(function () {
      var pending = state.pendingMaintainOptions || {};
      state.pendingMaintainOptions = null;
      state.maintainScheduled = null;
      maintainProjectJourney(pending);
    }, Math.max(0, Number(delay) || 0));
  }

  function mergeMaintainOptions(current, next) {
    current = current || {};
    next = next || {};
    return {
      forceScan: !!(current.forceScan || next.forceScan)
    };
  }

  function maintainProjectJourney() {
    var $host = findProjectTabsHost();
    if (!$host.length) {
      state.lastHost = null;
      state.lastPanelMaxHeight = "";
      removeJourneyTab();
      return;
    }

    state.lastHost = $host.get(0);
    installJourneyTab($host);
    bindNativeTabReset($host);
  }

  function findProjectTabsHost() {
    var hosts = $("#tabs > ul, .hh-framework_tabs > ul, .ui-tabs > ul.ui-tabs-nav, ul.ui-tabs-nav");

    for (var i = 0; i < hosts.length; i++) {
      var $host = hosts.eq(i);
      if (isProjectTabsHost($host)) return $host;
    }

    return $();
  }

  function isProjectTabsHost($host) {
    if (!$host.length || $host.closest("#items_tab").length) return false;
    var labels = getTabLabels($host);
    if (!labels["project details"]) return false;

    var supporting = 0;
    var expected = ["tasks", "notes", "files", "schedule", "emails"];
    for (var i = 0; i < expected.length; i++) {
      if (labels[expected[i]]) supporting++;
    }

    return supporting >= 2;
  }

  function installJourneyTab($host) {
    ensureJourneyPanel($host);

    var $sampleTab = findTabTemplate($host);
    var $button = $("#" + CFG.buttonId);

    if ($button.length && !$button.parent().is($host)) {
      $button.detach();
    }

    if (!$button.length) {
      $button = buildJourneyTab($sampleTab);
    }

    applyTabTemplate($button, $sampleTab);
    bindJourneyButton($button);
    placeJourneyTab($host, $button);
    ensureNativeTabsRegistration($host, $("#" + CFG.panelId));
  }

  function buildJourneyTab($sampleTab) {
    var $button = $sampleTab && $sampleTab.length ? $sampleTab.clone(false, false) : $();

    if (!$button.length) {
      $button = $('<li role="tab"><a></a></li>');
    }

    $button
      .attr("id", CFG.buttonId)
      .attr("data-wise-project-journey-tab", "1")
      .removeClass("ui-tabs-active ui-state-active ui-state-focus ui-state-hover ui-tabs-loading")
      .attr("aria-selected", "false")
      .attr("aria-expanded", "false")
      .removeAttr("aria-controls aria-labelledby");

    var $anchor = $button.children("a").first();
    if (!$anchor.length) {
      $anchor = $("<a></a>").appendTo($button);
    }

    $button.children().not($anchor).remove();
    $anchor
      .attr("href", "#" + CFG.panelId)
      .attr("title", CFG.defaultButtonTitle)
      .attr("aria-controls", CFG.panelId)
      .removeAttr("id aria-selected aria-expanded")
      .empty()
      .text(CFG.defaultButtonLabel);

    return $button;
  }

  function applyTabTemplate($button, $sampleTab) {
    if (!$button || !$button.length) return;

    var templateSignature = getTemplateSignature($sampleTab);
    var templateChanged = $button.attr("data-wise-project-journey-template") !== templateSignature;

    if ($sampleTab && $sampleTab.length && templateChanged) {
      $button.attr("class", normaliseTabClass($sampleTab.attr("class") || $button.attr("class") || ""));
      $button.attr("role", $sampleTab.attr("role") || "tab");
      copyComputedStyle($sampleTab.get(0), $button.get(0), [
        "display",
        "float",
        "position",
        "boxSizing",
        "height",
        "minHeight",
        "marginTop",
        "marginRight",
        "marginBottom",
        "marginLeft",
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft",
        "borderTopWidth",
        "borderRightWidth",
        "borderBottomWidth",
        "borderLeftWidth",
        "borderTopStyle",
        "borderRightStyle",
        "borderBottomStyle",
        "borderLeftColor",
        "borderRightColor",
        "borderTopColor",
        "borderBottomColor",
        "backgroundColor"
      ]);
    } else if (!$sampleTab || !$sampleTab.length) {
      $button.attr("class", normaliseTabClass($button.attr("class") || ""));
    }

    $button
      .attr("data-wise-project-journey-template", templateSignature)
      .attr("data-wise-project-journey-tab", "1")
      .removeClass("ui-tabs-active ui-state-active ui-state-focus ui-state-hover ui-tabs-loading")
      .attr("aria-selected", "false")
      .attr("aria-expanded", "false")
      .css("display", "");

    var $anchor = $button.children("a").first();
    var $sampleAnchor = $sampleTab && $sampleTab.length ? $sampleTab.children("a").first() : $();
    if ($anchor.length && $sampleAnchor.length && templateChanged) {
      $anchor.attr("class", $sampleAnchor.attr("class") || "");
      copyComputedStyle($sampleAnchor.get(0), $anchor.get(0), [
        "display",
        "boxSizing",
        "height",
        "minHeight",
        "lineHeight",
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft",
        "fontFamily",
        "fontSize",
        "fontWeight",
        "color",
        "textDecoration"
      ]);
    }

    $anchor
      .attr("href", "#" + CFG.panelId)
      .attr("title", CFG.defaultButtonTitle)
      .attr("aria-controls", CFG.panelId)
      .removeAttr("id aria-selected aria-expanded")
      .empty()
      .text(CFG.defaultButtonLabel);
  }

  function bindJourneyButton($button) {
    if (!$button || !$button.length) return;
    if ($button.attr("data-wise-project-journey-bound") === "1") return;

    $button.off(".wiseProjectJourney");
    $button.children("a").off(".wiseProjectJourney");
    $button.attr("data-wise-project-journey-bound", "1");

    $button.add($button.children("a")).on("click.wiseProjectJourney", function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      var $host = $button.parent();
      activateJourneyPanel($host);
      return false;
    });
  }

  function placeJourneyTab($host, $button) {
    if (!$host.length || !$button.length) return;

    var $after = findFirstTabByLabels($host, ["project details"]);
    if ($after.length && !$button.prev().is($after)) {
      $button.insertAfter($after);
      return;
    }

    var $before = findFirstTabByLabels($host, ["tasks", "notes", "files"]);
    if ($before.length && !$button.next().is($before)) {
      $button.insertBefore($before);
      return;
    }

    if (!$button.parent().is($host)) {
      $host.append($button);
    }
  }

  function removeJourneyTab() {
    $('[data-wise-project-journey-tab="1"]').remove();
    $("#" + CFG.panelId).remove();
    $(".wise-journey-active").removeClass("wise-journey-active");
  }

  function activateJourneyPanel($host) {
    if (!$host || !$host.length) return;

    ensureJourneyPanel($host);
    renderJourneyPanel();
    showJourneyPanel($host);
  }

  function ensureJourneyPanel($host) {
    var $container = getTabsContainer($host);
    var $panel = $("#" + CFG.panelId);
    var created = false;
    var moved = false;

    if (!$panel.length) {
      created = true;
      $panel = $("<div></div>")
        .attr("id", CFG.panelId)
        .attr("role", "tabpanel")
        .attr("aria-labelledby", CFG.buttonId)
        .attr("data-wise-project-journey-panel", "1")
        .addClass(getPanelClass($host));
      $panel.hide().attr("aria-hidden", "true");
    }

    if ($container.length && !$panel.parent().is($container)) {
      $panel.detach().appendTo($container);
      moved = true;
    }

    if (created || moved || !$panel.is(":visible")) {
      resetPanelLayout($panel);
    }

    if (created || !$panel.children().length) {
      renderJourneyPanel();
    } else {
      bindJourneyPanelEvents();
    }

    ensureNativeTabsRegistration($host, $panel);
    if ($panel.is(":visible")) applyJourneyPanelSizing($panel);
    return $panel;
  }

  function renderJourneyPanel() {
    var $panel = $("#" + CFG.panelId);
    if (!$panel.length) return;

    var data = getJourneyData();
    var analysis = analyseJourney(data);
    state.lastAnalysis = analysis;

    $panel.html(buildJourneyHtml(data, analysis));
    bindJourneyPanelEvents();
    applyJourneyPanelSizing($panel);
  }

  function showJourneyPanel($host) {
    var $container = getTabsContainer($host);
    var $panel = $("#" + CFG.panelId);
    if (!$panel.length) return;

    if (activateNativeTabPanel($host, $("#" + CFG.buttonId), $panel)) {
      $container.removeClass("wise-checklist-active wise-journey-active");
      $('[data-wise-checklist-panel="1"]').not($panel).hide().attr("aria-hidden", "true");
      $('[data-wise-job-checklist="1"]')
        .removeClass("is-wise-checklist-active")
        .attr("aria-selected", "false")
        .attr("aria-expanded", "false");
      $panel
        .show()
        .attr("aria-hidden", "false")
        .removeAttr("hidden");
      applyJourneyPanelSizing($panel);
      setJourneyTabVisualState($host);
      return;
    }

    $container.removeClass("wise-checklist-active").addClass("wise-journey-active");
    $('[data-wise-checklist-panel="1"]').hide().attr("aria-hidden", "true");
    $('[data-wise-job-checklist="1"]')
      .removeClass("is-wise-checklist-active")
      .attr("aria-selected", "false")
      .attr("aria-expanded", "false");

    $container.children(".ui-tabs-panel,[role='tabpanel']").not($panel).hide().attr("aria-hidden", "true");
    $panel
      .removeClass("ui-tabs-hide ui-helper-hidden ui-helper-hidden-accessible")
      .show()
      .attr("aria-hidden", "false")
      .removeAttr("hidden");

    applyJourneyPanelSizing($panel);
    setJourneyTabVisualState($host);
  }

  function hideJourneyPanel() {
    $(".wise-journey-active").removeClass("wise-journey-active");
    $("#" + CFG.panelId).hide().attr("aria-hidden", "true");
    $('[data-wise-project-journey-tab="1"]')
      .removeClass("is-wise-journey-active")
      .attr("aria-selected", "false")
      .attr("aria-expanded", "false");
  }

  function ensureNativeTabsRegistration($host, $panel) {
    var $container = getTabsContainer($host);
    if (!$container.length || typeof $container.tabs !== "function") return false;
    if (!$container.hasClass("ui-tabs") && !$container.data("ui-tabs") && !$container.data("tabs")) return false;

    if ($panel && $panel.length) {
      $panel.addClass("ui-tabs-panel ui-widget-content ui-corner-bottom");
    }

    try {
      $container.tabs("refresh");
      return true;
    } catch (err) {
      return false;
    }
  }

  function activateNativeTabPanel($host, $button, $panel) {
    var $container = getTabsContainer($host);
    if (!$container.length || !$button.length || !$panel.length) return false;
    if (!ensureNativeTabsRegistration($host, $panel)) return false;

    var index = $host.children("li,[role='tab']").index($button);
    if (index < 0) return false;

    try {
      $container.tabs("option", "active", index);
    } catch (err) {
      try {
        $container.tabs("select", index);
      } catch (err2) {
        return false;
      }
    }

    return $panel.is(":visible") ||
      $button.hasClass("ui-tabs-active") ||
      $button.hasClass("ui-state-active") ||
      $button.attr("aria-selected") === "true";
  }

  function applyJourneyPanelSizing($panel) {
    if (!$panel || !$panel.length) return;

    var el = $panel.get(0);
    var rect = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 700;
    var top = rect && isFinite(rect.top) ? Math.max(0, rect.top) : 0;
    var maxHeight = Math.max(CFG.minPanelHeight, Math.floor(viewportHeight - top - CFG.bottomPadding));
    var heightKey = String(maxHeight);

    if (state.lastPanelMaxHeight === heightKey && $panel.css("overflow-y") === "auto") return;
    state.lastPanelMaxHeight = heightKey;

    $panel.css({
      maxHeight: maxHeight + "px",
      overflowY: "auto",
      overflowX: "hidden"
    });
  }

  function setJourneyTabVisualState($host) {
    $host.children("li,[role='tab']").each(function () {
      var $tab = $(this);
      var active = $tab.is('[data-wise-project-journey-tab="1"]');
      $tab.toggleClass("is-wise-journey-active", active);
      if (active) {
        $tab
          .addClass("ui-tabs-active ui-state-active")
          .attr("aria-selected", "true")
          .attr("aria-expanded", "true");
      } else if (!$tab.is('[data-wise-job-checklist="1"]')) {
        $tab
          .removeClass("ui-tabs-active ui-state-active")
          .attr("aria-selected", "false")
          .attr("aria-expanded", "false");
      }
    });
  }

  function bindNativeTabReset($host) {
    var $otherTabs = $host.children("li,[role='tab']").not('[data-wise-project-journey-tab="1"]');
    $otherTabs.add($otherTabs.children("a")).off(".wiseJourneyNativeReset").on("mousedown.wiseJourneyNativeReset click.wiseJourneyNativeReset", function () {
      hideJourneyPanel();
    });
  }

  function bindJourneyPanelEvents() {
    var $panel = $("#" + CFG.panelId);
    if (!$panel.length) return;

    $panel.find("[data-wise-project-journey-toggle]").off(".wiseProjectJourney").on("click.wiseProjectJourney", function (event) {
      event.preventDefault();
      state.showCriticalOnly = $(this).attr("data-wise-project-journey-toggle") === "critical";
      renderJourneyPanel();
      if (state.lastHost) showJourneyPanel($(state.lastHost));
    });

    $panel.find("[data-wise-project-journey-refresh]").off(".wiseProjectJourney").on("click.wiseProjectJourney", function (event) {
      event.preventDefault();
      renderJourneyPanel();
    });
  }

  function getJourneyData() {
    if (state.overrideData) return normaliseJourneyData(state.overrideData, false);

    var configured = getConfiguredJourneyData();
    if (configured) return normaliseJourneyData(configured, !!configured.isMock);

    var extracted = buildJourneyDataFromHireHop();
    if (hasMeaningfulProjectData(extracted) || CFG.mockWhenEmpty === false) {
      return normaliseJourneyData(extracted, false);
    }

    return normaliseJourneyData(getMockJourneyData(), true);
  }

  function getConfiguredJourneyData() {
    if (EXTERNAL_CONFIG.getData && typeof EXTERNAL_CONFIG.getData === "function") {
      try {
        var data = EXTERNAL_CONFIG.getData({
          projectId: getCurrentProjectId(),
          projectInfo: $("#proj_info").get(0) || null,
          tabsHost: state.lastHost || null
        });
        if (data && typeof data === "object") return data;
      } catch (err) {
        log("Configured data mapper failed", err);
      }
    }

    if (EXTERNAL_CONFIG.data && typeof EXTERNAL_CONFIG.data === "object") return EXTERNAL_CONFIG.data;
    if (window.WiseProjectJourneyData && typeof window.WiseProjectJourneyData === "object") return window.WiseProjectJourneyData;
    return null;
  }

  function buildJourneyDataFromHireHop() {
    /*
     * Mapping hook:
     * When the real HireHop project/job API fields are agreed, prefer setting
     * window.WiseProjectJourneyConfig.getData = function(context) { ... }.
     * This fallback only reads obvious current-page/window values so the tab can
     * render safely before the live data contract is connected.
     */
    var projectWindow = (window.proj_data && typeof window.proj_data === "object" && !isFileRecord(window.proj_data))
      ? window.proj_data
      : (window.project && typeof window.project === "object" && !isFileRecord(window.project))
        ? window.project
        : (state.cachedProjectData || {});
    var project = {
      id: getCurrentProjectId(),
      name: firstNonEmpty([
        firstObjectValue(projectWindow, ["NAME", "name", "PROJECT_NAME", "project_name", "TITLE", "title"]),
        readProjectInfoField(["project name", "event name", "name", "title"]),
        cleanDocumentTitle()
      ]),
      clientName: firstNonEmpty([
        firstObjectValue(projectWindow, ["CLIENT_NAME", "client_name", "COMPANY_NAME", "company_name"]),
        readProjectCustomField(projectWindow, ["Client", "client", "Customer", "customer", "Account", "account", "Company", "company"]),
        readProjectInfoField(["client", "customer", "account"])
      ]),
      venue: firstNonEmpty([
        firstObjectValue(projectWindow, ["VENUE", "venue", "VENUE_NAME", "venue_name"]),
        readProjectCustomField(projectWindow, ["Venue", "venue", "Location", "location", "Site", "site"]),
        firstObjectValue(projectWindow, ["DELIVER_TO", "deliver_to", "LOCATION", "location", "SITE", "site"]),
        readProjectInfoField(["venue", "location", "site"])
      ])
    };

    var systemDates = getProjectSystemDates(projectWindow);
    var projectOperationalDates = getProjectOperationalDates(projectWindow);
    var jobDates = getProjectJobDates();
    var wiseEventStart = firstNonEmpty([
      systemDates.startDateTime,
      firstObjectValue(projectWindow, ["WISE_EVENT_START", "wise_event_start", "wiseEventStart", "SALESFORCE_START", "salesforce_start", "EVENT_START", "event_start", "PROJECT_START", "project_start"])
    ]);
    var wiseEventEnd = firstNonEmpty([
      systemDates.projectEndDateTime,
      firstObjectValue(projectWindow, ["WISE_EVENT_END", "wise_event_end", "wiseEventEnd", "SALESFORCE_END", "salesforce_end", "EVENT_END", "event_end", "PROJECT_END", "project_end"])
    ]);

    // If the DOM only yielded a time (e.g. "09:00") without a date, combine it with
    // the date part from the corresponding job system date so the wrapper is usable.
    if (wiseEventStart && !parseDate(wiseEventStart)) {
      var startTime = extractTimePart(wiseEventStart);
      if (startTime && jobDates.onsiteStart) {
        var startDatePart = extractDatePart(jobDates.onsiteStart);
        if (startDatePart) wiseEventStart = startDatePart + " " + startTime;
      }
    }
    if (wiseEventEnd && !parseDate(wiseEventEnd)) {
      var endTime = extractTimePart(wiseEventEnd);
      if (endTime && jobDates.onsiteEnd) {
        var endDatePart = extractDatePart(jobDates.onsiteEnd);
        if (endDatePart) wiseEventEnd = endDatePart + " " + endTime;
      }
    }

    return {
      project: project,
      wiseEventStart: wiseEventStart,
      wiseEventEnd: wiseEventEnd,
      projectSystemDates: systemDates,
      projectOperationalDates: projectOperationalDates,
      jobDates: jobDates,
      hireHopFixedDates: buildDefaultFixedDates(wiseEventStart, wiseEventEnd, systemDates),
      jobKitBookingStart: jobDates.kitBookingStart,
      jobKitBookingEnd: jobDates.kitBookingEnd,
      milestones: buildDefaultMilestones(wiseEventStart, wiseEventEnd, systemDates, projectOperationalDates, jobDates),
      isMock: false
    };
  }

  function getProjectSystemDates(projectWindow) {
    projectWindow = projectWindow && typeof projectWindow === "object" ? projectWindow : {};

    return {
      outgoingDateTime: readMappedProjectDateTime(projectWindow, FIELD_MAP.projectSystem.outgoingDateTime),
      startDateTime: readMappedProjectDateTime(projectWindow, FIELD_MAP.projectSystem.startDateTime),
      projectEndDateTime: readMappedProjectDateTime(projectWindow, FIELD_MAP.projectSystem.projectEndDateTime),
      returnDateTime: readMappedProjectDateTime(projectWindow, FIELD_MAP.projectSystem.returnDateTime)
    };
  }

  function getProjectOperationalDates(projectWindow) {
    projectWindow = projectWindow && typeof projectWindow === "object" ? projectWindow : {};

    return {
      installStart: readMappedProjectDateTime(projectWindow, FIELD_MAP.projectOperational.installStart),
      showStart: readMappedProjectDateTime(projectWindow, FIELD_MAP.projectOperational.showStart),
      showEnd: readMappedProjectDateTime(projectWindow, FIELD_MAP.projectOperational.showEnd),
      derigStart: readMappedProjectDateTime(projectWindow, FIELD_MAP.projectOperational.derigStart)
    };
  }

  function getProjectJobDates() {
    var allRows = getProjectJobRows();
    // Filter to active jobs only (exclude cancelled/archived)
    var rows = [];
    for (var fi = 0; fi < allRows.length; fi++) {
      if (isActiveJob(allRows[fi])) rows.push(allRows[fi]);
    }
    var out = {
      sourceCount: rows.length,
      kitBookingStart: aggregateMappedJobDateTime(rows, FIELD_MAP.jobSystem.kitBookingStart),
      onsiteStart: aggregateMappedJobDateTime(rows, FIELD_MAP.jobSystem.onsiteStart),
      onsiteEnd: aggregateMappedJobDateTime(rows, FIELD_MAP.jobSystem.onsiteEnd),
      kitBookingEnd: aggregateMappedJobDateTime(rows, FIELD_MAP.jobSystem.kitBookingEnd),
      preProd: aggregateMappedJobDateTime(rows, FIELD_MAP.jobOperational.preProd),
      supplier: aggregateMappedJobDateTime(rows, FIELD_MAP.jobOperational.supplier),
      wisePrep: aggregateMappedJobDateTime(rows, FIELD_MAP.jobOperational.wisePrep),
      load: aggregateMappedJobDateTime(rows, FIELD_MAP.jobOperational.load),
      vehicleInstall: aggregateMappedJobDateTime(rows, FIELD_MAP.jobOperational.vehicleInstall),
      vehicleDerig: aggregateMappedJobDateTime(rows, FIELD_MAP.jobOperational.vehicleDerig),
      vehicleTip: aggregateMappedJobDateTime(rows, FIELD_MAP.jobOperational.vehicleTip)
    };

    out.hasDates = !!(out.kitBookingStart || out.onsiteStart || out.onsiteEnd || out.kitBookingEnd ||
      out.preProd || out.supplier || out.wisePrep || out.load || out.vehicleInstall || out.vehicleDerig || out.vehicleTip);
    return out;
  }

  function readMappedProjectDateTime(projectWindow, map) {
    return firstNonEmpty([
      readMappedDateTimeFromObject(projectWindow, map),
      readProjectInfoDateTimeField((map && map.labels) || [])
    ]);
  }

  function aggregateMappedJobDateTime(rows, map) {
    var values = [];
    for (var i = 0; i < rows.length; i++) {
      var value = readMappedDateTimeFromObject(rows[i], map);
      if (value) values.push(value);
    }
    return pickDateTimeValue(values, map && map.aggregate === "latest" ? "latest" : "earliest");
  }

  function readMappedDateTimeFromObject(object, map) {
    if (!object || typeof object !== "object" || !map) return "";

    var direct = readMappedObjectValue(object, (map.objectKeys || []).concat(map.labels || []));
    if (direct && dateValueHasDateAndTime(direct)) return direct;

    var dateValue = readMappedObjectValue(object, map.dateKeys || []);
    var timeValue = readMappedObjectValue(object, map.timeKeys || []);
    var combined = combineDateTimeValues([direct, dateValue, timeValue]);
    return combined || direct || "";
  }

  function readMappedObjectValue(object, keys) {
    var aliases = buildFieldAliases(keys || []);
    var value = firstObjectValue(object, aliases);
    if (value !== "") return asText(value).trim();

    value = readCustomFieldContainers(object, aliases);
    if (value !== "") return asText(value).trim();

    var aliasLookup = {};
    for (var i = 0; i < aliases.length; i++) {
      aliasLookup[normaliseFieldKey(aliases[i])] = true;
    }

    for (var key in object) {
      if (!Object.prototype.hasOwnProperty.call(object, key)) continue;
      if (!aliasLookup[normaliseFieldKey(key)]) continue;
      if (object[key] != null && object[key] !== "") return asText(object[key]).trim();
    }

    return "";
  }

  function readProjectCustomField(projectWindow, keys) {
    if (!projectWindow || typeof projectWindow !== "object") return "";
    var cf = projectWindow.CUSTOM_FIELDS || projectWindow.custom_fields || projectWindow.fields || {};
    if (!cf || typeof cf !== "object") return "";
    for (var i = 0; i < keys.length; i++) {
      var nk = normaliseFieldKey(keys[i]);
      for (var k in cf) {
        if (!Object.prototype.hasOwnProperty.call(cf, k)) continue;
        if (normaliseFieldKey(k) !== nk) continue;
        var entry = cf[k];
        var val = (entry && typeof entry === "object") ? asText(entry.value).trim() : asText(entry).trim();
        if (val && val !== "0") return val;
      }
    }
    return "";
  }

  function readCustomFieldContainers(object, aliases) {
    var containers = [
      object.CUSTOM_FIELDS,
      object.custom_fields,
      object.CUSTOMFIELDS,
      object.customFields,
      object.PROJECT_CUSTOM_FIELDS,
      object.project_custom_fields,
      object.JOB_CUSTOM_FIELDS,
      object.job_custom_fields
    ];

    for (var i = 0; i < containers.length; i++) {
      var value = readCustomFieldContainer(containers[i], aliases);
      if (value !== "") return value;
    }

    return "";
  }

  function readCustomFieldContainer(container, aliases) {
    container = parsePossibleJson(container);
    if (!container) return "";

    if ($.isArray(container)) {
      for (var i = 0; i < container.length; i++) {
        var item = container[i];
        if (!item || typeof item !== "object") continue;
        var key = firstNonEmpty([
          item.key,
          item.name,
          item.label,
          item.field,
          item.fieldName,
          item.logicalName,
          item.logical_name
        ]);
        if (!fieldNameMatches(key, aliases)) continue;
        return firstNonEmpty([item.value, item.dateTime, item.datetime, item.date, item.text]);
      }
      return "";
    }

    if (typeof container === "object") {
      // HireHop CUSTOM_FIELDS: keyed object where values may be {type, value, format} objects
      // or plain strings. Build a normalised alias lookup to match keys like "~Load", "Tip" etc.
      var aliasSet = {};
      for (var a = 0; a < aliases.length; a++) {
        aliasSet[normaliseFieldKey(aliases[a])] = true;
      }
      for (var k in container) {
        if (!Object.prototype.hasOwnProperty.call(container, k)) continue;
        if (!aliasSet[normaliseFieldKey(k)]) continue;
        var val = container[k];
        if (val && typeof val === "object") {
          var extracted = firstNonEmpty([val.value, val.dateTime, val.datetime, val.date, val.text]);
          if (extracted) return asText(extracted).trim();
        }
        if (val != null && val !== "" && typeof val !== "object") {
          return asText(val).trim();
        }
      }
      return "";
    }

    return "";
  }

  function parsePossibleJson(value) {
    if (!value || typeof value !== "string") return value;
    var text = value.trim();
    if (!text || (text.charAt(0) !== "{" && text.charAt(0) !== "[")) return value;
    try {
      return JSON.parse(text);
    } catch (err) {
      return value;
    }
  }

  function fieldNameMatches(value, aliases) {
    var key = normaliseFieldKey(value);
    if (!key) return false;
    for (var i = 0; i < aliases.length; i++) {
      if (key === normaliseFieldKey(aliases[i])) return true;
    }
    return false;
  }

  function buildFieldAliases(keys) {
    var out = [];
    for (var i = 0; i < keys.length; i++) {
      addFieldAlias(out, keys[i]);
      addFieldAlias(out, "~" + keys[i]);
      addFieldAlias(out, asText(keys[i]).replace(/^~?_+/, ""));
    }
    return out;
  }

  function addFieldAlias(out, value) {
    value = asText(value).trim();
    if (value && out.indexOf(value) === -1) out.push(value);
  }

  function isFileRecord(r) {
    if (!r || typeof r !== "object") return false;
    return !!(r.EXTENSION || r.extension || r.LOCATION_DATA || r.location_data ||
              (r.SIZE !== undefined && r.NAME && !r.JOB_DATE && !r.OUT_DATE));
  }

  function isJobRow(r) {
    if (!r || typeof r !== "object") return false;
    if (isFileRecord(r)) return false;
    // Require at least one HireHop job date field
    if (r.JOB_DATE || r.OUT_DATE || r.RETURN_DATE || r.JOB_END || r.JOB_TIME) return true;
    // OR a non-empty CUSTOM_FIELDS object (not empty array)
    if (r.CUSTOM_FIELDS && typeof r.CUSTOM_FIELDS === "object" &&
        !$.isArray(r.CUSTOM_FIELDS) && Object.keys(r.CUSTOM_FIELDS).length > 0) return true;
    // OR any tilde-prefixed custom job field
    for (var k in r) {
      if (Object.prototype.hasOwnProperty.call(r, k) && k.charAt(0) === "~") return true;
    }
    return false;
  }

  function extractJobId(row) {
    if (!row || typeof row !== "object") return "";
    var raw = firstObjectValue(row, ["ID", "id", "JOB_ID", "job_id"]);
    return asText(raw).replace(/<[^>]+>/g, "").replace(/\D/g, "").trim();
  }

  function isActiveJob(row) {
    if (!row || typeof row !== "object") return true;
    var statusText = asText(firstObjectValue(row, ["STATUS", "status"])).toLowerCase();
    // Exclude clearly inactive statuses by text
    if (statusText && (statusText.indexOf("cancel") !== -1 || statusText.indexOf("archived") !== -1)) return false;
    // Exclude by numeric status if available as a pure number
    var statusNum = row.STATUS;
    if (typeof statusNum === "number" || (typeof statusNum === "string" && /^\d+$/.test(statusNum))) {
      var n = Number(statusNum);
      // HireHop: status 7+ often means cancelled/archived — but we only know 5=confirmed-return, so be conservative
      if (n === 99) return false; // placeholder for known bad codes
    }
    return true;
  }

  function mergeJobRow(existing, incoming) {
    var merged = {};
    for (var k in existing) {
      if (Object.prototype.hasOwnProperty.call(existing, k)) merged[k] = existing[k];
    }
    for (var k2 in incoming) {
      if (!Object.prototype.hasOwnProperty.call(incoming, k2)) continue;
      var v = incoming[k2];
      if (v == null || v === "") continue;
      if ($.isArray(v) && !v.length) continue;
      merged[k2] = v;
    }
    // Always take CUSTOM_FIELDS from whichever side has more entries
    var eCF = existing.CUSTOM_FIELDS;
    var iCF = incoming.CUSTOM_FIELDS;
    if (eCF && iCF && typeof eCF === "object" && typeof iCF === "object" &&
        !$.isArray(eCF) && !$.isArray(iCF)) {
      var mergedCF = {};
      for (var ck in eCF) { if (Object.prototype.hasOwnProperty.call(eCF, ck)) mergedCF[ck] = eCF[ck]; }
      for (var ck2 in iCF) { if (Object.prototype.hasOwnProperty.call(iCF, ck2)) mergedCF[ck2] = iCF[ck2]; }
      merged.CUSTOM_FIELDS = mergedCF;
      merged.fields = mergedCF;
    }
    return merged;
  }

  function tryCacheJobsFromResponse(xhr) {
    if (!xhr || !xhr.responseText || xhr.responseText.length > 2000000) return;
    var data;
    try { data = JSON.parse(xhr.responseText); } catch (e) { return; }
    if (!data) return;

    var rows = [];
    appendObjectRows(rows, data);
    if (!rows.length) return;

    var jobRows = [];
    for (var i = 0; i < rows.length; i++) {
      if (isJobRow(rows[i])) jobRows.push(rows[i]);
    }
    if (!jobRows.length) return;

    if (!state.cachedJobRows) {
      state.cachedJobRows = jobRows;
      return;
    }

    // Upsert: merge incoming rows into the cache by job ID
    // Richer API data (with CUSTOM_FIELDS) wins over bare DOM-scraped rows
    for (var j = 0; j < jobRows.length; j++) {
      var incoming = jobRows[j];
      var inId = extractJobId(incoming);
      var found = false;
      if (inId) {
        for (var k = 0; k < state.cachedJobRows.length; k++) {
          if (extractJobId(state.cachedJobRows[k]) === inId) {
            state.cachedJobRows[k] = mergeJobRow(state.cachedJobRows[k], incoming);
            found = true;
            break;
          }
        }
      }
      if (!found) state.cachedJobRows.push(incoming);
    }
  }

  function tryCacheProjectFromResponse(xhr) {
    if (!xhr || !xhr.responseText || xhr.responseText.length > 500000) return;
    var data;
    try { data = JSON.parse(xhr.responseText); } catch (e) { return; }
    if (!data || typeof data !== "object" || $.isArray(data)) return;
    if (isFileRecord(data)) return;

    // Looks like a project if it has a name-like field AND a date field (HireHop uses DATE/DATE_END)
    var hasName = !!(data.NAME || data.name || data.TITLE || data.title);
    var hasDate = !!(data.DATE || data.date || data.DATE_END || data.date_end ||
                     data.START_DATETIME || data.start_datetime || data.DATETIME || data.datetime);
    var hasId = !!(data.ID || data.id || data.MAIN_ID || data.main_id);

    if (hasName && hasDate && hasId) {
      state.cachedProjectData = data;
    }
  }

  function getProjectJobRows() {
    var rows = [];
    appendObjectRows(rows, window.WiseProjectJourneyJobs);
    appendObjectRows(rows, state.cachedJobRows);
    appendObjectRows(rows, window.projectJobs);
    appendObjectRows(rows, window.project_jobs);
    appendObjectRows(rows, window.jobs);
    appendObjectRows(rows, window.JOBS);
    appendObjectRows(rows, window.project && window.project.jobs);
    appendObjectRows(rows, window.project && window.project.JOBS);
    appendJqGridRows(rows);
    appendDomGridRows(rows);

    // Merge by extracted job ID so DOM-scraped and API-fetched versions of the same
    // job collapse into one enriched row (richer/earlier data is the base that incoming merges into)
    var byId = {};
    var order = [];
    var unidentified = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r || typeof r !== "object") continue;
      if (isFileRecord(r)) continue;
      if (!hasObjectTextValue(r)) continue;
      var jid = extractJobId(r);
      if (jid) {
        if (byId[jid]) {
          byId[jid] = mergeJobRow(byId[jid], r);
        } else {
          byId[jid] = r;
          order.push(jid);
        }
      } else {
        unidentified.push(r);
      }
    }
    // Unidentified rows (no extractable job ID) are excluded — they are typically
    // jqGrid frozen-column table fragments and would otherwise appear as phantom job rows
    var out = [];
    for (var oi = 0; oi < order.length; oi++) out.push(byId[order[oi]]);
    return out;
  }

  function appendObjectRows(target, value) {
    if (!value) return;
    if ($.isArray(value)) {
      for (var i = 0; i < value.length; i++) appendObjectRows(target, value[i]);
      return;
    }
    if (value && typeof value === "object") {
      if ($.isArray(value.rows)) appendObjectRows(target, value.rows);
      else if ($.isArray(value.data)) appendObjectRows(target, value.data);
      else if ($.isArray(value.items)) appendObjectRows(target, value.items);
      else target.push(value.rowData && typeof value.rowData === "object" ? value.rowData : value);
    }
  }

  function appendJqGridRows(target) {
    $("#jobs_grid,#project_jobs_grid,table[id*='jobs'][id*='grid']").each(function () {
      var $grid = $(this);
      if (!$grid.length || typeof $grid.jqGrid !== "function") return;

      try {
        appendObjectRows(target, $grid.jqGrid("getGridParam", "data"));
      } catch (err) {}

      try {
        var ids = $grid.jqGrid("getDataIDs") || [];
        for (var i = 0; i < ids.length; i++) {
          appendObjectRows(target, $grid.jqGrid("getRowData", ids[i]));
        }
      } catch (err2) {}
    });
  }

  function appendDomGridRows(target) {
    $("#jobs_grid,#project_jobs_grid,table[id*='jobs'][id*='grid']").each(function () {
      var $grid = $(this);
      var headers = getGridHeaders($grid);
      $grid.find("tbody tr,tr.jqgrow").each(function () {
        var row = {};
        $(this).children("td").each(function (index) {
          var key = headers[index] || $(this).attr("aria-describedby") || $(this).attr("data-field") || ("col_" + index);
          row[key] = compactText($(this).text());
        });
        if (hasObjectTextValue(row)) target.push(row);
      });
    });
  }

  function getGridHeaders($grid) {
    var id = $grid.attr("id");
    var headers = [];
    var $headers = id ? $("#gbox_" + id).find(".ui-jqgrid-htable th") : $();
    if (!$headers.length) $headers = $grid.find("thead th");

    $headers.each(function () {
      headers.push(compactText($(this).text()) || $(this).attr("id") || $(this).attr("aria-describedby") || "");
    });

    return headers;
  }

  function dedupeObjectRows(rows) {
    var seen = {};
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i] || typeof rows[i] !== "object") continue;
      if (!hasObjectTextValue(rows[i])) continue;
      var key = firstObjectValue(rows[i], ["id", "ID", "job_id", "JOB_ID", "NUMBER", "number"]) || JSON.stringify(rows[i]).substr(0, 180);
      if (seen[key]) continue;
      seen[key] = true;
      out.push(rows[i]);
    }
    return out;
  }

  function hasObjectTextValue(object) {
    for (var key in object) {
      if (!Object.prototype.hasOwnProperty.call(object, key)) continue;
      if (compactText(object[key])) return true;
    }
    return false;
  }

  function pickDateTimeValue(values, mode) {
    var chosen = "";
    var chosenDate = null;

    for (var i = 0; i < values.length; i++) {
      var value = asText(values[i]).trim();
      if (!value) continue;
      var date = parseDate(value);
      if (!date) {
        if (!chosen) chosen = value;
        continue;
      }
      if (!chosenDate ||
          (mode === "latest" && date.getTime() > chosenDate.getTime()) ||
          (mode !== "latest" && date.getTime() < chosenDate.getTime())) {
        chosenDate = date;
        chosen = value;
      }
    }

    return chosen;
  }

  function normaliseFieldKey(value) {
    return normaliseComparable(value).replace(/[^a-z0-9]+/g, "");
  }

  function buildDefaultFixedDates(wiseEventStart, wiseEventEnd, systemDates) {
    systemDates = normaliseProjectSystemDates(systemDates || {});

    return [
      {
        label: "Start Date Time",
        friendlyLabel: "Project/Onsite Start",
        dateTime: systemDates.startDateTime || wiseEventStart,
        note: FIELD_MAP.projectSystem.startDateTime.logicalName + " via " + FIELD_MAP.projectSystem.startDateTime.upstream
      },
      {
        label: "Project End Date Time",
        friendlyLabel: "Project/Onsite End",
        dateTime: systemDates.projectEndDateTime || wiseEventEnd,
        note: FIELD_MAP.projectSystem.projectEndDateTime.logicalName + " via " + FIELD_MAP.projectSystem.projectEndDateTime.upstream
      }
    ];
  }

  function milestoneStatus(dateTime) {
    if (!dateTime) return "Missing";
    var d = parseDate(dateTime);
    return (d && d < new Date()) ? "Complete" : "Not Started";
  }

  function buildDefaultMilestones(wiseEventStart, wiseEventEnd, systemDates, projectOperationalDates, jobDates) {
    systemDates = normaliseProjectSystemDates(systemDates || {});
    projectOperationalDates = normaliseProjectOperationalDates(projectOperationalDates || {});
    jobDates = normaliseJobJourneyDates(jobDates || {});
    var hasJobSource = hasJobJourneySource(jobDates);
    var projectStart = wiseEventStart || systemDates.startDateTime;
    var projectEnd = wiseEventEnd || systemDates.projectEndDateTime;

    return [
      {
        id: "pre-production",
        group: "Pre-Production",
        name: "Pre-Prod Sign Off/Meeting",
        plannedDateTime: jobDates.preProd,
        actualDateTime: "",
        owner: "Production",
        status: milestoneStatus(jobDates.preProd),
        riskLevel: jobDates.preProd ? "None" : "Missing",
        criticalPath: false,
        optional: true,
        timingType: "offsite-prep",
        dependencies: [],
        targetDaysBeforeStart: FIELD_MAP.jobOperational.preProd.targetDaysBeforeStart,
        notes: "Final sign-off before production begins. Scope of work confirmed for team allocation and delegation. Target: at least 21 days before site."
      },
      {
        id: "supplier-engaged",
        group: "Supplier / Kit Prep",
        name: "Supplier Engaged",
        plannedDateTime: jobDates.supplier,
        actualDateTime: "",
        owner: "Technical",
        status: milestoneStatus(jobDates.supplier),
        riskLevel: jobDates.supplier ? "None" : "Missing",
        criticalPath: false,
        optional: true,
        timingType: "offsite-prep",
        dependencies: ["pre-production"],
        targetDaysBeforeStart: FIELD_MAP.jobOperational.supplier.targetDaysBeforeStart,
        notes: "Project made visible to suppliers and key partnerships confirmed. Target: at least 3 weeks before site."
      },
      {
        id: "wise-prep-start",
        group: "Supplier / Kit Prep",
        name: "Wise Prep Start",
        plannedDateTime: jobDates.wisePrep,
        actualDateTime: "",
        owner: "Technical",
        status: milestoneStatus(jobDates.wisePrep),
        riskLevel: jobDates.wisePrep ? "None" : "Missing",
        criticalPath: false,
        optional: true,
        timingType: "offsite-prep",
        dependencies: ["supplier-engaged"],
        notes: "First Wise prep activity for this job — kit check, team brief, logistics planning."
      },
      {
        id: "kit-booking-start",
        group: "Supplier / Kit Prep",
        name: "Kit Booking Start",
        plannedDateTime: jobDates.kitBookingStart,
        actualDateTime: "",
        owner: "Suppliers",
        status: milestoneStatus(jobDates.kitBookingStart),
        riskLevel: jobDates.kitBookingStart ? "None" : "Missing",
        criticalPath: true,
        optional: !hasJobSource,
        timingType: "offsite-prep",
        dependencies: ["wise-prep-start"],
        notes: "First day of chargeable kit time. The earliest equipment-out date across all jobs on this project."
      },
      {
        id: "vehicle-load",
        group: "Load / Transport",
        name: "Vehicle Load",
        plannedDateTime: jobDates.load,
        actualDateTime: "",
        owner: "Suppliers",
        status: milestoneStatus(jobDates.load),
        riskLevel: jobDates.load ? "None" : "Missing",
        criticalPath: false,
        optional: true,
        timingType: "offsite-prep",
        dependencies: ["kit-booking-start"],
        notes: "Planned load time for assigned vehicles. Must allow enough time to load, travel and arrive on site before the build starts."
      },
      {
        id: "vehicle-onsite-install",
        group: "Site Arrival",
        name: "Vehicle Onsite - Install",
        plannedDateTime: jobDates.vehicleInstall,
        actualDateTime: "",
        owner: "Technical",
        status: milestoneStatus(jobDates.vehicleInstall),
        riskLevel: jobDates.vehicleInstall ? "None" : "Missing",
        criticalPath: false,
        optional: true,
        timingType: "onsite",
        dependencies: ["vehicle-load"],
        notes: "Vehicle assigned to this job arrives on site ahead of the build."
      },
      {
        id: "job-onsite-start",
        group: "Site Arrival",
        name: "Onsite Start",
        plannedDateTime: jobDates.onsiteStart || projectStart,
        actualDateTime: "",
        owner: "Technical",
        status: milestoneStatus(jobDates.onsiteStart || projectStart),
        riskLevel: (jobDates.onsiteStart || projectStart) ? "None" : "Missing",
        criticalPath: true,
        optional: !hasJobSource && !!projectStart,
        timingType: "onsite",
        dependencies: ["vehicle-onsite-install"],
        notes: jobDates.onsiteStart ? "Earliest on-site start across all jobs on this project — first resource (crew or vehicle) onsite." : "Using the project on-site start date until individual job start times are available."
      },
      {
        id: "install-start",
        group: "Install",
        name: "Install Start",
        plannedDateTime: projectOperationalDates.installStart,
        actualDateTime: "",
        owner: "Production",
        status: milestoneStatus(projectOperationalDates.installStart),
        riskLevel: projectOperationalDates.installStart ? "None" : "Missing",
        criticalPath: false,
        optional: true,
        timingType: "onsite",
        dependencies: ["job-onsite-start"],
        notes: "Earliest install activity on the project. All crew and vehicles should be on site at or before this time."
      },
      {
        id: "show-start",
        group: "Show",
        name: "Show Start",
        plannedDateTime: projectOperationalDates.showStart,
        actualDateTime: "",
        owner: "Project Management",
        status: milestoneStatus(projectOperationalDates.showStart),
        riskLevel: projectOperationalDates.showStart ? "None" : "Missing",
        criticalPath: false,
        optional: true,
        timingType: "onsite",
        dependencies: ["install-start"],
        notes: "The event begins — guests enter. All build activities should be complete before this point."
      },
      {
        id: "show-end",
        group: "Show",
        name: "Show End",
        plannedDateTime: projectOperationalDates.showEnd,
        actualDateTime: "",
        owner: "Project Management",
        status: milestoneStatus(projectOperationalDates.showEnd),
        riskLevel: projectOperationalDates.showEnd ? "None" : "Missing",
        criticalPath: false,
        optional: true,
        timingType: "onsite",
        dependencies: ["show-start"],
        notes: "The event fully ends and guests leave for the final time. Derig can begin after this point."
      },
      {
        id: "derig-start",
        group: "Derig",
        name: "Derig Start",
        plannedDateTime: projectOperationalDates.derigStart,
        actualDateTime: "",
        owner: "Production",
        status: milestoneStatus(projectOperationalDates.derigStart),
        riskLevel: projectOperationalDates.derigStart ? "None" : "Missing",
        criticalPath: false,
        optional: true,
        timingType: "onsite",
        dependencies: ["show-end"],
        notes: "Earliest derig activity on the project. Should be after the show ends."
      },
      {
        id: "vehicle-onsite-derig",
        group: "Derig",
        name: "Vehicle Onsite - Derig",
        plannedDateTime: jobDates.vehicleDerig,
        actualDateTime: "",
        owner: "Technical",
        status: milestoneStatus(jobDates.vehicleDerig),
        riskLevel: jobDates.vehicleDerig ? "None" : "Missing",
        criticalPath: false,
        optional: true,
        timingType: "onsite",
        dependencies: ["derig-start"],
        notes: "Vehicle assigned to this job arrives on site for collection."
      },
      {
        id: "site-clear",
        group: "Site Clear",
        name: "Site Clear",
        plannedDateTime: jobDates.onsiteEnd || projectEnd,
        actualDateTime: "",
        owner: "Technical",
        status: milestoneStatus(jobDates.onsiteEnd || projectEnd),
        riskLevel: (jobDates.onsiteEnd || projectEnd) ? "None" : "Missing",
        criticalPath: true,
        optional: !hasJobSource && !!projectEnd,
        timingType: "onsite",
        dependencies: ["vehicle-onsite-derig"],
        notes: jobDates.onsiteEnd ? "Latest clear-of-site time across all jobs on this project." : "Using the project end date until individual job clear times are available."
      },
      {
        id: "kit-booking-end",
        group: "Site Clear",
        name: "Kit Booking End",
        plannedDateTime: jobDates.kitBookingEnd,
        actualDateTime: "",
        owner: "Suppliers",
        status: milestoneStatus(jobDates.kitBookingEnd),
        riskLevel: jobDates.kitBookingEnd ? "None" : "Missing",
        criticalPath: true,
        optional: !hasJobSource,
        timingType: "offsite",
        dependencies: ["site-clear"],
        notes: "Last day of chargeable kit time. The latest equipment-return date across all jobs on this project."
      },
      {
        id: "vehicle-tip",
        group: "Site Clear",
        name: "Vehicle Tip",
        plannedDateTime: jobDates.vehicleTip,
        actualDateTime: "",
        owner: "Suppliers",
        status: milestoneStatus(jobDates.vehicleTip),
        riskLevel: jobDates.vehicleTip ? "None" : "Missing",
        criticalPath: false,
        optional: true,
        timingType: "offsite",
        dependencies: ["kit-booking-end"],
        notes: "Vehicles arrive back at the supplier depot for tip / off-load."
      }
    ];
  }

  function normaliseJourneyData(raw, isMock) {
    raw = raw || {};
    var project = raw.project && typeof raw.project === "object" ? raw.project : {};
    var systemDates = normaliseProjectSystemDates(raw.projectSystemDates || raw.systemDates || raw);
    var projectOperationalDates = normaliseProjectOperationalDates(raw.projectOperationalDates || raw.operationalDates || raw.projectMilestones || raw);
    var jobDates = normaliseJobJourneyDates(raw.jobDates || raw.jobSystemDates || raw.jobMilestoneDates || raw);
    var wiseEventStart = firstNonEmpty([raw.wiseEventStart, project.wiseEventStart, systemDates.startDateTime, raw.eventStart, raw.start]);
    var wiseEventEnd = firstNonEmpty([raw.wiseEventEnd, project.wiseEventEnd, systemDates.projectEndDateTime, raw.eventEnd, raw.end]);
    var milestones = normaliseMilestones(raw.milestones || raw.journeyMilestones || [], wiseEventStart, wiseEventEnd);

    return {
      isMock: !!isMock,
      project: {
        id: asText(project.id || raw.projectId || getCurrentProjectId()),
        name: asText(project.name || raw.projectName || "Untitled project"),
        clientName: asText(project.clientName || project.client || raw.clientName || ""),
        venue: asText(project.venue || raw.venue || "")
      },
      wiseEventStart: asText(wiseEventStart),
      wiseEventEnd: asText(wiseEventEnd),
      projectSystemDates: systemDates,
      projectOperationalDates: projectOperationalDates,
      jobDates: jobDates,
      hireHopFixedDates: normaliseFixedDates(raw.hireHopFixedDates || raw.fixedDates || [], wiseEventStart, wiseEventEnd, systemDates),
      jobKitBookingStart: asText(raw.jobKitBookingStart || raw.kitBookingStart || jobDates.kitBookingStart || ""),
      jobKitBookingEnd: asText(raw.jobKitBookingEnd || raw.kitBookingEnd || jobDates.kitBookingEnd || ""),
      milestones: milestones.length ? milestones : buildDefaultMilestones(wiseEventStart, wiseEventEnd, systemDates, projectOperationalDates, jobDates),
      departments: normaliseDepartments(raw.departments || DEPARTMENTS)
    };
  }

  function normaliseProjectSystemDates(value) {
    value = value && typeof value === "object" ? value : {};

    return {
      outgoingDateTime: asText(value.outgoingDateTime || value.out_datetime || value.outgoing || value.outgoingDate || ""),
      startDateTime: asText(value.startDateTime || value.start_datetime || value.startDate || value.projectStartDateTime || ""),
      projectEndDateTime: asText(value.projectEndDateTime || value.end_datetime || value.projectEnd || value.endDateTime || value.endDate || ""),
      returnDateTime: asText(value.returnDateTime || value.return_datetime || value.return || value.returnDate || "")
    };
  }

  function normaliseProjectOperationalDates(value) {
    value = value && typeof value === "object" ? value : {};

    return {
      installStart: asText(value.installStart || value._Install || value.install || ""),
      showStart: asText(value.showStart || value._ShowStart || value.show_start || ""),
      showEnd: asText(value.showEnd || value._ShowEnd || value.show_end || ""),
      derigStart: asText(value.derigStart || value._Derig || value.derig || "")
    };
  }

  function normaliseJobJourneyDates(value) {
    value = value && typeof value === "object" ? value : {};

    var out = {
      sourceCount: Number(value.sourceCount || value.count || 0) || 0,
      kitBookingStart: asText(value.kitBookingStart || value.out_datetime || value.outDateTime || value.out || ""),
      onsiteStart: asText(value.onsiteStart || value.start_datetime || value.startDateTime || value.start || ""),
      onsiteEnd: asText(value.onsiteEnd || value.end_datetime || value.endDateTime || value.end || ""),
      kitBookingEnd: asText(value.kitBookingEnd || value.return_datetime || value.returnDateTime || value.return || ""),
      preProd: asText(value.preProd || value._PreProd || value.preProduction || ""),
      supplier: asText(value.supplier || value._Supplier || value.supplierEngaged || ""),
      wisePrep: asText(value.wisePrep || value._WisePrep || ""),
      load: asText(value.load || value._Load || value.vehicleLoad || ""),
      vehicleInstall: asText(value.vehicleInstall || value._VehicleInstall || ""),
      vehicleDerig: asText(value.vehicleDerig || value._VehicleDerig || ""),
      vehicleTip: asText(value.vehicleTip || value._Tip || "")
    };

    out.hasDates = !!(out.kitBookingStart || out.onsiteStart || out.onsiteEnd || out.kitBookingEnd ||
      out.preProd || out.supplier || out.wisePrep || out.load || out.vehicleInstall || out.vehicleDerig || out.vehicleTip);
    return out;
  }

  function hasJobJourneySource(jobDates) {
    return !!(jobDates && jobDates.hasDates);
  }

  function normaliseFixedDates(fixedDates, wiseEventStart, wiseEventEnd, systemDates) {
    var list = normaliseArray(fixedDates);
    var out = [];

    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!item || typeof item !== "object") continue;
      out.push({
        label: asText(item.label || item.name || ""),
        friendlyLabel: asText(item.friendlyLabel || item.displayLabel || ""),
        dateTime: asText(item.dateTime || item.plannedDateTime || item.value || ""),
        note: asText(item.note || item.notes || "")
      });
    }

    if (!out.length) {
      return buildDefaultFixedDates(wiseEventStart, wiseEventEnd, systemDates);
    }

    return out;
  }

  function normaliseMilestones(items) {
    var list = normaliseArray(items);
    var out = [];

    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!item || typeof item !== "object") continue;
      var planned = asText(item.plannedDateTime || item.planned || item.dateTime || "");
      var actual = asText(item.actualDateTime || item.actual || "");
      var status = normaliseStatus(item.status || deriveStatus(planned, actual));
      var owner = asText(item.owner || item.ownerDepartment || item.department || "");
      out.push({
        id: normaliseId(item.id || item.key || item.name || ("milestone-" + i)),
        group: asText(item.group || "Operational Journey"),
        name: asText(item.name || item.label || "Milestone"),
        plannedDateTime: planned,
        actualDateTime: actual,
        owner: owner,
        status: status,
        riskLevel: normaliseRisk(item.riskLevel || item.risk || status),
        criticalPath: item.criticalPath === true || item.critical === true,
        optional: item.optional === true || item.required === false,
        dependencies: normaliseDependencies(item.dependencies),
        notes: asText(item.notes || item.note || ""),
        timingType: normaliseTimingType(item.timingType || item.locationType || ""),
        targetDaysBeforeStart: Number(item.targetDaysBeforeStart || item.daysBeforeStart || 0) || 0,
        allowOutsideWrapper: item.allowOutsideWrapper === true || item.offsitePrep === true
      });
    }

    return out;
  }

  function normaliseDependencies(value) {
    var list = normaliseArray(value);
    var out = [];

    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (item && typeof item === "object") {
        out.push(normaliseId(item.id || item.key || item.name || item.label));
      } else {
        out.push(normaliseId(item));
      }
    }

    return out;
  }

  function normaliseDepartments(value) {
    var list = normaliseArray(value);
    var out = [];

    for (var i = 0; i < list.length; i++) {
      var text = asText(list[i]).trim();
      if (text && out.indexOf(text) === -1) out.push(text);
    }

    for (var d = 0; d < DEPARTMENTS.length; d++) {
      if (out.indexOf(DEPARTMENTS[d]) === -1) out.push(DEPARTMENTS[d]);
    }

    return out;
  }

  function analyseJourney(data) {
    var issues = generateIssues(data);
    var readiness = calculateReadiness(data, issues);
    var departmentReadiness = calculateDepartmentReadiness(data, issues);
    var status = calculateOverallStatus(data, issues, readiness.score);

    return {
      issues: issues,
      readiness: readiness,
      departmentReadiness: departmentReadiness,
      status: status
    };
  }

  function generateIssues(data) {
    var issues = [];
    var milestones = data.milestones || [];
    var byId = indexMilestonesById(milestones);
    var wrapperStart = parseDate(data.wiseEventStart);
    var wrapperEnd = parseDate(data.wiseEventEnd);

    if (!wrapperStart) {
      issues.push(createIssue("Blocked", "Event start date not set", "Set the project start date in HireHop so milestones can be validated against the event window.", "event-wrapper", true));
    }
    if (!wrapperEnd) {
      issues.push(createIssue("Blocked", "Event end date not set", "Set the project end date in HireHop to enable full journey checks.", "event-wrapper", true));
    }
    if (wrapperStart && wrapperEnd && wrapperStart.getTime() > wrapperEnd.getTime()) {
      issues.push(createIssue("Blocked", "End date is before the start date", "Check the project start and end dates in HireHop — the end appears to be earlier than the start.", "event-wrapper", true));
    }

    for (var i = 0; i < milestones.length; i++) {
      var milestone = milestones[i];
      var planned = parseDate(milestone.plannedDateTime);

      if (!milestone.plannedDateTime && !milestone.optional) {
        issues.push(createIssue(milestone.criticalPath ? "Blocked" : "Missing Data", milestone.name + " has no date set", "Add a date for this milestone so it can be validated against the event window.", milestone.id, milestone.criticalPath));
      }

      if (!milestone.owner) {
        issues.push(createIssue("Missing Data", milestone.name + " has no assigned department", "Assign a department so this milestone appears in the readiness view.", milestone.id, milestone.criticalPath));
      }

      if (planned && wrapperStart && isOperationalOnsite(milestone) && planned.getTime() < wrapperStart.getTime()) {
        issues.push(createIssue(milestone.criticalPath ? "At Risk" : "Warning", milestone.name + " falls before the event window opens", "This on-site activity is planned before the project start date in HireHop.", milestone.id, milestone.criticalPath));
      }

      if (planned && wrapperEnd && isOperationalOnsite(milestone) && planned.getTime() > wrapperEnd.getTime()) {
        issues.push(createIssue(milestone.criticalPath ? "At Risk" : "Warning", milestone.name + " falls after the event window closes", "This on-site activity is planned beyond the project end date in HireHop.", milestone.id, milestone.criticalPath));
      }

      if (isSupplierMilestone(milestone) && !milestone.plannedDateTime && !milestone.optional) {
        issues.push(createIssue("At Risk", "Supplier timing not confirmed", milestone.name + " needs a confirmed date before the journey is ready.", milestone.id, milestone.criticalPath));
      }

      if (planned && wrapperStart && milestone.targetDaysBeforeStart) {
        var target = new Date(wrapperStart.getTime() - (milestone.targetDaysBeforeStart * 24 * 60 * 60 * 1000));
        if (planned.getTime() > target.getTime()) {
          issues.push(createIssue("At Risk", milestone.name + " is too close to the event", "Target is at least " + milestone.targetDaysBeforeStart + " days before the on-site date.", milestone.id, milestone.criticalPath));
        }
      }

      if (normaliseStatus(milestone.status) === "Blocked") {
        issues.push(createIssue("Blocked", milestone.name + " is blocked", milestone.notes || "Resolve the blocker before this journey can be considered ready.", milestone.id, milestone.criticalPath));
      } else if (normaliseStatus(milestone.status) === "At Risk") {
        issues.push(createIssue("At Risk", milestone.name + " is at risk", milestone.notes || "Review the milestone owner, timing and dependencies.", milestone.id, milestone.criticalPath));
      }

      for (var d = 0; d < milestone.dependencies.length; d++) {
        var dependency = byId[milestone.dependencies[d]];
        if (!dependency) {
          issues.push(createIssue("Missing Data", milestone.name + " has an unmapped dependency", "Dependency '" + milestone.dependencies[d] + "' is not present in the journey data.", milestone.id, milestone.criticalPath));
        } else {
          var dependencyIssue = getDependencyIssue(milestone, dependency);
          if (dependencyIssue) {
            issues.push(createIssue(dependencyIssue.severity, dependencyIssue.title, dependencyIssue.detail, milestone.id, milestone.criticalPath));
          }
        }
      }
    }

    if (hasJobJourneySource(data.jobDates) && (!data.jobKitBookingStart || !data.jobKitBookingEnd)) {
      issues.push(createIssue("Missing Data", "Kit out or return dates missing from jobs", "Set equipment-out and return dates on each job so kit timing can be tracked separately from the on-site window.", "kit-booking", true));
    }

    addRelationshipIssues(issues, byId, wrapperEnd);
    return sortIssues(dedupeIssues(issues));
  }

  function getDependencyIssue(milestone, dependency) {
    if (milestone.optional) return null;
    if (dependency.optional && !dependency.plannedDateTime) return null;

    var dependencyStatus = normaliseStatus(dependency.status);
    if (dependencyStatus === "Complete") return null;

    var milestoneStatus = normaliseStatus(milestone.status);
    var milestonePlanned = parseDate(milestone.plannedDateTime);
    var dependencyPlanned = parseDate(dependency.plannedDateTime);

    if (dependencyStatus === "Blocked" && milestonePlanned) {
      return {
        severity: milestone.criticalPath ? "At Risk" : "Warning",
        title: milestone.name + " depends on blocked work",
        detail: dependency.name + " is blocked and must be resolved first."
      };
    }

    if (milestoneStatus === "In Progress" || milestoneStatus === "Complete" || milestone.actualDateTime) {
      return {
        severity: milestone.criticalPath ? "At Risk" : "Warning",
        title: milestone.name + " started before dependency complete",
        detail: dependency.name + " should be complete before this milestone moves forward."
      };
    }

    if (milestonePlanned && dependencyPlanned && milestonePlanned.getTime() < dependencyPlanned.getTime()) {
      return {
        severity: milestone.criticalPath ? "At Risk" : "Warning",
        title: milestone.name + " is planned before its dependency",
        detail: dependency.name + " is planned later than this milestone."
      };
    }

    return null;
  }

  function addRelationshipIssues(issues, byId, wrapperEnd) {
    var onsiteStart = byId["job-onsite-start"] || byId["job_onsite_start"];
    var installStart = byId["install-start"] || byId["install_start"];
    var showEnd = byId["show-end"] || byId["show_end"];
    var derigStart = byId["derig-start"] || byId["derig_start"];
    var siteClear = byId["site-clear"] || byId["site_clear"];

    if (onsiteStart && installStart && compareMilestoneTimes(onsiteStart, installStart) > 0) {
      issues.push(createIssue("At Risk", "Crew arrives after build starts", "The first crew on-site time is later than the build start — check job and install dates.", onsiteStart.id, true));
    }

    if (derigStart && showEnd && compareMilestoneTimes(derigStart, showEnd) < 0) {
      issues.push(createIssue("At Risk", "Derig begins before the show ends", "The derig start overlaps with the show end — check show and derig timing.", derigStart.id, true));
    }

    var siteClearDate = siteClear ? parseDate(siteClear.plannedDateTime) : null;
    if (siteClearDate && wrapperEnd && siteClearDate.getTime() > wrapperEnd.getTime()) {
      issues.push(createIssue("At Risk", "Site clear is after the event window closes", "The planned clear time extends beyond the project end date in HireHop.", siteClear.id, true));
    }
  }

  function calculateReadiness(data, issues) {
    var milestones = getScoredMilestones(data.milestones || []);
    var weighted = 0;
    var possible = 0;

    for (var i = 0; i < milestones.length; i++) {
      var milestone = milestones[i];
      var weight = milestone.criticalPath ? 1.6 : 1;
      possible += weight;
      weighted += weight * getStatusScore(milestone.status);
    }

    var baseScore = possible ? Math.round((weighted / possible) * 100) : 0;
    var penalty = calculateIssuePenalty(issues);
    var score = clamp(Math.round(baseScore - penalty), 0, 100);

    return {
      score: score,
      baseScore: baseScore,
      penalty: penalty,
      complete: countMilestonesByStatus(milestones, "Complete"),
      total: milestones.length
    };
  }

  function calculateDepartmentReadiness(data, issues) {
    var departments = data.departments || DEPARTMENTS;
    var milestones = data.milestones || [];
    var scoredMilestones = getScoredMilestones(milestones);
    var out = [];

    for (var d = 0; d < departments.length; d++) {
      var department = departments[d];
      var dNorm = normaliseComparable(department);
      // All milestones for display
      var allForDept = [];
      for (var a = 0; a < milestones.length; a++) {
        if (normaliseComparable(milestones[a].owner) === dNorm) allForDept.push(milestones[a]);
      }
      // Scored milestones for score calculation
      var scored = [];
      for (var i = 0; i < scoredMilestones.length; i++) {
        if (normaliseComparable(scoredMilestones[i].owner) === dNorm) scored.push(scoredMilestones[i]);
      }

      var base = scored.length ? averageStatusScore(scored) : 0;
      var penalty = 0;
      for (var j = 0; j < issues.length; j++) {
        var issueMilestone = findMilestoneById(milestones, issues[j].milestoneId);
        if (issueMilestone && normaliseComparable(issueMilestone.owner) === dNorm) {
          penalty += getIssuePenalty(issues[j]) * 0.55;
        }
      }

      out.push({
        department: department,
        score: scored.length ? clamp(Math.round(base - penalty), 0, 100) : 0,
        total: allForDept.length,
        complete: countMilestonesByStatus(allForDept, "Complete"),
        milestones: allForDept
      });
    }

    return out;
  }

  function calculateOverallStatus(data, issues, readinessScore) {
    var milestones = getScoredMilestones(data.milestones || []);

    for (var i = 0; i < issues.length; i++) {
      if (issues[i].severity === "Blocked") return "Blocked";
    }
    for (var j = 0; j < issues.length; j++) {
      if (issues[j].severity === "At Risk") return "At Risk";
    }
    for (var m = 0; m < milestones.length; m++) {
      if (normaliseStatus(milestones[m].status) === "In Progress") return "In Progress";
    }

    return readinessScore >= 85 ? "Ready" : "At Risk";
  }

  function getScoredMilestones(milestones) {
    var out = [];
    for (var i = 0; i < milestones.length; i++) {
      if (!milestones[i].optional || milestones[i].plannedDateTime || normaliseStatus(milestones[i].status) === "Complete") {
        out.push(milestones[i]);
      }
    }
    return out.length ? out : milestones;
  }

  function indexIssuesByMilestone(issues) {
    var out = {};
    for (var i = 0; i < issues.length; i++) {
      var id = issues[i].milestoneId;
      if (id) {
        if (!out[id]) out[id] = [];
        out[id].push(issues[i]);
      }
    }
    return out;
  }

  function maybePreloadJobData() {
    var $grid = $("#jobs_grid,#project_jobs_grid,table[id*='jobs'][id*='grid']").first();
    var hasJqGrid = $grid.length && typeof $grid.jqGrid === "function";

    // If jqGrid is present and we have no cached rows yet, try fetching from its URL
    if (hasJqGrid && (!state.cachedJobRows || !state.cachedJobRows.length)) {
      var url;
      try { url = $grid.jqGrid("getGridParam", "url"); } catch (e) {}
      if (url) {
        $.ajax({
          url: url, method: "GET", dataType: "json",
          success: function (data) {
            tryCacheJobsFromResponse({ responseText: JSON.stringify(data) });
            maybePreloadJobDetails();
            if (state.cachedJobRows && state.cachedJobRows.length) {
              scheduleMaintainProjectJourney(50, { forceScan: true });
            }
          }
        });
        return;
      }
    }

    // Always attempt detail preload — will fall back to DOM rows if cache is empty
    maybePreloadJobDetails();
  }

  function maybePreloadJobDetails() {
    // Use cached rows if available; fall back to DOM-scraped rows for job IDs
    var sourceRows = (state.cachedJobRows && state.cachedJobRows.length)
      ? state.cachedJobRows
      : (function () { var r = []; appendJqGridRows(r); appendDomGridRows(r); return r; }());

    if (!sourceRows.length) return;
    var toFetch = [];
    for (var i = 0; i < sourceRows.length; i++) {
      var row = sourceRows[i];
      var cf = row.CUSTOM_FIELDS;
      var hasRichData = cf && typeof cf === "object" && !$.isArray(cf) && Object.keys(cf).length > 0;
      if (!hasRichData) {
        var id = extractJobId(row);
        if (id && toFetch.indexOf(id) === -1) toFetch.push(id);
      }
    }
    if (!toFetch.length) return;
    toFetch = toFetch.slice(0, 5);
    for (var j = 0; j < toFetch.length; j++) {
      (function (jobId) {
        $.ajax({
          url: "api/job_data.php?job=" + encodeURIComponent(jobId),
          method: "GET", dataType: "json",
          success: function (data) {
            if (!data || typeof data !== "object") return;
            tryCacheJobsFromResponse({ responseText: JSON.stringify(data) });
            scheduleMaintainProjectJourney(120, { forceScan: true });
          }
        });
      })(toFetch[j]);
    }
  }

  function buildJourneyHtml(data, analysis) {
    maybePreloadJobData();
    var operationalMilestones = getOperationalMilestones(data.milestones || []);
    var visibleMilestones = state.showCriticalOnly ? filterCriticalMilestones(operationalMilestones) : operationalMilestones;
    var issuesByMilestone = indexIssuesByMilestone(analysis.issues);

    return '<div class="wpj-shell">' +
      buildHeaderSummary(data, analysis) +
      buildIssuesPanel(analysis.issues) +
      buildDepartmentReadiness(analysis.departmentReadiness) +
      buildTimeline(visibleMilestones, state.showCriticalOnly, issuesByMilestone, data) +
      buildDiagnosticPanel() +
    '</div>';
  }

  function buildHeaderSummary(data, analysis) {
    var score = analysis.readiness.score;
    var scoreClass = getScoreClass(score);
    var statusCls = cssClass(analysis.status);
    var metaRaw = [];
    if (data.project.clientName) metaRaw.push(data.project.clientName);
    if (data.project.venue) metaRaw.push(data.project.venue);
    if (data.isMock) metaRaw.push("Sample data");
    var projectNameNorm = normaliseComparable(data.project.name || "");
    var seen = {};
    var meta = [];
    for (var mi = 0; mi < metaRaw.length; mi++) {
      var mv = metaRaw[mi];
      if (!mv) continue;
      var mvNorm = normaliseComparable(mv);
      if (!mvNorm) continue;
      if (seen[mvNorm]) continue;
      if (mvNorm === projectNameNorm) continue;
      // Skip items whose words are all already contained in the project name
      var mvWords = mvNorm.split(" ");
      var allInName = true;
      for (var wi = 0; wi < mvWords.length; wi++) {
        if (mvWords[wi] && projectNameNorm.indexOf(mvWords[wi]) === -1) { allInName = false; break; }
      }
      if (allInName) continue;
      seen[mvNorm] = true;
      meta.push(mv);
    }

    return '<div class="wpj-hdr">' +
      '<div class="wpj-hdr-main">' +
        '<div class="wpj-hdr-kicker">Event Journey</div>' +
        '<h2>' + esc(data.project.name || "Untitled Project") + '</h2>' +
        (meta.length ? '<div class="wpj-hdr-meta">' + esc(meta.join(" · ")) + '</div>' : '') +
      '</div>' +
      '<div class="wpj-hdr-aside">' +
        '<span class="wpj-badge wpj-badge--' + statusCls + '">' + esc(analysis.status) + '</span>' +
        '<div class="wpj-readiness">' +
          '<div class="wpj-readiness-pct ' + scoreClass + '">' + score + '%</div>' +
          '<div class="wpj-readiness-track"><div class="wpj-readiness-fill ' + scoreClass + '" style="width:' + score + '%"></div></div>' +
          '<div class="wpj-readiness-label">' + esc(analysis.readiness.complete + " of " + analysis.readiness.total + " milestones complete") + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }


  function buildIssuesPanel(issues) {
    if (!issues.length) return '';
    var blocked = 0, atRisk = 0;
    for (var i = 0; i < issues.length; i++) {
      if (issues[i].severity === "Blocked") blocked++;
      else if (issues[i].severity === "At Risk") atRisk++;
    }
    var parts = [issues.length + " issue" + (issues.length !== 1 ? "s" : "")];
    if (blocked) parts.push(blocked + " blocking");
    if (atRisk) parts.push(atRisk + " at risk");

    var html = '<details class="wpj-alerts' + (blocked ? ' wpj-alerts--blocked' : ' wpj-alerts--risk') + '">' +
      '<summary>' +
        '<span class="wpj-alerts-icon">⚠</span>' +
        '<span class="wpj-alerts-text">' + esc(parts.join(" · ")) + '</span>' +
        '<span class="wpj-alerts-caret">▾</span>' +
      '</summary>' +
      '<div class="wpj-alerts-body">';
    for (var j = 0; j < issues.length; j++) {
      html += '<div class="wpj-alert wpj-alert--' + cssClass(issues[j].severity) + '">' +
        '<span class="wpj-alert-sev">' + esc(issues[j].severity) + '</span>' +
        '<div class="wpj-alert-content">' +
          '<strong>' + esc(issues[j].title) + '</strong>' +
          '<p>' + esc(issues[j].message) + '</p>' +
        '</div>' +
      '</div>';
    }
    html += '</div></details>';
    return html;
  }

  function buildTimeline(milestones, criticalOnly, issuesByMilestone, data) {
    issuesByMilestone = issuesByMilestone || {};
    data = data || {};
    var pad = (data.projectOperationalDates && typeof data.projectOperationalDates === "object")
      ? data.projectOperationalDates : {};

    var bars = '<div class="wpj-flow-bar">' +
      '<div class="wpj-segmented">' +
        '<button type="button" class="' + (!criticalOnly ? "is-active" : "") + '" data-wise-project-journey-toggle="all">All milestones</button>' +
        '<button type="button" class="' + (criticalOnly ? "is-active" : "") + '" data-wise-project-journey-toggle="critical">Critical path only</button>' +
      '</div>' +
      '<button type="button" class="wpj-refresh-btn" data-wise-project-journey-refresh>⟳ Refresh</button>' +
    '</div>';

    // ---- Project row events ----
    var projectEventDefs = [
      { name: "Onsite Start",  dateTime: data.wiseEventStart,  fieldKey: "START_DATE",        pointType: "wrapper-start", critical: true  },
      { name: "Install Start", dateTime: pad.installStart,      fieldKey: "_Install",          pointType: "project",       critical: true  },
      { name: "Show Start",    dateTime: pad.showStart,         fieldKey: "_ShowStart",        pointType: "project",       critical: true  },
      { name: "Show End",      dateTime: pad.showEnd,           fieldKey: "_ShowEnd",          pointType: "project",       critical: true  },
      { name: "Derig Start",   dateTime: pad.derigStart,        fieldKey: "_Derig",            pointType: "project",       critical: true  },
      { name: "Onsite End",    dateTime: data.wiseEventEnd,     fieldKey: "END_DATE",          pointType: "wrapper-end",   critical: true  }
    ];
    var projectEvents = [];
    for (var pi = 0; pi < projectEventDefs.length; pi++) {
      var pdef = projectEventDefs[pi];
      if (pdef.dateTime && parseDate(pdef.dateTime) && (!criticalOnly || pdef.critical)) {
        projectEvents.push(pdef);
      }
    }

    // ---- Per-job rows ----
    var rawJobRows = getProjectJobRows();
    var activeJobRows = [];
    for (var ri = 0; ri < rawJobRows.length; ri++) {
      if (isActiveJob(rawJobRows[ri])) activeJobRows.push(rawJobRows[ri]);
    }

    var JOB_COLORS = ["#0369a1", "#7c3aed", "#0891b2", "#b45309", "#4a6fa5", "#15803d"];
    var jobEventMaps = [
      { name: "Kit Booking Start",       map: FIELD_MAP.jobSystem.kitBookingStart,    fieldKey: "OUT_DATE",        critical: true  },
      { name: "Wise Prep Start",          map: FIELD_MAP.jobOperational.wisePrep,      fieldKey: "_WisePrep",       critical: false },
      { name: "Vehicle Load",             map: FIELD_MAP.jobOperational.load,          fieldKey: "_Load",           critical: false },
      { name: "Onsite Start",              map: FIELD_MAP.jobSystem.onsiteStart,        fieldKey: "JOB_DATE",        critical: true  },
      { name: "Vehicle Onsite - Install", map: FIELD_MAP.jobOperational.vehicleInstall,fieldKey: "_VehicleInstall", critical: false },
      { name: "Vehicle Onsite - Derig",   map: FIELD_MAP.jobOperational.vehicleDerig,  fieldKey: "_VehicleDerig",   critical: false },
      { name: "Site Clear",               map: FIELD_MAP.jobSystem.onsiteEnd,          fieldKey: "JOB_END",         critical: true  },
      { name: "Kit Booking End",          map: FIELD_MAP.jobSystem.kitBookingEnd,      fieldKey: "RETURN_DATE",     critical: true  },
      { name: "Vehicle Tip",              map: FIELD_MAP.jobOperational.vehicleTip,    fieldKey: "_Tip",            critical: false }
    ];

    var jobGroups = [];
    for (var ji = 0; ji < activeJobRows.length; ji++) {
      var jobRow = activeJobRows[ji];
      var jobId = extractJobId(jobRow) || String(ji + 1);
      var jEvents = [];
      for (var di = 0; di < jobEventMaps.length; di++) {
        var jdef = jobEventMaps[di];
        if (criticalOnly && !jdef.critical) continue;
        var jdt = readMappedDateTimeFromObject(jobRow, jdef.map);
        if (jdt && parseDate(jdt)) {
          jEvents.push({ name: jdef.name, dateTime: jdt, fieldKey: jdef.fieldKey, pointType: "job", critical: jdef.critical });
        }
      }
      jobGroups.push({ jobId: jobId, events: jEvents, color: JOB_COLORS[ji % JOB_COLORS.length] });
    }

    // ---- Global time range across all rows ----
    var allMs = [];
    for (var pei = 0; pei < projectEvents.length; pei++) {
      var pd = parseDate(projectEvents[pei].dateTime);
      if (pd) allMs.push(pd.getTime());
    }
    for (var jgi = 0; jgi < jobGroups.length; jgi++) {
      for (var jei = 0; jei < jobGroups[jgi].events.length; jei++) {
        var jed = parseDate(jobGroups[jgi].events[jei].dateTime);
        if (jed) allMs.push(jed.getTime());
      }
    }

    if (!allMs.length) {
      return '<div class="wpj-flow">' + bars +
        '<div class="wpj-empty-state">No scheduled dates yet — milestones will appear once dates are set.</div></div>';
    }

    var globalMin = Math.min.apply(null, allMs);
    var globalMax = Math.max.apply(null, allMs);
    var totalSpan = Math.max(globalMax - globalMin, 3600000); // at least 1 hr span

    function toLPct(ms) {
      return (4 + (ms - globalMin) / totalSpan * 92).toFixed(1);
    }

    var html = '<div class="wpj-flow">' + bars + '<div class="wpj-tl-scroll"><div class="wpj-tl-grid">';

    if (projectEvents.length) {
      html += renderTlRow("Project", projectEvents, toLPct, "wpj-tl-row--project", null);
    }
    for (var jri = 0; jri < jobGroups.length; jri++) {
      var jg = jobGroups[jri];
      html += renderTlRow('#' + jg.jobId, jg.events, toLPct, "wpj-tl-row--job", jg.color);
    }

    html += '</div></div>';

    // Milestones from analysis with no scheduled date
    var unscheduled = [];
    for (var umi = 0; umi < milestones.length; umi++) {
      if (!milestones[umi].plannedDateTime && !milestones[umi].actualDateTime) {
        unscheduled.push(milestones[umi]);
      }
    }
    if (unscheduled.length) {
      html += '<details class="wpj-gantt-unsched"><summary>Not yet scheduled — ' + unscheduled.length + ' milestone' + (unscheduled.length > 1 ? "s" : "") + '</summary><div class="wpj-gantt-unsched-body">';
      for (var ui = 0; ui < unscheduled.length; ui++) {
        html += '<div class="wpj-gantt-unsched-row"><span class="wpj-tl-ename">' + esc(unscheduled[ui].name) + '</span>' +
          buildStatusChip(normaliseStatus(unscheduled[ui].status)) + '</div>';
      }
      html += '</div></details>';
    }

    html += '</div>';
    return html;
  }

  function renderTlRow(label, events, toLPct, rowCls, accentColor) {
    var sorted = events.slice().sort(function (a, b) {
      return parseDate(a.dateTime).getTime() - parseDate(b.dateTime).getTime();
    });

    var hdrStyle = accentColor ? ' style="color:' + accentColor + ';border-right-color:' + accentColor + '"' : '';
    var lineStyle = accentColor ? ' style="background:' + accentColor + ';opacity:0.3"' : '';

    var html = '<div class="wpj-tl-row ' + (rowCls || '') + '">' +
      '<div class="wpj-tl-row-hdr"' + hdrStyle + '>' + esc(label) + '</div>' +
      '<div class="wpj-tl-row-body">' +
      '<div class="wpj-tl-body-line"' + lineStyle + '></div>';

    for (var i = 0; i < sorted.length; i++) {
      var ev = sorted[i];
      var d = parseDate(ev.dateTime);
      var lp = toLPct(d.getTime());
      var above = i % 2 === 0;

      var evtCls = "wpj-tl-evt";
      if (ev.pointType === "wrapper-start") evtCls += " wpj-tl-evt--ws";
      else if (ev.pointType === "wrapper-end") evtCls += " wpj-tl-evt--we";

      var dotCls = "wpj-tl-dot ";
      var dotStyle = "";
      if (ev.pointType === "wrapper-start") {
        dotCls += "wpj-tl-dot--ws";
      } else if (ev.pointType === "wrapper-end") {
        dotCls += "wpj-tl-dot--we";
      } else if (accentColor) {
        dotCls += "wpj-tl-dot--job";
        dotStyle = "background:" + accentColor + ";";
      } else {
        dotCls += "wpj-tl-dot--project";
      }

      var lContent =
        '<div class="wpj-tl-ename">' + esc(ev.name) + '</div>' +
        '<div class="wpj-tl-edate">' + esc(formatDateTime(ev.dateTime)) + '</div>' +
        '<div class="wpj-tl-fkey">' + esc(ev.fieldKey) + '</div>';

      html += '<div class="' + evtCls + '" style="left:' + lp + '%">' +
        '<div class="wpj-tl-above">' + (above ? lContent : '') + '</div>' +
        '<div class="' + dotCls + '" style="' + dotStyle + '"></div>' +
        '<div class="wpj-tl-below">' + (!above ? lContent : '') + '</div>' +
      '</div>';
    }

    html += '</div></div>';
    return html;
  }

  function buildDepartmentReadiness(rows) {
    var html = '<div class="wpj-deptmatrix">' +
      '<div class="wpj-deptmatrix-bar">Department Readiness</div>' +
      '<div class="wpj-deptmatrix-cols">';

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var score = row.score;
      var scoreClass = getScoreClass(score);
      var hasWork = row.total > 0;
      var milestones = row.milestones || [];

      var pctLabel = row.total === 0 ? "—" : (row.score > 0 || row.complete > 0 ? score + "%" : "Pending");
      html += '<details class="wpj-dcol">' +
        '<summary class="wpj-dcol-hdr">' +
          '<div class="wpj-dcol-name">' + esc(row.department) + '</div>' +
          '<div class="wpj-dcol-pct ' + (row.total > 0 ? scoreClass : "wpj-score-none") + '">' + esc(pctLabel) + '</div>' +
          '<div class="wpj-dcol-bar"><div class="wpj-dcol-fill ' + scoreClass + '" style="width:' + score + '%"></div></div>' +
        '</summary>';

      if (milestones.length) {
        html += '<ul class="wpj-dcol-body">';
        for (var m = 0; m < milestones.length; m++) {
          var ms = milestones[m];
          var status = normaliseStatus(ms.status);
          var statusCls = cssClass(status);
          var dateDisplay = ms.actualDateTime ? formatDateTime(ms.actualDateTime) :
                            ms.plannedDateTime ? formatDateTime(ms.plannedDateTime) : null;
          html += '<li class="wpj-dcol-row wpj-dcol-row--' + statusCls + '">' +
            '<span class="wpj-dcol-mname">' + esc(ms.name) + '</span>' +
            '<span class="wpj-dcol-mdate' + (dateDisplay ? '' : ' wpj-dcol-mdate--unset') + '">' +
              esc(dateDisplay || 'Not scheduled') +
            '</span>' +
          '</li>';
        }
        html += '</ul>';
      } else {
        html += '<div class="wpj-dcol-none">No milestones assigned</div>';
      }

      html += '</details>';
    }

    html += '</div></div>';
    return html;
  }

  function buildDiagnosticPanel() {
    var cachedProj = state.cachedProjectData || null;
    var jobRows = getProjectJobRows();
    var firstJob = jobRows && jobRows.length ? jobRows[0] : null;
    var cachedJobCount = state.cachedJobRows ? state.cachedJobRows.length : 0;
    var projectId = getCurrentProjectId();

    function dumpObj(obj) {
      var lines = [];
      for (var k in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
        var v = obj[k];
        if (v && typeof v === "object") {
          lines.push(k + ": " + JSON.stringify(v).substr(0, 160));
        } else if (v != null && v !== "") {
          lines.push(k + ": " + asText(v).substr(0, 120));
        }
      }
      return lines.join("\n") || "(empty)";
    }

    // Scan window for anything that looks like project data
    var windowMatches = [];
    var scanNames = ["project", "proj", "project_data", "projectData", "currentProject",
                     "hp", "hirehop", "hp_project", "hirehop_project", "project_info",
                     "projectInfo", "page_data", "pageData", "app", "appData", "data",
                     "record", "mainRecord", "main_record", "entity", "model"];
    for (var si = 0; si < scanNames.length; si++) {
      try {
        var wv = window[scanNames[si]];
        if (wv && typeof wv === "object" && !$.isArray(wv) && !isFileRecord(wv)) {
          var hasDate = !!(wv.DATE || wv.date || wv.DATE_END || wv.DATE_OUT ||
                           wv.START_DATETIME || wv.start_datetime || wv.DATETIME);
          var hasName = !!(wv.NAME || wv.name || wv.TITLE || wv.title);
          if (hasDate || hasName) windowMatches.push(scanNames[si]);
        }
      } catch (e) {}
    }
    // Also scan by project ID match
    if (projectId) {
      for (var wk in window) {
        try {
          var wo = window[wk];
          if (!wo || typeof wo !== "object" || $.isArray(wo)) continue;
          if (isFileRecord(wo)) continue;
          var wid = asText(wo.ID || wo.id || wo.PROJECT_ID || wo.project_id).trim();
          if (wid === asText(projectId).trim() && windowMatches.indexOf(wk) === -1) {
            windowMatches.push(wk + " [ID match]");
          }
        } catch (e) {}
      }
    }

    // Dump #proj_info inputs
    var projInfoLines = [];
    var $info = $("#proj_info").first();
    if ($info.length) {
      $info.find("input,select,textarea").each(function() {
        var $f = $(this);
        var val = asText($f.val()).trim();
        if (!val) return;
        var id = $f.attr("id") || "";
        var name = $f.attr("name") || "";
        var dataField = $f.attr("data-field") || $f.attr("data-name") || "";
        var label = $('label[for="' + id + '"]').first().text().trim() ||
                    $f.closest("td,th,div,li").find("label,b,strong").first().text().trim() || "";
        projInfoLines.push(
          "[" + (id || name || dataField || "?") + "]" +
          (label ? " (" + label + ")" : "") +
          " = " + val
        );
      });
    }

    var html = '<details class="wpj-diag">' +
      '<summary class="wpj-diag-hdr">Field Mapping Diagnostic (Project ID: ' + (projectId || "unknown") + ')</summary>' +
      '<div class="wpj-diag-body">';

    // Window variable scan
    html += '<div class="wpj-diag-sec">' +
      '<div class="wpj-diag-sec-title">Window variables with project-like data</div>';
    if (windowMatches.length) {
      html += '<pre class="wpj-diag-pre">' + esc(windowMatches.join("\n")) + '</pre>';
      for (var wi = 0; wi < windowMatches.length; wi++) {
        var wname = windowMatches[wi].replace(" [ID match]", "");
        try {
          html += '<pre class="wpj-diag-pre" style="margin-top:4px">' + esc("window." + wname + ":\n" + dumpObj(window[wname])) + '</pre>';
        } catch(e) {}
      }
    } else {
      html += '<div class="wpj-diag-note">No matching window variables found. Project data may only exist in DOM form fields or an uncaptured AJAX response.</div>';
    }
    html += '</div>';

    // #proj_info form inputs
    html += '<div class="wpj-diag-sec">' +
      '<div class="wpj-diag-sec-title">#proj_info form inputs (' + projInfoLines.length + ' with values)</div>';
    if (projInfoLines.length) {
      html += '<pre class="wpj-diag-pre">' + esc(projInfoLines.join("\n")) + '</pre>';
    } else {
      html += '<div class="wpj-diag-note">#proj_info not found or has no inputs with values.</div>';
    }
    html += '</div>';

    // AJAX cached project data
    html += '<div class="wpj-diag-sec">' +
      '<div class="wpj-diag-sec-title">AJAX-cached project data (' + (cachedProj ? Object.keys(cachedProj).length + " keys" : "not yet captured") + ')</div>';
    if (cachedProj) {
      html += '<pre class="wpj-diag-pre">' + esc(dumpObj(cachedProj)) + '</pre>';
    } else {
      html += '<div class="wpj-diag-note">No project AJAX response captured yet. Navigate away from and back to this project to trigger a fresh load.</div>';
    }
    html += '</div>';

    // Job rows
    html += '<div class="wpj-diag-sec">' +
      '<div class="wpj-diag-sec-title">Job rows (' + jobRows.length + ' valid, ' + cachedJobCount + ' from AJAX cache)</div>';
    if (firstJob) {
      html += '<pre class="wpj-diag-pre">' + esc(dumpObj(firstJob)) + '</pre>';
    } else {
      html += '<div class="wpj-diag-note">No valid job rows. Open the Jobs tab on this project then return here.</div>';
    }
    html += '</div>';

    html += '</div></details>';
    return html;
  }

  function buildStatusChip(status) {
    status = normaliseStatus(status);
    return '<span class="wpj-chip wpj-chip-' + cssClass(status) + '">' + esc(status) + '</span>';
  }

  function getOperationalMilestones(milestones) {
    var out = [];
    for (var i = 0; i < milestones.length; i++) {
      if (normaliseComparable(milestones[i].group) === "event wrapper") continue;
      out.push(milestones[i]);
    }
    return out;
  }

  function filterCriticalMilestones(milestones) {
    var out = [];
    for (var i = 0; i < milestones.length; i++) {
      if (milestones[i].criticalPath) out.push(milestones[i]);
    }
    return out;
  }

  function groupMilestones(milestones) {
    var order = [
      "Pre-Production",
      "Supplier / Kit Prep",
      "Load / Transport",
      "Site Arrival",
      "Build",
      "Show",
      "Derig",
      "Site Clear"
    ];
    var map = {};
    var groups = [];

    for (var i = 0; i < order.length; i++) {
      map[order[i]] = { group: order[i], items: [] };
      groups.push(map[order[i]]);
    }

    for (var m = 0; m < milestones.length; m++) {
      var groupName = milestones[m].group || "Operational Journey";
      if (!map[groupName]) {
        map[groupName] = { group: groupName, items: [] };
        groups.push(map[groupName]);
      }
      map[groupName].items.push(milestones[m]);
    }

    var out = [];
    for (var g = 0; g < groups.length; g++) {
      if (groups[g].items.length) out.push(groups[g]);
    }
    return out;
  }

  function hasMeaningfulProjectData(data) {
    if (!data || typeof data !== "object") return false;
    return !!(data.wiseEventStart || data.wiseEventEnd || data.jobKitBookingStart || data.jobKitBookingEnd ||
      (data.projectSystemDates && (data.projectSystemDates.startDateTime || data.projectSystemDates.projectEndDateTime)));
  }

  function getMockJourneyData() {
    return {
      isMock: true,
      project: {
        id: "12345",
        name: "Sample Awards Dinner",
        clientName: "Acme Events",
        venue: "Roundhouse"
      },
      projectSystemDates: {
        outgoingDateTime: "2026-07-14T05:00:00",
        startDateTime: "2026-07-14T08:00:00",
        projectEndDateTime: "2026-07-15T02:00:00",
        returnDateTime: "2026-07-15T10:00:00"
      },
      wiseEventStart: "2026-07-14T08:00:00",
      wiseEventEnd: "2026-07-15T02:00:00",
      hireHopFixedDates: [
        {
          label: "Start Date Time",
          friendlyLabel: "Project/Onsite Start",
          dateTime: "2026-07-14T08:00:00",
          note: "Wise responsibility/activity starts on site."
        },
        {
          label: "Project End Date Time",
          friendlyLabel: "Project/Onsite End",
          dateTime: "2026-07-15T02:00:00",
          note: "Wise responsibility/activity ends on site."
        }
      ],
      jobKitBookingStart: "",
      jobKitBookingEnd: "",
      milestones: [
        {
          id: "pre-production",
          group: "Pre-Production",
          name: "Final production brief approved",
          plannedDateTime: "2026-07-10T15:00:00",
          actualDateTime: "2026-07-10T14:20:00",
          owner: "Project Management",
          status: "Complete",
          riskLevel: "None",
          criticalPath: true,
          timingType: "offsite-prep",
          dependencies: [],
          notes: "Signed off by PM and production."
        },
        {
          id: "supplier-delivery",
          group: "Supplier / Kit Prep",
          name: "Supplier delivery time confirmed",
          plannedDateTime: "",
          actualDateTime: "",
          owner: "Suppliers",
          status: "Missing",
          riskLevel: "Missing",
          criticalPath: true,
          timingType: "offsite-prep",
          dependencies: ["pre-production"],
          notes: "Waiting for supplier confirmation."
        },
        {
          id: "kit-prep",
          group: "Supplier / Kit Prep",
          name: "Kit picked and prepped",
          plannedDateTime: "2026-07-13T14:00:00",
          actualDateTime: "",
          owner: "Kit / Warehouse",
          status: "In Progress",
          riskLevel: "None",
          criticalPath: true,
          timingType: "offsite-prep",
          dependencies: ["pre-production"],
          notes: "Warehouse prep underway."
        },
        {
          id: "crew-call",
          group: "Load / Transport",
          name: "Crew call",
          plannedDateTime: "2026-07-14T09:00:00",
          actualDateTime: "",
          owner: "Crew & Logistics",
          status: "At Risk",
          riskLevel: "At Risk",
          criticalPath: true,
          timingType: "onsite",
          dependencies: ["kit-prep"],
          notes: "Call time currently sits after the first build activity."
        },
        {
          id: "load",
          group: "Load / Transport",
          name: "Vehicle allocated and loaded",
          plannedDateTime: "2026-07-14T05:00:00",
          actualDateTime: "",
          owner: "Crew & Logistics",
          status: "Not Started",
          riskLevel: "None",
          criticalPath: true,
          timingType: "offsite-prep",
          dependencies: ["kit-prep"],
          notes: "Vehicle allocation needs final confirmation."
        },
        {
          id: "site-arrival",
          group: "Site Arrival",
          name: "Site arrival",
          plannedDateTime: "2026-07-14T08:00:00",
          actualDateTime: "",
          owner: "Crew & Logistics",
          status: "Not Started",
          riskLevel: "None",
          criticalPath: true,
          timingType: "onsite",
          dependencies: ["load"],
          notes: "Aligned with Project/Onsite Start."
        },
        {
          id: "build-start",
          group: "Install",
          name: "Install start",
          plannedDateTime: "2026-07-14T08:30:00",
          actualDateTime: "",
          owner: "Production",
          status: "Not Started",
          riskLevel: "None",
          criticalPath: true,
          timingType: "onsite",
          dependencies: ["site-arrival"],
          notes: "Main room build."
        },
        {
          id: "show-start",
          group: "Show",
          name: "Show start",
          plannedDateTime: "2026-07-14T19:00:00",
          actualDateTime: "",
          owner: "Technical",
          status: "Not Started",
          riskLevel: "None",
          criticalPath: true,
          timingType: "onsite",
          dependencies: ["build-start"],
          notes: "Doors at 18:30."
        },
        {
          id: "show-end",
          group: "Show",
          name: "Show end",
          plannedDateTime: "2026-07-15T00:30:00",
          actualDateTime: "",
          owner: "Technical",
          status: "Not Started",
          riskLevel: "None",
          criticalPath: true,
          timingType: "onsite",
          dependencies: ["show-start"],
          notes: "Awards wrap."
        },
        {
          id: "derig-start",
          group: "Derig",
          name: "Derig start",
          plannedDateTime: "2026-07-15T00:15:00",
          actualDateTime: "",
          owner: "Production",
          status: "At Risk",
          riskLevel: "At Risk",
          criticalPath: true,
          timingType: "onsite",
          dependencies: ["show-end"],
          notes: "Currently overlaps show end."
        },
        {
          id: "site-clear",
          group: "Site Clear",
          name: "Site clear",
          plannedDateTime: "2026-07-15T03:30:00",
          actualDateTime: "",
          owner: "Crew & Logistics",
          status: "At Risk",
          riskLevel: "At Risk",
          criticalPath: true,
          timingType: "onsite",
          dependencies: ["derig-start"],
          notes: "Planned clear is beyond the HireHop project wrapper."
        }
      ]
    };
  }

  function createIssue(severity, title, message, milestoneId, critical) {
    return {
      severity: severity,
      title: title,
      message: message,
      milestoneId: milestoneId || "",
      critical: !!critical
    };
  }

  function sortIssues(issues) {
    return issues.sort(function (a, b) {
      var priority = (ISSUE_PRIORITY[a.severity] || 99) - (ISSUE_PRIORITY[b.severity] || 99);
      if (priority !== 0) return priority;
      if (a.critical !== b.critical) return a.critical ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
  }

  function dedupeIssues(issues) {
    var seen = {};
    var out = [];
    for (var i = 0; i < issues.length; i++) {
      var key = issues[i].severity + "|" + issues[i].title + "|" + issues[i].milestoneId;
      if (seen[key]) continue;
      seen[key] = true;
      out.push(issues[i]);
    }
    return out;
  }

  function indexMilestonesById(milestones) {
    var out = {};
    for (var i = 0; i < milestones.length; i++) {
      out[milestones[i].id] = milestones[i];
    }
    return out;
  }

  function compareMilestoneTimes(left, right) {
    var leftDate = parseDate(left && left.plannedDateTime);
    var rightDate = parseDate(right && right.plannedDateTime);
    if (!leftDate || !rightDate) return 0;
    return leftDate.getTime() - rightDate.getTime();
  }

  function isSupplierMilestone(milestone) {
    var text = normaliseComparable([milestone.group, milestone.owner, milestone.name].join(" "));
    return text.indexOf("supplier") !== -1;
  }

  function isOperationalOnsite(milestone) {
    if (!milestone || milestone.allowOutsideWrapper) return false;
    var timingType = normaliseComparable(milestone.timingType);
    if (timingType === "offsite-prep" || timingType === "offsite" || timingType === "prep") return false;
    if (timingType === "onsite") return true;

    var group = normaliseComparable(milestone.group);
    if (group === "pre production" || group === "supplier kit prep" || group === "load transport") return false;
    return true;
  }

  function calculateIssuePenalty(issues) {
    var penalty = 0;
    for (var i = 0; i < issues.length; i++) {
      penalty += getIssuePenalty(issues[i]);
    }
    return Math.min(65, penalty);
  }

  function getIssuePenalty(issue) {
    var base = 0;
    if (issue.severity === "Blocked") base = 12;
    else if (issue.severity === "At Risk") base = 8;
    else if (issue.severity === "Missing Data") base = 5;
    else base = 2;
    return issue.critical ? base * 1.35 : base;
  }

  function getStatusScore(status) {
    status = normaliseStatus(status);
    if (status === "Complete") return 1;
    if (status === "In Progress") return 0.68;
    if (status === "Not Started") return 0.35;
    if (status === "At Risk") return 0.22;
    if (status === "Missing") return 0.08;
    if (status === "Blocked") return 0;
    return 0.2;
  }

  function averageStatusScore(milestones) {
    var weighted = 0;
    var possible = 0;
    for (var i = 0; i < milestones.length; i++) {
      var weight = milestones[i].criticalPath ? 1.6 : 1;
      possible += weight;
      weighted += weight * getStatusScore(milestones[i].status);
    }
    return possible ? (weighted / possible) * 100 : 0;
  }

  function countMilestonesByStatus(milestones, status) {
    var count = 0;
    for (var i = 0; i < milestones.length; i++) {
      if (normaliseStatus(milestones[i].status) === status) count++;
    }
    return count;
  }

  function findMilestoneById(milestones, id) {
    for (var i = 0; i < milestones.length; i++) {
      if (milestones[i].id === id) return milestones[i];
    }
    return null;
  }

  function readProjectInfoField(labels) {
    var $info = $("#proj_info").first();
    if (!$info.length) return "";

    var labelLookup = {};
    for (var i = 0; i < labels.length; i++) {
      labelLookup[normaliseComparable(labels[i])] = true;
    }

    var value = readProjectInfoControlField($info, labelLookup);
    if (value) return value;

    $info.find("tr").each(function () {
      if (value) return false;
      var $row = $(this);
      var text = normaliseComparable($row.text());
      if (!matchesProjectInfoLabel(text, labelLookup)) return;

      value = readValueFromRow($row);
      return false;
    });

    return value;
  }

  function readProjectInfoDateTimeField(labels) {
    var $info = $("#proj_info").first();
    if (!$info.length) return "";

    var labelLookup = {};
    for (var i = 0; i < labels.length; i++) {
      labelLookup[normaliseComparable(labels[i])] = true;
    }

    var value = readProjectInfoDateTimeControlField($info, labelLookup);
    if (value) return value;

    $info.find("tr,.field-row,.form-row,.row,.ui-helper-clearfix,li").each(function () {
      if (value) return false;
      var $scope = $(this);
      var text = normaliseComparable(getElementTextWithControlMeta($scope));
      if (!matchesProjectInfoLabel(text, labelLookup)) return;

      value = readDateTimeFromScope($scope) || readValueFromRow($scope);
      return false;
    });

    return value;
  }

  function readProjectInfoDateTimeControlField($info, labelLookup) {
    var value = "";

    $info.find("input,textarea,select").each(function () {
      if (value) return false;
      var $field = $(this);
      if (!asText($field.val()).trim()) return;

      var text = getProjectInfoControlText($field);
      if (!matchesProjectInfoLabel(text, labelLookup)) return;

      value = readDateTimeForControl($field);
      return false;
    });

    return value;
  }

  function readDateTimeForControl($field) {
    var value = asText($field.val()).trim();
    if (!value) return "";
    if (dateValueHasDateAndTime(value)) return value;

    // Try progressively wider scopes — HireHop often puts date/time in adjacent cells
    var scopes = [
      $field.closest("td,th"),
      $field.parent(),
      $field.closest("tr"),
      $field.closest(".field-row,.form-row,.row,.ui-helper-clearfix,li,.form-group"),
      $field.closest("tr").parent().closest("tr"),  // parent row of a nested table
      $field.closest("table")
    ];

    for (var i = 0; i < scopes.length; i++) {
      var combined = readDateTimeFromScope(scopes[i], value);
      if (combined && combined !== value) return combined;
    }

    return value;
  }

  function readDateTimeFromScope($scope, preferredValue) {
    if (!$scope || !$scope.length) return "";

    var values = [];
    $scope.find("input,textarea,select").each(function () {
      var value = asText($(this).val()).trim();
      if (value) values.push(value);
    });

    var text = compactText($scope.clone().children("input,textarea,select,script,style").remove().end().text());
    if (text) values.push(text);
    if (preferredValue) values.unshift(preferredValue);

    return combineDateTimeValues(values);
  }

  function combineDateTimeValues(values) {
    var full = "";
    var date = "";
    var time = "";

    for (var i = 0; i < values.length; i++) {
      var value = asText(values[i]).trim();
      if (!value) continue;

      if (!full && dateValueHasDateAndTime(value)) full = value;
      if (!date) date = extractDatePart(value);
      if (!time) time = extractTimePart(value);
    }

    if (date && time) return date + " " + time;
    return full || "";
  }

  function dateValueHasDateAndTime(value) {
    return !!(extractDatePart(value) && extractTimePart(value));
  }

  function extractDatePart(value) {
    var text = asText(value);
    var iso = text.match(/\b\d{4}-\d{1,2}-\d{1,2}\b/);
    if (iso) return iso[0];
    var uk = text.match(/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/);
    if (uk) return uk[0];
    var named = text.match(/\b\d{1,2}\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{2,4}\b/i);
    if (named) return compactText(named[0]);
    var namedUs = text.match(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},?\s+\d{2,4}\b/i);
    return namedUs ? compactText(namedUs[0]) : "";
  }

  function extractTimePart(value) {
    var text = asText(value);
    var match = text.match(/\b([01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?(?:\s*[ap]m)?\b/i) ||
      text.match(/\b(1[0-2]|0?[1-9])\s*[ap]m\b/i);
    return match ? compactText(match[0]) : "";
  }

  function readProjectInfoControlField($info, labelLookup) {
    var value = "";

    $info.find("input,textarea,select").each(function () {
      if (value) return false;
      var $field = $(this);
      if (!asText($field.val()).trim()) return;

      var text = getProjectInfoControlText($field);
      if (!matchesProjectInfoLabel(text, labelLookup)) return;

      value = asText($field.val()).trim();
      return false;
    });

    return value;
  }

  function getProjectInfoControlText($field) {
    var bits = [
      $field.attr("id"),
      $field.attr("name"),
      $field.attr("title"),
      $field.attr("aria-label"),
      $field.attr("placeholder"),
      $field.attr("data-label"),
      $field.attr("data-name"),
      $field.attr("data-field")
    ];

    var id = $field.attr("id");
    if (id) {
      try {
        bits.push($('label[for="' + cssAttr(id) + '"]').first().text());
      } catch (err) {}
    }

    bits.push($field.closest("td,th,.field-row,.form-row,.row,.ui-helper-clearfix,li").find("label,b,strong,span").first().text());
    return normaliseComparable(bits.join(" "));
  }

  function getElementTextWithControlMeta($element) {
    var bits = [
      $element.text(),
      $element.attr("id"),
      $element.attr("name"),
      $element.attr("title"),
      $element.attr("aria-label")
    ];

    $element.find("input,textarea,select,[title],[aria-label],[data-label],[data-field],[data-name]").each(function () {
      var $field = $(this);
      bits.push(
        $field.attr("id"),
        $field.attr("name"),
        $field.attr("title"),
        $field.attr("aria-label"),
        $field.attr("placeholder"),
        $field.attr("data-label"),
        $field.attr("data-name"),
        $field.attr("data-field")
      );
    });

    return bits.join(" ");
  }

  function matchesProjectInfoLabel(text, labelLookup) {
    text = normaliseComparable(text);
    if (!text) return false;

    for (var key in labelLookup) {
      if (!Object.prototype.hasOwnProperty.call(labelLookup, key) || !key) continue;
      if (text === key || text.indexOf(key) !== -1) return true;
    }

    return false;
  }

  function readValueFromRow($row) {
    var control = $row.find("input,textarea,select").filter(function () {
      return !!asText($(this).val()).trim();
    }).last();
    if (control.length) return asText(control.val()).trim();

    var cells = $row.children("td,th");
    if (cells.length > 1) {
      var text = compactText(cells.last().text());
      if (text) return text;
    }

    return "";
  }

  function getCurrentProjectId() {
    var href = asText(window.location && window.location.href);
    var match = href.match(/[?&](?:project|project_id|main_id|id)=(\d+)/i) || href.match(/\/project\/(\d+)/i) || href.match(/\/projects\/(\d+)/i);
    if (match && match[1]) return match[1];

    var selectors = ['input[name="project"]', 'input[name="project_id"]', 'input[name="main_id"]', 'input[name="id"]', "#project_id", "#main_id"];
    for (var i = 0; i < selectors.length; i++) {
      var value = $.trim(asText($(selectors[i]).first().val()));
      if (/^\d+$/.test(value)) return value;
    }

    if (window.project_id && /^\d+$/.test(asText(window.project_id))) return asText(window.project_id);
    if (window.project && typeof window.project === "object") {
      var id = window.project.ID || window.project.id || window.project.PROJECT_ID || window.project.project_id;
      if (/^\d+$/.test(asText(id))) return asText(id);
    }

    return "";
  }

  function getTabLabels($host) {
    var out = {};
    getCandidateTabs($host).each(function () {
      var label = normaliseSearch(getTabText($(this)));
      if (label) out[label] = true;
    });
    return out;
  }

  function getCandidateTabs($host) {
    return $host.children("li,[role='tab']").not('[data-wise-project-journey-tab="1"]');
  }

  function findTabsByLabels($host, labels) {
    return getCandidateTabs($host).filter(function () {
      var tabLabel = normaliseSearch(getTabText($(this)));
      for (var i = 0; i < labels.length; i++) {
        if (tabLabel === normaliseSearch(labels[i])) return true;
      }
      return false;
    });
  }

  function findFirstTabByLabels($host, labels) {
    return findTabsByLabels($host, labels).first();
  }

  function findTabTemplate($host) {
    var labels = ["files", "notes", "tasks", "schedule", "emails", "project details"];
    for (var i = 0; i < labels.length; i++) {
      var $match = findTabsByLabels($host, [labels[i]]).filter(":visible").last();
      if ($match.length) return $match;
    }
    return getCandidateTabs($host).filter(":visible").last();
  }

  function getTabsContainer($host) {
    var $container = $host.closest(".ui-tabs,.hh-framework_tabs,#tabs");
    if ($container.length) return $container.first();
    return $host.parent();
  }

  function getPanelClass($host) {
    var $sample = getTabsContainer($host).children(".ui-tabs-panel,[role='tabpanel']").first();
    var className = $sample.attr("class") || "";
    return normalisePanelClass(className + " wise-project-journey-panel");
  }

  function normalisePanelClass(value) {
    var text = asText(value) || "ui-tabs-panel wise-project-journey-panel";
    if (text.indexOf("wise-project-journey-panel") === -1) text += " wise-project-journey-panel";
    return text;
  }

  function resetPanelLayout($panel) {
    if (!$panel || !$panel.length) return;
    $panel.css({
      position: "",
      top: "",
      left: "",
      right: "",
      bottom: "",
      zIndex: "",
      overflow: ""
    });
  }

  function getTemplateSignature($sampleTab) {
    if (!$sampleTab || !$sampleTab.length) return "none";
    var $anchor = $sampleTab.children("a").first();
    return [
      normaliseTabClass($sampleTab.attr("class") || ""),
      $sampleTab.attr("role") || "",
      $sampleTab.attr("style") || "",
      $anchor.attr("class") || "",
      $anchor.attr("style") || ""
    ].join("::");
  }

  function getTabText($tab) {
    var $anchor = $tab.children("a").first();
    return $.trim(asText($anchor.length ? $anchor.text() : $tab.text()));
  }

  function normaliseTabClass(value) {
    var text = asText(value) || "ui-state-default ui-corner-top ui-tabs-tab ui-tab";
    var remove = {
      "ui-tabs-active": true,
      "ui-state-active": true,
      "ui-state-focus": true,
      "ui-state-hover": true,
      "ui-tabs-loading": true
    };
    var parts = text.split(/\s+/);
    var kept = [];
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i] || remove[parts[i]]) continue;
      kept.push(parts[i]);
    }
    if (kept.indexOf("ui-state-default") === -1) kept.push("ui-state-default");
    if (kept.indexOf("ui-corner-top") === -1) kept.push("ui-corner-top");
    return kept.join(" ");
  }

  function copyComputedStyle(source, target, props) {
    if (!source || !target || !window.getComputedStyle) return;

    var computed;
    try { computed = window.getComputedStyle(source); } catch (err) { computed = null; }
    if (!computed) return;

    for (var i = 0; i < props.length; i++) {
      var prop = props[i];
      var value = computed[prop];
      if (!value || value === "auto" || (value === "normal" && prop !== "lineHeight")) continue;
      try { target.style[prop] = value; } catch (e) {}
    }
  }

  function installStyles() {
    if ($("#" + CFG.stylesId).length) return;

    var css = [
      /* ---- HireHop tab wiring ---- */
      ".wise-project-journey-panel{box-sizing:border-box;background:#f0f2f8!important;scrollbar-gutter:stable;}",
      ".wise-journey-active>.ui-tabs-panel:not([data-wise-project-journey-panel]),.wise-journey-active>[role='tabpanel']:not([data-wise-project-journey-panel]){display:none!important;}",
      ".wise-journey-active>[data-wise-project-journey-panel='1']{display:block!important;}",
      '[data-wise-project-journey-tab="1"].is-wise-journey-active{background:#0369a1!important;border-color:#0369a1!important;}',
      '[data-wise-project-journey-tab="1"].is-wise-journey-active>a{color:#fff!important;}',
      /* ---- Shell ---- */
      ".wpj-shell{box-sizing:border-box;padding:8px;font-family:inherit;color:#0f172a;background:#f0f2f8;}",
      ".wpj-shell *{box-sizing:border-box;}",
      /* ---- Header ---- */
      ".wpj-hdr{display:flex;align-items:center;gap:14px;background:#fff;border-radius:8px;padding:12px 16px;margin-bottom:8px;border:1px solid #e2e8ef;}",
      ".wpj-hdr-main{flex:1 1 0;min-width:0;}",
      ".wpj-hdr-kicker{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:3px;font-weight:700;}",
      ".wpj-hdr h2{margin:0 0 2px;font-size:18px;font-weight:800;color:#0f172a;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      ".wpj-hdr-meta{font-size:12px;color:#64748b;}",
      ".wpj-hdr-aside{display:flex;align-items:center;gap:14px;flex-shrink:0;}",
      ".wpj-badge{display:inline-flex;align-items:center;padding:4px 11px;border-radius:12px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;}",
      ".wpj-badge--ready{background:#dcfce7;color:#15803d;}",
      ".wpj-badge--in-progress{background:#dbeafe;color:#1d4ed8;}",
      ".wpj-badge--not-started{background:#f1f5f9;color:#475569;}",
      ".wpj-badge--at-risk{background:#fef3c7;color:#b45309;}",
      ".wpj-badge--blocked,.wpj-badge--missing{background:#fee2e2;color:#dc2626;}",
      ".wpj-readiness{text-align:right;}",
      ".wpj-readiness-pct{font-size:22px;font-weight:800;line-height:1;}",
      ".wpj-score-good{color:#16a34a;}",
      ".wpj-score-mid{color:#d97706;}",
      ".wpj-score-bad{color:#dc2626;}",
      ".wpj-score-none{color:#cbd5e1;}",
      ".wpj-readiness-track{height:5px;border-radius:3px;background:#e2e8ef;width:110px;margin:5px 0 3px;}",
      ".wpj-readiness-fill{height:100%;border-radius:3px;background:#3b82f6;min-width:0;}",
      ".wpj-readiness-fill.wpj-score-good{background:#22c55e;}",
      ".wpj-readiness-fill.wpj-score-mid{background:#f59e0b;}",
      ".wpj-readiness-fill.wpj-score-bad{background:#ef4444;}",
      ".wpj-readiness-label{font-size:10px;color:#94a3b8;}",
      /* ---- Issues bar ---- */
      ".wpj-alerts{margin-bottom:8px;border-radius:8px;overflow:hidden;border:1px solid #fca5a5;}",
      ".wpj-alerts--risk{border-color:#fcd34d;}",
      ".wpj-alerts summary{display:flex;align-items:center;gap:8px;padding:9px 14px;background:#fee2e2;cursor:pointer;list-style:none;user-select:none;}",
      ".wpj-alerts--risk summary{background:#fef9c3;}",
      ".wpj-alerts summary::-webkit-details-marker{display:none;}",
      ".wpj-alerts-icon{font-size:13px;}",
      ".wpj-alerts-text{flex:1 1 0;font-size:12px;font-weight:700;color:#dc2626;}",
      ".wpj-alerts--risk .wpj-alerts-text{color:#b45309;}",
      ".wpj-alerts-caret{font-size:11px;color:#94a3b8;}",
      ".wpj-alerts-body{display:grid;gap:1px;background:#e2e8ef;}",
      ".wpj-alert{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;padding:9px 14px;background:#fff;}",
      ".wpj-alert-sev{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;padding:2px 7px;border-radius:10px;white-space:nowrap;margin-top:2px;}",
      ".wpj-alert--blocked .wpj-alert-sev{background:#fee2e2;color:#dc2626;}",
      ".wpj-alert--at-risk .wpj-alert-sev{background:#fef3c7;color:#b45309;}",
      ".wpj-alert--missing-data .wpj-alert-sev,.wpj-alert--warning .wpj-alert-sev{background:#f1f5f9;color:#64748b;}",
      ".wpj-alert-content strong{display:block;font-size:12px;color:#0f172a;margin-bottom:1px;}",
      ".wpj-alert-content p{margin:0;font-size:11px;color:#64748b;line-height:1.4;}",
      /* ---- Journey flow ---- */
      ".wpj-flow{background:#fff;border:1px solid #e2e8ef;border-radius:8px;margin-bottom:8px;overflow:hidden;}",
      ".wpj-flow-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e2e8ef;}",
      ".wpj-segmented{display:inline-flex;border:1px solid #e2e8ef;border-radius:6px;overflow:hidden;}",
      ".wpj-segmented button{border:0;background:#fff;color:#64748b;font:inherit;font-size:11px;font-weight:700;padding:5px 11px;cursor:pointer;}",
      ".wpj-segmented button+button{border-left:1px solid #e2e8ef;}",
      ".wpj-segmented button.is-active{background:#0f172a;color:#fff;}",
      ".wpj-refresh-btn{border:1px solid #e2e8ef;border-radius:6px;background:#fff;color:#64748b;font:inherit;font-size:11px;font-weight:700;padding:5px 11px;cursor:pointer;}",
      /* ---- Event timeline ---- */
      ".wpj-tl-scroll{overflow-x:auto;padding:0 0 8px;}",
      ".wpj-tl-grid{min-width:600px;}",
      ".wpj-tl-row{display:flex;align-items:stretch;border-bottom:1px solid #f1f5f9;min-height:110px;}",
      ".wpj-tl-row--project{background:#fafbff;border-bottom:2px solid #e2e8ef;min-height:120px;}",
      ".wpj-tl-row-hdr{width:72px;min-width:72px;flex-shrink:0;display:flex;align-items:center;justify-content:flex-end;padding:0 10px 0 8px;border-right:1px solid #e2e8ef;font-size:10px;font-weight:800;color:#64748b;text-align:right;word-break:break-all;line-height:1.3;}",
      ".wpj-tl-row--project .wpj-tl-row-hdr{color:#374151;font-size:11px;}",
      ".wpj-tl-row-body{flex:1;position:relative;overflow:hidden;}",
      ".wpj-tl-body-line{position:absolute;top:50%;left:0;right:0;height:2px;background:#e2e8ef;transform:translateY(-50%);z-index:0;}",
      ".wpj-tl-evt{position:absolute;top:0;bottom:0;width:90px;display:flex;flex-direction:column;align-items:center;transform:translateX(-50%);z-index:1;}",
      ".wpj-tl-above{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:7px;text-align:center;width:90px;}",
      ".wpj-tl-below{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:7px;text-align:center;width:90px;}",
      ".wpj-tl-dot{width:11px;height:11px;border-radius:50%;border:2px solid #fff;flex-shrink:0;position:relative;z-index:2;}",
      ".wpj-tl-ename{font-size:10px;font-weight:700;color:#1e293b;line-height:1.3;}",
      ".wpj-tl-edate{font-size:9px;color:#94a3b8;margin-top:1px;white-space:nowrap;}",
      ".wpj-tl-fkey{font-size:8px;color:#cbd5e1;font-family:monospace;margin-top:2px;white-space:nowrap;}",
      ".wpj-tl-issue{font-size:9px;font-weight:700;background:#fee2e2;color:#dc2626;padding:1px 4px;border-radius:3px;margin-left:3px;vertical-align:middle;}",
      ".wpj-tl-dot--ws{background:#f97316;width:13px;height:13px;}",
      ".wpj-tl-dot--we{background:#38bdf8;width:13px;height:13px;}",
      ".wpj-tl-dot--project{background:#6366f1;}",
      ".wpj-tl-dot--job{background:#64748b;}",
      ".wpj-tl-evt--ws .wpj-tl-ename{color:#c2410c;font-weight:800;}",
      ".wpj-tl-evt--we .wpj-tl-ename{color:#0284c7;font-weight:800;}",
      /* ---- Unscheduled list ---- */
      ".wpj-gantt-unsched{border-top:1px solid #e2e8ef;margin-top:1px;}",
      ".wpj-gantt-unsched>summary{padding:7px 14px;background:#f8fafc;cursor:pointer;list-style:none;font-size:11px;font-weight:700;color:#64748b;display:block;}",
      ".wpj-gantt-unsched>summary::-webkit-details-marker{display:none;}",
      ".wpj-gantt-unsched-body{padding:2px 0;}",
      ".wpj-gantt-unsched-row{display:flex;align-items:center;justify-content:space-between;padding:7px 14px;border-bottom:1px solid #f8fafc;}",
      /* ---- Status chips ---- */
      ".wpj-chip{display:inline-flex;align-items:center;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;}",
      ".wpj-chip-complete{background:#dcfce7;color:#15803d;}",
      ".wpj-chip-in-progress{background:#dbeafe;color:#1d4ed8;}",
      ".wpj-chip-not-started{background:#f1f5f9;color:#64748b;}",
      ".wpj-chip-at-risk{background:#fef3c7;color:#b45309;}",
      ".wpj-chip-blocked,.wpj-chip-missing{background:#fee2e2;color:#dc2626;}",
      /* ---- Empty state ---- */
      ".wpj-empty-state{padding:24px;text-align:center;color:#94a3b8;font-size:13px;}",
      /* ---- Department matrix ---- */
      ".wpj-deptmatrix{background:#fff;border:1px solid #e2e8ef;border-radius:8px;margin-bottom:8px;overflow:hidden;}",
      ".wpj-deptmatrix-bar{padding:7px 14px;background:#f8fafc;border-bottom:1px solid #e2e8ef;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.6px;color:#374151;}",
      ".wpj-deptmatrix-cols{display:flex;overflow-x:auto;align-items:stretch;}",
      ".wpj-dcol{flex:1 0 130px;min-width:110px;border-right:1px solid #f1f5f9;}",
      ".wpj-dcol:last-child{border-right:0;}",
      ".wpj-dcol summary{list-style:none;cursor:pointer;padding:9px 11px;border-bottom:1px solid #f1f5f9;user-select:none;}",
      ".wpj-dcol summary::-webkit-details-marker{display:none;}",
      ".wpj-dcol[open] summary{background:#f8fafc;}",
      ".wpj-dcol-name{font-size:11px;font-weight:700;color:#374151;margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      ".wpj-dcol-pct{font-size:18px;font-weight:800;line-height:1;margin-bottom:5px;}",
      ".wpj-dcol-bar{height:3px;border-radius:2px;background:#f1f5f9;overflow:hidden;}",
      ".wpj-dcol-fill{height:100%;border-radius:2px;background:#3b82f6;min-width:0;}",
      ".wpj-dcol-fill.wpj-score-good{background:#22c55e;}",
      ".wpj-dcol-fill.wpj-score-mid{background:#f59e0b;}",
      ".wpj-dcol-fill.wpj-score-bad{background:#ef4444;}",
      ".wpj-dcol-body{list-style:none;margin:0;padding:4px 0;}",
      ".wpj-dcol-row{display:flex;flex-direction:column;padding:6px 11px;border-bottom:1px solid #f8fafc;border-left:3px solid transparent;}",
      ".wpj-dcol-row:last-child{border-bottom:0;}",
      ".wpj-dcol-row--complete{border-left-color:#22c55e;}",
      ".wpj-dcol-row--in-progress{border-left-color:#3b82f6;}",
      ".wpj-dcol-row--at-risk{border-left-color:#f59e0b;}",
      ".wpj-dcol-row--blocked,.wpj-dcol-row--missing{border-left-color:#ef4444;}",
      ".wpj-dcol-row--not-started{border-left-color:#e2e8ef;}",
      ".wpj-dcol-mname{font-size:11px;font-weight:600;color:#1e293b;margin-bottom:2px;line-height:1.3;}",
      ".wpj-dcol-mdate{font-size:10px;color:#94a3b8;}",
      ".wpj-dcol-mdate--unset{color:#cbd5e1;font-style:italic;}",
      ".wpj-dcol-row--complete .wpj-dcol-mdate{color:#16a34a;}",
      ".wpj-dcol-row--at-risk .wpj-dcol-mdate{color:#d97706;}",
      ".wpj-dcol-row--blocked .wpj-dcol-mdate,.wpj-dcol-row--missing .wpj-dcol-mdate{color:#dc2626;}",
      ".wpj-dcol-none{padding:10px 11px;font-size:10px;color:#cbd5e1;font-style:italic;}",
      /* ---- Diagnostic panel ---- */
      ".wpj-diag{margin-top:8px;border:1px solid #e2e8ef;border-radius:8px;overflow:hidden;font-size:11px;}",
      ".wpj-diag-hdr{padding:7px 14px;background:#f8fafc;cursor:pointer;list-style:none;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#94a3b8;}",
      ".wpj-diag-hdr::-webkit-details-marker{display:none;}",
      ".wpj-diag-body{padding:10px 14px;display:grid;gap:12px;}",
      ".wpj-diag-sec-title{font-weight:700;color:#374151;margin-bottom:5px;}",
      ".wpj-diag-pre{margin:0;padding:8px 10px;background:#f8fafc;border:1px solid #e2e8ef;border-radius:4px;font-size:10px;line-height:1.5;color:#1e293b;white-space:pre-wrap;word-break:break-all;max-height:220px;overflow-y:auto;}",
      ".wpj-diag-note{font-size:11px;color:#94a3b8;font-style:italic;}",
      /* ---- Responsive ---- */
      "@media(max-width:860px){.wpj-hdr{flex-direction:column;align-items:flex-start;}.wpj-tl-row-hdr{width:52px;min-width:52px;font-size:9px;padding:0 6px;}.wpj-tl-edate,.wpj-tl-fkey{display:none;}.wpj-tl-ename{font-size:9px;}}",
      "@media(max-width:480px){.wpj-shell{padding:5px;}.wpj-segmented button{padding:4px 7px;}}"
    ].join("\n");

    $("<style></style>", { id: CFG.stylesId, text: css }).appendTo("head");
  }

  function normaliseStatus(value) {
    var text = normaliseSearch(value);
    for (var i = 0; i < STATUS_LABELS.length; i++) {
      if (normaliseSearch(STATUS_LABELS[i]) === text) return STATUS_LABELS[i];
    }
    if (text === "done" || text === "completed") return "Complete";
    if (text === "inprogress" || text === "active") return "In Progress";
    if (text === "risk") return "At Risk";
    if (text === "missing data") return "Missing";
    return "Not Started";
  }

  function normaliseRisk(value) {
    var text = normaliseSearch(value);
    if (!text || text === "none" || text === "complete" || text === "completed") return "None";
    if (text === "in progress" || text === "low") return "Low";
    if (text === "not started") return "None";
    if (text === "at risk" || text === "risk" || text === "amber") return "At Risk";
    if (text === "blocked" || text === "red") return "Blocked";
    if (text === "missing" || text === "missing data") return "Missing";
    return value;
  }

  function normaliseTimingType(value) {
    var text = normaliseSearch(value);
    if (text === "offsite prep" || text === "offsite-prep") return "offsite-prep";
    if (text === "offsite") return "offsite";
    if (text === "prep") return "prep";
    if (text === "onsite" || text === "on site") return "onsite";
    if (text === "wrapper" || text === "event wrapper") return "wrapper";
    return text;
  }

  function deriveStatus(planned, actual) {
    if (actual) return "Complete";
    if (!planned) return "Missing";
    return "Not Started";
  }

  function formatDateTime(value) {
    if (!value) return "";
    var date = parseDate(value);
    if (!date) return asText(value);
    return date.toLocaleString(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function parseDate(value) {
    if (!value) return null;
    if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) return value;
    var text = asText(value).trim();
    if (!text) return null;

    // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY — must run before new Date() which assumes MM/DD
    var match = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (match) {
      var year = Number(match[3]);
      if (year < 100) year += 2000;
      var parsed = new Date(year, Number(match[2]) - 1, Number(match[1]), Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0));
      if (!isNaN(parsed.getTime())) return parsed;
    }

    // ISO 8601 and other unambiguous formats safe to pass to Date constructor
    var direct = new Date(text);
    if (!isNaN(direct.getTime())) return direct;

    return null;
  }

  function getScoreClass(score) {
    if (score >= 80) return "wpj-score-good";
    if (score >= 55) return "wpj-score-mid";
    return "wpj-score-bad";
  }

  function cssClass(value) {
    return normaliseSearch(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
  }

  function normaliseId(value) {
    return asText(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function normaliseSearch(value) {
    return asText(value)
      .replace(/\(\s*\d+\s*\)/g, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function normaliseComparable(value) {
    return normaliseSearch(value).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function compactText(value) {
    return asText(value).replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
  }

  function cleanDocumentTitle() {
    return compactText(asText(document.title).replace(/\s*[-|].*$/, ""));
  }

  function normaliseArray(value) {
    if (value == null) return [];
    return $.isArray(value) ? value : [value];
  }

  function asNumber(value, fallback) {
    var number = Number(value);
    return isFinite(number) && number > 0 ? number : fallback;
  }

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i++) {
      var text = asText(values[i]).trim();
      if (text) return text;
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

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function asText(value) {
    return value == null ? "" : String(value);
  }

  function esc(value) {
    return asText(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function cssAttr(value) {
    return asText(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function log() {
    if (!window.console || !window.console.log) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift(LOG_PREFIX);
    window.console.log.apply(window.console, args);
  }

  window.__wiseProjectJourney = {
    version: CFG.version,
    refresh: function () {
      renderJourneyPanel();
      scheduleMaintainProjectJourney(0, { forceScan: true });
    },
    open: function () {
      var $host = findProjectTabsHost();
      if ($host.length) activateJourneyPanel($host);
    },
    setData: function (data) {
      state.overrideData = data && typeof data === "object" ? data : null;
      renderJourneyPanel();
    },
    useMockData: function () {
      state.overrideData = getMockJourneyData();
      renderJourneyPanel();
    },
    getMockData: getMockJourneyData,
    generateIssues: function (data) {
      return generateIssues(normaliseJourneyData(data || getJourneyData(), !!(data && data.isMock)));
    },
    calculateReadiness: function (data) {
      var normalised = normaliseJourneyData(data || getJourneyData(), !!(data && data.isMock));
      return calculateReadiness(normalised, generateIssues(normalised));
    },
    describe: function () {
      var $host = findProjectTabsHost();
      return {
        version: CFG.version,
        projectTabsFound: !!$host.length,
        panelPresent: !!$("#" + CFG.panelId).length,
        criticalOnly: state.showCriticalOnly,
        readiness: state.lastAnalysis && state.lastAnalysis.readiness ? state.lastAnalysis.readiness.score : null,
        issueCount: state.lastAnalysis && state.lastAnalysis.issues ? state.lastAnalysis.issues.length : null
      };
    }
  };
})();
