(function () {
  "use strict";

  var $ = window.jQuery;
  if (!$) return;

  var HIREHOP_MODULE_GLOBAL = "WiseProposalSectionBuilderHireHop";
  var LOG_PREFIX = "[Wise Capacity Tracker]";

  var CFG = {
    version: "2026-05-12.04",
    title: "Capacity Tracker",
    subtitle: "Open project timeline by Project, Designer, Technical and Production assignment",
    buttonLabel: "Capacity Tracker",
    buttonTitle: "Open Capacity Tracker",
    buttonId: "wise-capacity-tracker-button",
    stylesId: "wise-capacity-tracker-styles",
    overlayId: "wise-capacity-tracker-overlay",
    modalId: "wise-capacity-tracker-modal",
    statusId: "wise-capacity-tracker-status",
    summaryId: "wise-capacity-tracker-summary",
    missingId: "wise-capacity-tracker-missing",
    leftBodyId: "wise-capacity-tracker-left-body",
    headerScrollId: "wise-capacity-tracker-header-scroll",
    timelineScrollId: "wise-capacity-tracker-timeline-scroll",
    timelineHeaderId: "wise-capacity-tracker-timeline-header",
    timelineBodyId: "wise-capacity-tracker-timeline-body",
    popoverId: "wise-capacity-tracker-popover",
    defaultZoom: "week",
    pixelsPerDay: {
      week: 26,
      month: 12,
      quarter: 5
    },
    personRowMinHeight: 38,
    barHeight: 22,
    laneGap: 4,
    lanePadding: 6,
    timelinePaddingMonthsBefore: 2,
    timelinePaddingMonthsAfter: 2,
    defaultMonthsBack: 18,
    defaultMonthsAhead: 24,
    fetchPageSize: 500,
    fetchMaxPages: 20,
    searchDebounceMs: 180,
    searchEndpointFallback: "/php_functions/search_list.php",
    debugUseMock: false,
    targetDepotIds: [],
    targetDepotNames: [
      "Wise Productions YES Events"
    ],
    closedStatusNames: [
      "Completed",
      "Completed & Invoiced",
      "Closed Lost",
      "Removed From Quote",
      "Cancelled",
      "Canceled",
      "Archived",
      "Deleted"
    ],
    openStatusNames: [
      "Quote",
      "Quote (New Client)",
      "Quote (Repeat Client)",
      "Very Likely",
      "Hold - Work In Progress",
      "Confirmed",
      "Confirmed - Quote Sent",
      "Confirmed - Return Quote"
    ],
    customFieldKeys: {
      pm: "_PM",
      designer: "_Designer",
      tpm: "_TPM",
      production: "_Production"
    }
  };

  var ROLE_MODES = {
    project: { field: "pm", label: "Project", groupLabel: "Project", unassigned: "Unassigned Project" },
    designer: { field: "designer", label: "Designer", groupLabel: "Designer", unassigned: "Unassigned Designer" },
    technical: { field: "tpm", label: "Technical", groupLabel: "Technical", unassigned: "Unassigned Technical" },
    production: { field: "production", label: "Production", groupLabel: "Production", unassigned: "Unassigned Production" }
  };

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
    zoom: CFG.defaultZoom,
    groupMode: "project",
    search: "",
    hideClosed: true,
    showUnassignedOnly: false,
    monthsBack: CFG.defaultMonthsBack,
    monthsAhead: CFG.defaultMonthsAhead
  };

  var latestLoadId = 0;
  var searchTimer = null;
  var buttonRetryTimer = null;

  window.WiseCapacityTracker = {
    version: CFG.version,
    open: openTracker,
    refresh: refreshProjects,
    describe: describe,
    _test: {
      normaliseProject: normaliseProject,
      getCustomField: getCustomField,
      parseHireHopDate: parseHireHopDate,
      formatDate: formatDate,
      isOpenProject: isOpenProject,
      getProjectStart: getProjectStart,
      getProjectEnd: getProjectEnd,
      buildTimelineRange: buildTimelineRange,
      groupProjects: groupProjects
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
  }

  function describe() {
    return {
      loaded: true,
      version: CFG.version,
      endpoint: getHireHopEndpoint("searchList", CFG.searchEndpointFallback),
      defaultZoom: CFG.defaultZoom,
      projectsLoaded: state.projects.length,
      targetDepot: getTargetDepotSummary(),
      customFieldKeys: $.extend({}, CFG.customFieldKeys)
    };
  }

  function installEntryPoint() {
    if (!isHomePage()) {
      $("#" + CFG.buttonId).remove();
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

    if ($("#" + CFG.buttonId).length) return;

    var $btn = $(
      '<li id="' + CFG.buttonId + '" class="wise-capacity-home-tab ui-state-default ui-corner-top" role="tab">' +
        '<a href="#wise-capacity-tracker-open" title="' + escapeAttr(CFG.buttonTitle) + '">' +
          '<span class="ui-icon ui-icon-calendar"></span>' +
          '<span>' + escapeHtml(CFG.buttonLabel) + '</span>' +
        '</a>' +
      '</li>'
    );

    $btn.on("click", function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openTracker();
    });

    $host.append($btn);
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

  function openTracker() {
    ensureModal();
    updateControlsFromState();
    $("#" + CFG.overlayId).addClass("is-visible").show();
    $("body").addClass("wise-capacity-tracker-open");

    if (!state.loaded && !state.loading) {
      refreshProjects();
      return;
    }

    render();
    setTimeout(function () { scrollToToday({ centerBias: 0.35 }); }, 40);
  }

  function closeTracker() {
    hidePopover();
    $("#" + CFG.overlayId).removeClass("is-visible").hide();
    $("body").removeClass("wise-capacity-tracker-open");
  }

  function refreshProjects() {
    var loadId = ++latestLoadId;
    state.loading = true;
    state.error = "";
    setStatus("Loading open projects...", "loading");
    clearTimeline();

    fetchProjectRows()
      .then(function (rows) {
        if (loadId !== latestLoadId) return;

        state.projects = rows.map(normaliseProject).filter(isProjectRecord);
        state.loaded = true;
        state.loading = false;
        state.error = "";

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

    var range = buildFetchDateRange();
    var depotFilter = resolveTargetDepots();
    if (!depotFilter.ids.length) {
      return Promise.reject(new Error("Target depot not found: " + CFG.targetDepotNames.join(", ") + ". The tracker will not load unfiltered project data."));
    }
    log("Using target depot filter", depotFilter);

    var allRows = [];

    /*
     * HireHop's native hh_search_results_dialog posts to search_list.php for jobs/projects.
     * Project rows use kind 6 and standard fields such as NUMBER, JOB_NAME, CLIENT, VENUE,
     * OUT_DATE, JOB_DATE, JOB_END and RETURN_DATE. When project custom fields are included,
     * HireHop prefixes them with "~", for example "~_PM".
     */
    function fetchPage(page) {
      var params = {
        local: formatServerDateTime(new Date()),
        tz: getTimezone(),
        page: page,
        rows: CFG.fetchPageSize,
        jobs: 0,
        projects: 1,
        open: 1,
        closed: state.hideClosed ? 0 : 1,
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
        DEPOT: depotFilter.ids,
        pq_filter: buildDepotFilter(depotFilter.ids)
      };

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
          if (!response.ok) throw new Error("HireHop returned HTTP " + response.status + ".");
          if (!json) throw new Error("HireHop did not return JSON from project search.");
          return json;
        });
      }).then(function (json) {
        var pageRows = extractRows(json);
        appendRows(allRows, pageRows);

        var totalRecords = Number(json.totalRecords || json.total || json.records || 0);
        var pageCount = totalRecords > 0 ? Math.ceil(totalRecords / CFG.fetchPageSize) : 0;
        var shouldContinue = page < CFG.fetchMaxPages && pageRows.length >= CFG.fetchPageSize;
        if (pageCount > 0) shouldContinue = page < Math.min(pageCount, CFG.fetchMaxPages);

        return shouldContinue ? fetchPage(page + 1) : allRows;
      });
    }

    return fetchPage(1);
  }

  function buildFetchDateRange() {
    var today = startOfDay(new Date());
    return {
      from: startOfDay(addMonths(today, -Math.max(0, Number(state.monthsBack) || 0))),
      to: endOfDay(addMonths(today, Math.max(1, Number(state.monthsAhead) || 1)))
    };
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

  function normaliseProject(raw, index) {
    raw = raw || {};

    var onsiteStart = parseHireHopDate(firstValue(raw, ["JOB_DATE", "PROJECT_START", "ONSITE_START", "START_DATE", "START"]));
    var onsiteEnd = parseHireHopDate(firstValue(raw, ["JOB_END", "PROJECT_END", "ONSITE_END", "END_DATE", "END"]));
    var kitStart = parseHireHopDate(firstValue(raw, ["OUT_DATE", "KIT_BOOKING_START", "KIT_START", "OUT"]));
    var kitEnd = parseHireHopDate(firstValue(raw, ["RETURN_DATE", "KIT_BOOKING_END", "KIT_END", "RETURN"]));
    var created = parseHireHopDate(firstValue(raw, ["CREATE_DATE", "CREATED_DATE", "CREATED", "DATE_CREATED"]));

    var start = onsiteStart || kitStart;
    var end = onsiteEnd || kitEnd || start;
    if (start && end && dayNumber(end) < dayNumber(start)) end = start;

    var project = {
      uid: "wct-project-" + (firstValue(raw, ["NUMBER", "PROJECT_ID", "ID", "id", "project_id"]) || index || Math.random()).toString().replace(/[^a-z0-9_-]+/gi, "-"),
      raw: raw,
      kind: firstValue(raw, ["kind", "KIND", "TYPE", "type"]),
      id: asText(firstValue(raw, ["NUMBER", "PROJECT_ID", "PROJECT_NUMBER", "ID", "id", "project_id"])),
      name: asText(firstValue(raw, ["JOB_NAME", "PROJECT_NAME", "NAME", "name", "project_name"])),
      wiseJobNumber: asText(firstValue(raw, ["~_WiseJobNumber", "~_Wise_Job_Number", "~_Wise_Job_No", "~_JobNumber", "~_Job_Number", "WISE_JOB_NUMBER", "WISE_JOB_NO", "JOB_NUMBER", "JOB_NO"])),
      client: asText(firstValue(raw, ["CLIENT", "CLIENT_NAME", "CUSTOMER", "customer"])),
      venue: asText(firstValue(raw, ["VENUE", "VENUE_NAME", "LOCATION", "location"])),
      status: readProjectStatusName(raw),
      statusValue: firstValue(raw, ["STATUS", "status"]),
      colour: normaliseColour(firstValue(raw, ["COLOUR", "COLOR", "STATUS_COLOUR", "STATUS_COLOR", "colour", "color"])),
      kitStart: kitStart,
      onsiteStart: onsiteStart,
      onsiteEnd: onsiteEnd,
      kitEnd: kitEnd,
      created: created,
      start: start,
      end: end,
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

    var directKeys = [
      key,
      "~" + key,
      key.replace(/^_+/, ""),
      "~" + key.replace(/^_+/, "")
    ];

    for (var i = 0; i < directKeys.length; i++) {
      if (raw[directKeys[i]] != null && raw[directKeys[i]] !== "") return customFieldToText(raw[directKeys[i]]);
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
      var value = readCustomFieldContainer(container, key);
      if (value !== "") return value;
    }

    return "";
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

    var keys = [key, "~" + key, key.replace(/^_+/, ""), "~" + key.replace(/^_+/, "")];
    for (var i = 0; i < keys.length; i++) {
      if (container[keys[i]] != null && container[keys[i]] !== "") return customFieldToText(container[keys[i]]);
    }

    if (Array.isArray(container)) {
      for (var c = 0; c < container.length; c++) {
        var item = container[c] || {};
        var name = asText(item.NAME || item.name || item.KEY || item.key || item.FIELD || item.field);
        if (normaliseKeyName(name) === normaliseKeyName(key)) {
          return customFieldToText(item.VALUE != null ? item.VALUE : item.value);
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
      if (value.NAME != null) return asText(value.NAME);
      if (value.name != null) return asText(value.name);
      if (value.LABEL != null) return asText(value.LABEL);
      if (value.label != null) return asText(value.label);
    }
    return asText(value);
  }

  function parseHireHopDate(value) {
    if (value == null || value === "") return null;
    if (value instanceof Date) return isValidDate(value) ? startOfDay(value) : null;

    if (typeof value === "number") {
      var numericDate = new Date(value);
      return isValidDate(numericDate) ? startOfDay(numericDate) : null;
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
    return isValidDate(parsed) ? startOfDay(parsed) : null;
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

  function isOpenProject(project) {
    if (!project) return false;
    if (!isProjectRecord(project)) return false;
    if (isDeletedProject(project.raw)) return false;

    var status = normaliseStatus(project.status);
    if (status && normalisedClosedStatuses().indexOf(status) !== -1) return false;
    if (status && normalisedOpenStatuses().indexOf(status) !== -1) return true;

    var raw = project.raw || {};
    var closedFlag = firstValue(raw, ["CLOSED", "closed", "IS_CLOSED", "is_closed", "ARCHIVED", "archived"]);
    if (closedFlag != null && closedFlag !== "" && Number(closedFlag) === 1) return false;

    return true;
  }

  function getProjectStart(project) {
    return project ? (project.onsiteStart || project.kitStart || null) : null;
  }

  function getProjectEnd(project) {
    if (!project) return null;
    return project.onsiteEnd || project.kitEnd || getProjectStart(project);
  }

  function buildTimelineRange(projects) {
    var start = null;
    var end = null;

    for (var i = 0; i < projects.length; i++) {
      var projectStart = getProjectStart(projects[i]);
      var projectEnd = getProjectEnd(projects[i]);
      if (!projectStart) continue;
      if (!start || dayNumber(projectStart) < dayNumber(start)) start = projectStart;
      if (projectEnd && (!end || dayNumber(projectEnd) > dayNumber(end))) end = projectEnd;
    }

    var today = startOfDay(new Date());
    if (!start) start = addMonths(today, -1);
    if (!end) end = addMonths(today, 1);

    start = startOfDay(addMonths(start, -CFG.timelinePaddingMonthsBefore));
    end = startOfDay(addMonths(end, CFG.timelinePaddingMonthsAfter));

    if (dayNumber(today) < dayNumber(start)) start = addMonths(today, -1);
    if (dayNumber(today) > dayNumber(end)) end = addMonths(today, 1);

    return {
      start: start,
      end: end,
      days: Math.max(1, daysBetween(start, end) + 1),
      pixelsPerDay: getPixelsPerDay()
    };
  }

  function groupProjects(projects, groupMode) {
    var role = ROLE_MODES[groupMode] || ROLE_MODES.project;
    var groups = {};

    for (var i = 0; i < projects.length; i++) {
      var project = projects[i];
      var value = cleanRoleValue(project.roles[role.field]) || role.unassigned;
      var key = normaliseGroupKey(value);
      if (!groups[key]) {
        groups[key] = {
          key: key,
          label: value,
          unassigned: value === role.unassigned,
          projects: []
        };
      }
      groups[key].projects.push(project);
    }

    return Object.keys(groups).map(function (key) {
      var group = groups[key];
      group.projects.sort(sortProjectsByStart);
      group.activeToday = countActiveToday(group.projects);
      return group;
    }).sort(function (a, b) {
      if (a.unassigned !== b.unassigned) return a.unassigned ? 1 : -1;
      return a.label.localeCompare(b.label);
    });
  }

  function render() {
    hidePopover();
    updateControlsFromState();

    if (state.loading) {
      setStatus("Loading open projects...", "loading");
      return;
    }

    var view = buildViewModel();
    state.visibleProjects = view.visibleProjects;
    state.datedProjects = view.datedProjects;
    state.missingDateProjects = view.missingDateProjects;
    state.rows = view.rows;
    state.timeline = view.timeline;
    state.projectMap = view.projectMap;

    $(".wct-left-head").text((ROLE_MODES[state.groupMode] || ROLE_MODES.project).label + " team");
    renderSummary(view);
    renderMissingDates(view.missingDateProjects);

    if (!state.projects.length) {
      setStatus("No projects were returned by HireHop for the selected date window.", "empty");
      clearTimeline();
      return;
    }

    if (!view.visibleProjects.length) {
      setStatus("No open projects match the current filters.", "empty");
      clearTimeline();
      return;
    }

    setStatus("", "");
    renderTimelineHeader(view.timeline);
    renderProjectBars(view);
    syncTimelineScroll();
    updateVisibleRangeText();
  }

  function buildViewModel() {
    var search = normaliseSearch(state.search);
    var visible = [];

    for (var i = 0; i < state.projects.length; i++) {
      var project = state.projects[i];
      if (state.hideClosed && !isOpenProject(project)) continue;
      if (search && project.searchText.indexOf(search) === -1) continue;
      if (state.showUnassignedOnly && !isProjectUnassignedForCurrentMode(project)) continue;
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
    var rows = buildRows(groupProjects(dated, state.groupMode));
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
      rows: rows,
      projectMap: projectMap,
      totalHeight: rows.length ? rows[rows.length - 1].top + rows[rows.length - 1].height : 0
    };
  }

  function buildRows(groups) {
    var rows = [];
    var top = 0;

    for (var g = 0; g < groups.length; g++) {
      var group = groups[g];
      assignProjectLanes(group);

      var lanes = Math.max(1, group.laneCount || 1);
      var height = Math.max(
        CFG.personRowMinHeight,
        (CFG.lanePadding * 2) + (lanes * CFG.barHeight) + ((lanes - 1) * CFG.laneGap)
      );

      rows.push({
        type: "person",
        key: group.key,
        label: group.label,
        count: group.projects.length,
        activeToday: group.activeToday || 0,
        projects: group.projects,
        lanes: group.lanes || {},
        laneCount: lanes,
        unassigned: group.unassigned,
        top: top,
        height: height
      });
      top += height;
    }

    return rows;
  }

  function assignProjectLanes(group) {
    var laneEnds = [];
    var lanes = {};
    var projects = group.projects || [];

    for (var i = 0; i < projects.length; i++) {
      var project = projects[i];
      var start = dayNumber(getProjectStart(project));
      var end = dayNumber(getProjectEnd(project) || getProjectStart(project));
      var lane = 0;

      while (laneEnds[lane] != null && start <= laneEnds[lane]) lane++;
      laneEnds[lane] = end;
      lanes[project.uid] = lane;
    }

    group.lanes = lanes;
    group.laneCount = Math.max(1, laneEnds.length);
  }

  function renderSummary(view) {
    var totalOpen = 0;
    var noPm = 0;
    var noDesigner = 0;
    var noTpm = 0;
    var noProduction = 0;

    for (var i = 0; i < state.projects.length; i++) {
      var project = state.projects[i];
      if (!isOpenProject(project)) continue;
      totalOpen++;
      if (!project.roles.pm) noPm++;
      if (!project.roles.designer) noDesigner++;
      if (!project.roles.tpm) noTpm++;
      if (!project.roles.production) noProduction++;
    }

    var items = [
      ["Open projects", totalOpen],
      ["Shown", view.visibleProjects.length],
      ["Missing dates", view.missingDateProjects.length],
      ["No Project", noPm],
      ["No Designer", noDesigner],
      ["No Technical", noTpm],
      ["No Production", noProduction],
      ["Visible range", '<span id="wise-capacity-tracker-visible-range">' + escapeHtml(getVisibleRangeLabel(view.timeline)) + '</span>']
    ];

    $("#" + CFG.summaryId).html(items.map(function (item) {
      return '<div class="wct-summary-pill"><span>' + escapeHtml(item[0]) + '</span><strong>' + item[1] + '</strong></div>';
    }).join(""));
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

  function renderTimelineHeader(timeline) {
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

    appendDayTicks(html, timeline, width);

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
    appendBodyDayGrid(html, timeline, width, height);

    var todayLeft = daysBetween(timeline.start, startOfDay(new Date())) * timeline.pixelsPerDay;
    if (todayLeft >= 0 && todayLeft <= width) {
      html.push('<div class="wct-today-line" style="left:' + todayLeft + 'px;height:' + height + 'px;"><span>Today</span></div>');
    }

    for (var r = 0; r < view.rows.length; r++) {
      var rowModel = view.rows[r];
      if (rowModel.type !== "person") continue;
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

  function renderLeftRows(rows, height) {
    var html = ['<div class="wct-left-inner" style="height:' + Math.max(height, 80) + 'px;">'];

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      html.push(
        '<div class="wct-left-row is-person' + (row.unassigned ? " is-unassigned" : "") + '" style="top:' + row.top + 'px;height:' + row.height + 'px;">' +
          '<strong>' + escapeHtml(row.label) + '</strong>' +
          '<span>' + row.count + ' event' + (row.count === 1 ? "" : "s") + (row.activeToday ? " | " + row.activeToday + " active today" : "") + '</span>' +
        '</div>'
      );
    }

    html.push("</div>");
    $("#" + CFG.leftBodyId).html(html.join(""));
  }

  function renderProjectBar(row, project, lane, timeline) {
    var start = getProjectStart(project);
    var end = getProjectEnd(project) || start;
    var left = Math.max(0, daysBetween(timeline.start, start) * timeline.pixelsPerDay);
    var durationDays = Math.max(1, daysBetween(start, end) + 1);
    var minWidth = state.zoom === "quarter" ? 8 : Math.max(10, timeline.pixelsPerDay);
    var width = Math.max(minWidth, durationDays * timeline.pixelsPerDay);
    var maxWidth = timeline.days * timeline.pixelsPerDay - left;
    if (maxWidth > 0) width = Math.min(width, maxWidth);

    var color = project.colour || "#2563eb";
    var textColor = getReadableTextColor(color);
    var top = row.top + CFG.lanePadding + (lane * (CFG.barHeight + CFG.laneGap));

    return (
      '<button type="button" class="wct-project-bar" data-project-uid="' + escapeAttr(project.uid) + '" ' +
        'style="left:' + left + 'px;top:' + top + 'px;width:' + width + 'px;height:' + CFG.barHeight + 'px;background:' + escapeAttr(color) + ';color:' + textColor + ';" ' +
        'title="' + escapeAttr(getProjectLabel(project)) + '">' +
        '<span>' + escapeHtml(getShortBarLabel(project)) + '</span>' +
      '</button>'
    );
  }

  function appendDayTicks(html, timeline, width) {
    var cursor = startOfDay(timeline.start);

    while (dayNumber(cursor) <= dayNumber(timeline.end)) {
      var left = daysBetween(timeline.start, cursor) * timeline.pixelsPerDay;
      var dayWidth = Math.max(1, Math.min(timeline.pixelsPerDay, width - left));
      if (left >= 0 && left <= width) {
        html.push(
          '<div class="wct-day-cell' + getDayCellClasses(cursor) + '" style="left:' + left + 'px;width:' + dayWidth + 'px;">' +
            '<span>' + escapeHtml(String(cursor.getDate())) + '</span>' +
          '</div>'
        );
      }
      cursor = addDays(cursor, 1);
    }
  }

  function appendBodyDayGrid(html, timeline, width, height) {
    var cursor = startOfDay(timeline.start);
    while (dayNumber(cursor) <= dayNumber(timeline.end)) {
      var left = daysBetween(timeline.start, cursor) * timeline.pixelsPerDay;
      var dayWidth = Math.max(1, Math.min(timeline.pixelsPerDay, width - left));
      if (left >= 0 && left <= width) {
        html.push('<div class="wct-day-gridline' + getDayCellClasses(cursor) + '" style="left:' + left + 'px;width:' + dayWidth + 'px;height:' + height + 'px;"></div>');
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
    var timeline = state.timeline;
    var $scroll = $("#" + CFG.timelineScrollId);
    if (!timeline || !$scroll.length) return;

    var todayLeft = daysBetween(timeline.start, startOfDay(new Date())) * timeline.pixelsPerDay;
    var bias = options.centerBias == null ? 0.42 : Number(options.centerBias);
    var left = Math.max(0, todayLeft - ($scroll.innerWidth() * bias));

    $scroll.scrollLeft(left);
    syncTimelineScroll();
  }

  function syncTimelineScroll() {
    var $scroll = $("#" + CFG.timelineScrollId);
    var $left = $("#" + CFG.leftBodyId);
    var $header = $("#" + CFG.headerScrollId);
    if (!$scroll.length) return;

    $left.scrollTop($scroll.scrollTop());
    $header.scrollLeft($scroll.scrollLeft());
    updateVisibleRangeText();
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
    $("#" + CFG.timelineHeaderId + ",#" + CFG.timelineBodyId + ",#" + CFG.leftBodyId).empty();
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
        '<strong>' + escapeHtml(project.name || "Untitled project") + '</strong>',
        '<button type="button" class="wct-popover-close" aria-label="Close">x</button>',
      '</div>',
      '<div class="wct-popover-grid">',
        detailItem("Wise job", project.wiseJobNumber || project.id),
        detailItem("Client", project.client),
        detailItem("Venue", project.venue),
        detailItem("Status", project.status),
        detailItem("Onsite start", formatDate(project.onsiteStart)),
        detailItem("Onsite end", formatDate(project.onsiteEnd)),
        detailItem("Kit start", formatDate(project.kitStart)),
        detailItem("Kit end", formatDate(project.kitEnd)),
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
              ["week", "Week"],
              ["month", "Month"],
              ["quarter", "Quarter"]
            ]) +
            controlSelect("wise-capacity-tracker-group", "Team", [
              ["project", "Project"],
              ["designer", "Designer"],
              ["technical", "Technical"],
              ["production", "Production"]
            ]) +
            '<label class="wct-control wct-search"><span>Search</span><input id="wise-capacity-tracker-search" type="search" autocomplete="off" placeholder="Project, client, venue or person"></label>' +
            '<label class="wct-check"><input id="wise-capacity-tracker-hide-closed" type="checkbox"> Open only</label>' +
            '<label class="wct-check"><input id="wise-capacity-tracker-unassigned" type="checkbox"> Unassigned only</label>' +
            '<label class="wct-control wct-number"><span>Months back</span><input id="wise-capacity-tracker-months-back" type="number" min="0" max="84" step="1"></label>' +
            '<label class="wct-control wct-number"><span>Months ahead</span><input id="wise-capacity-tracker-months-ahead" type="number" min="1" max="84" step="1"></label>' +
          '</div>' +
          '<div id="' + CFG.statusId + '" class="wct-status" style="display:none;"></div>' +
          '<div id="' + CFG.summaryId + '" class="wct-summary"></div>' +
          '<div id="' + CFG.missingId + '" class="wct-missing" style="display:none;"></div>' +
          '<div class="wct-grid">' +
            '<div class="wct-left-head">Project team</div>' +
            '<div id="' + CFG.headerScrollId + '" class="wct-header-scroll"><div id="' + CFG.timelineHeaderId + '" class="wct-timeline-header"></div></div>' +
            '<div id="' + CFG.leftBodyId + '" class="wct-left-body"></div>' +
            '<div id="' + CFG.timelineScrollId + '" class="wct-timeline-scroll"><div id="' + CFG.timelineBodyId + '" class="wct-timeline-body"></div></div>' +
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

    $("#wise-capacity-tracker-hide-closed").on("change.wiseCapacityTracker", function () {
      state.hideClosed = this.checked;
      refreshProjects();
    });

    $("#wise-capacity-tracker-unassigned").on("change.wiseCapacityTracker", function () {
      state.showUnassignedOnly = this.checked;
      render();
    });

    $("#wise-capacity-tracker-months-back,#wise-capacity-tracker-months-ahead").on("change.wiseCapacityTracker", function () {
      state.monthsBack = clamp(Number($("#wise-capacity-tracker-months-back").val()) || CFG.defaultMonthsBack, 0, 84);
      state.monthsAhead = clamp(Number($("#wise-capacity-tracker-months-ahead").val()) || CFG.defaultMonthsAhead, 1, 84);
      refreshProjects();
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
    $("#wise-capacity-tracker-search").val(state.search);
    $("#wise-capacity-tracker-hide-closed").prop("checked", state.hideClosed);
    $("#wise-capacity-tracker-unassigned").prop("checked", state.showUnassignedOnly);
    $("#wise-capacity-tracker-months-back").val(state.monthsBack);
    $("#wise-capacity-tracker-months-ahead").val(state.monthsAhead);
  }

  function injectStyles() {
    if ($("#" + CFG.stylesId).length) return;

    $("head").append(
      '<style id="' + CFG.stylesId + '">' +
      "#wise-capacity-tracker-button.wise-capacity-home-tab a{display:flex;align-items:center;gap:5px;cursor:pointer;}" +
      "#wise-capacity-tracker-button.wise-capacity-home-tab .ui-icon{display:inline-block;position:static;margin:0;}" +
      "#wise-capacity-tracker-button.wise-capacity-home-tab:hover{background:#eef6ff;border-color:#9fc5ef;}" +
      ".wise-capacity-tracker-open{overflow:hidden;}" +
      ".wct-overlay{position:fixed;inset:0;z-index:100200;background:rgba(16,24,40,.48);display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box;}" +
      ".wct-overlay.is-visible{display:flex!important;}" +
      ".wct-overlay *{box-sizing:border-box;}" +
      ".wct-modal{position:relative;width:min(1680px,calc(100vw - 36px));height:min(960px,calc(100vh - 36px));display:flex;flex-direction:column;background:#f7f9fc;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 22px 70px rgba(15,23,42,.28);color:#1f2937;font-family:Arial,Helvetica,sans-serif;overflow:hidden;}" +
      ".wct-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:16px 18px 12px;background:#ffffff;border-bottom:1px solid #d9e2ec;}" +
      ".wct-title-block h2{margin:0;font-size:22px;line-height:1.2;font-weight:700;color:#102033;letter-spacing:0;}" +
      ".wct-title-block p{margin:4px 0 0;font-size:13px;line-height:1.35;color:#526071;}" +
      ".wct-header-actions{display:flex;align-items:center;gap:7px;}" +
      ".wct-icon-btn{min-width:34px;height:32px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#1f2937;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;}" +
      ".wct-icon-btn:hover{background:#eef6ff;border-color:#9fc5ef;}" +
      ".wct-controls{display:flex;flex-wrap:wrap;align-items:end;gap:10px;padding:10px 18px;background:#eef3f8;border-bottom:1px solid #d9e2ec;}" +
      ".wct-control{display:flex;flex-direction:column;gap:3px;font-size:11px;text-transform:uppercase;color:#526071;font-weight:700;letter-spacing:0;}" +
      ".wct-control select,.wct-control input{height:30px;border:1px solid #bec9d6;border-radius:6px;background:#fff;color:#172033;padding:0 9px;font-size:13px;text-transform:none;font-weight:400;min-width:130px;}" +
      ".wct-search{flex:1 1 260px;min-width:220px;}.wct-search input{width:100%;}" +
      ".wct-number input{width:86px;min-width:86px;}" +
      ".wct-check{height:30px;display:flex;align-items:center;gap:6px;font-size:13px;color:#253244;white-space:nowrap;}" +
      ".wct-check input{margin:0;}" +
      ".wct-status{margin:10px 18px 0;padding:10px 12px;border-radius:6px;border:1px solid #d6e4f0;background:#fff;color:#334155;font-size:13px;}" +
      ".wct-status.is-loading{border-color:#9cc5ed;background:#edf7ff;color:#164e7a;}.wct-status.is-error{border-color:#f0b4b4;background:#fff1f1;color:#8a1f1f;}.wct-status.is-empty{border-color:#d6e4f0;background:#ffffff;color:#526071;}" +
      ".wct-summary{display:flex;flex-wrap:wrap;gap:8px;padding:10px 18px 8px;min-height:48px;}" +
      ".wct-summary-pill{display:flex;align-items:baseline;gap:7px;background:#fff;border:1px solid #dbe3ec;border-radius:6px;padding:6px 9px;min-height:30px;}" +
      ".wct-summary-pill span{font-size:11px;text-transform:uppercase;color:#667085;font-weight:700;letter-spacing:0;}.wct-summary-pill strong{font-size:13px;color:#1f2937;font-weight:700;}" +
      ".wct-missing{margin:0 18px 8px;padding:8px 10px;border:1px solid #f0d38a;background:#fff8e6;border-radius:6px;color:#6b4e00;font-size:12px;display:flex;gap:10px;align-items:center;}.wct-missing span{color:#725c23;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
      ".wct-grid{flex:1 1 auto;min-height:240px;display:grid;grid-template-columns:310px minmax(0,1fr);grid-template-rows:56px minmax(0,1fr);border-top:1px solid #d9e2ec;background:#fff;}" +
      ".wct-left-head{grid-column:1;grid-row:1;display:flex;align-items:center;padding:0 14px;border-right:1px solid #d9e2ec;border-bottom:1px solid #d9e2ec;background:#f8fafc;font-weight:700;font-size:12px;text-transform:uppercase;color:#526071;letter-spacing:0;}" +
      ".wct-header-scroll{grid-column:2;grid-row:1;overflow:hidden;border-bottom:1px solid #d9e2ec;background:#f8fafc;}" +
      ".wct-timeline-header{position:relative;height:56px;min-width:100%;}" +
      ".wct-left-body{grid-column:1;grid-row:2;position:relative;overflow:hidden;border-right:1px solid #d9e2ec;background:#fbfdff;}" +
      ".wct-left-inner{position:relative;min-height:100%;}" +
      ".wct-left-row{position:absolute;left:0;right:0;display:flex;flex-direction:column;justify-content:center;padding:0 12px;border-bottom:1px solid #edf1f5;overflow:hidden;background:#fff;}" +
      ".wct-left-row.is-person strong{font-size:13px;color:#102033;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.wct-left-row.is-person span{font-size:11px;color:#667085;}.wct-left-row.is-unassigned{background:#fff8e6;}" +
      ".wct-timeline-scroll{grid-column:2;grid-row:2;overflow:auto;position:relative;background:#fff;}" +
      ".wct-timeline-body{position:relative;min-width:100%;min-height:100%;}" +
      ".wct-month-segment{position:absolute;top:0;height:24px;border-right:1px solid #d9e2ec;padding:5px 7px 0;font-size:12px;font-weight:700;color:#253244;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      ".wct-day-cell{position:absolute;top:24px;height:32px;border-left:1px solid #dbe3ec;display:flex;align-items:center;justify-content:center;font-size:10px;color:#526071;overflow:hidden;}.wct-day-cell.is-weekend{background:#eef3f8;}.wct-day-cell.is-today{background:#fff1f1;color:#b42318;font-weight:700;}" +
      ".wct-row-backdrop{position:absolute;left:0;top:0;}.wct-row-line{position:absolute;left:0;right:0;border-bottom:1px solid #edf1f5;}.wct-row-line.is-person:nth-child(even){background:#fcfdff;}" +
      ".wct-day-gridline{position:absolute;top:0;border-left:1px solid #edf1f5;z-index:1;pointer-events:none;}.wct-day-gridline.is-weekend{background:rgba(238,243,248,.55);}.wct-day-gridline.is-today{background:rgba(217,45,32,.06);}" +
      ".wct-today-line{position:absolute;top:0;width:0;border-left:2px solid #d92d20;z-index:5;pointer-events:none;}.wct-today-line span{position:absolute;top:4px;left:5px;background:#d92d20;color:#fff;border-radius:4px;padding:2px 5px;font-size:10px;font-weight:700;}" +
      ".wct-project-bar{position:absolute;z-index:4;border:1px solid rgba(15,23,42,.22);border-radius:5px;box-shadow:0 1px 2px rgba(15,23,42,.14);padding:0 7px;text-align:left;cursor:pointer;overflow:hidden;}" +
      ".wct-project-bar span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:700;line-height:18px;}" +
      ".wct-project-bar:hover{filter:brightness(1.03);box-shadow:0 2px 7px rgba(15,23,42,.22);}" +
      ".wct-popover{position:absolute;z-index:20;width:360px;max-width:calc(100% - 24px);background:#fff;border:1px solid #b9c7d6;border-radius:8px;box-shadow:0 14px 34px rgba(15,23,42,.26);padding:12px;color:#1f2937;}" +
      ".wct-popover-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px;}.wct-popover-head strong{font-size:15px;line-height:1.25;}.wct-popover-close{border:0;background:transparent;color:#667085;font-size:16px;line-height:1;cursor:pointer;}" +
      ".wct-popover-grid{display:grid;grid-template-columns:105px 1fr;gap:5px 10px;font-size:12px;}.wct-detail-label{color:#667085;font-weight:700;}.wct-detail-value{color:#243244;min-width:0;overflow:hidden;text-overflow:ellipsis;}" +
      ".wct-role-strip{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}.wct-role-chip{border:1px solid #d9e2ec;background:#f8fafc;border-radius:5px;padding:4px 6px;font-size:11px;color:#253244;}.wct-role-chip.is-empty{color:#8a5a00;background:#fff8e6;border-color:#efd58e;}.wct-role-chip strong{margin-right:4px;color:#526071;}" +
      "@media (max-width: 900px){.wct-overlay{padding:8px;}.wct-modal{width:calc(100vw - 16px);height:calc(100vh - 16px);}.wct-grid{grid-template-columns:235px minmax(0,1fr);}.wct-controls{gap:8px;}.wct-control select,.wct-control input{min-width:104px;}.wct-search{flex-basis:190px;min-width:180px;}}" +
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

  function detailItem(label, value) {
    return '<span class="wct-detail-label">' + escapeHtml(label) + '</span><span class="wct-detail-value">' + escapeHtml(value || "Unassigned") + '</span>';
  }

  function roleChip(label, value) {
    var empty = !value;
    return '<span class="wct-role-chip' + (empty ? " is-empty" : "") + '"><strong>' + escapeHtml(label) + '</strong>' + escapeHtml(value || "Unassigned") + '</span>';
  }

  function getProjectLabel(project) {
    if (!project) return "";
    return project.wiseJobNumber || project.name || ("Project " + project.id);
  }

  function getShortBarLabel(project) {
    if (!project) return "";
    var prefix = project.wiseJobNumber || project.id;
    if (prefix && project.name) return prefix + " - " + project.name;
    return getProjectLabel(project);
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
      project.name,
      project.wiseJobNumber,
      project.client,
      project.venue,
      project.status,
      project.roles.pm,
      project.roles.designer,
      project.roles.tpm,
      project.roles.production
    ].join(" "));
  }

  function isProjectUnassignedForCurrentMode(project) {
    var role = ROLE_MODES[state.groupMode] || ROLE_MODES.project;
    return !project.roles[role.field];
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
    var startDiff = dayNumber(getProjectStart(a) || new Date(8640000000000000)) - dayNumber(getProjectStart(b) || new Date(8640000000000000));
    if (startDiff !== 0) return startDiff;
    return getProjectLabel(a).localeCompare(getProjectLabel(b));
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

  function asText(value) {
    if (value == null) return "";
    return $.trim(String(value));
  }

  function cleanRoleValue(value) {
    var text = asText(value).replace(/\s+/g, " ");
    if (!text || /^null$/i.test(text) || /^undefined$/i.test(text)) return "";
    return text;
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

  function normalisedClosedStatuses() {
    return CFG.closedStatusNames.map(normaliseStatus);
  }

  function normalisedOpenStatuses() {
    return CFG.openStatusNames.map(normaliseStatus);
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

  function getPixelsPerDay() {
    return CFG.pixelsPerDay[state.zoom] || CFG.pixelsPerDay.month;
  }

  function getCustomFieldKeyList() {
    return [
      CFG.customFieldKeys.pm,
      CFG.customFieldKeys.designer,
      CFG.customFieldKeys.tpm,
      CFG.customFieldKeys.production
    ];
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
    return startOfDay(date);
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

  function addMonths(date, months) {
    return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
  }

  function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  function dayNumber(date) {
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  }

  function daysBetween(start, end) {
    return dayNumber(end) - dayNumber(start);
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
        "~_PM": "Alex",
        "~_Designer": "Taylor",
        "~_TPM": "Jordan",
        "~_Production": "Sam"
      }
    ];
  }
})();
