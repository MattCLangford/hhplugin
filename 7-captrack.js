(function () {
  "use strict";

  var $ = window.jQuery;
  if (!$) return;

  var HIREHOP_MODULE_GLOBAL = "WiseProposalSectionBuilderHireHop";
  var LOG_PREFIX = "[Wise Capacity Tracker]";

  var CFG = {
    version: "2026-05-18.6-absence-overlay",
    title: "Capacity Tracker",
    subtitle: "Wise project timeline grouped by team assignment, tier, status or venue",
    buttonLabel: "Capacity Tracker",
    buttonTitle: "Open Capacity Tracker",
    buttonId: "wise-capacity-tracker-button",
    stylesId: "wise-capacity-tracker-styles",
    overlayId: "wise-capacity-tracker-overlay",
    modalId: "wise-capacity-tracker-modal",
    statusId: "wise-capacity-tracker-status",
    summaryId: "wise-capacity-tracker-summary",
    missingId: "wise-capacity-tracker-missing",
    statusFiltersId: "wise-capacity-tracker-status-filters",
    nativeStatusFiltersId: "wise-capacity-tracker-native-status-filters",
    leftBodyId: "wise-capacity-tracker-left-body",
    headerScrollId: "wise-capacity-tracker-header-scroll",
    timelineScrollId: "wise-capacity-tracker-timeline-scroll",
    totalsLabelId: "wise-capacity-tracker-totals-label",
    totalsScrollId: "wise-capacity-tracker-totals-scroll",
    timelineHeaderId: "wise-capacity-tracker-timeline-header",
    timelineBodyId: "wise-capacity-tracker-timeline-body",
    timelineTotalsId: "wise-capacity-tracker-timeline-totals",
    popoverId: "wise-capacity-tracker-popover",
    defaultZoom: "week",
    pixelsPerDay: {
      week: 84,
      month: 56,
      quarter: 32
    },
    defaultCardLabelMode: "full",
    capacityMediumThreshold: 2,
    capacityHighThreshold: 4,
    personRowMinHeight: 24,
    barHeight: 24,
    laneGap: 2,
    lanePadding: 0,
    defaultRangeMonthsBefore: 0,
    defaultRangeMonthsAfter: 1,
    fetchChunkDays: 120,
    fetchPageSize: 500,
    fetchMaxPages: 20,
    searchDebounceMs: 180,
    searchEndpointFallback: "/php_functions/search_list.php",
    absenceFeed: {
      enabled: true,
      cacheTtlMs: 15 * 60 * 1000,
      requestTimeoutMs: 15000,
      localStorageKey: "wise-capacity-tracker-absence-feed-url",
      personGroupModes: ["project", "designer", "technical", "production"]
    },
    debugUseMock: false,
    targetDepotIds: [],
    targetDepotNames: [
      "Wise Productions YES Events"
    ],
    unknownStatusKey: "__unmapped",
    wiseStatuses: [
      { key: "closed_lost", label: "Closed Lost", color: "#7c8794" },
      { key: "quote_new", label: "Quote (New Client)", color: "#7c3aed" },
      { key: "quote_repeat", label: "Quote (Repeat Client)", color: "#7c3aed" },
      { key: "very_likely", label: "Very Likely", color: "#f2c94c" },
      { key: "hold", label: "Hold", color: "#f97316" },
      { key: "confirmed", label: "Confirmed", color: "#16a34a" }
    ],
    unknownStatus: { key: "__unmapped", label: "Unmapped", color: "#64748b" },
    customFieldKeys: {
      status: ["_Status"],
      projectName: ["_Project_Name", "_ProjectName"],
      jobNumber: ["_Job_Number", "_JobNumber"],
      client: ["_Client"],
      venue: ["_Venue"],
      pm: "_PM",
      designer: "_Designer",
      tpm: "_TPM",
      production: "_Production",
      revenue: ["_Revenue", "_revenue"],
      tier: ["_Tier", "_tier"]
    }
  };

  var GROUP_MODES = {
    project: { field: "pm", source: "roles", label: "Project team", headerLabel: "Project team", unassigned: "Unassigned Project", emptyFilterLabel: "Unassigned only" },
    designer: { field: "designer", source: "roles", label: "Designer", headerLabel: "Designer", unassigned: "Unassigned Designer", emptyFilterLabel: "Unassigned only" },
    technical: { field: "tpm", source: "roles", label: "Technical", headerLabel: "Technical", unassigned: "Unassigned Technical", emptyFilterLabel: "Unassigned only" },
    production: { field: "production", source: "roles", label: "Production", headerLabel: "Production", unassigned: "Unassigned Production", emptyFilterLabel: "Unassigned only" },
    tier: { field: "tier", source: "project", label: "Tier", headerLabel: "Tier", unassigned: "No tier", emptyFilterLabel: "Missing tier only", normalise: getTierGroupLabel },
    status: { field: "status", source: "project", label: "Status", headerLabel: "Status", unassigned: "No status", emptyFilterLabel: "Missing status only", normalise: normaliseWiseStatus },
    venue: { field: "venue", source: "project", label: "Venue", headerLabel: "Venue", unassigned: "No venue", emptyFilterLabel: "Missing venue only" }
  };

  var defaultDateRange = createDefaultDateRange();

  var state = {
    ready: false,
    loaded: false,
    loading: false,
    error: "",
    projects: [],
    visibleProjects: [],
    datedProjects: [],
    missingDateProjects: [],
    rows: [],
    projectMap: {},
    timeline: null,
    loadedRangeKey: "",
    zoom: CFG.defaultZoom,
    groupMode: "project",
    cardLabelMode: CFG.defaultCardLabelMode,
    rowOrder: {},
    search: "",
    showUnassignedOnly: false,
    nativeStatusFilters: createDefaultNativeStatusFilters(),
    statusFilters: createDefaultStatusFilters(),
    dateRangeStart: defaultDateRange.start,
    dateRangeEnd: defaultDateRange.end,
    absence: {
      configured: false,
      loading: false,
      loaded: false,
      error: "",
      feedUrl: "",
      feedUrlSource: "",
      feedKey: "",
      loadedAt: 0,
      events: [],
      byPersonKey: {},
      promise: null
    }
  };

  var latestLoadId = 0;
  var searchTimer = null;
  var buttonRetryTimer = null;
  var draggedRowKey = "";

  window.WiseCapacityTracker = {
    version: CFG.version,
    open: openTracker,
    refresh: refreshProjects,
    refreshAbsences: function () { return ensureAbsenceFeed({ force: true, renderOnComplete: true }); },
    setAbsenceFeedUrl: setAbsenceFeedUrl,
    clearAbsenceFeedUrl: clearAbsenceFeedUrl,
    describe: describe,
    debugDateFields: debugDateFields,
    _test: {
      normaliseProject: normaliseProject,
      getCustomField: getCustomField,
      parseHireHopDate: parseHireHopDate,
      formatDate: formatDate,
      isOpenProject: isOpenProject,
      getProjectStart: getProjectStart,
      getProjectEnd: getProjectEnd,
      buildTimelineRange: buildTimelineRange,
      groupProjects: groupProjects,
      parseIcsEvents: parseIcsEvents,
      normalisePersonName: normalisePersonName
    }
  };

  log("Loaded", CFG.version);
  boot();

  function boot() {
    injectStyles();
    ensureModal();
    installEntryPoint();

    $(window).on("load.wiseCapacityTracker focus.wiseCapacityTracker", installEntryPoint);
    $(document).on("ajaxComplete.wiseCapacityTracker", installEntryPoint);
    $(document).on("change.wiseCapacityTracker input.wiseCapacityTracker", "select,input", installEntryPoint);
  }

  function describe() {
    return {
      loaded: true,
      version: CFG.version,
      endpoint: getHireHopEndpoint("searchList", CFG.searchEndpointFallback),
      defaultZoom: CFG.defaultZoom,
      projectsLoaded: state.projects.length,
      targetDepot: getTargetDepotSummary(),
      dateRange: getSelectedDateRangeLabel(),
      fetchPlan: describeFetchPlan(),
      nativeHireHopStatus: getNativeStatusFilterLabel(),
      groupMode: state.groupMode,
      cardLabelMode: state.cardLabelMode,
      absenceFeed: describeAbsenceFeed(),
      wiseStatuses: CFG.wiseStatuses.map(function (status) { return status.label; }),
      customFieldKeys: $.extend({}, CFG.customFieldKeys)
    };
  }

  function debugDateFields(limit) {
    var count = Math.max(1, Math.min(Number(limit) || 8, 25));
    return state.projects.slice(0, count).map(function (project) {
      return {
        label: getProjectLabel(project),
        kitStart: formatDateTime(project.kitStart),
        kitEnd: formatDateTime(project.kitEnd),
        rawDateTimeFields: collectDateTimeRawFields(project.raw)
      };
    });
  }

  function setAbsenceFeedUrl(url, persist) {
    var feedUrl = normaliseAbsenceFeedUrl(url);
    if (!feedUrl) {
      clearAbsenceFeedUrl(persist !== false);
      return describeAbsenceFeed();
    }

    state.absence.feedUrl = feedUrl;
    state.absence.feedUrlSource = persist ? "localStorage" : "runtime";
    state.absence.configured = true;
    state.absence.loaded = false;
    state.absence.error = "";
    state.absence.loadedAt = 0;
    state.absence.feedKey = "";
    state.absence.events = [];
    state.absence.byPersonKey = {};

    if (persist) writeStoredAbsenceFeedUrl(feedUrl);
    ensureAbsenceFeed({ force: true, renderOnComplete: true });
    return describeAbsenceFeed();
  }

  function clearAbsenceFeedUrl(clearStored) {
    state.absence.feedUrl = "";
    state.absence.feedUrlSource = "";
    state.absence.configured = false;
    state.absence.loading = false;
    state.absence.loaded = false;
    state.absence.error = "";
    state.absence.feedKey = "";
    state.absence.loadedAt = 0;
    state.absence.events = [];
    state.absence.byPersonKey = {};
    state.absence.promise = null;
    if (clearStored !== false) removeStoredAbsenceFeedUrl();
    if ($("#" + CFG.overlayId).hasClass("is-visible")) render();
    return describeAbsenceFeed();
  }

  function describeAbsenceFeed() {
    var resolved = resolveAbsenceFeedUrl();
    return {
      configured: !!resolved.url,
      source: resolved.source || "",
      loading: !!state.absence.loading,
      loaded: !!state.absence.loaded,
      events: state.absence.events ? state.absence.events.length : 0,
      error: state.absence.error ? "unavailable" : ""
    };
  }

  function installEntryPoint() {
    if (!isAllowedActiveDepot()) {
      removeEntryPoint();
      return;
    }

    if (!isHomePage()) {
      removeEntryPoint();
      return;
    }

    var $host = findHomeTabsHost();

    if (!$host.length) {
      if (!buttonRetryTimer) {
        buttonRetryTimer = setTimeout(function () {
          buttonRetryTimer = null;
          installEntryPoint();
        }, 1000);
      }
      return;
    }

    var $sampleTab = findHomeTabTemplate($host);
    var $existing = $("#" + CFG.buttonId);
    if ($existing.length) {
      applyHomeTabTemplate($existing, $sampleTab);
      return;
    }

    var $btn = buildHomeTabButton($sampleTab);

    $btn.on("click", function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openTracker();
    });

    $host.append($btn);
    applyHomeTabTemplate($btn, $sampleTab);
  }

  function buildHomeTabButton($sampleTab) {
    var $btn = $sampleTab && $sampleTab.length ? $sampleTab.clone(false, false) : $();

    if (!$btn.length) {
      $btn = $('<li role="tab"><a href="#wise-capacity-tracker-open"></a></li>');
    }

    $btn
      .attr("id", CFG.buttonId)
      .removeClass("ui-tabs-active ui-state-active ui-state-focus ui-state-hover ui-tabs-loading")
      .attr("aria-selected", "false")
      .attr("aria-expanded", "false")
      .removeAttr("aria-controls aria-labelledby");

    var tabClass = $sampleTab && $sampleTab.length
      ? normaliseHomeTabClass($sampleTab.attr("class") || $btn.attr("class") || "")
      : normaliseHomeTabClass($btn.attr("class") || "ui-state-default ui-corner-top ui-tabs-tab ui-tab");
    $btn.attr("class", tabClass);

    var $anchor = $btn.children("a").first();
    if (!$anchor.length) {
      $anchor = $('<a></a>').appendTo($btn);
    }

    $btn.children().not($anchor).remove();
    $anchor
      .attr("href", "#wise-capacity-tracker-open")
      .attr("title", CFG.buttonTitle)
      .removeAttr("id aria-controls aria-selected aria-expanded");
    setHomeTabAnchorText($anchor, CFG.buttonLabel);

    return $btn;
  }

  function applyHomeTabTemplate($btn, $sampleTab) {
    if (!$btn || !$btn.length) return;

    $sampleTab = $sampleTab && $sampleTab.length ? $sampleTab : findHomeTabTemplate($btn.parent());
    if (!$sampleTab.length) return;

    $btn.attr("class", normaliseHomeTabClass($sampleTab.attr("class") || $btn.attr("class") || ""));
    $btn
      .removeClass("ui-tabs-active ui-state-active ui-state-focus ui-state-hover ui-tabs-loading")
      .attr("role", $sampleTab.attr("role") || "tab")
      .attr("aria-selected", "false")
      .attr("aria-expanded", "false")
      .removeAttr("aria-controls aria-labelledby");

    copyComputedStyle($sampleTab.get(0), $btn.get(0), [
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
      "borderLeftStyle",
      "borderTopColor",
      "borderRightColor",
      "borderBottomColor",
      "borderLeftColor",
      "backgroundColor"
    ]);

    var $anchor = $btn.children("a").first();
    var $sampleAnchor = $sampleTab.children("a").first();
    if ($anchor.length && $sampleAnchor.length) {
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
        "borderTopWidth",
        "borderRightWidth",
        "borderBottomWidth",
        "borderLeftWidth",
        "fontFamily",
        "fontSize",
        "fontWeight",
        "color",
        "textDecoration"
      ]);
      $anchor
        .attr("href", "#wise-capacity-tracker-open")
        .attr("title", CFG.buttonTitle)
        .removeAttr("id aria-controls aria-selected aria-expanded");
      setHomeTabAnchorText($anchor, CFG.buttonLabel);
    }
  }

  function copyComputedStyle(source, target, props) {
    if (!source || !target || !window.getComputedStyle) return;

    var computed;
    try { computed = window.getComputedStyle(source); } catch (e) { computed = null; }
    if (!computed) return;

    for (var i = 0; i < props.length; i++) {
      var prop = props[i];
      var value = computed[prop];
      if (!value || value === "auto" || value === "normal" && prop !== "lineHeight") continue;
      try { target.style[prop] = value; } catch (err) {}
    }
  }

  function findHomeTabTemplate($host) {
    var labels = ["stock check", "pre-prep", "reports"];

    for (var i = 0; i < labels.length; i++) {
      var $match = $host.children("li").not("#" + CFG.buttonId).filter(":visible").filter(function () {
        return normaliseSearch($(this).text()) === labels[i];
      }).last();
      if ($match.length) return $match;
    }

    return $host.children("li").not("#" + CFG.buttonId).filter(":visible").last();
  }

  function setHomeTabAnchorText($anchor, label) {
    var $textNodeHost = $anchor.find("span").filter(function () {
      return $.trim(String($(this).text() || "")) !== "";
    }).last();

    if ($textNodeHost.length) {
      $textNodeHost.text(label);
      return;
    }

    $anchor.text(label);
  }

  function removeEntryPoint() {
    $("#" + CFG.buttonId).remove();
    if ($("#" + CFG.overlayId).is(":visible")) {
      closeTracker();
    }
  }

  function isHomePage() {
    return /\/home\.php(?:[?#]|$)/i.test(window.location.pathname + window.location.search);
  }

  function findHomeTabsHost() {
    var selectors = [
      "#tabs > ul.ui-tabs-nav:first",
      "#tabs > ul:first",
      ".hh-framework_tabs > ul.ui-tabs-nav:first",
      ".hh-framework_tabs > ul:first",
      "ul.ui-tabs-nav:first"
    ];

    for (var i = 0; i < selectors.length; i++) {
      var $host = $(selectors[i]).filter(function () {
        return !$(this).closest("#items_tab,#" + CFG.modalId).length;
      }).first();
      if ($host.length) return $host;
    }

    return $();
  }

  function normaliseHomeTabClass(value) {
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

  function openTracker() {
    ensureModal();
    updateControlsFromState();
    $("#" + CFG.overlayId)
      .addClass("is-visible")
      .show();
    $("body").addClass("wise-capacity-tracker-open");

    if ((!state.loaded || state.loadedRangeKey !== getSelectedRangeKey()) && !state.loading) {
      refreshProjects();
      return;
    }

    ensureAbsenceFeed({ renderOnComplete: true });
    render();
    setTimeout(function () { scrollToToday({ centerBias: 0.35 }); }, 40);
  }

  function closeTracker() {
    hidePopover();
    $("#" + CFG.overlayId).removeClass("is-visible").hide();
    $("body").removeClass("wise-capacity-tracker-open");
  }

  function refreshProjects() {
    syncFetchControlsFromDom();

    var loadId = ++latestLoadId;
    var rangeKey = getSelectedRangeKey();
    state.loading = true;
    state.error = "";
    setStatus("Loading Wise projects (" + getSelectedDateRangeLabel() + ", " + getNativeStatusFilterLabel() + ")...", "loading");
    clearTimeline();
    ensureAbsenceFeed({ renderOnComplete: true });

    fetchProjectRows()
      .then(function (rows) {
        if (loadId !== latestLoadId) return;

        state.projects = rows.map(normaliseProject).filter(isProjectRecord);
        state.loaded = true;
        state.loading = false;
        state.error = "";
        state.loadedRangeKey = rangeKey;

        log("Loaded project rows", {
          rawRows: rows.length,
          projectRows: state.projects.length
        });

        render();
        setTimeout(function () { scrollToToday({ centerBias: 0.35 }); }, 60);
      })
      .then(null, function (error) {
        if (loadId !== latestLoadId) return;

        state.loading = false;
        state.loaded = false;
        state.error = error && error.message ? error.message : String(error || "Failed to load project data.");
        logWarn("Failed to load project data", error);
        setStatus("Failed to load project data. " + state.error, "error");
        clearTimeline();
      });
  }

  function fetchProjectRows() {
    if (CFG.debugUseMock) return Promise.resolve(getMockRows());
    if (typeof window.fetch !== "function") {
      return Promise.reject(new Error("The browser fetch API is not available in this HireHop session."));
    }

    var endpoint = getHireHopEndpoint("searchList", CFG.searchEndpointFallback);
    if (!endpoint) return Promise.reject(new Error("HireHop project search endpoint is not configured."));

    var depotFilter = resolveTargetDepots();
    if (!depotFilter.ids.length) {
      return Promise.reject(new Error("Target depot not found: " + CFG.targetDepotNames.join(", ") + ". The tracker will not load unfiltered project data."));
    }
    log("Using target depot filter", depotFilter);

    var selectedRange = buildFetchDateRange();
    var rangeChunks = buildFetchDateRangeChunks(selectedRange);
    var allRows = [];
    var useJsonDepotFilter = false;
    log("Using fetch date chunks", rangeChunks.map(function (chunk) {
      return {
        from: formatServerDateTime(chunk.from),
        to: formatServerDateTime(chunk.to)
      };
    }));

    /*
     * HireHop's native hh_search_results_dialog posts to search_list.php for jobs/projects.
     * Project rows use kind 6 and standard fields such as NUMBER, JOB_NAME, CLIENT, VENUE,
     * OUT_DATE, JOB_DATE, JOB_END and RETURN_DATE. When project custom fields are included,
     * HireHop prefixes them with "~", for example "~_PM".
     */
    function fetchChunk(chunkIndex) {
      if (chunkIndex >= rangeChunks.length) return Promise.resolve(dedupeProjectRows(allRows));
      return fetchPage(rangeChunks[chunkIndex], 1).then(function () {
        return fetchChunk(chunkIndex + 1);
      });
    }

    function fetchPage(range, page) {
      var params = buildSearchParams(page, depotFilter.ids, useJsonDepotFilter, range);

      return requestProjectPage(endpoint, params)
        .then(null, function (error) {
          if (!useJsonDepotFilter && error && error.status >= 500) {
            useJsonDepotFilter = true;
            logWarn("Retrying HireHop project search with JSON encoded depot filter", {
              status: error.status,
              depotIds: depotFilter.ids
            });
            return requestProjectPage(endpoint, buildSearchParams(page, depotFilter.ids, true, range));
          }
          throw error;
        })
        .then(function (json) {
          var pageRows = extractRows(json);
          appendRows(allRows, pageRows);

          var totalRecords = Number(json.totalRecords || json.total || json.records || 0);
          var pageCount = totalRecords > 0 ? Math.ceil(totalRecords / CFG.fetchPageSize) : 0;
          var shouldContinue = page < CFG.fetchMaxPages && pageRows.length >= CFG.fetchPageSize;
          if (pageCount > 0) shouldContinue = page < Math.min(pageCount, CFG.fetchMaxPages);

          return shouldContinue ? fetchPage(range, page + 1) : allRows;
        });
    }

    return fetchChunk(0);
  }

  function ensureAbsenceFeed(options) {
    options = options || {};
    if (!CFG.absenceFeed || CFG.absenceFeed.enabled === false || typeof window.fetch !== "function") {
      clearAbsenceRuntimeState();
      return Promise.resolve(describeAbsenceFeed());
    }

    var resolved = resolveAbsenceFeedUrl();
    state.absence.configured = !!resolved.url;
    state.absence.feedUrl = resolved.url;
    state.absence.feedUrlSource = resolved.source;

    if (!resolved.url) {
      clearAbsenceRuntimeState();
      return Promise.resolve(describeAbsenceFeed());
    }

    var feedKey = getAbsenceFeedKey(resolved.url);
    var now = Date.now();
    var ttl = Math.max(60000, Number(CFG.absenceFeed.cacheTtlMs) || 900000);
    var isFresh = state.absence.loaded && state.absence.feedKey === feedKey && (now - state.absence.loadedAt) < ttl;
    if (!options.force && isFresh) return Promise.resolve(describeAbsenceFeed());
    if (state.absence.loading && state.absence.promise) return state.absence.promise;

    state.absence.loading = true;
    state.absence.error = "";

    state.absence.promise = fetchAbsenceFeed(resolved.url)
      .then(function (text) {
        var events = parseIcsEvents(text);
        state.absence.events = events;
        state.absence.byPersonKey = buildAbsenceIndex(events);
        state.absence.loaded = true;
        state.absence.loadedAt = Date.now();
        state.absence.feedKey = feedKey;
        state.absence.error = "";
        log("Loaded absence feed", { events: events.length });
        return describeAbsenceFeed();
      })
      .then(null, function (error) {
        state.absence.loaded = false;
        state.absence.events = [];
        state.absence.byPersonKey = {};
        state.absence.error = getAbsenceFetchErrorMessage(error);
        logWarn("Failed to load absence feed", state.absence.error);
        return describeAbsenceFeed();
      })
      .then(function (summary) {
        state.absence.loading = false;
        state.absence.promise = null;
        if (options.renderOnComplete && $("#" + CFG.overlayId).hasClass("is-visible")) render();
        return summary;
      });

    if (options.renderOnComplete && $("#" + CFG.overlayId).hasClass("is-visible")) render();
    return state.absence.promise;
  }

  function fetchAbsenceFeed(url) {
    var options = {
      method: "GET",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: {
        Accept: "text/calendar,text/plain,*/*"
      }
    };

    if (window.AbortController) {
      var controller = new window.AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, Math.max(3000, Number(CFG.absenceFeed.requestTimeoutMs) || 15000));
      options.signal = controller.signal;
      return window.fetch(url, options).then(function (response) {
        clearTimeout(timeout);
        return readAbsenceFeedResponse(response);
      }, function (error) {
        clearTimeout(timeout);
        throw error;
      });
    }

    return window.fetch(url, options).then(readAbsenceFeedResponse);
  }

  function readAbsenceFeedResponse(response) {
    return response.text().then(function (text) {
      if (!response.ok) {
        var error = new Error("BrightHR returned HTTP " + response.status + ".");
        error.status = response.status;
        throw error;
      }
      return text;
    });
  }

  function getAbsenceFetchErrorMessage(error) {
    if (error && error.name === "AbortError") return "BrightHR absence feed timed out.";
    if (error && error.status) return "BrightHR absence feed returned HTTP " + error.status + ".";
    return "BrightHR absence feed could not be read. The feed may be blocked by browser CORS or unavailable.";
  }

  function clearAbsenceRuntimeState() {
    state.absence.loading = false;
    state.absence.loaded = false;
    state.absence.error = "";
    state.absence.feedKey = "";
    state.absence.loadedAt = 0;
    state.absence.events = [];
    state.absence.byPersonKey = {};
    state.absence.promise = null;
  }

  function resolveAbsenceFeedUrl() {
    var runtimeUrl = normaliseAbsenceFeedUrl(state.absence.feedUrl);
    if (runtimeUrl) return { url: runtimeUrl, source: state.absence.feedUrlSource || "runtime" };

    var globalUrl = normaliseAbsenceFeedUrl(window.WiseCapacityTrackerAbsenceFeedUrl);
    if (globalUrl) return { url: globalUrl, source: "window" };

    var config = window.WiseCapacityTrackerConfig;
    var configUrl = "";
    if (config && typeof config === "object") {
      configUrl = config.absenceFeedUrl || (config.absence && config.absence.feedUrl);
    }
    configUrl = normaliseAbsenceFeedUrl(configUrl);
    if (configUrl) return { url: configUrl, source: "window-config" };

    var storedUrl = normaliseAbsenceFeedUrl(readStoredAbsenceFeedUrl());
    if (storedUrl) return { url: storedUrl, source: "localStorage" };

    return { url: "", source: "" };
  }

  function normaliseAbsenceFeedUrl(url) {
    var text = asText(url);
    if (!text) return "";
    if (!/^https:\/\//i.test(text)) return "";
    return text;
  }

  function getAbsenceFeedKey(url) {
    var text = normaliseAbsenceFeedUrl(url);
    if (!text) return "";
    var match = text.match(/^https:\/\/([^\/]+)(\/.*)$/i);
    return match ? match[1].toLowerCase() + match[2].replace(/[?#].*$/, "") : text.replace(/[?#].*$/, "");
  }

  function readStoredAbsenceFeedUrl() {
    try {
      return window.localStorage ? window.localStorage.getItem(CFG.absenceFeed.localStorageKey) : "";
    } catch (e) {
      return "";
    }
  }

  function writeStoredAbsenceFeedUrl(url) {
    try {
      if (window.localStorage) window.localStorage.setItem(CFG.absenceFeed.localStorageKey, url);
    } catch (e) {}
  }

  function removeStoredAbsenceFeedUrl() {
    try {
      if (window.localStorage) window.localStorage.removeItem(CFG.absenceFeed.localStorageKey);
    } catch (e) {}
  }

  function parseIcsEvents(text) {
    var unfolded = unfoldIcsLines(text);
    var blocks = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];
    var events = [];

    for (var i = 0; i < blocks.length; i++) {
      var event = parseIcsEventBlock(blocks[i], i);
      if (event) events.push(event);
    }

    return events;
  }

  function unfoldIcsLines(text) {
    return String(text || "").replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  }

  function parseIcsEventBlock(block, index) {
    var props = parseIcsProperties(block);
    var startProp = getFirstIcsProperty(props, "DTSTART");
    if (!startProp) return null;

    var endProp = getFirstIcsProperty(props, "DTEND");
    var summaryProp = getFirstIcsProperty(props, "SUMMARY");
    var uidProp = getFirstIcsProperty(props, "UID");
    var start = parseIcsDateValue(startProp.value);
    if (!start) return null;

    var allDay = isIcsDateOnly(startProp);
    var endExclusive = endProp ? parseIcsDateValue(endProp.value) : null;
    if (!endExclusive) endExclusive = allDay ? addDays(start, 1) : new Date(start.getTime());
    if (endExclusive.getTime() <= start.getTime()) endExclusive = allDay ? addDays(start, 1) : addDays(startOfDay(start), 1);

    var summary = unescapeIcsText(summaryProp ? summaryProp.value : "");
    var candidates = getAbsenceNameCandidates(summary);
    if (!candidates.length) return null;

    return {
      uid: asText(uidProp ? uidProp.value : "") || ("absence-" + index),
      summary: summary,
      nameCandidates: candidates,
      start: allDay ? startOfDay(start) : start,
      endExclusive: allDay ? startOfDay(endExclusive) : endExclusive,
      allDay: allDay
    };
  }

  function parseIcsProperties(block) {
    var props = {};
    var lines = unfoldIcsLines(block).split(/\r?\n/);

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var colon = line.indexOf(":");
      if (colon <= 0) continue;

      var head = line.substr(0, colon);
      var value = line.substr(colon + 1);
      var parts = head.split(";");
      var name = asText(parts.shift()).toUpperCase();
      if (!name || name === "BEGIN" || name === "END") continue;

      var params = {};
      for (var p = 0; p < parts.length; p++) {
        var eq = parts[p].indexOf("=");
        if (eq > 0) params[parts[p].substr(0, eq).toUpperCase()] = parts[p].substr(eq + 1);
      }

      if (!props[name]) props[name] = [];
      props[name].push({ name: name, params: params, value: value });
    }

    return props;
  }

  function getFirstIcsProperty(props, name) {
    var values = props && props[String(name || "").toUpperCase()];
    return values && values.length ? values[0] : null;
  }

  function isIcsDateOnly(prop) {
    var value = asText(prop && prop.value);
    var valueType = prop && prop.params ? asText(prop.params.VALUE).toUpperCase() : "";
    return valueType === "DATE" || /^\d{8}$/.test(value);
  }

  function parseIcsDateValue(value) {
    var text = asText(value);
    var dateOnly = text.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (dateOnly) return dateFromParts(Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3]), 0, 0, 0);

    var dateTime = text.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
    if (dateTime) {
      if (dateTime[7] === "Z") {
        var utc = new Date(Date.UTC(Number(dateTime[1]), Number(dateTime[2]) - 1, Number(dateTime[3]), Number(dateTime[4]), Number(dateTime[5]), Number(dateTime[6])));
        return isValidDate(utc) ? utc : null;
      }
      return dateFromParts(Number(dateTime[1]), Number(dateTime[2]), Number(dateTime[3]), Number(dateTime[4]), Number(dateTime[5]), Number(dateTime[6]));
    }

    return parseHireHopDate(text);
  }

  function unescapeIcsText(value) {
    return asText(value)
      .replace(/\\n/gi, " ")
      .replace(/\\,/g, ",")
      .replace(/\\;/g, ";")
      .replace(/\\\\/g, "\\")
      .replace(/\s+/g, " ");
  }

  function getAbsenceNameCandidates(summary) {
    var text = cleanRoleValue(summary);
    var result = [];
    if (!text) return result;

    addAbsenceNameCandidate(result, text);
    addAbsenceNameCandidate(result, text.replace(/\([^)]*\)/g, " "));

    var parts = text.split(/\s+(?:-|--|\u2013|\u2014|\||:)\s+/);
    if (parts.length > 1) {
      for (var i = 0; i < parts.length; i++) addAbsenceNameCandidate(result, parts[i]);
    }

    return result;
  }

  function addAbsenceNameCandidate(result, value) {
    var key = normalisePersonName(value);
    if (key && result.indexOf(key) === -1) result.push(key);
  }

  function buildAbsenceIndex(events) {
    var index = {};
    for (var i = 0; i < events.length; i++) {
      var event = events[i];
      for (var c = 0; c < event.nameCandidates.length; c++) {
        var key = event.nameCandidates[c];
        if (!index[key]) index[key] = [];
        index[key].push(event);
      }
    }
    return index;
  }

  function buildSearchParams(page, depotIds, jsonEncodeFilter, range) {
    range = range || buildFetchDateRange();
    var filter = buildDepotFilter(depotIds);
    var nativeStatus = getNativeStatusRequestFlags();
    return {
      local: formatServerDateTime(new Date()),
      tz: getTimezone(),
      page: page,
      rows: CFG.fetchPageSize,
      jobs: 0,
      projects: 1,
      open: nativeStatus.open,
      closed: nativeStatus.closed,
      money_owed: 0,
      is_late: 0,
      mine: 0,
      no_user: 0,
      needs_bill: 0,
      only_open_ended: 0,
      status: "",
      from_date: formatServerDateTime(range.from),
      to_date: formatServerDateTime(range.to),
      include_project_custom_fields: 1,
      include_custom_fields: 1,
      project_custom_fields: getCustomFieldKeyList().join(","),
      custom_fields: getCustomFieldKeyList().join(","),
      wise_cache: Date.now(),
      pq_filter: jsonEncodeFilter ? JSON.stringify(filter) : filter
    };
  }

  function requestProjectPage(endpoint, params) {
    var url = endpoint + (endpoint.indexOf("?") === -1 ? "?" : "&") + $.param(params);

    return window.fetch(url, {
      method: "GET",
      credentials: "same-origin",
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01"
      }
    }).then(function (response) {
      return response.text().then(function (text) {
        var json = tryParseJson(text);
        if (!response.ok) {
          var error = new Error("HireHop returned HTTP " + response.status + ".");
          error.status = response.status;
          error.responseText = text ? text.substr(0, 500) : "";
          error.searchParams = summariseSearchParams(params);
          throw error;
        }
        if (!json) throw new Error("HireHop did not return JSON from project search.");
        return json;
      });
    });
  }

  function summariseSearchParams(params) {
    return {
      page: params.page,
      rows: params.rows,
      jobs: params.jobs,
      projects: params.projects,
      open: params.open,
      closed: params.closed,
      from_date: params.from_date,
      to_date: params.to_date,
      pq_filter_type: typeof params.pq_filter
    };
  }

  function buildFetchDateRange() {
    var selected = getSelectedDateRange();
    return {
      from: selected.start,
      to: endOfDay(selected.end)
    };
  }

  function buildFetchDateRangeChunks(range) {
    var chunks = [];
    var cursor = startOfDay(range.from);
    var finalDay = startOfDay(range.to);
    var chunkDays = Math.max(14, Number(CFG.fetchChunkDays) || 120);

    while (dayNumber(cursor) <= dayNumber(finalDay)) {
      var chunkEndDay = addDays(cursor, chunkDays - 1);
      if (dayNumber(chunkEndDay) > dayNumber(finalDay)) chunkEndDay = finalDay;

      chunks.push({
        from: startOfDay(cursor),
        to: endOfDay(chunkEndDay)
      });

      cursor = addDays(chunkEndDay, 1);
    }

    return chunks.length ? chunks : [range];
  }

  function describeFetchPlan() {
    var chunks = buildFetchDateRangeChunks(buildFetchDateRange());
    return chunks.map(function (chunk) {
      return formatDate(chunk.from) + " - " + formatDate(chunk.to);
    });
  }

  function resolveTargetDepots() {
    var ids = [];
    var labels = [];

    for (var c = 0; c < CFG.targetDepotIds.length; c++) {
      var configuredId = normaliseDepotId(CFG.targetDepotIds[c]);
      if (configuredId && ids.indexOf(configuredId) === -1) ids.push(configuredId);
    }

    var depotRows = window.depots && typeof window.depots === "object" ? window.depots : null;
    if (depotRows) {
      $.each(depotRows, function (key, depot) {
        var id = normaliseDepotId(firstValue(depot, ["ID", "id", "DEPOT_ID", "depot_id"]) || key);
        var name = cleanDepotName(firstValue(depot, ["DEPOT", "depot", "NAME", "name"]));
        if (!id || !name) return;
        if (matchesTargetDepotName(name) && ids.indexOf(id) === -1) ids.push(id);
        if (ids.indexOf(id) !== -1 && labels.indexOf(name) === -1) labels.push(name);
      });
    }

    return {
      ids: ids,
      labels: labels
    };
  }

  function buildDepotFilter(depotIds) {
    var numericIds = depotIds.map(function (id) { return Number(id); }).filter(function (id) { return isFinite(id) && id > 0; });
    return {
      mode: "AND",
      data: [{
        condition: "range",
        dataIndx: "DEPOT",
        dataType: "integer",
        value: numericIds
      }]
    };
  }

  function getTargetDepotSummary() {
    var depots = resolveTargetDepots();
    return {
      names: CFG.targetDepotNames.slice(),
      ids: depots.ids,
      resolvedNames: depots.labels
    };
  }

  function extractRows(json) {
    if (Array.isArray(json)) return json;
    if (!json || typeof json !== "object") return [];
    if (Array.isArray(json.data)) return json.data;
    if (Array.isArray(json.rows)) return json.rows;
    if (Array.isArray(json.items)) return json.items;
    if (Array.isArray(json.records)) return json.records;
    if (json.data && Array.isArray(json.data.data)) return json.data.data;
    return [];
  }

  function appendRows(target, rows) {
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i] && rows[i].rowData ? rows[i].rowData : rows[i];
      if (!row || row.pq_empty) continue;
      target.push(row);
    }
  }

  function dedupeProjectRows(rows) {
    var seen = {};
    var deduped = [];

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i] && rows[i].rowData ? rows[i].rowData : rows[i];
      var key = getProjectRowKey(row, i);
      if (seen[key]) continue;
      seen[key] = true;
      deduped.push(row);
    }

    return deduped;
  }

  function getProjectRowKey(row, index) {
    var id = firstValue(row || {}, ["NUMBER", "PROJECT_ID", "PROJECT_NUMBER", "ID", "id", "project_id"]);
    return id ? "project:" + asText(id) : "row:" + index + ":" + normaliseSearch(JSON.stringify(row || {})).substr(0, 120);
  }

  function normaliseProject(raw, index) {
    raw = raw || {};

    var onsiteStart = readHireHopDateTime(raw, ["JOB_DATE", "PROJECT_START", "ONSITE_START", "START_DATE", "START"], ["JOB_TIME", "PROJECT_START_TIME", "ONSITE_START_TIME", "START_TIME"], [["job", "date"], ["onsite", "start"]], [["job", "time"], ["onsite", "start", "time"]]);
    var onsiteEnd = readHireHopDateTime(raw, ["JOB_END", "PROJECT_END", "ONSITE_END", "END_DATE", "END"], ["JOB_END_TIME", "PROJECT_END_TIME", "ONSITE_END_TIME", "END_TIME"], [["job", "end"], ["onsite", "end"]], [["job", "end", "time"], ["onsite", "end", "time"]]);
    var kitStart = readHireHopDateTime(raw, ["OUT_DATE", "OUT_DATETIME", "OUT_DATE_TIME", "OUT_AT", "BOOK_OUT_DATE", "BOOKED_OUT_DATE", "BOOKING_START_DATE", "KIT_BOOKING_START", "KIT_BOOKING_START_DATE", "KIT_START", "KIT_START_DATE", "OUT"], ["OUT_TIME", "OUT_START_TIME", "OUT_HOUR", "DATE_OUT_TIME", "BOOK_OUT_TIME", "BOOKED_OUT_TIME", "BOOKING_START_TIME", "KIT_BOOKING_START_TIME", "KIT_START_TIME"], [["out", "date"], ["kit", "start"], ["booking", "start"]], [["out", "time"], ["time", "out"], ["kit", "start", "time"], ["booking", "start", "time"]]);
    var kitEnd = readHireHopDateTime(raw, ["RETURN_DATE", "RETURN_DATETIME", "RETURN_DATE_TIME", "RETURN_AT", "IN_DATE", "BOOK_IN_DATE", "BOOKED_IN_DATE", "BOOKING_END_DATE", "KIT_RETURN", "KIT_RETURN_DATE", "KIT_BOOKING_END", "KIT_BOOKING_END_DATE", "KIT_END", "KIT_END_DATE", "RETURN"], ["RETURN_TIME", "RETURN_END_TIME", "RETURN_HOUR", "DATE_RETURN_TIME", "IN_TIME", "BOOK_IN_TIME", "BOOKED_IN_TIME", "BOOKING_END_TIME", "KIT_RETURN_TIME", "KIT_BOOKING_END_TIME", "KIT_END_TIME"], [["return", "date"], ["kit", "end"], ["kit", "return"], ["booking", "end"]], [["return", "time"], ["time", "return"], ["kit", "end", "time"], ["kit", "return", "time"], ["booking", "end", "time"]]);
    var created = parseHireHopDate(firstValue(raw, ["CREATE_DATE", "CREATED_DATE", "CREATED", "DATE_CREATED"]));

    var start = kitStart || onsiteStart;
    var end = kitEnd || onsiteEnd || start;
    if (start && end && end.getTime() < start.getTime()) end = start;

    var wiseStatus = normaliseWiseStatus(getCustomField(raw, CFG.customFieldKeys.status));
    var nativeStatus = readProjectStatusName(raw);
    var wiseJobNumber = asText(getCustomField(raw, CFG.customFieldKeys.jobNumber));
    var client = asText(getCustomField(raw, CFG.customFieldKeys.client));
    var venue = asText(getCustomField(raw, CFG.customFieldKeys.venue));
    var tier = asText(getCustomField(raw, CFG.customFieldKeys.tier));
    var projectName = asText(getCustomField(raw, CFG.customFieldKeys.projectName));

    var project = {
      uid: "wct-project-" + (firstValue(raw, ["NUMBER", "PROJECT_ID", "ID", "id", "project_id"]) || index || Math.random()).toString().replace(/[^a-z0-9_-]+/gi, "-"),
      raw: raw,
      kind: firstValue(raw, ["kind", "KIND", "TYPE", "type"]),
      id: asText(firstValue(raw, ["NUMBER", "PROJECT_ID", "PROJECT_NUMBER", "ID", "id", "project_id"])),
      name: projectName || asText(firstValue(raw, ["JOB_NAME", "PROJECT_NAME", "NAME", "name", "project_name"])),
      wiseProjectName: projectName,
      nativeName: asText(firstValue(raw, ["JOB_NAME", "PROJECT_NAME", "NAME", "name", "project_name"])),
      wiseJobNumber: wiseJobNumber || asText(firstValue(raw, ["~_WiseJobNumber", "~_Wise_Job_Number", "~_Wise_Job_No", "~_JobNumber", "~_Job_Number", "WISE_JOB_NUMBER", "WISE_JOB_NO", "JOB_NUMBER", "JOB_NO"])),
      client: client || asText(firstValue(raw, ["CLIENT", "CLIENT_NAME", "CUSTOMER", "customer"])),
      venue: venue || asText(firstValue(raw, ["VENUE", "VENUE_NAME", "LOCATION", "location"])),
      status: wiseStatus,
      nativeStatus: nativeStatus,
      statusKey: getWiseStatusKey(wiseStatus),
      statusColor: getWiseStatusColor(wiseStatus),
      statusValue: firstValue(raw, ["STATUS", "status"]),
      colour: normaliseColour(firstValue(raw, ["COLOUR", "COLOR", "STATUS_COLOUR", "STATUS_COLOR", "colour", "color"])),
      kitStart: kitStart,
      onsiteStart: onsiteStart,
      onsiteEnd: onsiteEnd,
      kitEnd: kitEnd,
      created: created,
      start: start,
      end: end,
      revenue: asText(getCustomField(raw, CFG.customFieldKeys.revenue)),
      tier: tier,
      roles: {
        pm: cleanRoleValue(getCustomField(raw, CFG.customFieldKeys.pm)),
        designer: cleanRoleValue(getCustomField(raw, CFG.customFieldKeys.designer)),
        tpm: cleanRoleValue(getCustomField(raw, CFG.customFieldKeys.tpm)),
        production: cleanRoleValue(getCustomField(raw, CFG.customFieldKeys.production))
      }
    };

    project.searchText = buildProjectSearchText(project);
    return project;
  }

  function getCustomField(raw, key) {
    if (!raw || !key) return "";
    var keys = Array.isArray(key) ? key : [key];

    for (var k = 0; k < keys.length; k++) {
      var fieldKey = keys[k];
      var directKeys = getCustomFieldKeyAliases(fieldKey);
      for (var i = 0; i < directKeys.length; i++) {
        if (raw[directKeys[i]] != null && raw[directKeys[i]] !== "") return customFieldToText(raw[directKeys[i]]);
      }
    }

    var containers = [
      raw.CUSTOM_FIELDS,
      raw.custom_fields,
      raw.CUSTOMFIELDS,
      raw.customFields,
      raw.PROJECT_CUSTOM_FIELDS,
      raw.project_custom_fields
    ];

    for (var c = 0; c < containers.length; c++) {
      var container = parseCustomFieldContainer(containers[c]);
      for (var ck = 0; ck < keys.length; ck++) {
        var value = readCustomFieldContainer(container, keys[ck]);
        if (value !== "") return value;
      }
    }

    return "";
  }

  function getCustomFieldKeyAliases(key) {
    key = asText(key);
    if (!key) return [];
    var stripped = key.replace(/^_+/, "");
    return uniqueValues([
      key,
      "~" + key,
      stripped,
      "~" + stripped
    ]);
  }

  function parseCustomFieldContainer(value) {
    if (!value) return null;
    if (typeof value === "string") {
      var parsed = tryParseJson(value);
      return parsed || null;
    }
    return value;
  }

  function readCustomFieldContainer(container, key) {
    if (!container) return "";

    var keys = getCustomFieldKeyAliases(key);
    for (var i = 0; i < keys.length; i++) {
      if (container[keys[i]] != null && container[keys[i]] !== "") return customFieldToText(container[keys[i]]);
    }

    if (Array.isArray(container)) {
      for (var c = 0; c < container.length; c++) {
        var item = container[c] || {};
        var name = asText(item.NAME || item.name || item.KEY || item.key || item.FIELD || item.field || item.FIELD_NAME || item.field_name || item.CUSTOM_FIELD || item.custom_field);
        if (normaliseKeyName(name) === normaliseKeyName(key)) {
          var itemValue = item.VALUE != null ? item.VALUE : item.value;
          if (itemValue == null) itemValue = item.TEXT != null ? item.TEXT : item.text;
          if (itemValue == null) itemValue = item.DISPLAY != null ? item.DISPLAY : item.display;
          return customFieldToText(itemValue);
        }
      }
    }

    return "";
  }

  function customFieldToText(value) {
    if (value == null) return "";
    if (typeof value === "object") {
      if (value.VALUE != null) return asText(value.VALUE);
      if (value.value != null) return asText(value.value);
      if (value.TEXT != null) return asText(value.TEXT);
      if (value.text != null) return asText(value.text);
      if (value.DISPLAY != null) return asText(value.DISPLAY);
      if (value.display != null) return asText(value.display);
      if (value.NAME != null) return asText(value.NAME);
      if (value.name != null) return asText(value.name);
      if (value.LABEL != null) return asText(value.LABEL);
      if (value.label != null) return asText(value.label);
    }
    return asText(value);
  }

  function readHireHopDateTime(raw, dateKeys, timeKeys, dateTokenGroups, timeTokenGroups) {
    var exactValue = firstValue(raw, dateKeys);
    var dateValue = exactValue !== "" ? exactValue : firstValueByNormalisedKey(raw, dateKeys);
    if (dateValue === "") dateValue = firstValueByKeyTokens(raw, dateTokenGroups);
    var date = parseHireHopDate(dateValue);
    if (!date) return null;

    var timeValue = firstValue(raw, timeKeys);
    if (timeValue === "") timeValue = firstValueByNormalisedKey(raw, timeKeys);
    if (timeValue === "") timeValue = firstValueByKeyTokens(raw, timeTokenGroups);
    var time = parseHireHopTime(timeValue);

    if (!time && hasExplicitTime(dateValue)) return date;
    if (!time) return date;

    return dateFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate(), time.hours, time.minutes, time.seconds);
  }

  function parseHireHopDate(value) {
    if (value == null || value === "") return null;
    if (value instanceof Date) return isValidDate(value) ? new Date(value.getTime()) : null;

    if (typeof value === "number") {
      var numericValue = Math.abs(value) < 100000000000 ? value * 1000 : value;
      var numericDate = new Date(numericValue);
      return isValidDate(numericDate) ? numericDate : null;
    }

    var text = $.trim(String(value));
    if (!text || text === "0000-00-00" || text === "0000-00-00 00:00:00") return null;

    var iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (iso) {
      return dateFromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]), Number(iso[4] || 0), Number(iso[5] || 0), Number(iso[6] || 0));
    }

    var slash = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (slash) {
      var first = Number(slash[1]);
      var second = Number(slash[2]);
      var year = Number(slash[3]);
      if (year < 100) year += 2000;

      var dateOrder = getHireHopDateOrder();
      var day = dateOrder === "mdy" ? second : first;
      var month = dateOrder === "mdy" ? first : second;
      if (first > 12) {
        day = first;
        month = second;
      } else if (second > 12) {
        day = second;
        month = first;
      }

      return dateFromParts(year, month, day, Number(slash[4] || 0), Number(slash[5] || 0), Number(slash[6] || 0));
    }

    var parsed = new Date(text);
    return isValidDate(parsed) ? parsed : null;
  }

  function parseHireHopTime(value) {
    if (value == null || value === "") return null;
    if (value instanceof Date && isValidDate(value)) {
      return {
        hours: value.getHours(),
        minutes: value.getMinutes(),
        seconds: value.getSeconds()
      };
    }

    var text = $.trim(String(value));
    if (!text || text === "00:00:00" || /^0+$/.test(text)) return null;

    if (/^\d{3,4}$/.test(text)) {
      var padded = text.length === 3 ? "0" + text : text;
      var compactHours = Number(padded.substr(0, 2));
      var compactMinutes = Number(padded.substr(2, 2));
      if (compactHours > 23 || compactMinutes > 59) return null;
      return {
        hours: compactHours,
        minutes: compactMinutes,
        seconds: 0
      };
    }

    if (hasExplicitTime(text) && /\d{1,4}[\/.-]\d{1,2}[\/.-]\d{1,4}/.test(text)) {
      var date = parseHireHopDate(text);
      if (date) {
        return {
          hours: date.getHours(),
          minutes: date.getMinutes(),
          seconds: date.getSeconds()
        };
      }
    }

    var time = text.match(/(\d{1,2})(?:[:.h](\d{2}))?(?:[:.](\d{2}))?\s*(am|pm)?/i);
    if (!time) return null;

    var hours = Number(time[1]);
    var minutes = Number(time[2] || 0);
    var seconds = Number(time[3] || 0);
    var meridiem = asText(time[4]).toLowerCase();

    if (meridiem === "pm" && hours < 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;
    if (hours > 23 || minutes > 59 || seconds > 59) return null;

    return {
      hours: hours,
      minutes: minutes,
      seconds: seconds
    };
  }

  function hasExplicitTime(value) {
    if (value instanceof Date) {
      return value.getHours() !== 0 || value.getMinutes() !== 0 || value.getSeconds() !== 0 || value.getMilliseconds() !== 0;
    }
    var text = asText(value);
    return /(?:T|\s)\d{1,2}:\d{2}/.test(text);
  }

  function formatDate(value) {
    if (!value) return "";
    var date = value instanceof Date ? value : parseHireHopDate(value);
    if (!date) return "";
    return pad2(date.getDate()) + "/" + pad2(date.getMonth() + 1) + "/" + date.getFullYear();
  }

  function formatDateShort(value) {
    if (!value) return "";
    var date = value instanceof Date ? value : parseHireHopDate(value);
    if (!date) return "";
    return pad2(date.getDate()) + " " + getMonthName(date, true);
  }

  function formatDateTime(value) {
    if (!value) return "";
    var date = value instanceof Date ? value : parseHireHopDate(value);
    if (!date) return "";
    return formatDate(date) + " " + pad2(date.getHours()) + ":" + pad2(date.getMinutes());
  }

  function formatDateInput(value) {
    var date = value instanceof Date ? value : parseHireHopDate(value);
    if (!date) return "";
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
  }

  function parseDateInput(value) {
    var text = asText(value);
    var match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return dateFromParts(Number(match[1]), Number(match[2]), Number(match[3]), 0, 0, 0);
  }

  function createDefaultDateRange() {
    var today = startOfDay(new Date());
    return {
      start: startOfDay(addMonths(today, -CFG.defaultRangeMonthsBefore)),
      end: startOfDay(addMonths(today, CFG.defaultRangeMonthsAfter))
    };
  }

  function getSelectedDateRange() {
    var start = state.dateRangeStart || createDefaultDateRange().start;
    var end = state.dateRangeEnd || createDefaultDateRange().end;
    if (dayNumber(end) < dayNumber(start)) end = start;
    return {
      start: startOfDay(start),
      end: startOfDay(end)
    };
  }

  function getSelectedDateRangeLabel() {
    var range = getSelectedDateRange();
    return formatDate(range.start) + " - " + formatDate(range.end);
  }

  function getSelectedRangeKey() {
    var range = getSelectedDateRange();
    var nativeStatus = getNativeStatusRequestFlags();
    return [
      formatDateInput(range.start),
      formatDateInput(range.end),
      nativeStatus.open ? "open" : "no-open",
      nativeStatus.closed ? "closed" : "no-closed"
    ].join("|");
  }

  function applyDateRangeFromControls() {
    var start = parseDateInput($("#wise-capacity-tracker-date-start").val());
    var end = parseDateInput($("#wise-capacity-tracker-date-end").val());
    if (!start || !end) {
      updateControlsFromState();
      return false;
    }
    if (dayNumber(end) < dayNumber(start)) end = start;
    start = startOfDay(start);
    end = startOfDay(end);
    var changed = dayNumber(start) !== dayNumber(state.dateRangeStart) || dayNumber(end) !== dayNumber(state.dateRangeEnd);
    state.dateRangeStart = start;
    state.dateRangeEnd = end;
    updateControlsFromState();
    return changed;
  }

  function invalidateLoadedProjects() {
    state.loaded = false;
    state.loadedRangeKey = "";
  }

  function syncFetchControlsFromDom() {
    if ($("#wise-capacity-tracker-date-start").length) applyDateRangeFromControls();
    if ($("#" + CFG.nativeStatusFiltersId).length) applyNativeStatusFromControls("");
  }

  function isOpenProject(project) {
    if (!project) return false;
    if (!isProjectRecord(project)) return false;
    if (isDeletedProject(project.raw)) return false;
    return getWiseStatusKey(project.status) !== "closed_lost";
  }

  function getProjectStart(project) {
    return project ? (project.kitStart || project.onsiteStart || null) : null;
  }

  function getProjectEnd(project) {
    if (!project) return null;
    return project.kitEnd || project.onsiteEnd || getProjectStart(project);
  }

  function buildTimelineRange(projects) {
    var selected = getSelectedDateRange();
    var start = selected.start;
    var end = selected.end;

    return {
      start: start,
      end: end,
      days: Math.max(1, daysBetween(start, end) + 1),
      pixelsPerDay: getPixelsPerDay()
    };
  }

  function groupProjects(projects, groupMode) {
    var mode = getGroupMode(groupMode);
    var groups = {};

    for (var i = 0; i < projects.length; i++) {
      var project = projects[i];
      var value = getProjectGroupValue(project, mode);
      var label = value || mode.unassigned;
      var key = normaliseGroupKey(label);
      if (!groups[key]) {
        groups[key] = {
          key: key,
          label: label,
          unassigned: !value,
          projects: []
        };
      }
      groups[key].projects.push(project);
    }

    var orderedGroups = Object.keys(groups).map(function (key) {
      var group = groups[key];
      group.projects.sort(sortProjectsByStart);
      group.activeToday = countActiveToday(group.projects);
      return group;
    }).sort(function (a, b) {
      return compareGroupRows(a, b, groupMode);
    });

    return applyRowOrder(orderedGroups, groupMode);
  }

  function applyRowOrder(groups, groupMode) {
    var order = state.rowOrder[groupMode] || [];
    if (!order.length) return groups;

    var index = {};
    for (var i = 0; i < order.length; i++) index[order[i]] = i;

    return groups.slice().sort(function (a, b) {
      var ai = index[a.key];
      var bi = index[b.key];
      var hasA = ai != null;
      var hasB = bi != null;
      if (hasA && hasB) return ai - bi;
      if (hasA !== hasB) return hasA ? -1 : 1;
      return compareGroupRows(a, b, groupMode);
    });
  }

  function getGroupMode(groupMode) {
    return GROUP_MODES[groupMode] || GROUP_MODES.project;
  }

  function getProjectGroupValue(project, mode) {
    if (!project || !mode) return "";

    var value = "";
    if (mode.source === "project") {
      value = project[mode.field];
    } else {
      value = project.roles ? project.roles[mode.field] : "";
    }

    if (typeof mode.normalise === "function") value = mode.normalise(value);
    return cleanRoleValue(value);
  }

  function compareGroupRows(a, b, groupMode) {
    if (a.unassigned !== b.unassigned) return a.unassigned ? 1 : -1;
    if (groupMode === "tier") return compareTierTotalLabels(a.label, b.label);
    if (groupMode === "status") return compareStatusGroupLabels(a.label, b.label);
    return a.label.localeCompare(b.label);
  }

  function compareStatusGroupLabels(a, b) {
    var ai = getStatusGroupSortIndex(a);
    var bi = getStatusGroupSortIndex(b);
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  }

  function getStatusGroupSortIndex(value) {
    var key = getWiseStatusKey(value);
    for (var i = 0; i < CFG.wiseStatuses.length; i++) {
      if (CFG.wiseStatuses[i].key === key) return i;
    }
    return CFG.wiseStatuses.length + 1;
  }

  function render() {
    hidePopover();
    updateControlsFromState();

    if (state.loading) {
      setStatus("Loading Wise projects...", "loading");
      return;
    }

    var view = buildViewModel();
    state.visibleProjects = view.visibleProjects;
    state.datedProjects = view.datedProjects;
    state.missingDateProjects = view.missingDateProjects;
    state.rows = view.rows;
    state.timeline = view.timeline;
    state.projectMap = view.projectMap;

    $(".wct-left-head").text(getGroupMode(state.groupMode).headerLabel);
    renderSummary(view);
    renderMissingDates(view.missingDateProjects);

    if (!state.projects.length) {
      setStatus("No projects were returned by HireHop for the selected date range.", "empty");
      clearTimeline();
      return;
    }

    if (!view.visibleProjects.length) {
      setStatus("No projects match the current filters.", "empty");
      clearTimeline();
      return;
    }

    setStatus("", "");
    renderTimelineHeader(view.timeline, view.capacity);
    renderProjectBars(view);
    renderTimelineTotals(view);
    syncTimelineScrollLayout();
    syncTimelineScroll();
    updateVisibleRangeText();
  }

  function buildViewModel() {
    var search = normaliseSearch(state.search);
    var selected = getSelectedDateRange();
    var visible = [];

    for (var i = 0; i < state.projects.length; i++) {
      var project = state.projects[i];
      if (isDeletedProject(project.raw)) continue;
      if (!isProjectStatusVisible(project)) continue;
      if (search && project.searchText.indexOf(search) === -1) continue;
      if (state.showUnassignedOnly && !isProjectUnassignedForCurrentMode(project)) continue;
      if (getProjectStart(project) && !projectOverlapsRange(project, selected.start, selected.end)) continue;
      visible.push(project);
    }

    var dated = [];
    var missing = [];
    for (var d = 0; d < visible.length; d++) {
      if (getProjectStart(visible[d])) dated.push(visible[d]);
      else missing.push(visible[d]);
    }

    dated.sort(sortProjectsByStart);
    var timeline = buildTimelineRange(dated);
    var capacity = buildCapacityModel(dated, timeline);
    var rows = buildRows(groupProjects(dated, state.groupMode), timeline);
    var absenceSummary = buildVisibleAbsenceSummary(rows);
    var projectMap = {};
    for (var r = 0; r < rows.length; r++) {
      var rowProjects = rows[r].projects || [];
      for (var p = 0; p < rowProjects.length; p++) {
        projectMap[rowProjects[p].uid] = rowProjects[p];
      }
    }

    return {
      visibleProjects: visible,
      datedProjects: dated,
      missingDateProjects: missing,
      timeline: timeline,
      capacity: capacity,
      absenceSummary: absenceSummary,
      rows: rows,
      projectMap: projectMap,
      totalHeight: rows.length ? rows[rows.length - 1].top + rows[rows.length - 1].height : 0
    };
  }

  function buildRows(groups, timeline) {
    var rows = [];
    var top = 0;

    for (var g = 0; g < groups.length; g++) {
      var group = groups[g];
      assignProjectLanes(group);
      var groupLoad = buildProjectLoadMap(group.projects, timeline);

      var lanes = Math.max(1, group.laneCount || 1);
      var height = Math.max(
        CFG.personRowMinHeight,
        (lanes * CFG.barHeight) + ((lanes - 1) * CFG.laneGap)
      );

      rows.push({
        type: "group",
        key: group.key,
        label: group.label,
        count: group.projects.length,
        activeToday: group.activeToday || 0,
        liveCount: groupLoad.totalLive,
        peakLiveLoad: groupLoad.maxDay,
        loadLevel: getCapacityLevel(groupLoad.maxDay),
        projects: group.projects,
        lanes: group.lanes || {},
        laneCount: lanes,
        absences: getGroupAbsences(group, timeline),
        unassigned: group.unassigned,
        top: top,
        height: height
      });
      top += height;
    }

    return rows;
  }

  function getGroupAbsences(group, timeline) {
    if (!isPersonGroupMode(state.groupMode)) return [];
    if (!group || group.unassigned || !timeline || !state.absence.loaded) return [];

    var keys = getPersonNameKeys(group.label);
    if (!keys.length) return [];

    var seen = {};
    var result = [];
    for (var i = 0; i < keys.length; i++) {
      var matches = state.absence.byPersonKey[keys[i]] || [];
      for (var m = 0; m < matches.length; m++) {
        var absence = matches[m];
        var dedupeKey = absence.uid + ":" + dayNumber(absence.start) + ":" + dayNumber(absence.endExclusive);
        if (seen[dedupeKey]) continue;
        if (!absenceOverlapsTimeline(absence, timeline)) continue;
        seen[dedupeKey] = true;
        result.push(absence);
      }
    }

    result.sort(function (a, b) {
      return a.start.getTime() - b.start.getTime();
    });
    return result;
  }

  function buildVisibleAbsenceSummary(rows) {
    var summary = {
      active: isAbsenceSummaryActive(),
      personGrouping: isPersonGroupMode(state.groupMode),
      loading: !!state.absence.loading,
      loaded: !!state.absence.loaded,
      error: state.absence.error,
      rowCount: 0,
      rangeCount: 0
    };

    for (var i = 0; i < rows.length; i++) {
      var count = rows[i].absences ? rows[i].absences.length : 0;
      if (!count) continue;
      summary.rowCount++;
      summary.rangeCount += count;
    }

    return summary;
  }

  function isAbsenceSummaryActive() {
    return !!(state.absence.configured || state.absence.loading || state.absence.loaded || state.absence.error);
  }

  function absenceOverlapsTimeline(absence, timeline) {
    if (!absence || !timeline || !absence.start || !absence.endExclusive) return false;
    var clipEnd = getTimelineClipEnd(timeline);
    return absence.endExclusive.getTime() > timeline.start.getTime() && absence.start.getTime() < clipEnd.getTime();
  }

  function isPersonGroupMode(groupMode) {
    if (!CFG.absenceFeed || !CFG.absenceFeed.personGroupModes) return false;
    return CFG.absenceFeed.personGroupModes.indexOf(groupMode) !== -1;
  }

  function assignProjectLanes(group) {
    var laneEnds = [];
    var lanes = {};
    var projects = group.projects || [];

    for (var i = 0; i < projects.length; i++) {
      var project = projects[i];
      var startDate = getProjectStart(project);
      var endDate = getProjectEnd(project) || startDate;
      var start = startDate ? startDate.getTime() : 0;
      var end = endDate ? Math.max(endDate.getTime(), start) : start;
      var lane = 0;

      while (laneEnds[lane] != null && start < laneEnds[lane]) lane++;
      laneEnds[lane] = end;
      lanes[project.uid] = lane;
    }

    group.lanes = lanes;
    group.laneCount = Math.max(1, laneEnds.length);
  }

  function buildCapacityModel(projects, timeline) {
    var model = buildProjectLoadMap(projects, timeline);
    var weekLoads = {};
    var maxWeek = 0;

    if (timeline) {
      for (var i = 0; i < projects.length; i++) {
        var project = projects[i];
        if (!isCapacityLiveProject(project)) continue;

        var start = getProjectStart(project);
        var end = getProjectEnd(project) || start;
        if (!start || !end || !projectOverlapsRange(project, timeline.start, timeline.end)) continue;

        var visibleStart = dayNumber(start) < dayNumber(timeline.start) ? timeline.start : start;
        var visibleEnd = dayNumber(end) > dayNumber(timeline.end) ? timeline.end : end;
        var cursor = startOfWeek(visibleStart);

        while (dayNumber(cursor) <= dayNumber(visibleEnd)) {
          var weekKey = String(dayNumber(cursor));
          weekLoads[weekKey] = (weekLoads[weekKey] || 0) + 1;
          if (weekLoads[weekKey] > maxWeek) maxWeek = weekLoads[weekKey];
          cursor = addDays(cursor, 7);
        }
      }
    }

    model.weekLoads = weekLoads;
    model.maxWeek = maxWeek;
    model.peakWeekDate = null;
    model.peakWeekDayNumber = null;

    $.each(weekLoads, function (key, count) {
      if (count === maxWeek && model.peakWeekDayNumber == null) {
        model.peakWeekDayNumber = Number(key);
        model.peakWeekDate = dateFromDayNumber(Number(key));
      }
    });

    return model;
  }

  function buildProjectLoadMap(projects, timeline) {
    var dayLoads = {};
    var maxDay = 0;
    var totalLive = 0;
    var peakDayNumber = null;

    if (!timeline) {
      return { dayLoads: dayLoads, maxDay: 0, peakDayNumber: null, peakDayDate: null, maxWeek: 0, peakWeekDayNumber: null, peakWeekDate: null, weekLoads: {}, totalLive: 0 };
    }

    for (var i = 0; i < projects.length; i++) {
      var project = projects[i];
      if (!isCapacityLiveProject(project)) continue;

      var start = getProjectStart(project);
      var end = getProjectEnd(project) || start;
      if (!start || !end || !projectOverlapsRange(project, timeline.start, timeline.end)) continue;

      totalLive++;
      var visibleStart = dayNumber(start) < dayNumber(timeline.start) ? timeline.start : start;
      var visibleEnd = dayNumber(end) > dayNumber(timeline.end) ? timeline.end : end;
      var cursor = startOfDay(visibleStart);

      while (dayNumber(cursor) <= dayNumber(visibleEnd)) {
        var key = String(dayNumber(cursor));
        dayLoads[key] = (dayLoads[key] || 0) + 1;
        if (dayLoads[key] > maxDay) {
          maxDay = dayLoads[key];
          peakDayNumber = Number(key);
        }
        cursor = addDays(cursor, 1);
      }
    }

    return {
      dayLoads: dayLoads,
      maxDay: maxDay,
      peakDayNumber: peakDayNumber,
      peakDayDate: peakDayNumber == null ? null : dateFromDayNumber(peakDayNumber),
      maxWeek: 0,
      peakWeekDayNumber: null,
      peakWeekDate: null,
      weekLoads: {},
      totalLive: totalLive
    };
  }

  function isCapacityLiveProject(project) {
    return !!(project && isProjectRecord(project) && !isDeletedProject(project.raw) && isOpenProject(project));
  }

  function getDayLoad(capacity, date) {
    if (!capacity || !capacity.dayLoads || !date) return 0;
    return capacity.dayLoads[String(dayNumber(date))] || 0;
  }

  function getWeekLoad(capacity, date) {
    if (!capacity || !capacity.weekLoads || !date) return 0;
    return capacity.weekLoads[String(dayNumber(startOfWeek(date)))] || 0;
  }

  function getCapacityLevel(count) {
    count = Number(count) || 0;
    if (count <= 0) return "";
    if (count >= CFG.capacityHighThreshold) return "high";
    if (count >= CFG.capacityMediumThreshold) return "medium";
    return "low";
  }

  function getCapacityClass(count) {
    var level = getCapacityLevel(count);
    return level ? " is-load-" + level : "";
  }

  function getLoadLabel(count, noun) {
    count = Number(count) || 0;
    return count + " " + noun + (count === 1 ? "" : "s");
  }

  function renderSummary(view) {
    var capacity = view.capacity || {};
    var items = [
      { label: "Visible", value: view.visibleProjects.length },
      { label: "Live", value: capacity.totalLive || 0 },
      { label: "Peak day", value: formatPeakSummary(capacity.maxDay, capacity.peakDayDate), dayNumber: capacity.peakDayNumber },
      { label: "Peak week", value: formatPeakSummary(capacity.maxWeek, capacity.peakWeekDate), dayNumber: capacity.peakWeekDayNumber },
      { label: "Missing dates", value: view.missingDateProjects.length }
    ];

    var absenceItem = getAbsenceSummaryItem(view.absenceSummary);
    if (absenceItem) items.push(absenceItem);
    items.push({ label: "Range", value: '<span id="wise-capacity-tracker-visible-range">' + escapeHtml(getVisibleRangeLabel(view.timeline)) + '</span>' });

    $("#" + CFG.summaryId).html(items.map(function (item) {
      var clickable = item.dayNumber != null && item.dayNumber !== "" && Number(item.dayNumber) >= 0;
      var tag = clickable ? "button" : "div";
      var attrs = clickable ? ' type="button" data-scroll-day="' + escapeAttr(item.dayNumber) + '"' : "";
      return '<' + tag + attrs + ' class="wct-summary-pill' + (clickable ? " is-clickable" : "") + '"><span>' + escapeHtml(item.label) + '</span><strong>' + item.value + '</strong></' + tag + '>';
    }).join(""));
  }

  function getAbsenceSummaryItem(summary) {
    if (!summary || !summary.active) return null;

    var value = "";
    if (summary.loading) value = "Loading";
    else if (summary.error) value = "Unavailable";
    else if (!summary.personGrouping) value = "Person rows only";
    else value = summary.rangeCount + " range" + (summary.rangeCount === 1 ? "" : "s");

    return { label: "Absence", value: escapeHtml(value) };
  }

  function formatPeakSummary(count, date) {
    count = Number(count) || 0;
    if (!count || !date) return "0";
    return count + " | " + formatDateShort(date);
  }

  function formatAbsenceRange(absence) {
    if (!absence || !absence.start || !absence.endExclusive) return "";
    var endDisplay = absence.allDay ? addDays(absence.endExclusive, -1) : absence.endExclusive;
    if (dayNumber(absence.start) === dayNumber(endDisplay)) return formatDate(absence.start);
    return formatDate(absence.start) + " - " + formatDate(endDisplay);
  }

  function renderMissingDates(projects) {
    var $missing = $("#" + CFG.missingId);
    if (!projects.length) {
      $missing.empty().hide();
      return;
    }

    var max = Math.min(projects.length, 8);
    var labels = [];
    for (var i = 0; i < max; i++) {
      labels.push(escapeHtml(getProjectLabel(projects[i])));
    }

    $missing.html(
      '<strong>' + projects.length + ' project' + (projects.length === 1 ? "" : "s") + ' missing usable dates</strong>' +
      '<span>' + labels.join(", ") + (projects.length > max ? "..." : "") + '</span>'
    ).show();
  }

  function renderTimelineHeader(timeline, capacity) {
    var html = [];
    var width = timeline.days * timeline.pixelsPerDay;
    var cursor = startOfMonth(timeline.start);

    if (dayNumber(cursor) > dayNumber(timeline.start)) cursor = addMonths(cursor, -1);

    while (dayNumber(cursor) <= dayNumber(timeline.end)) {
      var next = addMonths(cursor, 1);
      var left = Math.max(0, daysBetween(timeline.start, cursor) * timeline.pixelsPerDay);
      var right = Math.min(width, daysBetween(timeline.start, next) * timeline.pixelsPerDay);
      var segmentWidth = Math.max(1, right - left);
      html.push(
        '<div class="wct-month-segment" style="left:' + left + 'px;width:' + segmentWidth + 'px;">' +
          escapeHtml(getMonthName(cursor, false) + " " + cursor.getFullYear()) +
        '</div>'
      );
      cursor = next;
    }

    appendDayTicks(html, timeline, width, capacity);
    appendWeekLoadBands(html, timeline, width, capacity);

    $("#" + CFG.timelineHeaderId).css("width", width + "px").html(html.join(""));
  }

  function renderProjectBars(view) {
    var timeline = view.timeline;
    var width = timeline.days * timeline.pixelsPerDay;
    var height = Math.max(view.totalHeight, 80);
    var html = [];

    html.push('<div class="wct-row-backdrop" style="height:' + height + 'px;width:' + width + 'px;">');
    for (var i = 0; i < view.rows.length; i++) {
      var row = view.rows[i];
      html.push('<div class="wct-row-line is-' + row.type + '" style="top:' + row.top + 'px;height:' + row.height + 'px;"></div>');
    }
    html.push('</div>');
    appendBodyDayGrid(html, timeline, width, height, view.capacity);
    appendAbsenceBands(html, view.rows, timeline, width);

    var todayLeft = getTimelineX(timeline, new Date());
    if (todayLeft >= 0 && todayLeft <= width) {
      html.push('<div class="wct-today-line" style="left:' + todayLeft + 'px;height:' + height + 'px;"><span>Today</span></div>');
    }

    for (var r = 0; r < view.rows.length; r++) {
      var rowModel = view.rows[r];
      if (rowModel.type !== "group") continue;
      for (var p = 0; p < rowModel.projects.length; p++) {
        var project = rowModel.projects[p];
        html.push(renderProjectBar(rowModel, project, rowModel.lanes[project.uid] || 0, timeline));
      }
    }

    $("#" + CFG.timelineBodyId)
      .css({ width: width + "px", height: height + "px" })
      .html(html.join(""));

    renderLeftRows(view.rows, height);
  }

  function appendAbsenceBands(html, rows, timeline, width) {
    if (!isPersonGroupMode(state.groupMode) || !state.absence.loaded) return;

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var absences = row.absences || [];
      for (var a = 0; a < absences.length; a++) {
        html.push(renderAbsenceBand(row, absences[a], timeline, width));
      }
    }
  }

  function renderAbsenceBand(row, absence, timeline, width) {
    var clipEnd = getTimelineClipEnd(timeline);
    var visibleStart = absence.start.getTime() < timeline.start.getTime() ? timeline.start : absence.start;
    var visibleEnd = absence.endExclusive.getTime() > clipEnd.getTime() ? clipEnd : absence.endExclusive;
    var left = clamp(getTimelineX(timeline, visibleStart), 0, width);
    var right = clamp(getTimelineX(timeline, visibleEnd), 0, width);
    var bandWidth = Math.max(2, right - left);
    var title = row.label + " absent: " + formatAbsenceRange(absence);

    return (
      '<div class="wct-absence-band" ' +
        'style="left:' + left + 'px;top:' + row.top + 'px;width:' + bandWidth + 'px;height:' + row.height + 'px;" ' +
        'title="' + escapeAttr(title) + '"></div>'
    );
  }

  function renderLeftRows(rows, height) {
    var html = ['<div class="wct-left-inner" style="height:' + Math.max(height, 80) + 'px;">'];

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var absenceCount = row.absences ? row.absences.length : 0;
      var rowMeta = row.count + " event" + (row.count === 1 ? "" : "s") + " | " + row.liveCount + " live | peak " + row.peakLiveLoad + " live at once" + (row.activeToday ? " | " + row.activeToday + " active today" : "") + (absenceCount ? " | " + absenceCount + " absence range" + (absenceCount === 1 ? "" : "s") : "");
      html.push(
        '<div class="wct-left-row is-group' + (row.unassigned ? " is-unassigned" : "") + getCapacityClass(row.peakLiveLoad) + '" draggable="true" data-row-key="' + escapeAttr(row.key) + '" style="top:' + row.top + 'px;height:' + row.height + 'px;" title="' + escapeAttr(rowMeta) + '">' +
          '<strong>' + escapeHtml(row.label) + '</strong>' +
          '<span class="wct-load-summary">Live ' + escapeHtml(String(row.liveCount || 0)) + ' | Peak ' + escapeHtml(String(row.peakLiveLoad || 0)) + '</span>' +
        '</div>'
      );
    }

    html.push("</div>");
    $("#" + CFG.leftBodyId).html(html.join(""));
  }

  function renderProjectBar(row, project, lane, timeline) {
    var start = getProjectStart(project);
    var end = getProjectEnd(project) || start;
    var clipEnd = getTimelineClipEnd(timeline);
    var visibleStart = start.getTime() < timeline.start.getTime() ? timeline.start : start;
    var visibleEnd = end.getTime() > clipEnd.getTime() ? clipEnd : end;
    if (visibleEnd.getTime() < visibleStart.getTime()) visibleEnd = visibleStart;
    var left = clamp(getTimelineX(timeline, visibleStart), 0, timeline.days * timeline.pixelsPerDay);
    var right = clamp(getTimelineX(timeline, visibleEnd), 0, timeline.days * timeline.pixelsPerDay);
    var minWidth = state.zoom === "quarter" ? 8 : 14;
    var width = Math.max(minWidth, right - left);
    var maxWidth = timeline.days * timeline.pixelsPerDay - left;
    if (maxWidth > 0) width = Math.min(width, maxWidth);

    var colors = getProjectBarColors(project);
    var top = row.top + CFG.lanePadding + (lane * (CFG.barHeight + CFG.laneGap));
    var title = getProjectLabel(project) + " | Kit " + formatDateTime(project.kitStart || start) + " - " + formatDateTime(project.kitEnd || end);

    return (
      '<button type="button" class="wct-project-bar is-status-' + escapeAttr(project.statusKey || CFG.unknownStatusKey) + '" data-project-uid="' + escapeAttr(project.uid) + '" ' +
        'style="left:' + left + 'px;top:' + top + 'px;width:' + width + 'px;height:' + CFG.barHeight + 'px;background:' + escapeAttr(colors.background) + ';border-color:' + escapeAttr(colors.border) + ';color:' + escapeAttr(colors.text) + ';" ' +
        'title="' + escapeAttr(title) + '">' +
        '<span>' + escapeHtml(getCardLabel(project)) + '</span>' +
      '</button>'
    );
  }

  function getProjectBarColors(project) {
    var base = project.statusColor || project.colour || "#2563eb";
    var colors = {
      background: base,
      border: "rgba(15,23,42,.22)",
      text: getReadableTextColor(base)
    };

    if (state.cardLabelMode !== "tier") return colors;

    var alpha = getTierBackgroundAlpha(project.tier);
    var tierBackground = colorToRgba(base, alpha);
    var tierBorder = colorToRgba(base, Math.min(1, alpha + 0.28));
    if (!tierBackground) return colors;

    colors.background = tierBackground;
    colors.border = tierBorder || base;
    colors.text = alpha < 0.76 ? "#102033" : getReadableTextColor(base);
    return colors;
  }

  function getTierBackgroundAlpha(tier) {
    var tierNumber = extractTierNumber(getTierTotalLabel(tier));
    if (tierNumber === 1) return 0.36;
    if (tierNumber === 2) return 0.64;
    if (tierNumber >= 3) return 0.96;
    return 0.52;
  }

  function renderTimelineTotals(view) {
    var timeline = view.timeline;
    var width = timeline.days * timeline.pixelsPerDay;
    var mode = getDayTotalMode();
    var html = [];
    var cursor = startOfDay(timeline.start);

    $("#" + CFG.totalsLabelId).text(getDayTotalLabel(mode));

    while (dayNumber(cursor) <= dayNumber(timeline.end)) {
      var left = daysBetween(timeline.start, cursor) * timeline.pixelsPerDay;
      var dayWidth = Math.max(1, Math.min(timeline.pixelsPerDay, width - left));
      var total = calculateDayTotal(view.datedProjects, cursor, mode);
      var title = getDayTotalTitle(cursor, total, mode);

      html.push(
        '<div class="wct-total-cell is-' + escapeAttr(mode) + getDayCellClasses(cursor) + getCapacityClass(total.count) + '" style="left:' + left + 'px;width:' + dayWidth + 'px;" title="' + escapeAttr(title) + '">' +
          formatDayTotalHtml(total, mode) +
        '</div>'
      );

      cursor = addDays(cursor, 1);
    }

    $("#" + CFG.timelineTotalsId)
      .css("width", width + "px")
      .html(html.join(""));
  }

  function getDayTotalMode() {
    if (state.cardLabelMode === "revenue") return "revenue";
    if (state.cardLabelMode === "tier") return "tier";
    return "count";
  }

  function getDayTotalLabel(mode) {
    if (mode === "revenue") return "Daily revenue";
    if (mode === "tier") return "Daily tier qty";
    return "Daily qty";
  }

  function calculateDayTotal(projects, date, mode) {
    var total = {
      count: 0,
      revenue: 0,
      tiers: {}
    };

    for (var i = 0; i < projects.length; i++) {
      var project = projects[i];
      if (!projectOverlapsDay(project, date)) continue;

      total.count++;

      if (mode === "revenue") {
        total.revenue += parseRevenueNumber(project.revenue) || 0;
      } else if (mode === "tier") {
        var tier = getTierTotalLabel(project.tier);
        total.tiers[tier] = (total.tiers[tier] || 0) + 1;
      }
    }

    return total;
  }

  function projectOverlapsDay(project, date) {
    var start = getProjectStart(project);
    var end = getProjectEnd(project) || start;
    if (!start || !end) return false;

    var dayStart = startOfDay(date);
    var dayEnd = addDays(dayStart, 1);

    if (end.getTime() === start.getTime()) {
      return start.getTime() >= dayStart.getTime() && start.getTime() < dayEnd.getTime();
    }

    return start.getTime() < dayEnd.getTime() && end.getTime() > dayStart.getTime();
  }

  function formatDayTotalHtml(total, mode) {
    if (mode === "revenue") {
      return '<strong>' + escapeHtml(formatSterlingValue(total.revenue) || "\u00a30.00") + '</strong>';
    }

    if (mode === "tier") {
      var tiers = getSortedTierTotalKeys(total.tiers);
      if (!tiers.length) return '<strong>0</strong>';

      var html = [];
      var max = Math.min(tiers.length, 3);
      for (var i = 0; i < max; i++) {
        html.push('<span><strong>' + escapeHtml(tiers[i]) + '</strong> ' + escapeHtml(String(total.tiers[tiers[i]])) + '</span>');
      }
      if (tiers.length > max) html.push('<span>+' + escapeHtml(String(tiers.length - max)) + '</span>');
      return html.join("");
    }

    return '<strong>' + escapeHtml(String(total.count || 0)) + '</strong>';
  }

  function getDayTotalTitle(date, total, mode) {
    if (mode === "revenue") return formatDate(date) + " total revenue: " + (formatSterlingValue(total.revenue) || "\u00a30.00") + " across " + total.count + " event" + (total.count === 1 ? "" : "s");
    if (mode === "tier") return formatDate(date) + " tier qty: " + formatTierTotalTitle(total.tiers);
    return formatDate(date) + " total qty: " + total.count + " event" + (total.count === 1 ? "" : "s");
  }

  function formatTierTotalTitle(tiers) {
    var keys = getSortedTierTotalKeys(tiers);
    if (!keys.length) return "0";

    var parts = [];
    for (var i = 0; i < keys.length; i++) {
      parts.push(keys[i] + " qty " + tiers[keys[i]]);
    }
    return parts.join(", ");
  }

  function getTierTotalLabel(value) {
    var text = cleanRoleValue(value);
    if (!text) return "No tier";

    var compact = text.match(/^(?:tier\s*)?([0-9]+)$/i) || text.match(/^t\s*([0-9]+)$/i);
    if (compact) return "T" + compact[1];

    return text;
  }

  function getTierGroupLabel(value) {
    return cleanRoleValue(value) ? getTierTotalLabel(value) : "";
  }

  function getSortedTierTotalKeys(tiers) {
    var keys = [];
    $.each(tiers || {}, function (key, count) {
      if (count > 0) keys.push(key);
    });
    keys.sort(compareTierTotalLabels);
    return keys;
  }

  function compareTierTotalLabels(a, b) {
    if (a === "No tier") return 1;
    if (b === "No tier") return -1;

    var aNumber = extractTierNumber(a);
    var bNumber = extractTierNumber(b);
    if (aNumber != null && bNumber != null && aNumber !== bNumber) return aNumber - bNumber;
    if (aNumber != null && bNumber == null) return -1;
    if (aNumber == null && bNumber != null) return 1;
    return a.localeCompare(b);
  }

  function extractTierNumber(value) {
    var match = asText(value).match(/^T\s*([0-9]+)$/i);
    return match ? Number(match[1]) : null;
  }

  function appendDayTicks(html, timeline, width, capacity) {
    var cursor = startOfDay(timeline.start);

    while (dayNumber(cursor) <= dayNumber(timeline.end)) {
      var left = daysBetween(timeline.start, cursor) * timeline.pixelsPerDay;
      var dayWidth = Math.max(1, Math.min(timeline.pixelsPerDay, width - left));
      var load = getDayLoad(capacity, cursor);
      if (left >= 0 && left <= width) {
        html.push(
          '<div class="wct-day-cell' + getDayCellClasses(cursor) + getCapacityClass(load) + '" style="left:' + left + 'px;width:' + dayWidth + 'px;" title="' + escapeAttr(getLoadLabel(load, "live event")) + '">' +
            '<em>' + escapeHtml(getWeekdayName(cursor)) + '</em>' +
            '<span>' + escapeHtml(String(cursor.getDate())) + '</span>' +
          '</div>'
        );
      }
      cursor = addDays(cursor, 1);
    }
  }

  function appendWeekLoadBands(html, timeline, width, capacity) {
    var cursor = startOfWeek(timeline.start);
    while (dayNumber(cursor) <= dayNumber(timeline.end)) {
      var next = addDays(cursor, 7);
      var left = Math.max(0, daysBetween(timeline.start, cursor) * timeline.pixelsPerDay);
      var right = Math.min(width, daysBetween(timeline.start, next) * timeline.pixelsPerDay);
      var segmentWidth = Math.max(1, right - left);
      var load = getWeekLoad(capacity, cursor);

      if (load > 0 && right > 0) {
        html.push(
          '<div class="wct-week-load' + getCapacityClass(load) + '" style="left:' + left + 'px;width:' + segmentWidth + 'px;" title="' + escapeAttr("Week of " + formatDate(cursor) + ": " + getLoadLabel(load, "live event")) + '"></div>'
        );
      }

      cursor = next;
    }
  }

  function appendBodyDayGrid(html, timeline, width, height, capacity) {
    var cursor = startOfDay(timeline.start);
    while (dayNumber(cursor) <= dayNumber(timeline.end)) {
      var left = daysBetween(timeline.start, cursor) * timeline.pixelsPerDay;
      var dayWidth = Math.max(1, Math.min(timeline.pixelsPerDay, width - left));
      var load = getDayLoad(capacity, cursor);
      if (left >= 0 && left <= width) {
        html.push('<div class="wct-day-gridline' + getDayCellClasses(cursor) + getCapacityClass(load) + '" style="left:' + left + 'px;width:' + dayWidth + 'px;height:' + height + 'px;"></div>');
      }
      cursor = addDays(cursor, 1);
    }
  }

  function getDayCellClasses(date) {
    var classes = [];
    var day = date.getDay();
    if (day === 0 || day === 6) classes.push(" is-weekend");
    if (dayNumber(date) === dayNumber(startOfDay(new Date()))) classes.push(" is-today");
    return classes.join("");
  }

  function scrollToToday(options) {
    options = options || {};
    scrollToDayNumber(dayNumber(startOfDay(new Date())), options);
  }

  function scrollToDayNumber(targetDayNumber, options) {
    options = options || {};
    var timeline = state.timeline;
    var $scroll = $("#" + CFG.timelineScrollId);
    if (!timeline || !$scroll.length) return;
    if (!isFinite(targetDayNumber)) return;

    var targetLeft = (targetDayNumber - dayNumber(timeline.start)) * timeline.pixelsPerDay;
    var bias = options.centerBias == null ? 0.42 : Number(options.centerBias);
    var left = Math.max(0, targetLeft - ($scroll.innerWidth() * bias));

    $scroll.scrollLeft(left);
    syncTimelineScroll();
  }

  function reorderCurrentRows(sourceKey, targetKey, insertAfter) {
    if (!sourceKey || !targetKey || sourceKey === targetKey) return;

    var order = [];
    for (var i = 0; i < state.rows.length; i++) {
      order.push(state.rows[i].key);
    }

    var sourceIndex = order.indexOf(sourceKey);
    var targetIndex = order.indexOf(targetKey);
    if (sourceIndex === -1 || targetIndex === -1) return;

    order.splice(sourceIndex, 1);
    targetIndex = order.indexOf(targetKey);
    order.splice(targetIndex + (insertAfter ? 1 : 0), 0, sourceKey);
    state.rowOrder[state.groupMode] = order;
  }

  function syncTimelineScroll() {
    var $scroll = $("#" + CFG.timelineScrollId);
    var $left = $("#" + CFG.leftBodyId);
    var $header = $("#" + CFG.headerScrollId);
    var $totals = $("#" + CFG.totalsScrollId);
    if (!$scroll.length) return;

    $left.scrollTop($scroll.scrollTop());
    $header.scrollLeft($scroll.scrollLeft());
    $totals.scrollLeft($scroll.scrollLeft());
    updateVisibleRangeText();
  }

  function syncTimelineScrollLayout() {
    var $scroll = $("#" + CFG.timelineScrollId);
    var $body = $("#" + CFG.timelineBodyId);
    var $leftInner = $("#" + CFG.leftBodyId + " .wct-left-inner");
    if (!$scroll.length || !$body.length || !$leftInner.length) return;

    var scrollElement = $scroll[0];
    var bodyHeight = Math.max($body.outerHeight() || 0, 80);
    var horizontalScrollbarHeight = Math.max(0, scrollElement.offsetHeight - scrollElement.clientHeight);

    $leftInner.css("height", (bodyHeight + horizontalScrollbarHeight) + "px");
  }

  function scrollTimelineFromLeftColumn(event) {
    var $scroll = $("#" + CFG.timelineScrollId);
    if (!$scroll.length) return;

    var original = event.originalEvent || event;
    var deltaX = original && original.deltaX ? original.deltaX : 0;
    var deltaY = original && original.deltaY ? original.deltaY : 0;
    if (!deltaX && !deltaY) return;

    if (original && original.deltaMode === 1) {
      deltaX *= 16;
      deltaY *= 16;
    } else if (original && original.deltaMode === 2) {
      deltaX *= $scroll.innerWidth();
      deltaY *= $scroll.innerHeight();
    }

    event.preventDefault();
    $scroll.scrollTop($scroll.scrollTop() + deltaY);
    $scroll.scrollLeft($scroll.scrollLeft() + deltaX);
    syncTimelineScroll();
  }

  function updateVisibleRangeText() {
    var timeline = state.timeline;
    var $range = $("#wise-capacity-tracker-visible-range");
    var $scroll = $("#" + CFG.timelineScrollId);
    if (!timeline || !$range.length || !$scroll.length) return;

    var startOffset = Math.max(0, Math.floor($scroll.scrollLeft() / timeline.pixelsPerDay));
    var endOffset = Math.min(timeline.days - 1, Math.ceil(($scroll.scrollLeft() + $scroll.innerWidth()) / timeline.pixelsPerDay));
    $range.text(formatDate(addDays(timeline.start, startOffset)) + " - " + formatDate(addDays(timeline.start, endOffset)));
  }

  function getVisibleRangeLabel(timeline) {
    if (!timeline) return "";
    return formatDate(timeline.start) + " - " + formatDate(timeline.end);
  }

  function clearTimeline() {
    $("#" + CFG.summaryId).empty();
    $("#" + CFG.missingId).empty().hide();
    $("#" + CFG.timelineHeaderId + ",#" + CFG.timelineBodyId + ",#" + CFG.timelineTotalsId + ",#" + CFG.leftBodyId).empty();
  }

  function setStatus(message, type) {
    var $status = $("#" + CFG.statusId);
    if (!message) {
      $status.removeClass("is-loading is-error is-empty").empty().hide();
      return;
    }
    $status
      .removeClass("is-loading is-error is-empty")
      .addClass(type ? "is-" + type : "")
      .text(message)
      .show();
  }

  function showProjectPopover(project, anchor) {
    if (!project) return;

    var html = [
      '<div class="wct-popover-head">',
        '<strong>' + escapeHtml(getProjectLabel(project) || "Untitled project") + '</strong>',
        '<button type="button" class="wct-popover-close" aria-label="Close">x</button>',
      '</div>',
      '<div class="wct-popover-grid">',
        detailItem("HireHop ID", project.id),
        detailItem("Wise ID", project.wiseJobNumber),
        detailItem("Tier", project.tier),
        detailItem("Client", project.client),
        detailItem("Venue", project.venue),
        detailItem("Status", project.status || getWiseStatusByKey(project.statusKey).label),
        detailItem("Revenue", formatSterlingValue(project.revenue) || project.revenue),
        detailItem("Kit start", formatDateTime(project.kitStart)),
        detailItem("Onsite start", formatDateTime(project.onsiteStart)),
        detailItem("Onsite end", formatDateTime(project.onsiteEnd)),
        detailItem("Kit end", formatDateTime(project.kitEnd)),
      '</div>',
      '<div class="wct-role-strip">',
        roleChip("Project", project.roles.pm),
        roleChip("Designer", project.roles.designer),
        roleChip("Technical", project.roles.tpm),
        roleChip("Production", project.roles.production),
      '</div>'
    ].join("");

    var $popover = $("#" + CFG.popoverId).html(html).show();
    positionPopover($popover, anchor);
  }

  function positionPopover($popover, anchor) {
    var anchorRect = anchor.getBoundingClientRect();
    var modalRect = document.getElementById(CFG.modalId).getBoundingClientRect();
    var left = anchorRect.left - modalRect.left;
    var top = anchorRect.bottom - modalRect.top + 8;

    $popover.css({ left: left + "px", top: top + "px" });

    var popRect = $popover.get(0).getBoundingClientRect();
    if (popRect.right > modalRect.right - 12) {
      left = Math.max(12, modalRect.width - popRect.width - 12);
    }
    if (popRect.bottom > modalRect.bottom - 12) {
      top = Math.max(12, anchorRect.top - modalRect.top - popRect.height - 8);
    }

    $popover.css({ left: left + "px", top: top + "px" });
  }

  function hidePopover() {
    $("#" + CFG.popoverId).hide().empty();
  }

  function openHireHopProject(project) {
    if (!project || !project.id) {
      setStatus("This project row does not include a HireHop Project ID.", "error");
      return;
    }

    var target = window.user && Number(window.user.NEW_TABS) === 1 ? "_blank" : "_self";
    window.open("/project.php?id=" + encodeURIComponent(project.id), target);
  }

  function ensureModal() {
    if ($("#" + CFG.overlayId).length) return;

    $("body").append(
      '<div id="' + CFG.overlayId + '" class="wct-overlay" style="display:none;">' +
        '<div id="' + CFG.modalId + '" class="wct-modal" role="dialog" aria-modal="true" aria-labelledby="wise-capacity-tracker-heading">' +
          '<div class="wct-header">' +
            '<div class="wct-title-block">' +
              '<h2 id="wise-capacity-tracker-heading">' + escapeHtml(CFG.title) + '</h2>' +
              '<p>' + escapeHtml(CFG.subtitle) + '</p>' +
            '</div>' +
            '<div class="wct-header-actions">' +
              iconButton("wise-capacity-tracker-refresh", "ui-icon-refresh", "Refresh") +
              iconButton("wise-capacity-tracker-today", "ui-icon-pin-s", "Today") +
              iconButton("wise-capacity-tracker-close", "ui-icon-closethick", "Close") +
            '</div>' +
          '</div>' +
          '<div class="wct-controls">' +
            controlSelect("wise-capacity-tracker-zoom", "Zoom", [
              ["week", "Wide"],
              ["month", "Balanced"],
              ["quarter", "Overview"]
            ]) +
            controlSelect("wise-capacity-tracker-group", "Group by", [
              ["project", "Project team"],
              ["designer", "Designer"],
              ["technical", "Technical"],
              ["production", "Production"],
              ["tier", "Tier"],
              ["status", "Status"],
              ["venue", "Venue"]
            ]) +
            controlSelect("wise-capacity-tracker-card-label", "Card label", [
              ["full", "Full"],
              ["name", "Name"],
              ["venue", "Venue"],
              ["tier", "Tier"],
              ["wise", "Wise ID"],
              ["revenue", "Revenue \u00a3"]
            ]) +
            '<label class="wct-control wct-search"><span>Search</span><input id="wise-capacity-tracker-search" type="search" autocomplete="off" placeholder="Project, client, venue or person"></label>' +
            '<label class="wct-control wct-date"><span>Start</span><input id="wise-capacity-tracker-date-start" type="date"></label>' +
            '<label class="wct-control wct-date"><span>End</span><input id="wise-capacity-tracker-date-end" type="date"></label>' +
            '<div class="wct-native-filter" id="' + CFG.nativeStatusFiltersId + '" aria-label="HireHop native status filters">' + renderNativeStatusFilterControls() + '</div>' +
            '<div class="wct-status-filter" id="' + CFG.statusFiltersId + '" aria-label="Wise status filters">' + renderStatusFilterControls() + '</div>' +
            '<label class="wct-check"><input id="wise-capacity-tracker-unassigned" type="checkbox"> <span id="wise-capacity-tracker-unassigned-label">Unassigned only</span></label>' +
          '</div>' +
          '<div id="' + CFG.statusId + '" class="wct-status" style="display:none;"></div>' +
          '<div id="' + CFG.summaryId + '" class="wct-summary"></div>' +
          '<div id="' + CFG.missingId + '" class="wct-missing" style="display:none;"></div>' +
          '<div class="wct-grid">' +
            '<div class="wct-left-head">Project team</div>' +
            '<div id="' + CFG.headerScrollId + '" class="wct-header-scroll"><div id="' + CFG.timelineHeaderId + '" class="wct-timeline-header"></div></div>' +
            '<div id="' + CFG.leftBodyId + '" class="wct-left-body"></div>' +
            '<div id="' + CFG.timelineScrollId + '" class="wct-timeline-scroll"><div id="' + CFG.timelineBodyId + '" class="wct-timeline-body"></div></div>' +
            '<div id="' + CFG.totalsLabelId + '" class="wct-left-total">Daily qty</div>' +
            '<div id="' + CFG.totalsScrollId + '" class="wct-total-scroll"><div id="' + CFG.timelineTotalsId + '" class="wct-timeline-totals"></div></div>' +
          '</div>' +
          '<div id="' + CFG.popoverId + '" class="wct-popover" style="display:none;"></div>' +
        '</div>' +
      '</div>'
    );

    bindModalEvents();
  }

  function bindModalEvents() {
    $("#" + CFG.overlayId).on("click.wiseCapacityTracker", function (event) {
      if (event.target === this) closeTracker();
    });

    $("#wise-capacity-tracker-close").on("click.wiseCapacityTracker", closeTracker);
    $("#wise-capacity-tracker-refresh").on("click.wiseCapacityTracker", refreshProjects);
    $("#wise-capacity-tracker-today").on("click.wiseCapacityTracker", function () { scrollToToday({ centerBias: 0.35 }); });

    $("#wise-capacity-tracker-zoom").on("change.wiseCapacityTracker", function () {
      state.zoom = this.value;
      render();
      setTimeout(function () { scrollToToday({ centerBias: 0.35 }); }, 30);
    });

    $("#wise-capacity-tracker-group").on("change.wiseCapacityTracker", function () {
      state.groupMode = this.value;
      render();
    });

    $("#wise-capacity-tracker-card-label").on("change.wiseCapacityTracker", function () {
      state.cardLabelMode = this.value || CFG.defaultCardLabelMode;
      render();
    });

    $("#wise-capacity-tracker-unassigned").on("change.wiseCapacityTracker", function () {
      state.showUnassignedOnly = this.checked;
      render();
    });

    $("#wise-capacity-tracker-date-start,#wise-capacity-tracker-date-end").on("change.wiseCapacityTracker", function () {
      if (applyDateRangeFromControls()) {
        invalidateLoadedProjects();
        refreshProjects();
      }
    });

    $("#" + CFG.nativeStatusFiltersId).on("change.wiseCapacityTracker", "input[type='checkbox']", function () {
      if (applyNativeStatusFromControls($(this).attr("data-native-status"))) {
        invalidateLoadedProjects();
        refreshProjects();
      }
    });

    $("#" + CFG.statusFiltersId)
      .on("change.wiseCapacityTracker", "input[type='checkbox']", function () {
        state.statusFilters[$(this).attr("data-status-key")] = this.checked;
        render();
      })
      .on("click.wiseCapacityTracker", "button[data-status-preset]", function (event) {
        event.preventDefault();
        applyStatusFilterPreset($(this).attr("data-status-preset"));
        render();
      });

    $("#wise-capacity-tracker-search").on("input.wiseCapacityTracker", function () {
      var value = this.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        state.search = value;
        render();
      }, CFG.searchDebounceMs);
    });

    $("#" + CFG.timelineScrollId).on("scroll.wiseCapacityTracker", syncTimelineScroll);
    $(window).on("resize.wiseCapacityTracker", function () {
      syncTimelineScrollLayout();
      syncTimelineScroll();
    });

    $("#" + CFG.summaryId).on("click.wiseCapacityTracker", ".wct-summary-pill[data-scroll-day]", function (event) {
      event.preventDefault();
      scrollToDayNumber(Number($(this).attr("data-scroll-day")), { centerBias: 0.35 });
    });

    $("#" + CFG.leftBodyId)
      .on("wheel.wiseCapacityTracker", scrollTimelineFromLeftColumn)
      .on("dragstart.wiseCapacityTracker", ".wct-left-row", function (event) {
        draggedRowKey = $(this).attr("data-row-key") || "";
        $(this).addClass("is-dragging");
        if (event.originalEvent && event.originalEvent.dataTransfer) {
          event.originalEvent.dataTransfer.effectAllowed = "move";
          event.originalEvent.dataTransfer.setData("text/plain", draggedRowKey);
        }
      })
      .on("dragover.wiseCapacityTracker", ".wct-left-row", function (event) {
        if (!draggedRowKey) return;
        event.preventDefault();
        $(this).addClass("is-drop-target");
      })
      .on("dragleave.wiseCapacityTracker", ".wct-left-row", function () {
        $(this).removeClass("is-drop-target");
      })
      .on("drop.wiseCapacityTracker", ".wct-left-row", function (event) {
        if (!draggedRowKey) return;
        event.preventDefault();
        var targetKey = $(this).attr("data-row-key") || "";
        var rect = this.getBoundingClientRect();
        var after = event.originalEvent && event.originalEvent.clientY > rect.top + (rect.height / 2);
        reorderCurrentRows(draggedRowKey, targetKey, after);
        draggedRowKey = "";
        $("#" + CFG.leftBodyId + " .wct-left-row").removeClass("is-dragging is-drop-target");
        render();
      })
      .on("dragend.wiseCapacityTracker", ".wct-left-row", function () {
        draggedRowKey = "";
        $("#" + CFG.leftBodyId + " .wct-left-row").removeClass("is-dragging is-drop-target");
      });

    $("#" + CFG.modalId)
      .on("click.wiseCapacityTracker", ".wct-project-bar", function (event) {
        event.preventDefault();
        var project = state.projectMap[$(this).attr("data-project-uid")];
        showProjectPopover(project, this);
      })
      .on("dblclick.wiseCapacityTracker", ".wct-project-bar", function (event) {
        event.preventDefault();
        var project = state.projectMap[$(this).attr("data-project-uid")];
        openHireHopProject(project);
      })
      .on("click.wiseCapacityTracker", ".wct-popover-close", function (event) {
        event.preventDefault();
        hidePopover();
      });

    $(document).on("keydown.wiseCapacityTracker", function (event) {
      if (!$("#" + CFG.overlayId).is(":visible")) return;
      if (event.key === "Escape") closeTracker();
    });
  }

  function updateControlsFromState() {
    $("#wise-capacity-tracker-zoom").val(state.zoom);
    $("#wise-capacity-tracker-group").val(state.groupMode);
    $("#wise-capacity-tracker-card-label").val(state.cardLabelMode);
    $("#wise-capacity-tracker-search").val(state.search);
    $("#wise-capacity-tracker-unassigned").prop("checked", state.showUnassignedOnly);
    $("#wise-capacity-tracker-unassigned-label").text(getGroupMode(state.groupMode).emptyFilterLabel || "Unassigned only");
    $("#wise-capacity-tracker-date-start").val(formatDateInput(state.dateRangeStart));
    $("#wise-capacity-tracker-date-end").val(formatDateInput(state.dateRangeEnd));
    updateNativeStatusControls();
    updateStatusFilterControls();
  }

  function injectStyles() {
    if ($("#" + CFG.stylesId).length) return;

    $("head").append(
      '<style id="' + CFG.stylesId + '">' +
      "#" + CFG.buttonId + " a{cursor:pointer;}" +
      ".wise-capacity-tracker-open{overflow:hidden;}" +
      ".wct-overlay{position:fixed;inset:0;z-index:100200;background:#eef3f8;display:flex;align-items:stretch;justify-content:stretch;padding:0;box-sizing:border-box;}" +
      ".wct-overlay.is-visible{display:flex!important;}" +
      ".wct-overlay *{box-sizing:border-box;}" +
      ".wct-modal{position:relative;width:100vw;height:100vh;display:flex;flex-direction:column;background:#f7f9fc;border:0;border-radius:0;box-shadow:none;color:#1f2937;font-family:Arial,Helvetica,sans-serif;overflow:hidden;}" +
      ".wct-header{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:12px 14px 10px;background:#ffffff;border-bottom:1px solid #d9e2ec;}" +
      ".wct-title-block h2{margin:0;font-size:20px;line-height:1.2;font-weight:700;color:#102033;letter-spacing:0;}" +
      ".wct-title-block p{margin:4px 0 0;font-size:13px;line-height:1.35;color:#526071;}" +
      ".wct-header-actions{display:flex;align-items:center;gap:7px;}" +
      ".wct-icon-btn{min-width:34px;height:32px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#1f2937;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;}" +
      ".wct-icon-btn:hover{background:#eef6ff;border-color:#9fc5ef;}" +
      ".wct-controls{display:flex;flex-wrap:wrap;align-items:end;gap:8px;padding:8px 14px;background:#eef3f8;border-bottom:1px solid #d9e2ec;}" +
      ".wct-control{display:flex;flex-direction:column;gap:3px;font-size:11px;text-transform:uppercase;color:#526071;font-weight:700;letter-spacing:0;}" +
      ".wct-control select,.wct-control input{height:30px;border:1px solid #bec9d6;border-radius:6px;background:#fff;color:#172033;padding:0 9px;font-size:13px;text-transform:none;font-weight:400;min-width:120px;}" +
      ".wct-search{flex:1 1 300px;min-width:220px;}.wct-search input{width:100%;}" +
      ".wct-date input{width:138px;min-width:138px;}" +
      ".wct-check{height:30px;display:flex;align-items:center;gap:6px;font-size:13px;color:#253244;white-space:nowrap;}" +
      ".wct-check input{margin:0;}" +
      ".wct-native-filter{display:flex;align-items:center;gap:7px;min-height:30px;padding:0 2px;}" +
      ".wct-native-filter-head{font-size:11px;text-transform:uppercase;color:#526071;font-weight:700;white-space:nowrap;}" +
      ".wct-status-filter{display:flex;align-items:center;gap:7px;min-height:30px;flex:1 1 560px;min-width:420px;}" +
      ".wct-status-filter-head{display:flex;align-items:center;gap:5px;font-size:11px;text-transform:uppercase;color:#526071;font-weight:700;white-space:nowrap;}" +
      ".wct-status-filter-head button{height:24px;border:1px solid #cbd5e1;background:#fff;border-radius:5px;padding:0 7px;font-size:11px;color:#253244;cursor:pointer;text-transform:none;font-weight:700;}" +
      ".wct-status-filter-options{display:flex;align-items:center;gap:5px;flex-wrap:wrap;}" +
      ".wct-status-chip{height:26px;display:inline-flex;align-items:center;gap:5px;border:1px solid #d4dbe5;border-radius:6px;background:#fff;padding:0 7px;font-size:12px;color:#243244;white-space:nowrap;}" +
      ".wct-status-chip:before{content:'';width:9px;height:9px;border-radius:50%;background:var(--wct-status-color);box-shadow:0 0 0 1px rgba(15,23,42,.14);}" +
      ".wct-status-chip input{margin:0;}" +
      ".wct-status-chip.is-off{opacity:.46;}" +
      ".wct-status{margin:8px 14px 0;padding:8px 10px;border-radius:6px;border:1px solid #d6e4f0;background:#fff;color:#334155;font-size:13px;}" +
      ".wct-status.is-loading{border-color:#9cc5ed;background:#edf7ff;color:#164e7a;}.wct-status.is-error{border-color:#f0b4b4;background:#fff1f1;color:#8a1f1f;}.wct-status.is-empty{border-color:#d6e4f0;background:#ffffff;color:#526071;}" +
      ".wct-summary{display:flex;flex-wrap:wrap;gap:6px;padding:8px 14px 6px;min-height:38px;}" +
      ".wct-summary-pill{display:flex;align-items:baseline;gap:7px;background:#fff;border:1px solid #dbe3ec;border-radius:6px;padding:5px 8px;min-height:28px;}" +
      "button.wct-summary-pill{font-family:inherit;cursor:pointer;}button.wct-summary-pill:hover{background:#eef6ff;border-color:#9fc5ef;}" +
      ".wct-summary-pill span{font-size:11px;text-transform:uppercase;color:#667085;font-weight:700;letter-spacing:0;}.wct-summary-pill strong{font-size:13px;color:#1f2937;font-weight:700;}" +
      ".wct-missing{margin:0 14px 6px;padding:7px 9px;border:1px solid #f0d38a;background:#fff8e6;border-radius:6px;color:#6b4e00;font-size:12px;display:flex;gap:10px;align-items:center;}.wct-missing span{color:#725c23;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
      ".wct-grid{flex:1 1 auto;min-height:240px;display:grid;grid-template-columns:210px minmax(0,1fr);grid-template-rows:50px minmax(0,1fr) 42px;border-top:1px solid #d9e2ec;background:#fff;}" +
      ".wct-left-head{grid-column:1;grid-row:1;display:flex;align-items:center;padding:0 10px;border-right:1px solid #d9e2ec;border-bottom:1px solid #d9e2ec;background:#f8fafc;font-weight:700;font-size:11px;text-transform:uppercase;color:#526071;letter-spacing:0;}" +
      ".wct-header-scroll{grid-column:2;grid-row:1;overflow:hidden;border-bottom:1px solid #d9e2ec;background:#f8fafc;}" +
      ".wct-timeline-header{position:relative;height:50px;min-width:100%;}" +
      ".wct-left-body{grid-column:1;grid-row:2;position:relative;overflow:hidden;border-right:1px solid #d9e2ec;background:#fbfdff;}" +
      ".wct-left-inner{position:relative;min-height:100%;}" +
      ".wct-left-row{position:absolute;left:0;right:0;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 8px;border-bottom:1px solid #edf1f5;overflow:hidden;background:#fff;cursor:grab;}" +
      ".wct-left-row.is-dragging{opacity:.52;cursor:grabbing;}.wct-left-row.is-drop-target{box-shadow:inset 0 0 0 2px rgba(37,99,235,.28);}" +
      ".wct-left-row.is-group strong{font-size:12px;color:#102033;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}.wct-load-summary{flex:0 0 auto;text-align:center;border:1px solid #dbe3ec;background:#f8fafc;border-radius:5px;padding:1px 5px;font-size:10px;color:#667085;white-space:nowrap;}.wct-left-row.is-unassigned{background:#fff8e6;}" +
      ".wct-left-row.is-load-low{border-left:4px solid #22c55e;background:linear-gradient(90deg,rgba(34,197,94,.10),#fff 52px);}.wct-left-row.is-load-medium{border-left:4px solid #f59e0b;background:linear-gradient(90deg,rgba(245,158,11,.13),#fff 58px);}.wct-left-row.is-load-high{border-left:4px solid #ef4444;background:linear-gradient(90deg,rgba(239,68,68,.14),#fff 66px);}" +
      ".wct-left-row.is-load-low .wct-load-summary{background:#ecfdf3;border-color:#86efac;color:#166534;}.wct-left-row.is-load-medium .wct-load-summary{background:#fff7ed;border-color:#fed7aa;color:#9a3412;}.wct-left-row.is-load-high .wct-load-summary{background:#fff1f2;border-color:#fecdd3;color:#9f1239;}" +
      ".wct-timeline-scroll{grid-column:2;grid-row:2;overflow:auto;position:relative;background:#fff;}" +
      ".wct-timeline-body{position:relative;min-width:100%;min-height:100%;}" +
      ".wct-left-total{grid-column:1;grid-row:3;display:flex;align-items:center;padding:0 10px;border-top:1px solid #d9e2ec;border-right:1px solid #d9e2ec;background:#f8fafc;font-size:11px;text-transform:uppercase;font-weight:700;color:#526071;letter-spacing:0;}" +
      ".wct-total-scroll{grid-column:2;grid-row:3;overflow:hidden;border-top:1px solid #d9e2ec;background:#f8fafc;}" +
      ".wct-timeline-totals{position:relative;height:42px;min-width:100%;}" +
      ".wct-total-cell{position:absolute;top:0;height:42px;border-left:1px solid #dbe3ec;display:flex;align-items:center;justify-content:center;gap:2px;padding:0 3px;text-align:center;font-size:10px;line-height:1.12;color:#253244;overflow:hidden;white-space:normal;}" +
      ".wct-total-cell strong{font-weight:700;}.wct-total-cell.is-revenue{white-space:nowrap;font-size:10px;}.wct-total-cell.is-tier{flex-direction:column;align-items:center;}.wct-total-cell.is-tier span{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.wct-total-cell.is-weekend{background:#eef3f8;}.wct-total-cell.is-load-low{background:#f0fdf4;color:#166534;}.wct-total-cell.is-load-medium{background:#fff7ed;color:#9a3412;}.wct-total-cell.is-load-high{background:#fff1f2;color:#9f1239;}" +
      ".wct-month-segment{position:absolute;top:0;height:22px;border-right:1px solid #d9e2ec;padding:4px 7px 0;font-size:12px;font-weight:700;color:#253244;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      ".wct-day-cell{position:absolute;top:22px;height:28px;border-left:1px solid #dbe3ec;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:10px;color:#526071;overflow:hidden;line-height:1.05;}.wct-day-cell em{font-style:normal;font-size:8px;text-transform:uppercase;color:inherit;opacity:.72;}.wct-day-cell span{font-size:11px;font-weight:700;}.wct-day-cell.is-weekend{background:#eef3f8;}.wct-day-cell.is-load-low{background:#f0fdf4;color:#166534;}.wct-day-cell.is-load-medium{background:#fff7ed;color:#9a3412;}.wct-day-cell.is-load-high{background:#fff1f2;color:#9f1239;font-weight:700;}.wct-day-cell.is-today{box-shadow:inset 0 0 0 2px rgba(217,45,32,.28);color:#b42318;font-weight:700;}" +
      ".wct-week-load{position:absolute;bottom:0;height:4px;border-radius:4px 4px 0 0;z-index:3;pointer-events:auto;opacity:.72;}.wct-week-load.is-load-low{background:#22c55e;}.wct-week-load.is-load-medium{background:#f59e0b;}.wct-week-load.is-load-high{background:#ef4444;}" +
      ".wct-row-backdrop{position:absolute;left:0;top:0;}.wct-row-line{position:absolute;left:0;right:0;border-bottom:1px solid #edf1f5;}.wct-row-line.is-group:nth-child(even){background:#fcfdff;}" +
      ".wct-day-gridline{position:absolute;top:0;border-left:1px solid #edf1f5;z-index:1;pointer-events:none;}.wct-day-gridline.is-weekend{background:rgba(238,243,248,.55);}.wct-day-gridline.is-load-low{background:rgba(34,197,94,.045);}.wct-day-gridline.is-load-medium{background:rgba(245,158,11,.07);}.wct-day-gridline.is-load-high{background:rgba(239,68,68,.085);}.wct-day-gridline.is-today{box-shadow:inset 2px 0 0 rgba(217,45,32,.36);}" +
      ".wct-absence-band{position:absolute;z-index:2;background:repeating-linear-gradient(135deg,rgba(71,85,105,.18) 0,rgba(71,85,105,.18) 8px,rgba(71,85,105,.10) 8px,rgba(71,85,105,.10) 16px);border-left:1px solid rgba(71,85,105,.26);border-right:1px solid rgba(71,85,105,.20);pointer-events:auto;}" +
      ".wct-today-line{position:absolute;top:0;width:0;border-left:2px solid #d92d20;z-index:5;pointer-events:none;}.wct-today-line span{position:absolute;top:4px;left:5px;background:#d92d20;color:#fff;border-radius:4px;padding:2px 5px;font-size:10px;font-weight:700;}" +
      ".wct-project-bar{position:absolute;z-index:4;border:1px solid rgba(15,23,42,.22);border-radius:5px;box-shadow:0 1px 2px rgba(15,23,42,.14);padding:0 7px;text-align:left;cursor:pointer;overflow:hidden;}" +
      ".wct-project-bar span{position:relative;z-index:2;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:700;line-height:22px;}" +
      ".wct-project-bar:hover{filter:brightness(1.03);box-shadow:0 2px 7px rgba(15,23,42,.22);}" +
      ".wct-popover{position:absolute;z-index:20;width:420px;max-width:calc(100% - 24px);background:#fff;border:1px solid #b9c7d6;border-radius:8px;box-shadow:0 14px 34px rgba(15,23,42,.26);padding:12px;color:#1f2937;}" +
      ".wct-popover-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px;}.wct-popover-head strong{font-size:15px;line-height:1.25;}.wct-popover-close{border:0;background:transparent;color:#667085;font-size:16px;line-height:1;cursor:pointer;}" +
      ".wct-popover-grid{display:grid;grid-template-columns:90px 1fr;gap:5px 10px;font-size:12px;}.wct-detail-label{color:#667085;font-weight:700;}.wct-detail-value{color:#243244;min-width:0;overflow:hidden;text-overflow:ellipsis;}" +
      ".wct-role-strip{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}.wct-role-chip{border:1px solid #d9e2ec;background:#f8fafc;border-radius:5px;padding:4px 6px;font-size:11px;color:#253244;}.wct-role-chip.is-empty{color:#8a5a00;background:#fff8e6;border-color:#efd58e;}.wct-role-chip strong{margin-right:4px;color:#526071;}" +
      "@media (max-width: 900px){.wct-grid{grid-template-columns:170px minmax(0,1fr);}.wct-controls{gap:7px;}.wct-control select,.wct-control input{min-width:104px;}.wct-search{flex-basis:190px;min-width:180px;}.wct-status-filter{min-width:260px;}}" +
      "</style>"
    );
  }

  function iconButton(id, iconClass, label) {
    return (
      '<button id="' + id + '" type="button" class="wct-icon-btn" title="' + escapeAttr(label) + '" aria-label="' + escapeAttr(label) + '">' +
        '<span class="ui-icon ' + iconClass + '"></span>' +
      '</button>'
    );
  }

  function controlSelect(id, label, options) {
    var html = ['<label class="wct-control"><span>' + escapeHtml(label) + '</span><select id="' + id + '">'];
    for (var i = 0; i < options.length; i++) {
      html.push('<option value="' + escapeAttr(options[i][0]) + '">' + escapeHtml(options[i][1]) + '</option>');
    }
    html.push("</select></label>");
    return html.join("");
  }

  function renderNativeStatusFilterControls() {
    return [
      '<span class="wct-native-filter-head">HireHop</span>',
      '<label class="wct-check"><input type="checkbox" data-native-status="open"> Open</label>',
      '<label class="wct-check"><input type="checkbox" data-native-status="closed"> Closed</label>'
    ].join("");
  }

  function renderStatusFilterControls() {
    var html = [
      '<div class="wct-status-filter-head">',
        '<span>Wise status</span>',
        '<button type="button" data-status-preset="all">All</button>',
        '<button type="button" data-status-preset="live">Live</button>',
      '</div>',
      '<div class="wct-status-filter-options">'
    ];
    var statuses = getStatusFilterOptions();
    for (var i = 0; i < statuses.length; i++) {
      html.push(
        '<label class="wct-status-chip" style="--wct-status-color:' + escapeAttr(statuses[i].color) + '">' +
          '<input type="checkbox" data-status-key="' + escapeAttr(statuses[i].key) + '">' +
          '<span>' + escapeHtml(statuses[i].label) + '</span>' +
        '</label>'
      );
    }
    html.push("</div>");
    return html.join("");
  }

  function updateNativeStatusControls() {
    var filters = state.nativeStatusFilters || createDefaultNativeStatusFilters();
    $("#" + CFG.nativeStatusFiltersId + " input[type='checkbox']").each(function () {
      var key = $(this).attr("data-native-status");
      this.checked = filters[key] !== false;
    });
  }

  function updateStatusFilterControls() {
    $("#" + CFG.statusFiltersId + " input[type='checkbox']").each(function () {
      var key = $(this).attr("data-status-key");
      var checked = state.statusFilters[key] !== false;
      this.checked = checked;
      $(this).closest(".wct-status-chip").toggleClass("is-off", !checked);
    });
  }

  function detailItem(label, value) {
    return '<span class="wct-detail-label">' + escapeHtml(label) + '</span><span class="wct-detail-value">' + escapeHtml(value || "Unassigned") + '</span>';
  }

  function roleChip(label, value) {
    var empty = !value;
    return '<span class="wct-role-chip' + (empty ? " is-empty" : "") + '"><strong>' + escapeHtml(label) + '</strong>' + escapeHtml(value || "Unassigned") + '</span>';
  }

  function getProjectLabel(project) {
    if (!project) return "";
    return getWiseStandardLabel(project) || project.wiseProjectName || project.name || project.wiseJobNumber || ("Project " + project.id);
  }

  function getWiseStandardLabel(project) {
    if (!project) return "";
    var parts = [];
    if (project.tier) parts.push(project.tier);
    if (project.wiseJobNumber) parts.push(project.wiseJobNumber);
    var clientVenue = "";
    if (project.client && project.venue) clientVenue = project.client + " @ " + project.venue;
    else clientVenue = project.client || project.venue;
    if (clientVenue) parts.push(clientVenue);
    return parts.join(" - ");
  }

  function getShortBarLabel(project) {
    if (!project) return "";
    return getProjectLabel(project);
  }

  function getCardLabel(project) {
    if (!project) return "";

    if (state.cardLabelMode === "tier") {
      return project.tier || "No tier";
    }

    if (state.cardLabelMode === "name") {
      return project.wiseProjectName || project.name || getProjectLabel(project);
    }

    if (state.cardLabelMode === "venue") {
      return project.venue || "No venue";
    }

    if (state.cardLabelMode === "wise") {
      return project.wiseJobNumber || project.id || "No Wise ID";
    }

    if (state.cardLabelMode === "revenue") {
      return formatSterlingValue(project.revenue) || "No revenue";
    }

    return getWiseStandardLabel(project) || getShortBarLabel(project);
  }

  function formatSterlingValue(value) {
    var amount = parseRevenueNumber(value);
    if (amount == null) return "";

    if (typeof amount.toLocaleString === "function") {
      return amount.toLocaleString("en-GB", {
        style: "currency",
        currency: "GBP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    return "\u00a3" + formatNumberWithCommas(amount.toFixed(2));
  }

  function parseRevenueNumber(value) {
    var text = asText(value);
    if (!text) return null;

    var negative = /^\s*\(.*\)\s*$/.test(text) || /^\s*-/.test(text);
    var cleaned = text.replace(/[^\d.]/g, "");
    if (!cleaned) return null;

    var amount = Number(cleaned);
    if (!isFinite(amount)) return null;

    return negative ? -amount : amount;
  }

  function formatNumberWithCommas(value) {
    var parts = String(value).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  }

  function getProjectMeta(project) {
    var parts = [];
    if (project.client) parts.push(project.client);
    if (project.venue) parts.push(project.venue);
    if (project.status) parts.push(project.status);
    return parts.join(" | ");
  }

  function buildProjectSearchText(project) {
    return normaliseSearch([
      project.id,
      getProjectLabel(project),
      project.name,
      project.wiseProjectName,
      project.nativeName,
      project.wiseJobNumber,
      project.client,
      project.venue,
      project.status,
      project.nativeStatus,
      project.revenue,
      project.tier,
      project.roles.pm,
      project.roles.designer,
      project.roles.tpm,
      project.roles.production
    ].join(" "));
  }

  function isProjectUnassignedForCurrentMode(project) {
    return !getProjectGroupValue(project, getGroupMode(state.groupMode));
  }

  function isProjectStatusVisible(project) {
    var key = getWiseStatusKey(project && project.status);
    return state.statusFilters[key] !== false;
  }

  function projectOverlapsRange(project, rangeStart, rangeEnd) {
    var start = getProjectStart(project);
    var end = getProjectEnd(project) || start;
    if (!start || !end) return false;
    return end.getTime() >= rangeStart.getTime() && start.getTime() <= endOfDay(rangeEnd).getTime();
  }

  function isProjectRecord(project) {
    var raw = project && project.raw ? project.raw : project;
    if (!raw) return false;
    var kind = firstValue(raw, ["kind", "KIND"]);
    if (kind == null || kind === "") return true;
    return Number(kind) === 6 || String(kind).toLowerCase() === "project";
  }

  function isDeletedProject(raw) {
    var value = firstValue(raw || {}, ["DELETED", "deleted", "DEL", "del", "IS_DELETED", "is_deleted"]);
    return value != null && value !== "" && Number(value) === 1;
  }

  function readProjectStatusName(raw) {
    var value = firstValue(raw, ["STATUS_NAME", "STATUS_TEXT", "STATUS_LABEL", "status_name", "statusText", "STATUS", "status"]);
    if (value == null || value === "") return "";

    if (isFinite(Number(value)) && window.lang && window.lang.proj_status && window.lang.proj_status[value] != null) {
      return asText(window.lang.proj_status[value]);
    }

    return asText(value);
  }

  function sortProjectsByStart(a, b) {
    var startDiff = getProjectSortTime(a) - getProjectSortTime(b);
    if (startDiff !== 0) return startDiff;
    return getProjectLabel(a).localeCompare(getProjectLabel(b));
  }

  function getProjectSortTime(project) {
    var start = getProjectStart(project);
    return start ? start.getTime() : 8640000000000000;
  }

  function countActiveToday(projects) {
    var today = dayNumber(startOfDay(new Date()));
    var count = 0;
    for (var i = 0; i < projects.length; i++) {
      var start = getProjectStart(projects[i]);
      var end = getProjectEnd(projects[i]) || start;
      if (start && dayNumber(start) <= today && dayNumber(end) >= today) count++;
    }
    return count;
  }

  function firstValue(object, keys) {
    for (var i = 0; i < keys.length; i++) {
      if (object && object[keys[i]] != null && object[keys[i]] !== "") return object[keys[i]];
    }
    return "";
  }

  function firstValueByNormalisedKey(object, keys) {
    if (!object) return "";

    var wanted = {};
    for (var i = 0; i < keys.length; i++) {
      wanted[normaliseKeyName(keys[i])] = true;
    }

    for (var key in object) {
      if (!Object.prototype.hasOwnProperty.call(object, key)) continue;
      if (!wanted[normaliseKeyName(key)]) continue;
      if (object[key] != null && object[key] !== "") return object[key];
    }

    return "";
  }

  function firstValueByKeyTokens(object, tokenGroups) {
    if (!object || !tokenGroups || !tokenGroups.length) return "";

    for (var key in object) {
      if (!Object.prototype.hasOwnProperty.call(object, key)) continue;
      if (object[key] == null || object[key] === "") continue;

      var normalised = normaliseKeyName(key);
      for (var i = 0; i < tokenGroups.length; i++) {
        if (keyContainsAllTokens(normalised, tokenGroups[i])) return object[key];
      }
    }

    return "";
  }

  function keyContainsAllTokens(normalisedKey, tokens) {
    if (!tokens || !tokens.length) return false;
    for (var i = 0; i < tokens.length; i++) {
      if (normalisedKey.indexOf(normaliseKeyName(tokens[i])) === -1) return false;
    }
    return true;
  }

  function collectDateTimeRawFields(raw) {
    var result = {};
    var usefulTokens = ["date", "time", "out", "return", "book", "kit", "start", "end", "in"];
    for (var key in raw || {}) {
      if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
      var normalised = normaliseKeyName(key);
      for (var i = 0; i < usefulTokens.length; i++) {
        if (normalised.indexOf(usefulTokens[i]) !== -1) {
          result[key] = raw[key];
          break;
        }
      }
    }
    return result;
  }

  function asText(value) {
    if (value == null) return "";
    return $.trim(String(value));
  }

  function cleanRoleValue(value) {
    var text = asText(value).replace(/\s+/g, " ");
    if (!text || /^null$/i.test(text) || /^undefined$/i.test(text)) return "";
    return text;
  }

  function getPersonNameKeys(value) {
    var text = cleanRoleValue(value);
    var keys = [];
    if (!text) return keys;

    addPersonNameKey(keys, text);

    var parts = text.split(/\s*(?:,|\/|&|\+|\band\b)\s*/i);
    if (parts.length > 1) {
      for (var i = 0; i < parts.length; i++) addPersonNameKey(keys, parts[i]);
    }

    return keys;
  }

  function addPersonNameKey(keys, value) {
    var key = normalisePersonName(value);
    if (key && keys.indexOf(key) === -1) keys.push(key);

    var reversed = getReversedPersonNameKey(value);
    if (reversed && keys.indexOf(reversed) === -1) keys.push(reversed);
  }

  function getReversedPersonNameKey(value) {
    var text = cleanRoleValue(value);
    var comma = text.match(/^([^,]+),\s*(.+)$/);
    if (comma) return normalisePersonName(comma[2] + " " + comma[1]);

    var words = text.split(/\s+/);
    if (words.length === 2) return normalisePersonName(words[1] + " " + words[0]);
    return "";
  }

  function normalisePersonName(value) {
    var text = cleanRoleValue(value).toLowerCase();
    if (!text) return "";
    if (typeof text.normalize === "function") text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return text
      .replace(/['`]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\b(?:mr|mrs|miss|ms|dr)\b/g, " ")
      .replace(/\s+/g, " ")
      .replace(/^\s+|\s+$/g, "");
  }

  function flattenValues(values) {
    var result = [];
    for (var i = 0; i < values.length; i++) {
      if (Array.isArray(values[i])) result = result.concat(flattenValues(values[i]));
      else if (values[i] != null && values[i] !== "") result.push(values[i]);
    }
    return result;
  }

  function uniqueValues(values) {
    var seen = {};
    var result = [];
    for (var i = 0; i < values.length; i++) {
      var value = asText(values[i]);
      if (!value || seen[value]) continue;
      seen[value] = true;
      result.push(value);
    }
    return result;
  }

  function normaliseSearch(value) {
    return asText(value).toLowerCase().replace(/\s+/g, " ");
  }

  function normaliseGroupKey(value) {
    return normaliseSearch(value).replace(/[^a-z0-9]+/g, "-") || "unassigned";
  }

  function normaliseKeyName(value) {
    return asText(value).toLowerCase().replace(/^~?_*|[\s_-]+/g, "");
  }

  function normaliseDepotId(value) {
    var text = asText(value).replace(/[^\d]/g, "");
    return text || "";
  }

  function cleanDepotName(value) {
    return asText(value).replace(/\s+/g, " ");
  }

  function normaliseDepotName(value) {
    return cleanDepotName(value).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
  }

  function matchesTargetDepotName(name) {
    var normalised = normaliseDepotName(name);
    for (var i = 0; i < CFG.targetDepotNames.length; i++) {
      if (normalised === normaliseDepotName(CFG.targetDepotNames[i])) return true;
    }
    return false;
  }

  function normaliseStatus(value) {
    return asText(value).toLowerCase().replace(/\s+/g, " ").replace(/\s*&\s*/g, " & ");
  }

  function normaliseWiseStatus(value) {
    var text = asText(value).replace(/\s+/g, " ");
    if (!text) return "";

    var normalised = normaliseStatus(text);
    if (normalised === "hold - work in progress") normalised = "hold";
    for (var i = 0; i < CFG.wiseStatuses.length; i++) {
      if (normaliseStatus(CFG.wiseStatuses[i].label) === normalised) return CFG.wiseStatuses[i].label;
    }
    return text;
  }

  function getWiseStatusKey(value) {
    var normalised = normaliseStatus(value);
    if (normalised === "hold - work in progress") normalised = "hold";
    for (var i = 0; i < CFG.wiseStatuses.length; i++) {
      if (normaliseStatus(CFG.wiseStatuses[i].label) === normalised) return CFG.wiseStatuses[i].key;
    }
    return CFG.unknownStatusKey;
  }

  function getWiseStatusByKey(key) {
    for (var i = 0; i < CFG.wiseStatuses.length; i++) {
      if (CFG.wiseStatuses[i].key === key) return CFG.wiseStatuses[i];
    }
    return CFG.unknownStatus;
  }

  function getWiseStatusColor(value) {
    return getWiseStatusByKey(getWiseStatusKey(value)).color;
  }

  function getStatusFilterOptions() {
    return CFG.wiseStatuses.concat([CFG.unknownStatus]);
  }

  function createDefaultStatusFilters() {
    var filters = {};
    var statuses = getStatusFilterOptions();
    for (var i = 0; i < statuses.length; i++) {
      filters[statuses[i].key] = statuses[i].key !== "closed_lost";
    }
    return filters;
  }

  function createDefaultNativeStatusFilters() {
    return {
      open: true,
      closed: false
    };
  }

  function applyNativeStatusFromControls(changedKey) {
    var previous = state.nativeStatusFilters || createDefaultNativeStatusFilters();
    var next = {};

    $("#" + CFG.nativeStatusFiltersId + " input[type='checkbox']").each(function () {
      next[$(this).attr("data-native-status")] = this.checked;
    });

    if (!next.open && !next.closed) {
      next[changedKey === "closed" ? "closed" : "open"] = true;
      setStatus("Keep at least one HireHop status selected.", "empty");
    }

    state.nativeStatusFilters = {
      open: next.open !== false,
      closed: next.closed !== false
    };
    updateNativeStatusControls();

    return previous.open !== state.nativeStatusFilters.open || previous.closed !== state.nativeStatusFilters.closed;
  }

  function getNativeStatusRequestFlags() {
    var filters = state.nativeStatusFilters || createDefaultNativeStatusFilters();
    var open = filters.open !== false;
    var closed = filters.closed !== false;

    if (!open && !closed) {
      open = true;
      closed = true;
    }

    return {
      open: open ? 1 : 0,
      closed: closed ? 1 : 0
    };
  }

  function getNativeStatusFilterLabel() {
    var nativeStatus = getNativeStatusRequestFlags();
    if (nativeStatus.open && nativeStatus.closed) return "Open and Closed";
    if (nativeStatus.open) return "Open only";
    if (nativeStatus.closed) return "Closed only";
    return "Open and Closed";
  }

  function applyStatusFilterPreset(preset) {
    var statuses = getStatusFilterOptions();
    for (var i = 0; i < statuses.length; i++) {
      state.statusFilters[statuses[i].key] = preset === "live" ? statuses[i].key !== "closed_lost" : true;
    }
    updateStatusFilterControls();
  }

  function getDominantStatusLabel(counts) {
    var bestKey = "";
    var bestCount = 0;
    $.each(counts || {}, function (key, count) {
      if (count > bestCount) {
        bestKey = key;
        bestCount = count;
      }
    });
    if (!bestKey) return "";
    return getWiseStatusByKey(bestKey).label + " (" + bestCount + ")";
  }

  function normaliseColour(value) {
    var text = asText(value);
    if (!text) return "";
    if (/^#[0-9a-f]{3,8}$/i.test(text)) return text;
    if (/^[0-9a-f]{6}$/i.test(text)) return "#" + text;
    if (/^[a-z]+$/i.test(text)) return text;
    return "";
  }

  function getReadableTextColor(color) {
    var hex = normaliseColour(color);
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return "#ffffff";
    var r = parseInt(hex.substr(1, 2), 16);
    var g = parseInt(hex.substr(3, 2), 16);
    var b = parseInt(hex.substr(5, 2), 16);
    var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.62 ? "#172033" : "#ffffff";
  }

  function colorToRgba(color, alpha) {
    var hex = normaliseColour(color);
    if (/^#[0-9a-f]{3}$/i.test(hex)) {
      hex = "#" + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2) + hex.charAt(3) + hex.charAt(3);
    }
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return "";

    return [
      "rgba(",
      parseInt(hex.substr(1, 2), 16),
      ",",
      parseInt(hex.substr(3, 2), 16),
      ",",
      parseInt(hex.substr(5, 2), 16),
      ",",
      clamp(Number(alpha), 0, 1),
      ")"
    ].join("");
  }

  function getPixelsPerDay() {
    return CFG.pixelsPerDay[state.zoom] || CFG.pixelsPerDay.month;
  }

  function getCustomFieldKeyList() {
    return uniqueValues(flattenValues([
      CFG.customFieldKeys.status,
      CFG.customFieldKeys.projectName,
      CFG.customFieldKeys.jobNumber,
      CFG.customFieldKeys.client,
      CFG.customFieldKeys.venue,
      CFG.customFieldKeys.pm,
      CFG.customFieldKeys.designer,
      CFG.customFieldKeys.tpm,
      CFG.customFieldKeys.production,
      CFG.customFieldKeys.revenue,
      CFG.customFieldKeys.tier
    ]));
  }

  function isAllowedActiveDepot() {
    var depot = getSharedDepotModule();
    if (!depot || typeof depot.isAllowed !== "function") return false;

    var context = typeof depot.getActiveContext === "function"
      ? depot.getActiveContext()
      : (window.__wiseHireHopDepotContext || {});

    return depot.isAllowed(context, {
      allowedIds: [],
      allowedNames: ["Proposal Creation"],
      blockWhenUndetected: true
    });
  }

  function getSharedDepotModule() {
    var module = window[HIREHOP_MODULE_GLOBAL];
    var depot = module && module.depot;
    return depot && typeof depot === "object" ? depot : null;
  }

  function getHireHopModuleSection(name) {
    var module = window[HIREHOP_MODULE_GLOBAL];
    var section = module && module[name];
    return section && typeof section === "object" ? section : null;
  }

  function getHireHopModuleValue(sectionName, key, fallback) {
    var section = getHireHopModuleSection(sectionName);
    var value = section && section[key];
    return value == null || value === "" ? fallback : value;
  }

  function getHireHopSelector(key, fallback) {
    return String(getHireHopModuleValue("selectors", key, fallback));
  }

  function getHireHopEndpoint(key, fallback) {
    return String(getHireHopModuleValue("endpoints", key, fallback));
  }

  function getTimezone() {
    if (window.timezone) return String(window.timezone);
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { return ""; }
  }

  function getHireHopDateOrder() {
    if (window.user && window.user.DATE_FORMAT != null) {
      var format = String(window.user.DATE_FORMAT);
      if (format === "1" || /m.*d.*y/i.test(format)) return "mdy";
    }
    return "dmy";
  }

  function dateFromParts(year, month, day, hour, minute, second) {
    var date = new Date(year, month - 1, day, hour || 0, minute || 0, second || 0);
    if (!isValidDate(date)) return null;
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
  }

  function isValidDate(date) {
    return date instanceof Date && !isNaN(date.getTime());
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function endOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function startOfWeek(date) {
    var day = date.getDay();
    var offset = (day + 6) % 7;
    return startOfDay(addDays(date, -offset));
  }

  function addMonths(date, months) {
    return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
  }

  function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  function dayNumber(date) {
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  }

  function dateFromDayNumber(value) {
    var epoch = new Date(1970, 0, 1);
    return startOfDay(addDays(epoch, Number(value) || 0));
  }

  function daysBetween(start, end) {
    return dayNumber(end) - dayNumber(start);
  }

  function getTimelineClipEnd(timeline) {
    return addDays(timeline.end, 1);
  }

  function getTimelineX(timeline, date) {
    if (!timeline || !date) return 0;
    return (daysBetween(timeline.start, date) + getDayFraction(date)) * timeline.pixelsPerDay;
  }

  function getDayFraction(date) {
    var seconds = (date.getHours() * 3600) + (date.getMinutes() * 60) + date.getSeconds() + (date.getMilliseconds() / 1000);
    return seconds / 86400;
  }

  function formatServerDateTime(date) {
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate()) + " " + pad2(date.getHours()) + ":" + pad2(date.getMinutes()) + ":" + pad2(date.getSeconds());
  }

  function pad2(value) {
    return value < 10 ? "0" + value : String(value);
  }

  function getMonthName(date, shortName) {
    var names = shortName
      ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return names[date.getMonth()];
  }

  function getWeekdayName(date) {
    return ["sun", "mon", "tues", "wed", "thur", "fri", "sat"][date.getDay()];
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function tryParseJson(text) {
    try { return JSON.parse(text); } catch (e) { return null; }
  }

  function escapeHtml(value) {
    return asText(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function log(message, details) {
    try {
      if (details === undefined) console.warn(LOG_PREFIX + " " + message);
      else console.warn(LOG_PREFIX + " " + message, details);
    } catch (e) {}
  }

  function logWarn(message, details) {
    try {
      if (details === undefined) console.warn(LOG_PREFIX + " " + message);
      else console.warn(LOG_PREFIX + " " + message, details);
    } catch (e) {}
  }

  function getMockRows() {
    return [
      {
        kind: 6,
        NUMBER: "1001",
        JOB_NAME: "DEBUG Capacity Project",
        CLIENT: "Debug Client",
        VENUE: "Debug Venue",
        STATUS: "Confirmed",
        COLOUR: "#2563eb",
        JOB_DATE: "2026-05-01",
        JOB_END: "2026-05-18",
        OUT_DATE: "2026-04-28",
        RETURN_DATE: "2026-05-20",
        "~_Status": "Confirmed",
        "~_Revenue": "125000",
        "~_Job_Number": "W-1001",
        "~_Project_Name": "A - W-1001 - Debug Client @ Debug Venue",
        "~_Tier": "A",
        "~_Client": "Debug Client",
        "~_Venue": "Debug Venue",
        "~_PM": "Alex",
        "~_Designer": "Taylor",
        "~_TPM": "Jordan",
        "~_Production": "Sam"
      }
    ];
  }
})();
