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
    "Production",
    "Technical",
    "Crew & Logistics",
    "Suppliers",
    "Kit / Warehouse"
  ];

  var CFG = {
    version: "2026-06-24.4",
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
    lastPanelMaxHeight: ""
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
    $(document).on("ajaxComplete.wiseProjectJourney", function () {
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
    var projectWindow = window.project && typeof window.project === "object" ? window.project : {};
    var project = {
      id: getCurrentProjectId(),
      name: firstNonEmpty([
        firstObjectValue(projectWindow, ["NAME", "name", "PROJECT_NAME", "project_name", "TITLE", "title"]),
        readProjectInfoField(["project name", "event name", "name", "title"]),
        cleanDocumentTitle()
      ]),
      clientName: firstNonEmpty([
        firstObjectValue(projectWindow, ["CLIENT_NAME", "client_name", "CLIENT", "client", "CUSTOMER", "customer"]),
        readProjectInfoField(["client", "customer", "account"])
      ]),
      venue: firstNonEmpty([
        firstObjectValue(projectWindow, ["VENUE", "venue", "LOCATION", "location", "SITE", "site"]),
        readProjectInfoField(["venue", "location", "site"])
      ])
    };

    var systemDates = getProjectSystemDates(projectWindow);
    var wiseEventStart = firstNonEmpty([
      systemDates.startDateTime,
      firstObjectValue(projectWindow, ["WISE_EVENT_START", "wise_event_start", "wiseEventStart", "SALESFORCE_START", "salesforce_start", "EVENT_START", "event_start", "PROJECT_START", "project_start"])
    ]);
    var wiseEventEnd = firstNonEmpty([
      systemDates.projectEndDateTime,
      firstObjectValue(projectWindow, ["WISE_EVENT_END", "wise_event_end", "wiseEventEnd", "SALESFORCE_END", "salesforce_end", "EVENT_END", "event_end", "PROJECT_END", "project_end"])
    ]);

    return {
      project: project,
      wiseEventStart: wiseEventStart,
      wiseEventEnd: wiseEventEnd,
      projectSystemDates: systemDates,
      hireHopFixedDates: [
        {
          label: "Start Date Time",
          friendlyLabel: "Project/Onsite Start",
          dateTime: wiseEventStart,
          note: "Wise responsibility/activity starts on site."
        },
        {
          label: "Project End Date Time",
          friendlyLabel: "Project/Onsite End",
          dateTime: wiseEventEnd,
          note: "Wise responsibility/activity ends on site."
        }
      ],
      jobKitBookingStart: "",
      jobKitBookingEnd: "",
      milestones: buildDefaultMilestones(wiseEventStart, wiseEventEnd),
      isMock: false
    };
  }

  function getProjectSystemDates(projectWindow) {
    projectWindow = projectWindow && typeof projectWindow === "object" ? projectWindow : {};

    return {
      outgoingDateTime: firstNonEmpty([
        firstObjectValue(projectWindow, ["OUTGOING_DATE_TIME", "outgoing_date_time", "outgoingDateTime", "OUTGOING", "outgoing", "OUT_DATE_TIME", "out_date_time"]),
        readProjectInfoField(["outgoing date time", "outgoing datetime", "outgoing time"])
      ]),
      startDateTime: firstNonEmpty([
        firstObjectValue(projectWindow, ["START_DATE_TIME", "start_date_time", "startDateTime", "START_DATETIME", "start_datetime", "START", "start", "PROJECT_START_DATE_TIME", "project_start_date_time"]),
        readProjectInfoField(["start date time", "start datetime", "project/onsite start", "project onsite start", "wise event start", "salesforce start", "event start", "project start"])
      ]),
      projectEndDateTime: firstNonEmpty([
        firstObjectValue(projectWindow, ["PROJECT_END_DATE_TIME", "project_end_date_time", "projectEndDateTime", "END_DATE_TIME", "end_date_time", "endDateTime", "PROJECT_END", "project_end", "END", "end"]),
        readProjectInfoField(["project end date time", "project end datetime", "project/onsite end", "project onsite end", "wise event end", "salesforce end", "event end", "project end"])
      ]),
      returnDateTime: firstNonEmpty([
        firstObjectValue(projectWindow, ["RETURN_DATE_TIME", "return_date_time", "returnDateTime", "RETURN_DATETIME", "return_datetime", "RETURN", "return"]),
        readProjectInfoField(["return date time", "return datetime", "return time"])
      ])
    };
  }

  function buildDefaultMilestones(wiseEventStart, wiseEventEnd) {
    return [
      {
        id: "pre-production",
        group: "Pre-Production",
        name: "Pre-production sign-off",
        plannedDateTime: "",
        actualDateTime: "",
        owner: "Project Management",
        status: "Missing",
        riskLevel: "Missing",
        criticalPath: true,
        timingType: "offsite-prep",
        dependencies: [],
        notes: "Map to the agreed production sign-off or final brief field."
      },
      {
        id: "supplier-delivery",
        group: "Supplier / Kit Prep",
        name: "Supplier delivery confirmed",
        plannedDateTime: "",
        actualDateTime: "",
        owner: "Suppliers",
        status: "Missing",
        riskLevel: "Missing",
        criticalPath: true,
        timingType: "offsite-prep",
        dependencies: ["pre-production"],
        notes: "Map supplier delivery or collection timing here."
      },
      {
        id: "kit-prep",
        group: "Supplier / Kit Prep",
        name: "Kit prep complete",
        plannedDateTime: "",
        actualDateTime: "",
        owner: "Kit / Warehouse",
        status: "Missing",
        riskLevel: "Missing",
        criticalPath: true,
        timingType: "offsite-prep",
        dependencies: ["pre-production"],
        notes: "Map from job-level kit prep and return data once available."
      },
      {
        id: "load",
        group: "Load / Transport",
        name: "Vehicle allocated and loaded",
        plannedDateTime: "",
        actualDateTime: "",
        owner: "Crew & Logistics",
        status: "Missing",
        riskLevel: "Missing",
        criticalPath: true,
        timingType: "offsite-prep",
        dependencies: ["kit-prep"],
        notes: "Map vehicle allocation and load timing here."
      },
      {
        id: "site-arrival",
        group: "Site Arrival",
        name: "Site arrival",
        plannedDateTime: wiseEventStart,
        actualDateTime: "",
        owner: "Crew & Logistics",
        status: wiseEventStart ? "Not Started" : "Missing",
        riskLevel: wiseEventStart ? "None" : "Missing",
        criticalPath: true,
        timingType: "onsite",
        dependencies: ["load"],
        notes: "Defaulted from Wise Event Start until a specific site arrival time is mapped."
      },
      {
        id: "build-start",
        group: "Build",
        name: "Build start",
        plannedDateTime: "",
        actualDateTime: "",
        owner: "Production",
        status: "Missing",
        riskLevel: "Missing",
        criticalPath: true,
        timingType: "onsite",
        dependencies: ["site-arrival"],
        notes: "Map build start from job schedule or production plan."
      },
      {
        id: "show-start",
        group: "Show",
        name: "Show start",
        plannedDateTime: "",
        actualDateTime: "",
        owner: "Technical",
        status: "Missing",
        riskLevel: "Missing",
        criticalPath: true,
        timingType: "onsite",
        dependencies: ["build-start"],
        notes: "Map show start from the operational schedule."
      },
      {
        id: "show-end",
        group: "Show",
        name: "Show end",
        plannedDateTime: "",
        actualDateTime: "",
        owner: "Technical",
        status: "Missing",
        riskLevel: "Missing",
        criticalPath: true,
        timingType: "onsite",
        dependencies: ["show-start"],
        notes: "Map show end from the operational schedule."
      },
      {
        id: "derig-start",
        group: "Derig",
        name: "Derig start",
        plannedDateTime: "",
        actualDateTime: "",
        owner: "Production",
        status: "Missing",
        riskLevel: "Missing",
        criticalPath: true,
        timingType: "onsite",
        dependencies: ["show-end"],
        notes: "Map derig start from job schedule."
      },
      {
        id: "site-clear",
        group: "Site Clear",
        name: "Site clear",
        plannedDateTime: wiseEventEnd,
        actualDateTime: "",
        owner: "Crew & Logistics",
        status: wiseEventEnd ? "Not Started" : "Missing",
        riskLevel: wiseEventEnd ? "None" : "Missing",
        criticalPath: true,
        timingType: "onsite",
        dependencies: ["derig-start"],
        notes: "Defaulted from Wise Event End until a specific clear time is mapped."
      }
    ];
  }

  function normaliseJourneyData(raw, isMock) {
    raw = raw || {};
    var project = raw.project && typeof raw.project === "object" ? raw.project : {};
    var systemDates = normaliseProjectSystemDates(raw.projectSystemDates || raw.systemDates || raw);
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
      hireHopFixedDates: normaliseFixedDates(raw.hireHopFixedDates || raw.fixedDates || [], wiseEventStart, wiseEventEnd, systemDates),
      jobKitBookingStart: asText(raw.jobKitBookingStart || raw.kitBookingStart || ""),
      jobKitBookingEnd: asText(raw.jobKitBookingEnd || raw.kitBookingEnd || ""),
      milestones: milestones.length ? milestones : buildDefaultMilestones(wiseEventStart, wiseEventEnd),
      departments: normaliseDepartments(raw.departments || DEPARTMENTS)
    };
  }

  function normaliseProjectSystemDates(value) {
    value = value && typeof value === "object" ? value : {};

    return {
      outgoingDateTime: asText(value.outgoingDateTime || value.outgoing || value.outgoingDate || ""),
      startDateTime: asText(value.startDateTime || value.startDate || value.projectStartDateTime || ""),
      projectEndDateTime: asText(value.projectEndDateTime || value.projectEnd || value.endDateTime || value.endDate || ""),
      returnDateTime: asText(value.returnDateTime || value.return || value.returnDate || "")
    };
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
      out.push({
        label: "Start Date Time",
        friendlyLabel: "Project/Onsite Start",
        dateTime: systemDates && systemDates.startDateTime ? systemDates.startDateTime : wiseEventStart,
        note: "Wise responsibility/activity starts on site."
      });
      out.push({
        label: "Project End Date Time",
        friendlyLabel: "Project/Onsite End",
        dateTime: systemDates && systemDates.projectEndDateTime ? systemDates.projectEndDateTime : wiseEventEnd,
        note: "Wise responsibility/activity ends on site."
      });
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
        dependencies: normaliseDependencies(item.dependencies),
        notes: asText(item.notes || item.note || ""),
        timingType: normaliseTimingType(item.timingType || item.locationType || ""),
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
      issues.push(createIssue("Blocked", "Wise Event Start is missing", "The Salesforce event wrapper start is required before operational dates can be trusted.", "event-wrapper", true));
    }
    if (!wrapperEnd) {
      issues.push(createIssue("Blocked", "Wise Event End is missing", "The Salesforce event wrapper end is required before operational dates can be trusted.", "event-wrapper", true));
    }
    if (wrapperStart && wrapperEnd && wrapperStart.getTime() > wrapperEnd.getTime()) {
      issues.push(createIssue("Blocked", "Wise Event End is before Wise Event Start", "Check the Salesforce wrapper dates before planning operational milestones.", "event-wrapper", true));
    }

    for (var i = 0; i < milestones.length; i++) {
      var milestone = milestones[i];
      var planned = parseDate(milestone.plannedDateTime);

      if (!milestone.plannedDateTime) {
        issues.push(createIssue(milestone.criticalPath ? "Blocked" : "Missing Data", milestone.name + " has no planned datetime", "Add a planned date/time so the milestone can be checked against the wrapper.", milestone.id, milestone.criticalPath));
      }

      if (!milestone.owner) {
        issues.push(createIssue("Missing Data", milestone.name + " has no owner department", "Set the owner so the readiness score can show who needs to act.", milestone.id, milestone.criticalPath));
      }

      if (planned && wrapperStart && isOperationalOnsite(milestone) && planned.getTime() < wrapperStart.getTime()) {
        issues.push(createIssue(milestone.criticalPath ? "At Risk" : "Warning", milestone.name + " is before Wise Event Start", "Onsite operational work sits outside the Salesforce event wrapper.", milestone.id, milestone.criticalPath));
      }

      if (planned && wrapperEnd && isOperationalOnsite(milestone) && planned.getTime() > wrapperEnd.getTime()) {
        issues.push(createIssue(milestone.criticalPath ? "At Risk" : "Warning", milestone.name + " is after Wise Event End", "Onsite operational work extends beyond the Salesforce event wrapper.", milestone.id, milestone.criticalPath));
      }

      if (isSupplierMilestone(milestone) && !milestone.plannedDateTime) {
        issues.push(createIssue("At Risk", "Supplier timing missing", milestone.name + " needs a confirmed supplier timing before the journey is ready.", milestone.id, milestone.criticalPath));
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
        } else if (normaliseStatus(dependency.status) !== "Complete") {
          issues.push(createIssue(milestone.criticalPath ? "At Risk" : "Warning", milestone.name + " depends on incomplete work", dependency.name + " must be complete first.", milestone.id, milestone.criticalPath));
        }
      }
    }

    if (!data.jobKitBookingStart || !data.jobKitBookingEnd) {
      issues.push(createIssue("Missing Data", "Job operational kit timing is missing", "Map job-level prep, return and supplier timings so they are not confused with project wrapper dates.", "kit-booking", true));
    }

    addRelationshipIssues(issues, byId, wrapperEnd);
    return sortIssues(dedupeIssues(issues));
  }

  function addRelationshipIssues(issues, byId, wrapperEnd) {
    var crewCall = byId["crew-call"] || byId["crew_call"];
    var buildStart = byId["build-start"] || byId["build_start"];
    var showEnd = byId["show-end"] || byId["show_end"];
    var derigStart = byId["derig-start"] || byId["derig_start"];
    var siteClear = byId["site-clear"] || byId["site_clear"];

    if (crewCall && buildStart && compareMilestoneTimes(crewCall, buildStart) > 0) {
      issues.push(createIssue("At Risk", "Crew call is after build start", "Crew need to be called before build starts.", crewCall.id, true));
    }

    if (derigStart && showEnd && compareMilestoneTimes(derigStart, showEnd) < 0) {
      issues.push(createIssue("At Risk", "Derig starts before show ends", "Check show end and derig start sequencing.", derigStart.id, true));
    }

    var siteClearDate = siteClear ? parseDate(siteClear.plannedDateTime) : null;
    if (siteClearDate && wrapperEnd && siteClearDate.getTime() > wrapperEnd.getTime()) {
      issues.push(createIssue("At Risk", "Site clear is after Wise Event End", "The operational clear time extends beyond the Salesforce wrapper.", siteClear.id, true));
    }
  }

  function calculateReadiness(data, issues) {
    var milestones = data.milestones || [];
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
    var out = [];

    for (var d = 0; d < departments.length; d++) {
      var department = departments[d];
      var selected = [];
      for (var i = 0; i < milestones.length; i++) {
        if (normaliseComparable(milestones[i].owner) === normaliseComparable(department)) {
          selected.push(milestones[i]);
        }
      }

      var base = selected.length ? averageStatusScore(selected) : 0;
      var penalty = 0;
      for (var j = 0; j < issues.length; j++) {
        var issueMilestone = findMilestoneById(milestones, issues[j].milestoneId);
        if (issueMilestone && normaliseComparable(issueMilestone.owner) === normaliseComparable(department)) {
          penalty += getIssuePenalty(issues[j]) * 0.55;
        }
      }

      out.push({
        department: department,
        score: selected.length ? clamp(Math.round(base - penalty), 0, 100) : 0,
        total: selected.length,
        complete: countMilestonesByStatus(selected, "Complete")
      });
    }

    return out;
  }

  function calculateOverallStatus(data, issues, readinessScore) {
    var milestones = data.milestones || [];

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

  function buildJourneyHtml(data, analysis) {
    var operationalMilestones = getOperationalMilestones(data.milestones || []);
    var visibleMilestones = state.showCriticalOnly ? filterCriticalMilestones(operationalMilestones) : operationalMilestones;

    return '' +
      '<div class="wpj-shell">' +
        buildHeaderSummary(data, analysis) +
        buildEventWrapper(data) +
        buildJourneyToolbar() +
        '<div class="wpj-main-grid">' +
          '<div class="wpj-primary">' +
            buildTimeline(visibleMilestones, state.showCriticalOnly) +
            buildDepartmentReadiness(analysis.departmentReadiness) +
          '</div>' +
          '<div class="wpj-side">' +
            buildIssuesPanel(analysis.issues) +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function buildHeaderSummary(data, analysis) {
    var score = analysis.readiness.score;
    var scoreClass = getScoreClass(score);
    var meta = [];
    if (data.project.clientName) meta.push("Client: " + data.project.clientName);
    if (data.project.venue) meta.push("Venue: " + data.project.venue);
    if (data.isMock) meta.push("Mock data");

    return '' +
      '<section class="wpj-header hirehop_panel ui-corner-all font_scale">' +
        '<div class="wpj-header-main">' +
          '<div class="wpj-kicker">Project Journey</div>' +
          '<h2>' + esc(data.project.name || "Untitled project") + '</h2>' +
          '<div class="wpj-meta">' + esc(meta.length ? meta.join(" | ") : "Current HireHop project") + '</div>' +
        '</div>' +
        '<div class="wpj-header-stats">' +
          '<div class="wpj-stat">' +
            '<span class="wpj-stat-label">Journey Status</span>' +
            buildStatusChip(analysis.status) +
          '</div>' +
          '<div class="wpj-stat wpj-score-stat">' +
            '<span class="wpj-stat-label">Event Readiness</span>' +
            '<div class="wpj-score-row">' +
              '<strong class="' + scoreClass + '">' + score + '%</strong>' +
              '<span>' + esc(analysis.readiness.complete + " of " + analysis.readiness.total + " milestones complete") + '</span>' +
            '</div>' +
            '<div class="wpj-progress" aria-hidden="true"><span class="' + scoreClass + '" style="width:' + score + '%"></span></div>' +
          '</div>' +
        '</div>' +
      '</section>';
  }

  function buildEventWrapper(data) {
    var fixed = data.hireHopFixedDates || [];
    var fixedHtml = "";

    for (var i = 0; i < fixed.length; i++) {
      fixedHtml += '' +
        '<div class="wpj-fixed-date">' +
          '<strong>' + esc(fixed[i].friendlyLabel || fixed[i].label || "Project date") + '</strong>' +
          '<span>' + esc(formatDateTime(fixed[i].dateTime) || "Not set") + '</span>' +
          '<small>' + esc(fixed[i].label || "") + (fixed[i].note ? " - " + esc(fixed[i].note) : "") + '</small>' +
        '</div>';
    }

    return '' +
      '<section class="wpj-wrapper hirehop_panel ui-corner-all font_scale">' +
        '<div class="wpj-section-title">' +
          '<h3>Wise Event Wrapper</h3>' +
          '<span>Project system dates</span>' +
        '</div>' +
        '<div class="wpj-wrapper-grid">' +
          '<div class="wpj-wrapper-card">' +
            '<span>Project/Onsite Start</span>' +
            '<strong>' + esc(formatDateTime(data.wiseEventStart) || "Not set") + '</strong>' +
            '<small>First moment Wise is expected to be active on site</small>' +
          '</div>' +
          '<div class="wpj-wrapper-card">' +
            '<span>Project/Onsite End</span>' +
            '<strong>' + esc(formatDateTime(data.wiseEventEnd) || "Not set") + '</strong>' +
            '<small>Final moment Wise is expected to be active on site</small>' +
          '</div>' +
          '<div class="wpj-fixed-card">' +
            '<span>Source fields</span>' +
            fixedHtml +
          '</div>' +
        '</div>' +
      '</section>';
  }

  function buildJourneyToolbar() {
    return '' +
      '<section class="wpj-toolbar hirehop_panel ui-corner-all font_scale" aria-label="Journey view controls">' +
        '<div class="wpj-section-title">' +
          '<h3>Operational Journey</h3>' +
          '<span>Milestones checked against the wrapper</span>' +
        '</div>' +
        '<div class="wpj-actions">' +
          '<div class="wpj-segmented" role="group" aria-label="Milestone filter">' +
            '<button type="button" class="' + (!state.showCriticalOnly ? "is-active" : "") + '" data-wise-project-journey-toggle="all">Show All Milestones</button>' +
            '<button type="button" class="' + (state.showCriticalOnly ? "is-active" : "") + '" data-wise-project-journey-toggle="critical">Show Critical Path Only</button>' +
          '</div>' +
          '<button type="button" class="wpj-refresh" data-wise-project-journey-refresh>Refresh</button>' +
        '</div>' +
      '</section>';
  }

  function buildTimeline(milestones, criticalOnly) {
    var groups = groupMilestones(milestones);
    var html = '<section class="wpj-timeline hirehop_panel ui-corner-all font_scale" aria-label="Journey timeline">';

    if (!milestones.length) {
      html += '<div class="wpj-empty">No ' + (criticalOnly ? "critical " : "") + 'milestones to show.</div>';
    }

    for (var i = 0; i < groups.length; i++) {
      html += '' +
        '<div class="wpj-group">' +
          '<div class="wpj-group-title">' +
            '<h4>' + esc(groups[i].group) + '</h4>' +
            '<span>' + groups[i].items.length + '</span>' +
          '</div>' +
          '<div class="wpj-card-row">';

      for (var m = 0; m < groups[i].items.length; m++) {
        html += buildMilestoneCard(groups[i].items[m]);
      }

      html += '</div></div>';
    }

    html += '</section>';
    return html;
  }

  function buildMilestoneCard(milestone) {
    var status = normaliseStatus(milestone.status);
    var risk = normaliseRisk(milestone.riskLevel || status);
    var dependencies = milestone.dependencies.length ? milestone.dependencies.join(", ") : "None";

    return '' +
      '<article class="wpj-milestone wpj-status-' + cssClass(status) + ' wpj-risk-' + cssClass(risk) + '">' +
        '<div class="wpj-milestone-head">' +
          '<div>' +
            '<h5>' + esc(milestone.name) + '</h5>' +
            '<span>' + esc(milestone.owner || "Owner missing") + '</span>' +
          '</div>' +
          buildStatusChip(status) +
        '</div>' +
        '<div class="wpj-datetime">' +
          '<span>Planned</span>' +
          '<strong>' + esc(formatDateTime(milestone.plannedDateTime) || "Missing") + '</strong>' +
        '</div>' +
        (milestone.actualDateTime ? '<div class="wpj-datetime"><span>Actual</span><strong>' + esc(formatDateTime(milestone.actualDateTime)) + '</strong></div>' : '') +
        '<div class="wpj-card-footer">' +
          '<span class="wpj-risk-dot" aria-hidden="true"></span>' +
          '<span>' + esc(risk === "None" ? "No current risk" : risk) + '</span>' +
          (milestone.criticalPath ? '<strong>Critical</strong>' : '') +
        '</div>' +
        '<details class="wpj-details">' +
          '<summary>Details</summary>' +
          '<dl>' +
            '<dt>Dependencies</dt><dd>' + esc(dependencies) + '</dd>' +
            '<dt>Notes</dt><dd>' + esc(milestone.notes || "No notes") + '</dd>' +
          '</dl>' +
        '</details>' +
      '</article>';
  }

  function buildIssuesPanel(issues) {
    var html = '' +
      '<section class="wpj-issues hirehop_panel ui-corner-all font_scale">' +
        '<div class="wpj-section-title">' +
          '<h3>Issues & Exceptions</h3>' +
          '<span>' + issues.length + ' active</span>' +
        '</div>';

    if (!issues.length) {
      html += '<div class="wpj-empty">No journey exceptions found.</div>';
    } else {
      html += '<ol class="wpj-issue-list">';
      for (var i = 0; i < issues.length; i++) {
        html += '' +
          '<li class="wpj-issue wpj-issue-' + cssClass(issues[i].severity) + '">' +
            '<span>' + esc(issues[i].severity) + '</span>' +
            '<strong>' + esc(issues[i].title) + '</strong>' +
            '<p>' + esc(issues[i].message) + '</p>' +
          '</li>';
      }
      html += '</ol>';
    }

    html += '</section>';
    return html;
  }

  function buildDepartmentReadiness(rows) {
    var html = '' +
      '<section class="wpj-departments hirehop_panel ui-corner-all font_scale">' +
        '<div class="wpj-section-title">' +
          '<h3>Readiness By Department</h3>' +
          '<span>Weighted by owned milestones</span>' +
        '</div>' +
        '<div class="wpj-department-grid">';

    for (var i = 0; i < rows.length; i++) {
      html += '' +
        '<div class="wpj-department">' +
          '<div class="wpj-department-head">' +
            '<strong>' + esc(rows[i].department) + '</strong>' +
            '<span>' + rows[i].score + '%</span>' +
          '</div>' +
          '<div class="wpj-progress" aria-hidden="true"><span class="' + getScoreClass(rows[i].score) + '" style="width:' + rows[i].score + '%"></span></div>' +
          '<small>' + esc(rows[i].total ? rows[i].complete + " of " + rows[i].total + " complete" : "No mapped milestones yet") + '</small>' +
        '</div>';
    }

    html += '</div></section>';
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
          notes: "Aligned with Wise Event Start."
        },
        {
          id: "build-start",
          group: "Build",
          name: "Build start",
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
          notes: "Planned clear is beyond the Salesforce wrapper."
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
      ".wise-project-journey-panel{box-sizing:border-box;background:#f6f7f9;color:#20242a;}",
      ".wise-journey-active>.ui-tabs-panel:not([data-wise-project-journey-panel]),.wise-journey-active>[role='tabpanel']:not([data-wise-project-journey-panel]){display:none!important;}",
      ".wise-journey-active>[data-wise-project-journey-panel='1']{display:block!important;}",
      '[data-wise-project-journey-tab="1"].is-wise-journey-active{background:#256f8f!important;border-color:#256f8f!important;}',
      '[data-wise-project-journey-tab="1"].is-wise-journey-active>a{color:#fff!important;}',
      ".wpj-shell{box-sizing:border-box;padding:14px 16px 18px;font-family:Arial,Helvetica,sans-serif;color:#20242a;}",
      ".wpj-shell *{box-sizing:border-box;}",
      ".wpj-header,.wpj-wrapper,.wpj-toolbar,.wpj-timeline,.wpj-departments,.wpj-issues{border:1px solid #d8dde3;background:#fff;border-radius:8px;}",
      ".wpj-header{display:flex;gap:14px;align-items:stretch;justify-content:space-between;padding:14px;margin-bottom:12px;}",
      ".wpj-header-main{min-width:220px;}",
      ".wpj-kicker{font-size:11px;font-weight:bold;letter-spacing:0;text-transform:uppercase;color:#52606d;margin-bottom:4px;}",
      ".wpj-header h2{margin:0 0 6px;font-size:22px;line-height:1.2;color:#20242a;font-weight:bold;}",
      ".wpj-meta{font-size:12px;line-height:1.4;color:#52606d;}",
      ".wpj-header-stats{display:grid;grid-template-columns:minmax(150px,190px) minmax(210px,280px);gap:10px;align-items:stretch;}",
      ".wpj-stat{border:1px solid #e1e5ea;border-radius:8px;padding:10px;background:#fbfcfd;}",
      ".wpj-stat-label{display:block;font-size:11px;text-transform:uppercase;font-weight:bold;color:#52606d;margin-bottom:7px;letter-spacing:0;}",
      ".wpj-score-row{display:flex;align-items:baseline;gap:8px;white-space:normal;}",
      ".wpj-score-row strong{font-size:24px;line-height:1;}",
      ".wpj-score-row span{font-size:12px;color:#52606d;}",
      ".wpj-progress{height:8px;border-radius:8px;background:#e8ebef;overflow:hidden;margin-top:8px;}",
      ".wpj-progress span{display:block;height:100%;border-radius:8px;background:#256f8f;}",
      ".wpj-score-good{color:#277a42;}",
      ".wpj-score-mid{color:#9b6500;}",
      ".wpj-score-bad{color:#b42318;}",
      ".wpj-progress .wpj-score-good{background:#2e8540;}",
      ".wpj-progress .wpj-score-mid{background:#d18a00;}",
      ".wpj-progress .wpj-score-bad{background:#d92d20;}",
      ".wpj-wrapper{padding:14px;margin-bottom:12px;border-color:#c7d7df;background:#fafdff;}",
      ".wpj-section-title{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:10px;}",
      ".wpj-section-title h3,.wpj-group-title h4{margin:0;font-size:16px;line-height:1.25;color:#20242a;}",
      ".wpj-section-title span,.wpj-group-title span{font-size:12px;color:#52606d;}",
      ".wpj-wrapper-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;}",
      ".wpj-wrapper-card,.wpj-fixed-card{border:1px solid #d7e4ea;border-radius:8px;background:#fff;padding:10px;min-height:92px;}",
      ".wpj-wrapper-card span,.wpj-fixed-card>span{display:block;font-size:11px;font-weight:bold;text-transform:uppercase;color:#52606d;margin-bottom:6px;letter-spacing:0;}",
      ".wpj-wrapper-card strong{display:block;font-size:16px;line-height:1.25;color:#1d5f7c;margin-bottom:5px;}",
      ".wpj-wrapper-card small,.wpj-fixed-date small,.wpj-department small{display:block;font-size:11px;line-height:1.35;color:#63707c;}",
      ".wpj-fixed-date{padding:6px 0;border-top:1px solid #e7edf1;}",
      ".wpj-fixed-date:first-of-type{border-top:0;padding-top:0;}",
      ".wpj-fixed-date strong{display:block;font-size:13px;color:#20242a;}",
      ".wpj-fixed-date span{display:block;font-size:12px;color:#1d5f7c;margin:2px 0;}",
      ".wpj-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;margin-bottom:12px;}",
      ".wpj-toolbar .wpj-section-title{margin-bottom:0;display:block;}",
      ".wpj-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;}",
      ".wpj-segmented{display:inline-flex;border:1px solid #b8c5cf;border-radius:8px;overflow:hidden;background:#fff;}",
      ".wpj-segmented button,.wpj-refresh{border:0;background:#fff;color:#20242a;font:inherit;font-size:12px;font-weight:bold;padding:7px 10px;cursor:pointer;}",
      ".wpj-segmented button+button{border-left:1px solid #b8c5cf;}",
      ".wpj-segmented button.is-active{background:#256f8f;color:#fff;}",
      ".wpj-refresh{border:1px solid #b8c5cf;border-radius:8px;background:#fff;}",
      ".wpj-main-grid{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:12px;align-items:start;}",
      ".wpj-primary{min-width:0;}",
      ".wpj-timeline{padding:14px;margin-bottom:12px;}",
      ".wpj-group{margin-bottom:14px;}",
      ".wpj-group:last-child{margin-bottom:0;}",
      ".wpj-group-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;border-bottom:1px solid #eceff3;padding-bottom:6px;}",
      ".wpj-card-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;}",
      ".wpj-milestone{border:1px solid #d8dde3;border-left-width:5px;border-radius:8px;background:#fff;padding:10px;min-width:0;}",
      ".wpj-milestone-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px;}",
      ".wpj-milestone h5{margin:0 0 3px;font-size:14px;line-height:1.25;color:#20242a;}",
      ".wpj-milestone-head span{font-size:12px;color:#52606d;}",
      ".wpj-datetime{display:grid;grid-template-columns:62px minmax(0,1fr);gap:8px;align-items:baseline;margin:5px 0;}",
      ".wpj-datetime span{font-size:11px;text-transform:uppercase;color:#63707c;font-weight:bold;letter-spacing:0;}",
      ".wpj-datetime strong{font-size:13px;line-height:1.3;color:#20242a;word-break:break-word;}",
      ".wpj-card-footer{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;color:#52606d;}",
      ".wpj-card-footer strong{margin-left:auto;color:#20242a;font-size:11px;text-transform:uppercase;}",
      ".wpj-risk-dot{width:9px;height:9px;border-radius:50%;background:#8a95a3;display:inline-block;flex:0 0 auto;}",
      ".wpj-details{margin-top:8px;border-top:1px solid #eef1f4;padding-top:7px;}",
      ".wpj-details summary{cursor:pointer;font-size:12px;font-weight:bold;color:#256f8f;}",
      ".wpj-details dl{display:grid;grid-template-columns:88px minmax(0,1fr);gap:4px 8px;margin:8px 0 0;font-size:12px;line-height:1.35;}",
      ".wpj-details dt{font-weight:bold;color:#52606d;}",
      ".wpj-details dd{margin:0;color:#20242a;word-break:break-word;}",
      ".wpj-chip{display:inline-flex;align-items:center;justify-content:center;min-height:22px;padding:3px 8px;border-radius:8px;font-size:11px;font-weight:bold;white-space:nowrap;border:1px solid transparent;}",
      ".wpj-chip-complete{background:#e8f5ec;color:#226c3a;border-color:#b8dfc4;}",
      ".wpj-chip-in-progress{background:#e6f2fb;color:#1b658f;border-color:#bad9ee;}",
      ".wpj-chip-not-started{background:#eef1f4;color:#52606d;border-color:#d6dce2;}",
      ".wpj-chip-at-risk{background:#fff4dc;color:#8a5a00;border-color:#e7c16f;}",
      ".wpj-chip-blocked,.wpj-chip-missing{background:#fdecec;color:#b42318;border-color:#f2b8b5;}",
      ".wpj-status-complete{border-left-color:#2e8540;}",
      ".wpj-status-in-progress{border-left-color:#256f8f;}",
      ".wpj-status-not-started{border-left-color:#8a95a3;}",
      ".wpj-status-at-risk{border-left-color:#d18a00;}",
      ".wpj-status-blocked,.wpj-status-missing{border-left-color:#d92d20;}",
      ".wpj-risk-none .wpj-risk-dot{background:#2e8540;}",
      ".wpj-risk-at-risk .wpj-risk-dot{background:#d18a00;}",
      ".wpj-risk-blocked .wpj-risk-dot,.wpj-risk-missing .wpj-risk-dot{background:#d92d20;}",
      ".wpj-risk-low .wpj-risk-dot{background:#256f8f;}",
      ".wpj-departments{padding:14px;}",
      ".wpj-department-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;}",
      ".wpj-department{border:1px solid #e1e5ea;border-radius:8px;background:#fbfcfd;padding:10px;}",
      ".wpj-department-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px;}",
      ".wpj-department-head span{font-weight:bold;color:#20242a;}",
      ".wpj-issues{padding:14px;position:sticky;top:8px;}",
      ".wpj-issue-list{list-style:none;margin:0;padding:0;display:grid;gap:8px;}",
      ".wpj-issue{border:1px solid #e1e5ea;border-left-width:5px;border-radius:8px;background:#fff;padding:9px;}",
      ".wpj-issue span{display:inline-block;font-size:10px;text-transform:uppercase;font-weight:bold;color:#52606d;margin-bottom:4px;letter-spacing:0;}",
      ".wpj-issue strong{display:block;font-size:13px;line-height:1.3;color:#20242a;margin-bottom:3px;}",
      ".wpj-issue p{margin:0;font-size:12px;line-height:1.35;color:#52606d;}",
      ".wpj-issue-blocked{border-left-color:#d92d20;}",
      ".wpj-issue-at-risk{border-left-color:#d18a00;}",
      ".wpj-issue-missing-data{border-left-color:#d92d20;}",
      ".wpj-issue-warning{border-left-color:#8a95a3;}",
      ".wpj-empty{border:1px dashed #cbd3db;border-radius:8px;background:#fbfcfd;color:#52606d;padding:14px;text-align:center;font-size:13px;}",
      "@media(max-width:980px){.wpj-header,.wpj-toolbar{display:block;}.wpj-header-stats{grid-template-columns:1fr;margin-top:12px;}.wpj-actions{justify-content:flex-start;margin-top:10px;}.wpj-main-grid{grid-template-columns:1fr;}.wpj-issues{position:static;}.wpj-wrapper-grid{grid-template-columns:1fr;}}",
      "@media(max-width:620px){.wpj-shell{padding:10px 8px 14px;}.wpj-header h2{font-size:18px;}.wpj-card-row,.wpj-department-grid{grid-template-columns:1fr;}.wpj-segmented{display:flex;width:100%;}.wpj-segmented button{flex:1 1 0;padding-left:6px;padding-right:6px;}.wpj-refresh{width:100%;}.wpj-datetime{grid-template-columns:1fr;gap:2px;}.wpj-details dl{grid-template-columns:1fr;}}",
      ".wise-project-journey-panel{box-sizing:border-box;background:#fff!important;color:inherit;scrollbar-gutter:stable;}",
      ".wpj-shell{padding:8px 8px 12px;font-family:inherit;color:inherit;background:#fff;}",
      ".wpj-header,.wpj-wrapper,.wpj-toolbar,.wpj-timeline,.wpj-departments,.wpj-issues{border:1px solid #a1a1a1;background:#fff;border-radius:4px;margin-bottom:8px;box-shadow:none;}",
      ".wpj-header{padding:0;display:block;}",
      ".wpj-header-main{padding:7px 8px;background:#f0f0f0;border-bottom:1px solid #c7c7c7;min-width:0;}",
      ".wpj-kicker{font-size:11px;color:#333;text-transform:none;margin-bottom:2px;font-weight:bold;}",
      ".wpj-header h2{font-size:1.2em;line-height:1.25;margin:0;color:#222;font-weight:bold;}",
      ".wpj-meta{font-size:11px;color:#555;margin-top:3px;}",
      ".wpj-header-stats{display:grid;grid-template-columns:180px minmax(220px,1fr);gap:0;border-top:0;}",
      ".wpj-stat{border:0;border-right:1px solid #d0d0d0;border-radius:0;background:#fff;padding:7px 8px;}",
      ".wpj-stat:last-child{border-right:0;}",
      ".wpj-stat-label,.wpj-wrapper-card span,.wpj-fixed-card>span,.wpj-datetime span{color:#333;text-transform:none;font-size:11px;letter-spacing:0;font-weight:bold;}",
      ".wpj-score-row strong{font-size:18px;}",
      ".wpj-progress{height:7px;border-radius:0;background:#e1e1e1;border:1px solid #c7c7c7;margin-top:6px;}",
      ".wpj-progress span{border-radius:0;}",
      ".wpj-wrapper,.wpj-timeline,.wpj-departments,.wpj-issues{padding:0;}",
      ".wpj-section-title,.wpj-group-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0;padding:6px 8px;background:#f0f0f0;border-bottom:1px solid #c7c7c7;}",
      ".wpj-section-title h3,.wpj-group-title h4{font-size:1.05em;color:#222;font-weight:bold;}",
      ".wpj-section-title span,.wpj-group-title span{font-size:11px;color:#555;}",
      ".wpj-wrapper-grid,.wpj-card-row,.wpj-department-grid{padding:8px;}",
      ".wpj-wrapper-card,.wpj-fixed-card,.wpj-milestone,.wpj-department,.wpj-issue{border:1px solid #d0d0d0;border-radius:3px;background:#fff;box-shadow:none;}",
      ".wpj-wrapper-card strong,.wpj-fixed-date span{color:#222;}",
      ".wpj-toolbar{padding:6px 8px;}",
      ".wpj-toolbar .wpj-section-title{padding:0;background:transparent;border-bottom:0;}",
      ".wpj-segmented{border:1px solid #a1a1a1;border-radius:4px;background:#fff;}",
      ".wpj-segmented button,.wpj-refresh{font:inherit;font-size:12px;border:0;background:#f5f5f5;color:#222;padding:5px 8px;}",
      ".wpj-segmented button+button{border-left:1px solid #a1a1a1;}",
      ".wpj-segmented button.is-active{background:#1f75cf;color:#fff;}",
      ".wpj-refresh{border:1px solid #a1a1a1;border-radius:4px;}",
      ".wpj-main-grid{grid-template-columns:minmax(0,1fr) 300px;gap:8px;}",
      ".wpj-group{margin:0;border-bottom:1px solid #dedede;}",
      ".wpj-group:last-child{border-bottom:0;}",
      ".wpj-group-title{border-bottom:1px solid #dedede;background:#f7f7f7;}",
      ".wpj-milestone{border-left-width:4px;}",
      ".wpj-milestone h5{font-size:13px;color:#222;}",
      ".wpj-details summary{color:#1f75cf;}",
      ".wpj-chip{border-radius:3px;min-height:19px;padding:2px 6px;font-size:11px;}",
      ".wpj-issues{position:static;}",
      ".wpj-issue-list{padding:8px;}",
      ".wpj-empty{margin:8px;border-color:#c7c7c7;border-radius:3px;background:#f7f7f7;color:#555;}"
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

    var direct = new Date(text);
    if (!isNaN(direct.getTime())) return direct;

    var match = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (match) {
      var year = Number(match[3]);
      if (year < 100) year += 2000;
      var parsed = new Date(year, Number(match[2]) - 1, Number(match[1]), Number(match[4] || 0), Number(match[5] || 0));
      if (!isNaN(parsed.getTime())) return parsed;
    }

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
