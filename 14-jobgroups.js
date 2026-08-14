/* Wise Job Details Layout
 * Proposal Creation-only canonical presentation for the read-only job page.
 * HireHop's native DOM remains in place but hidden; this module reads its live
 * values and renders a clean, deterministic project-overview plus job-card layout.
 */
(function () {
  "use strict";

  if (window.__wiseJobGroupsLoaded) return;
  window.__wiseJobGroupsLoaded = true;

  var $ = window.jQuery;
  if (!$) return;

  var LOG_PREFIX = "[Wise Job Groups]";
  var ROOT_CLASS = "wise-jg-active";
  var STYLES_ID = "wise-job-groups-styles";
  var FALLBACK_ACCENT = "#f97316";
  var FALLBACK_ACCENT_RGB = "249,115,22";
  var PROJECT_FALLBACK_ACCENT = "#64748b";
  var PROJECT_FALLBACK_ACCENT_RGB = "100,116,139";
  var USER_DEPOT_KEYS = [
    "DEPOT_ID", "depot_id", "DEFAULT_DEPOT_ID", "default_depot_id",
    "BRANCH_ID", "branch_id", "WAREHOUSE_ID", "warehouse_id",
    "DEPOT", "depot", "DEPOT_NAME", "depot_name",
    "DEFAULT_DEPOT", "default_depot", "WAREHOUSE", "warehouse"
  ];
  var KNOWN_PROPOSAL_CREATION_DEPOT_ID = "14";
  var CFG = { version: "2026-08-14.13", maintainRecoveryMs: 5000 };
  var PROJECT_CUSTOM_FIELDS = ["_Status", "_Tier", "_Job_Number", "_JobNumber", "_Client", "_Venue", "_Revenue", "_revenue", "_Install", "_ShowStart", "_ShowEnd", "_Derig"];
  var ICONS = {
    project: '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 17V4.5A1.5 1.5 0 0 1 4.5 3h11A1.5 1.5 0 0 1 17 4.5V17M1.5 17h17M7 7h2M11 7h2M7 11h2M11 11h2M8 17v-3h4v3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    job: '<svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor"><rect x="2" y="4" width="16" height="13" rx="2"/><path d="M6 4V2h8v2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="5" y="8" width="10" height="2" rx="1" fill="#fff"/><rect x="5" y="12" width="7" height="2" rx="1" fill="#fff"/></svg>',
    dates: '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2" y="3.5" width="16" height="14" rx="2"/><path d="M6 1.5v4M14 1.5v4M2 7.5h16"/><circle cx="10" cy="12" r="3"/><path d="M10 10.5V12l1.3.9" stroke-linecap="round"/></svg>',
    commercial: '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2" y="3" width="16" height="14" rx="2"/><path d="M2 7h16M5 12h4M12 12h3" stroke-linecap="round"/></svg>'
  };

  var PROJECT_GROUPS = [
    {
      key: "project-details",
      title: "Project Details",
      note: "Project-level view · read only here",
      icon: ICONS.project,
      project: true,
      fields: [
        field("project-tier", "Tier", ["Tier"], { always: true, projectKeys: ["_Tier", "~_Tier", "TIER", "tier"] }),
        field("project-wise-job-number", "Wise job number", ["Wise job number"], { always: true, projectKeys: ["_Job_Number", "_JobNumber", "~_Job_Number", "~_JobNumber", "WISE_JOB_NUMBER", "JOB_NUMBER"] }),
        field("project-client", "Client", ["Client"], { always: true, projectKeys: ["_Client", "~_Client", "CLIENT", "CLIENT_NAME", "COMPANY", "client"] }),
        field("project-venue", "Venue", ["Venue"], { always: true, projectKeys: ["_Venue", "~_Venue", "VENUE", "VENUE_NAME", "DELIVER_TO", "venue"] }),
        field("project-revenue", "Revenue", ["Revenue"], { always: true, projectKeys: ["_Revenue", "_revenue", "~_Revenue", "REVENUE", "revenue"] }),
        field("project-onsite-start", "Project/Onsite Start", ["Project/Onsite Start"], { always: true, section: "Project Timings", timelineStep: true, projectDate: true, projectKeys: ["START_DATETIME", "START_DATE_TIME", "PROJECT_START_DATE_TIME", "START_DATE", "DATE", "PROJECT_DATE", "JOB_DATE"], projectTimeKeys: ["START_TIME", "PROJECT_TIME", "TIME", "JOB_TIME"] }),
        field("project-install-start", "Install Start", ["Install Start"], { always: true, timelineStep: true, projectDate: true, projectKeys: ["_Install", "~_Install", "INSTALL", "INSTALL_START"] }),
        field("project-show-start", "Show Start", ["Show Start"], { always: true, timelineStep: true, projectDate: true, projectKeys: ["_ShowStart", "~_ShowStart", "SHOW_START", "showStart"] }),
        field("project-show-end", "Show End", ["Show End"], { always: true, timelineStep: true, projectDate: true, projectKeys: ["_ShowEnd", "~_ShowEnd", "SHOW_END", "showEnd"] }),
        field("project-derig-start", "Derig Start", ["Derig Start"], { always: true, timelineStep: true, projectDate: true, projectKeys: ["_Derig", "~_Derig", "DERIG", "DERIG_START"] }),
        field("project-onsite-end", "Project/Onsite End", ["Project/Onsite End"], { always: true, timelineStep: true, projectDate: true, projectKeys: ["END_DATETIME", "END_DATE_TIME", "PROJECT_END_DATE_TIME", "END_DATE", "DATE_END", "PROJECT_END", "JOB_END"], projectTimeKeys: ["END_TIME", "PROJECT_END_TIME", "TIME_END", "JOB_END_TIME"] })
      ]
    }
  ];

  var JOB_GROUPS = [
    {
      key: "job-details",
      title: "Job Details",
      icon: ICONS.job,
      fields: [
        field("job-name", "Job name", ["Job name"], { always: true }),
        field("job-type", "Job Type", ["Job type"], { always: true }),
        field("version", "Version", ["Version"], { always: true }),
        field("contact-name", "Contact name", ["Contact name"], { always: true }),
        field("email", "Email", ["Email"], { always: true }),
        field("mobile", "Mobile", ["Mobile"], { always: true }),
        field("job-memo", "Job memo", ["Job memo"], { always: true, longText: true })
      ]
    },
    {
      key: "job-timings",
      title: "Job Timings",
      icon: ICONS.dates,
      fields: [
        field("wise-prep-start", "Wise Prep Start", ["Wise Prep Start"], { always: true, dateTime: true }),
        field("kit-booking-start", "Kit Booking Start", ["Kit Booking Start"], { always: true, dateTime: true }),
        field("vehicle-load", "Vehicle Load", ["Vehicle Load"], { always: true, dateTime: true }),
        field("vehicle-install", "Vehicle Onsite - Install", ["Vehicle Onsite - Install", "Vehicle Onsite Install"], { always: true, dateTime: true }),
        field("project-start", "Project/Onsite Start", ["Project/Onsite Start", "Project Onsite Start"], { always: true, dateTime: true }),
        field("vehicle-derig", "Vehicle Onsite - Derig", ["Vehicle Onsite - Derig", "Vehicle Onsite Derig"], { always: true, dateTime: true }),
        field("project-end", "Project/Onsite End", ["Project/Onsite End", "Project Onsite End"], { always: true, dateTime: true }),
        field("vehicle-tip", "Vehicle Tip", ["Vehicle Tip"], { always: true, dateTime: true }),
        field("kit-booking-end", "Kit Booking End", ["Kit Booking End"], { always: true, dateTime: true })
      ]
    },
    {
      key: "job-commercial-info",
      title: "Job Commercial Info",
      icon: ICONS.commercial,
      fields: [
        field("discretionary-discount", "Discretionary discount", ["Discretionary Discount", "Discretionary discount"], { always: true }),
        field("venue-commission", "Venue commission", ["Venue Commission", "Venue commission"], { always: true }),
        field("client-commission", "Client commission", ["Client Commission", "Client commission"], { always: true }),
        field("charge-period", "Charge period", ["Charge period"], { always: true })
      ]
    }
  ];

  var GROUPS = PROJECT_GROUPS.concat(JOB_GROUPS);
  var JOB_ID_SPEC = field("internal-job-id", "Job ID", ["Job ID", "Job ID#"], { always: true });

  var ALL_LABELS = buildAllLabels();
  var state = {
    maintainTimer: null,
    maintainScheduled: null,
    accentObserver: null,
    accentObserverRoot: null,
    lastRoot: null,
    activeJobId: "",
    parentProjectId: "",
    parentProjectData: null,
    parentProjectSource: "",
    parentProjectSupplementError: "",
    parentProjectRequest: null,
    parentProjectError: "",
    recoveryCount: 0,
    recoveryChecks: 12
  };

  bootstrap();

  function field(key, label, aliases, options) {
    options = options || {};
    return {
      key: key,
      label: label,
      aliases: aliases,
      occurrence: Number(options.occurrence) || 0,
      span: Number(options.span) || 1,
      section: String(options.section || ""),
      always: !!options.always,
      projectKeys: options.projectKeys || [],
      projectTimeKeys: options.projectTimeKeys || [],
      projectDate: !!options.projectDate,
      dateTime: !!options.dateTime,
      longText: !!options.longText,
      timelineStep: !!options.timelineStep
    };
  }

  function bootstrap() {
    installStyles();
    scheduleMaintain(0);
    state.maintainTimer = setInterval(function () {
      if (document.hidden) return;
      state.recoveryCount += 1;
      scheduleMaintain(0);
      if (state.recoveryCount >= state.recoveryChecks) {
        clearInterval(state.maintainTimer);
        state.maintainTimer = null;
      }
    }, CFG.maintainRecoveryMs);
    $(window).on("load.wiseJobGroups focus.wiseJobGroups hashchange.wiseJobGroups", function () { scheduleMaintain(60); });
    $(document)
      .on("ajaxComplete.wiseJobGroups", function () { scheduleMaintain(80); })
      .on("tabsactivate.wiseJobGroups", ".hh-framework_tabs", function () { scheduleMaintain(20); })
      .on("click.wiseJobGroups", "#tabs > ul a,.hh-framework_tabs > ul a,.ui-tabs > ul.ui-tabs-nav a", function () {
        scheduleMaintain(20);
      });
  }

  function scheduleMaintain(delay) {
    if (state.maintainScheduled) clearTimeout(state.maintainScheduled);
    state.maintainScheduled = setTimeout(function () {
      state.maintainScheduled = null;
      try { maintain(); } catch (err) { log("maintain failed, native screen unaffected", err); }
    }, Math.max(0, Number(delay) || 0));
  }

  function maintain() {
    // HireHop's hh_tabbed_page framework owns one #main_tab panel per page
    // and jQuery UI hides that whole panel when another tab is selected. The
    // layout must live inside that panel; mounting against a text-matched
    // ancestor such as #tabs makes it a sibling of every panel and therefore
    // visible everywhere.
    var $detailsPanel = findJobDetailsPanel();
    if (!$detailsPanel.length) {
      restoreJobInfoLayouts();
      return;
    }
    restoreLayoutsOutsideDetailsPanel($detailsPanel);
    restoreStaleJobInfoLayouts();
    var $root = findJobInfoRoot($detailsPanel);
    if (!$root.length || !isProposalCreationDepot()) return;
    if (!isInsideDetailsPanel($root.get(0), $detailsPanel.get(0))) {
      log("Refused to mount job cards outside HireHop's #main_tab details panel.");
      return;
    }
    if ($root.hasClass(ROOT_CLASS)) {
      // Unlike the project layout, this layout is a rendered copy of the
      // hidden native job fields. Keep its copied accent variables live when
      // HireHop changes the current job/status without replacing the root.
      applyAccentColour($root);
      maintainAccentObserver($root);
      maintainParentProject($root);
      return;
    }

    applyAccentColour($root);
    var $nativeNodes = findNativeJobSourceNodes($root);
    if (!$nativeNodes.length) {
      log("A safe job-field boundary was not found; native screen left visible.");
      return;
    }
    var $layout = renderLayout($root);
    if (!$layout.find(".wise-jg-field").length) {
      log("No canonical job fields were found; native screen left visible.");
      return;
    }

    $nativeNodes.each(function () {
      var $node = $(this);
      if ($node.attr("data-wise-jg-original-aria") == null) {
        $node.attr("data-wise-jg-original-aria", $node.attr("aria-hidden") == null ? "__missing__" : $node.attr("aria-hidden"));
      }
    }).addClass("wise-jg-native-source-node").attr("aria-hidden", "true");
    $layout.insertBefore($nativeNodes.first());
    $root.addClass(ROOT_CLASS);
    state.lastRoot = $root.get(0);
    maintainAccentObserver($root);
    maintainParentProject($root);
  }

  function findNativeJobSourceNodes($root) {
    var markers = [
      "job id", "contact name", "job type", "venue", "address", "telephone", "mobile", "email",
      "job memo", "client reference", "price group", "price structure", "credit period",
      "kit booking start", "kit booking end", "project/onsite start", "project/onsite end",
      "wise prep start", "vehicle load", "vehicle onsite", "vehicle tip", "warehouse name",
      "calculate late fees", "allow early returns", "discretionary discount", "venue commission",
      "client commission", "technical", "created by", "version"
    ];
    var $children = $root.children().not(".wise-jg-layout");
    var $matched = $children.filter(function () {
      var text = normaliseText($(this).text());
      if (text.indexOf("job details") !== -1 && text.indexOf("kit booking start") !== -1 && text.indexOf("company") !== -1) return false;
      if ($(this).find("ul.ui-tabs-nav,#items_tab").length) return false;
      var matches = 0;
      for (var i = 0; i < markers.length; i++) {
        if (text.indexOf(markers[i]) !== -1) matches += 1;
      }
      return matches >= 2;
    });
    if ($matched.length) return $matched;

    // Stable HireHop job-info containers are already a safe boundary. The
    // ID-less fallback may be a shared wrapper, so never hide all of its
    // children unless field-bearing children were positively identified.
    if ($root.is("#job_info,#job_details,#job_detail,#job_info_container,[data-page='job-details']")) return $children;
    return $();
  }

  function restoreStaleJobInfoLayouts() {
    $("." + ROOT_CLASS).each(function () {
      var $root = $(this);
      var $source = $root.children(".wise-jg-native-source-node");
      var text = normaliseText($source.text());
      if (!looksLikeJobInfoText(text)) restoreJobInfoLayout($root);
    });
  }

  function restoreJobInfoLayouts() {
    $("." + ROOT_CLASS).each(function () { restoreJobInfoLayout($(this)); });
  }

  function restoreJobInfoLayout($root) {
    if (!$root || !$root.length) return;
    $root.children(".wise-jg-layout").remove();
    $root.children(".wise-jg-native-source-node").each(function () {
      var $node = $(this);
      var originalAria = $node.attr("data-wise-jg-original-aria");
      $node.removeClass("wise-jg-native-source-node").removeAttr("data-wise-jg-original-aria");
      if (originalAria && originalAria !== "__missing__") $node.attr("aria-hidden", originalAria);
      else $node.removeAttr("aria-hidden");
    });
    $root.removeClass(ROOT_CLASS);
    if (state.lastRoot === $root.get(0)) {
      state.lastRoot = null;
      resetParentProjectState();
    }
    if (state.accentObserverRoot === $root.get(0)) {
      stopAccentObserver();
    }
  }

  function findJobDetailsPanel() {
    var $visiblePagePanel = $();
    var $fallbackPanel = $();
    // HireHop currently has two job-page structures in circulation:
    //   legacy/live: #tabs.ui-tabs > #details_tab > table#job_info
    //   framework:   .hh-framework_tabs > #main_tab
    // Select the native details panel itself in either structure. Its job
    // field signature distinguishes it from project and unrelated tab panels,
    // while the visible parent tab widget wins if stale page widgets remain.
    $("#details_tab,#main_tab").each(function () {
      if ($visiblePagePanel.length) return;
      var $panel = $(this);
      var $tabs = $panel.parent("#tabs,.hh-framework_tabs,.ui-tabs");
      if (!$tabs.length || !looksLikeJobInfoText(normaliseText($panel.text()))) return;
      if ($tabs.is(":visible")) $visiblePagePanel = $panel;
      else if (!$fallbackPanel.length) $fallbackPanel = $panel;
    });
    return $visiblePagePanel.length ? $visiblePagePanel : $fallbackPanel;
  }

  function isInsideDetailsPanel(node, panel) {
    return !!node && !!panel && (node === panel || $.contains(panel, node));
  }

  function restoreLayoutsOutsideDetailsPanel($detailsPanel) {
    var panel = $detailsPanel && $detailsPanel.get(0);
    $("." + ROOT_CLASS).each(function () {
      if (!isInsideDetailsPanel(this, panel)) restoreJobInfoLayout($(this));
    });
  }

  function renderLayout($root) {
    var $layout = $("<div></div>").addClass("wise-jg-layout");
    var $projectGrid = $("<div></div>").addClass("wise-jg-project-grid");
    var $jobGrid = $("<div></div>").addClass("wise-jg-job-grid");
    for (var g = 0; g < GROUPS.length; g++) {
      var group = GROUPS[g];
      var $section = makeGroup(group);
      var $body = $section.children(".wise-jg-body");
      if (group.project) {
        renderSubhead($body, "Project Timings");
        var $projectTimings = $("<div></div>").addClass("wise-jg-project-date-grid").appendTo($body);
        renderProjectFields($projectTimings, group.fields, true);
        renderSubhead($body, "Project Information");
        var $projectInfo = $("<div></div>").addClass("wise-jg-project-info-grid").appendTo($body);
        renderProjectFields($projectInfo, group.fields, false);
      } else {
        var pendingSubhead = "";
        for (var f = 0; f < group.fields.length; f++) {
          var spec = group.fields[f];
          if (spec.section) pendingSubhead = spec.section;
          var value = readFieldValue($root, spec);
          if (!value && !spec.always) continue;
          if (pendingSubhead) {
            renderSubhead($body, pendingSubhead);
            pendingSubhead = "";
          }
          renderField($body, spec, value);
        }
      }
      (group.project ? $projectGrid : $jobGrid).append($section);
    }
    $layout.append($jobGrid, $projectGrid);
    return $layout;
  }

  function renderProjectFields($body, fields, timings) {
    for (var f = 0; f < fields.length; f++) {
      var spec = fields[f];
      if (!!spec.projectDate !== !!timings) continue;
      var value = readProjectFieldValue(spec);
      if (value || spec.always) renderField($body, spec, value);
    }
  }

  function makeGroup(group) {
    var $section = $("<section></section>")
      .attr("data-wise-job-group", group.key)
      .toggleClass("wise-jg-timeline", !!group.timeline)
      .addClass("wise-jg-section");
    var $header = $("<div></div>").addClass("wise-jg-hdr");
    $("<span></span>").addClass("wise-jg-icon").html(group.icon).appendTo($header);
    $("<span></span>").addClass("wise-jg-hdr-text").text(group.title).appendTo($header);
    if (group.note) $("<span></span>").addClass("wise-jg-hdr-note").text(group.note).appendTo($header);
    $section.append($header, $("<div></div>").addClass("wise-jg-body"));
    return $section;
  }

  function renderField($body, spec, value) {
    var $field = $("<div></div>")
      .addClass("wise-jg-field")
      .attr("data-wise-job-field", spec.key)
      .attr("data-wise-span", spec.span);
    if (spec.longText) $field.addClass("wise-jg-field-long-text");
    if (spec.timelineStep) $field.addClass("wise-jg-field-timing");
    if (spec.projectDate || spec.dateTime) $field.addClass("wise-jg-date-box");
    $("<span></span>").addClass("wise-jg-field-label").text(spec.label).appendTo($field);
    var $value = $("<span></span>").addClass("wise-jg-field-value").appendTo($field);
    setRenderedFieldValue($value, spec, value);
    $body.append($field);
  }

  function setRenderedFieldValue($value, spec, value) {
    $value.empty().toggleClass("wise-jg-empty", !value);
    if (!spec.projectDate && !spec.dateTime) {
      $value.text(value || "—");
      return;
    }
    var parts = splitDateTime(value);
    $("<span></span>").addClass("wise-jg-date-value").text(parts.date).appendTo($value);
    $("<span></span>").addClass("wise-jg-time-value").text(parts.time).appendTo($value);
  }

  function splitDateTime(value) {
    value = cleanValue(value);
    var match = value.match(/^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})$/);
    return match ? { date: match[1], time: match[2] } : { date: value || "—", time: "—" };
  }

  function renderSubhead($body, label) {
    $("<div></div>")
      .addClass("wise-jg-subhead")
      .text(label)
      .appendTo($body);
  }

  function readProjectFieldValue(spec) {
    var data = state.parentProjectData;
    if (!data || typeof data !== "object") return "";
    var value = readProjectObjectValue(data, spec.projectKeys);
    if (spec.projectDate && spec.projectTimeKeys.length && !valueHasTime(value)) {
      var timeValue = readProjectObjectValue(data, spec.projectTimeKeys);
      if (timeValue) value = cleanValue(value + " " + timeValue);
    }
    value = customFieldToText(value);
    return spec.projectDate ? formatDateTime(value) : value;
  }

  function readProjectObjectValue(object, keys) {
    if (!object || typeof object !== "object") return "";
    keys = keys || [];
    var containers = [
      object.CUSTOM_FIELDS,
      object.custom_fields,
      object.CUSTOMFIELDS,
      object.customFields,
      object.PROJECT_CUSTOM_FIELDS,
      object.project_custom_fields,
      object.fields,
      object.FIELDS,
      object
    ];
    for (var c = 0; c < containers.length; c++) {
      var container = parseProjectFieldContainer(containers[c]);
      if (!container || typeof container !== "object") continue;
      for (var k = 0; k < keys.length; k++) {
        var variants = projectKeyVariants(keys[k]);
        for (var v = 0; v < variants.length; v++) {
          if (Object.prototype.hasOwnProperty.call(container, variants[v]) && container[variants[v]] != null && container[variants[v]] !== "") {
            return container[variants[v]];
          }
        }
        if (!$.isArray(container)) {
          var containerKeys = Object.keys(container);
          for (var p = 0; p < containerKeys.length; p++) {
            var property = containerKeys[p];
            if (normaliseProjectKeyName(property) !== normaliseProjectKeyName(keys[k])) continue;
            if (container[property] != null && container[property] !== "") return container[property];
          }
        }
        if ($.isArray(container)) {
          for (var i = 0; i < container.length; i++) {
            var item = container[i] || {};
            var name = item.NAME || item.name || item.KEY || item.key || item.FIELD || item.field || item.FIELD_NAME || item.field_name || item.CUSTOM_FIELD || item.custom_field;
            if (normaliseProjectKeyName(name) !== normaliseProjectKeyName(keys[k])) continue;
            var itemValue = item.VALUE != null ? item.VALUE : item.value;
            if (itemValue == null) itemValue = item.TEXT != null ? item.TEXT : item.text;
            if (itemValue == null) itemValue = item.DISPLAY != null ? item.DISPLAY : item.display;
            if (itemValue != null && itemValue !== "") return itemValue;
          }
        }
      }
    }
    return "";
  }

  function parseProjectFieldContainer(value) {
    if (!value || typeof value !== "string") return value;
    try { return JSON.parse(value); } catch (error) { return null; }
  }

  function normaliseProjectKeyName(value) {
    return String(value == null ? "" : value).toLowerCase().replace(/^[~_]+/, "").replace(/[^a-z0-9]+/g, "");
  }

  function describeProjectKeys(object) {
    if (!object || typeof object !== "object") return [];
    var keys = Object.keys(object);
    var containers = [object.CUSTOM_FIELDS, object.custom_fields, object.CUSTOMFIELDS, object.customFields, object.PROJECT_CUSTOM_FIELDS, object.project_custom_fields, object.fields, object.FIELDS];
    for (var c = 0; c < containers.length; c++) {
      var container = parseProjectFieldContainer(containers[c]);
      if (!container || typeof container !== "object") continue;
      if ($.isArray(container)) {
        for (var i = 0; i < container.length; i++) {
          var item = container[i] || {};
          var name = item.NAME || item.name || item.KEY || item.key || item.FIELD || item.field || item.FIELD_NAME || item.field_name || item.CUSTOM_FIELD || item.custom_field;
          if (name) keys.push(String(name));
        }
      } else {
        keys = keys.concat(Object.keys(container));
      }
    }
    return keys.filter(function (key, index) { return keys.indexOf(key) === index; }).slice(0, 100);
  }

  function projectKeyVariants(key) {
    key = String(key || "");
    var bare = key.replace(/^~/, "");
    var variants = [key, bare, "~" + bare];
    var lower = bare.toLowerCase();
    if (variants.indexOf(lower) === -1) variants.push(lower);
    return variants;
  }

  function customFieldToText(value) {
    if (value == null) return "";
    if (typeof value !== "object") return cleanValue(value);
    var keys = ["VALUE", "value", "DISPLAY", "display", "TEXT", "text", "NAME", "name"];
    for (var i = 0; i < keys.length; i++) {
      if (value[keys[i]] != null && typeof value[keys[i]] !== "object") return cleanValue(value[keys[i]]);
    }
    return "";
  }

  function valueHasTime(value) {
    return /\b\d{1,2}:\d{2}\b/.test(customFieldToText(value));
  }

  function formatDateTime(value) {
    value = cleanValue(value);
    if (!value) return value;

    var day;
    var month;
    var year;
    var hour;
    var minute;
    var match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s]+(\d{1,2}):(\d{2}))?/);
    if (match) {
      year = Number(match[1]);
      month = Number(match[2]);
      day = Number(match[3]);
      hour = match[4];
      minute = match[5];
    } else {
      match = value.match(/^(?:[A-Za-z]+,?\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/i);
      if (match) {
        var monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
        month = monthNames.indexOf(match[2].toLowerCase()) + 1;
        if (!month) return value;
        day = Number(match[1]);
        year = Number(match[3]);
        hour = match[4];
        minute = match[5];
      } else {
        match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
        if (!match) return value;
        day = Number(match[1]);
        month = Number(match[2]);
        year = Number(match[3]);
        hour = match[4];
        minute = match[5];
      }
    }

    var date = new Date(year, month - 1, day);
    if (isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return value;
    if (hour == null) {
      hour = "00";
      minute = "00";
    }
    return ("0" + day).slice(-2) + "/" + ("0" + month).slice(-2) + "/" + year + " " + ("0" + hour).slice(-2) + ":" + minute;
  }

  function readFieldValue($root, spec) {
    var customValue = readCustomFieldValue($root, spec);
    if (customValue.found) return spec.dateTime ? formatDateTime(customValue.value) : customValue.value;

    var matches = findLabelMatches($root, spec);
    if (!matches.length) return "";
    var $label = $(matches[Math.min(spec.occurrence, matches.length - 1)]);
    var value = readValueFromLabel($label, spec);
    return spec.dateTime ? formatDateTime(value) : value;
  }

  function readCustomFieldValue($root, spec) {
    var found = { found: false, value: "" };
    $root.find(".custom_field_container").each(function () {
      if (found.found) return;
      var $container = $(this);
      var labelText = $container.children("label").first().clone().children().remove().end().text();
      if (!matchesSpecLabel(labelText, spec, true)) return;
      var $value = $container.find(".custom_field").first();
      found.found = true;
      found.value = cleanValue($value.is("input,select,textarea") ? $value.val() : $value.text());
    });
    return found;
  }

  function findLabelMatches($root, spec) {
    var matches = [];
    $root.find("label,b,strong,th,td,span,div").each(function () {
      var $element = $(this);
      if ($element.hasClass("wise-jg-layout") || $element.closest(".wise-jg-layout").length) return;
      if (this.tagName && this.tagName.toLowerCase() === "div" && $element.children().length) return;
      var ownText = getOwnText(this);
      if (matchesSpecLabel(ownText, spec, false)) matches.push(this);
    });

    matches.sort(function (a, b) {
      return normaliseText($(a).text()).length - normaliseText($(b).text()).length;
    });
    return matches;
  }

  function readValueFromLabel($label, spec) {
    var inline = stripLeadingLabel(getOwnText($label.get(0)), spec);
    if (inline) return cleanValue(inline);

    var siblingValue = readFollowingSiblings($label.get(0));
    if (siblingValue) return siblingValue;

    var $cell = $label.closest("td,th");
    if ($cell.length) {
      var cellInline = stripLeadingLabel(getOwnText($cell.get(0)), spec);
      if (cellInline) return cleanValue(cellInline);
      if (spec.longText) {
        var $copy = $cell.clone();
        $copy.find("label,b,strong,th,td,span,div").filter(function () {
          return matchesSpecLabel(getOwnText(this), spec, false);
        }).first().remove();
        var containedValue = cleanValue(stripLeadingLabel($copy.text(), spec) || $copy.text());
        // Memo-style cells often occupy one half of a wide row. Never fall
        // through to the following cell, which contains unrelated commercial
        // fields on HireHop's legacy job layout.
        return containedValue;
      }
      var tableValue = readFollowingCells($cell);
      if (tableValue) return tableValue;
    }

    var $parent = $label.parent();
    if ($parent.length) {
      var parentText = cleanValue(stripLeadingLabel($parent.text(), spec));
      if (parentText && countKnownLabels(parentText) <= 1 && parentText.length < 180) return parentText;
    }
    return "";
  }

  function readFollowingSiblings(label) {
    var parts = [];
    var node = label.nextSibling;
    while (node) {
      if (node.nodeType === 1 && elementStartsWithKnownLabel($(node))) break;
      var text = node.nodeType === 3 ? node.nodeValue : $(node).text();
      text = cleanValue(text);
      if (text) parts.push(text);
      node = node.nextSibling;
    }
    return cleanValue(parts.join(" "));
  }

  function readFollowingCells($cell) {
    var parts = [];
    $cell.nextAll("td,th").each(function () {
      var text = cleanValue($(this).text());
      if (!text) return;
      if (startsWithKnownLabel(text)) return false;
      parts.push(text);
    });
    return cleanValue(parts.join(" "));
  }

  function matchesSpecLabel(value, spec, exactOnly) {
    var normalised = normaliseLabel(value);
    for (var i = 0; i < spec.aliases.length; i++) {
      var alias = normaliseLabel(spec.aliases[i]);
      if (normalised === alias) return true;
      if (!exactOnly && normalised.indexOf(alias + " ") === 0) return true;
    }
    return false;
  }

  function stripLeadingLabel(value, spec) {
    value = String(value || "");
    var aliases = spec.aliases.slice().sort(function (a, b) { return b.length - a.length; });
    for (var i = 0; i < aliases.length; i++) {
      var alias = escapeRegExp(aliases[i]).replace(/\\ /g, "\\s+");
      var re = new RegExp("^\\s*" + alias.replace(/\\#$/, "#?") + "\\s*:?[?]?\\s*", "i");
      var stripped = value.replace(re, "");
      if (stripped !== value) return stripped;
    }
    return "";
  }

  function getOwnText(element) {
    var out = "";
    if (!element || !element.childNodes) return out;
    for (var i = 0; i < element.childNodes.length; i++) {
      if (element.childNodes[i].nodeType === 3) out += " " + element.childNodes[i].nodeValue;
    }
    return cleanValue(out);
  }

  function elementStartsWithKnownLabel($element) {
    return startsWithKnownLabel(getOwnText($element.get(0)) || $element.text());
  }

  function startsWithKnownLabel(value) {
    var text = normaliseLabel(value);
    for (var i = 0; i < ALL_LABELS.length; i++) {
      if (text === ALL_LABELS[i] || text.indexOf(ALL_LABELS[i] + " ") === 0) return true;
    }
    return false;
  }

  function countKnownLabels(value) {
    var text = normaliseLabel(value);
    var count = 0;
    for (var i = 0; i < ALL_LABELS.length; i++) {
      if (text.indexOf(ALL_LABELS[i]) !== -1) count += 1;
    }
    return count;
  }

  function buildAllLabels() {
    var labels = [];
    // Only native job labels participate in DOM row-boundary detection.
    // Parent-project labels are read from API objects and would otherwise make
    // values such as "Client 1" look like the start of a new native field.
    for (var g = 0; g < JOB_GROUPS.length; g++) {
      for (var f = 0; f < JOB_GROUPS[g].fields.length; f++) {
        var aliases = JOB_GROUPS[g].fields[f].aliases;
        for (var a = 0; a < aliases.length; a++) {
          var label = normaliseLabel(aliases[a]);
          if (labels.indexOf(label) === -1) labels.push(label);
        }
      }
    }
    labels.push(normaliseLabel("Job ID"), normaliseLabel("Job ID#"));
    labels.sort(function (a, b) { return b.length - a.length; });
    return labels;
  }

  function cleanValue(value) {
    return String(value == null ? "" : value)
      .replace(/\s+/g, " ")
      .replace(/^\s*:\s*/, "")
      .replace(/^\s+|\s+$/g, "");
  }

  function normaliseText(value) {
    return cleanValue(value).toLowerCase();
  }

  function normaliseLabel(value) {
    return normaliseText(value).replace(/[#:?]+/g, " ").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
  }

  function maintainParentProject($root) {
    var jobId = normaliseNumericId(readFieldValue($root, JOB_ID_SPEC)) || getCurrentJobIdFromLocation();
    if (!jobId) return;
    if (state.activeJobId !== jobId) {
      resetParentProjectState();
      state.activeJobId = jobId;
      refreshProjectFieldValues($root);
    }
    if (state.parentProjectData) {
      refreshProjectFieldValues($root);
      return;
    }
    if (state.parentProjectRequest || state.parentProjectError) return;

    var parentId = findParentProjectId($root);
    var requestJobId = jobId;
    state.parentProjectRequest = (parentId ? Promise.resolve({ id: parentId, project: findWindowProjectData(parentId) }) : requestJobDetail(jobId))
      .then(function (result) {
        if (requestJobId !== state.activeJobId) return null;
        var resolvedId = parentId || extractParentProjectId(result, jobId);
        var embeddedProject = result && result.project && typeof result.project === "object"
          ? result.project
          : extractEmbeddedProject(result, resolvedId);
        if (!resolvedId && embeddedProject) resolvedId = extractProjectRecordId(embeddedProject);
        if (!resolvedId) throw new Error("The parent project ID was not exposed by this job.");
        state.parentProjectId = resolvedId;
        if (embeddedProject && projectRecordHasRequestedFields(embeddedProject)) return embeddedProject;
        return requestProjectRecord(resolvedId);
      })
      .then(function (projectData) {
        if (requestJobId !== state.activeJobId || !projectData) return;
        state.parentProjectData = projectData;
        state.parentProjectError = "";
        refreshProjectFieldValues($root);
      })
      .catch(function (error) {
        if (requestJobId !== state.activeJobId) return;
        state.parentProjectError = error && error.message ? error.message : String(error || "Parent project lookup failed.");
        log("Parent project lookup failed; job fields remain available", state.parentProjectError);
        refreshProjectFieldValues($root);
      })
      .then(function () {
        if (requestJobId === state.activeJobId) state.parentProjectRequest = null;
      });
  }

  function resetParentProjectState() {
    state.activeJobId = "";
    state.parentProjectId = "";
    state.parentProjectData = null;
    state.parentProjectSource = "";
    state.parentProjectSupplementError = "";
    state.parentProjectRequest = null;
    state.parentProjectError = "";
  }

  function refreshProjectFieldValues($root) {
    if (!$root || !$root.length) return;
    for (var g = 0; g < PROJECT_GROUPS.length; g++) {
      for (var f = 0; f < PROJECT_GROUPS[g].fields.length; f++) {
        var spec = PROJECT_GROUPS[g].fields[f];
        var value = readProjectFieldValue(spec);
        setRenderedFieldValue(
          $root.find(".wise-jg-layout [data-wise-job-field='" + spec.key + "'] .wise-jg-field-value"),
          spec,
          value
        );
      }
    }
    applyProjectAccentColour($root);
    $root.find("[data-wise-job-group='project-details']")
      .attr("aria-busy", state.parentProjectRequest ? "true" : "false")
      .attr("data-wise-project-state", state.parentProjectData ? "ready" : state.parentProjectError ? "error" : "loading");
  }

  function findParentProjectId($root) {
    var $scope = $root.closest("#details_tab,#main_tab");
    if (!$scope.length) $scope = $root;
    var found = "";
    $scope.find("a[href],button[onclick],[data-project-id],[data-project]").each(function () {
      if (found) return;
      var $element = $(this);
      var text = [$element.attr("href"), $element.attr("onclick"), $element.attr("data-project-id"), $element.attr("data-project")].join(" ");
      var match = text.match(/project\.php[^\s'\"]*[?&](?:id|project|project_id)=(\d+)/i);
      if (!match) match = text.match(/(?:project-id|project_id|data-project-id)[^\d]{0,5}(\d+)/i);
      if (match) found = normaliseNumericId(match[1]);
    });
    if (found) return found;

    var selectors = ["input[name='project_id']", "input[name='project']", "#project_id", "[data-parent-project-id]"];
    for (var i = 0; i < selectors.length; i++) {
      var $candidate = $scope.find(selectors[i]).first();
      var value = $candidate.val() || $candidate.attr("data-parent-project-id") || $candidate.attr("data-project-id");
      found = normaliseNumericId(value);
      if (found) return found;
    }

    var objects = [window.job_data, window.jobData, window.currentJob, window.job];
    var jobId = state.activeJobId || getCurrentJobIdFromLocation();
    for (var o = 0; o < objects.length; o++) {
      found = extractParentProjectId(objects[o], jobId);
      if (found) return found;
    }
    return "";
  }

  function getCurrentJobIdFromLocation() {
    var href = String(window.location && window.location.href || "");
    var match = href.match(/[?&](?:job|job_id|id)=(\d+)/i) || href.match(/\/job\/(\d+)/i);
    return match ? normaliseNumericId(match[1]) : "";
  }

  function extractParentProjectId(object, currentJobId) {
    if (!object || typeof object !== "object") return "";
    var priority = ["PROJECT_ID", "project_id", "PARENT_PROJECT_ID", "parent_project_id", "PROJECT_NUMBER", "project_number"];
    for (var i = 0; i < priority.length; i++) {
      var id = normaliseNumericId(object[priority[i]]);
      if (id) return id;
    }
    var projectValue = object.PROJECT != null ? object.PROJECT : object.project;
    if (projectValue && typeof projectValue === "object") {
      var embeddedId = extractProjectRecordId(projectValue);
      if (embeddedId) return embeddedId;
    } else {
      var scalarId = normaliseNumericId(projectValue);
      if (scalarId) return scalarId;
    }
    var mainId = normaliseNumericId(object.MAIN_ID != null ? object.MAIN_ID : object.main_id);
    return mainId && mainId !== currentJobId ? mainId : "";
  }

  function extractEmbeddedProject(object, projectId) {
    if (!object || typeof object !== "object") return null;
    var candidates = [object.PROJECT, object.project, object.PROJECT_DATA, object.project_data, object.parentProject];
    for (var i = 0; i < candidates.length; i++) {
      if (!candidates[i] || typeof candidates[i] !== "object") continue;
      var id = extractProjectRecordId(candidates[i]);
      if (!projectId || !id || id === projectId) return candidates[i];
    }
    return null;
  }

  function extractProjectRecordId(object) {
    if (!object || typeof object !== "object") return "";
    var keys = ["PROJECT_ID", "project_id", "ID", "id", "NUMBER", "PROJECT_NUMBER"];
    for (var i = 0; i < keys.length; i++) {
      var id = normaliseNumericId(object[keys[i]]);
      if (id) return id;
    }
    return "";
  }

  function normaliseNumericId(value) {
    var match = String(value == null ? "" : value).match(/\d+/);
    return match && Number(match[0]) > 0 ? String(Number(match[0])) : "";
  }

  function findWindowProjectData(projectId) {
    var candidates = [window.proj_data, window.projectData, window.currentProject, window.project];
    for (var i = 0; i < candidates.length; i++) {
      if (!candidates[i] || typeof candidates[i] !== "object") continue;
      if (extractProjectRecordId(candidates[i]) === projectId) return candidates[i];
    }
    return null;
  }

  function projectRecordHasRequestedFields(project) {
    if (!project || typeof project !== "object") return false;
    for (var g = 0; g < PROJECT_GROUPS.length; g++) {
      for (var f = 0; f < PROJECT_GROUPS[g].fields.length; f++) {
        if (readProjectObjectValue(project, PROJECT_GROUPS[g].fields[f].projectKeys) !== "") return true;
      }
    }
    return false;
  }

  function requestJobDetail(jobId) {
    return requestJson("job-groups-job:" + jobId, "api/job_data.php?job=" + encodeURIComponent(jobId));
  }

  function requestProjectRecord(projectId) {
    var directUrl = "/php_functions/project_get_data.php?id=" + encodeURIComponent(projectId) +
      "&include_project_custom_fields=1&include_custom_fields=1&project_custom_fields=" + encodeURIComponent(PROJECT_CUSTOM_FIELDS.join(",")) +
      "&custom_fields=" + encodeURIComponent(PROJECT_CUSTOM_FIELDS.join(","));
    return requestJson("job-groups-project-data:" + projectId, directUrl)
      .then(function (json) {
        var project = json && json.data && typeof json.data === "object" && !$.isArray(json.data)
          ? $.extend(true, {}, json, json.data)
          : json;
        if (project && project.error) throw new Error("HireHop project data error: " + project.error);
        if (!project || typeof project !== "object" || extractProjectRecordId(project) !== projectId) {
          throw new Error("HireHop returned an invalid project record for " + projectId + ".");
        }
        return requestProjectRecordFromSearch(projectId, project).then(function (searchProject) {
          state.parentProjectSupplementError = "";
          state.parentProjectSource = "project_get_data+search_list";
          return $.extend(true, {}, project, searchProject);
        }, function (searchError) {
          state.parentProjectSupplementError = searchError && searchError.message ? searchError.message : String(searchError || "Project custom-field supplement failed.");
          state.parentProjectSource = "project_get_data";
          return project;
        });
      }, function (directError) {
        return requestProjectRecordFromSearch(projectId, null).then(function (project) {
          state.parentProjectSupplementError = "";
          state.parentProjectSource = "search_list_fallback";
          return project;
        }).catch(function (searchError) {
          throw new Error("Direct project lookup failed (" + directError.message + "); search fallback failed (" + searchError.message + ").");
        });
      });
  }

  function requestProjectRecordFromSearch(projectId, hintProject) {
    var endpoint = "/php_functions/search_list.php";
    var shared = window.WiseProposalSectionBuilderHireHop;
    if (shared && shared.endpoints && shared.endpoints.searchList) endpoint = shared.endpoints.searchList;
    var filter = {
      mode: "AND",
      data: [{ condition: "equal", dataIndx: "NUMBER", dataType: "integer", value: Number(projectId) }]
    };
    var range = getProjectSearchRange(hintProject);
    var params = {
      local: formatSearchDateTime(new Date()),
      tz: getTimezone(),
      page: 1,
      rows: 25,
      jobs: 0,
      projects: 1,
      open: 1,
      closed: 1,
      money_owed: 0,
      is_late: 0,
      mine: 0,
      no_user: 0,
      needs_bill: 0,
      only_open_ended: 0,
      status: "",
      from_date: range.from,
      to_date: range.to,
      include_project_custom_fields: 1,
      include_custom_fields: 1,
      project_custom_fields: PROJECT_CUSTOM_FIELDS.join(","),
      custom_fields: PROJECT_CUSTOM_FIELDS.join(","),
      wise_cache: Date.now()
    };
    var nativeFilterParams = $.extend({}, params, { pq_filter: filter });
    return requestProjectSearchResponse(endpoint, nativeFilterParams, projectId, "native-filter").catch(function () {
      var jsonFilterParams = $.extend({}, params, { pq_filter: JSON.stringify(filter) });
      return requestProjectSearchResponse(endpoint, jsonFilterParams, projectId, "json-filter");
    }).catch(function () {
      if (!range.narrowed) throw new Error("HireHop did not return parent project " + projectId + " from either exact filter shape.");
      var dateWindowParams = $.extend({}, params, { rows: 250 });
      return requestProjectSearchResponse(endpoint, dateWindowParams, projectId, "date-window");
    });
  }

  function getProjectSearchRange(project) {
    var fallback = { from: "2000-01-01 00:00:00", to: "2100-12-31 23:59:59", narrowed: false };
    if (!project || typeof project !== "object") return fallback;
    var start = parseProjectSearchDate(readProjectObjectValue(project, ["START_DATE", "JOB_DATE", "PROJECT_START", "DATE"]));
    var end = parseProjectSearchDate(readProjectObjectValue(project, ["END_DATE", "JOB_END", "PROJECT_END", "DATE_END"])) || start;
    if (!start) return fallback;
    if (end && end.getTime() < start.getTime()) end = start;
    var from = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7, 0, 0, 0);
    var to = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 7, 23, 59, 59);
    return { from: formatSearchDateTime(from), to: formatSearchDateTime(to), narrowed: true };
  }

  function parseProjectSearchDate(value) {
    value = customFieldToText(value);
    var match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    var date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return isNaN(date.getTime()) ? null : date;
  }

  function requestProjectSearchResponse(endpoint, params, projectId, mode) {
    var url = endpoint + (endpoint.indexOf("?") === -1 ? "?" : "&") + $.param(params);
    return requestJson("job-groups-project-search:" + projectId + ":" + mode, url).then(function (json) {
      var rows = extractResponseRows(json);
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i] && rows[i].rowData ? $.extend(true, {}, rows[i], rows[i].rowData) : rows[i];
        if (extractProjectRecordId(row) === projectId) return row;
      }
      if (json && typeof json === "object" && extractProjectRecordId(json) === projectId) return json;
      throw new Error("HireHop did not return parent project " + projectId + ".");
    });
  }

  function requestJson(key, url) {
    var factory = function () {
      return new Promise(function (resolve, reject) {
        $.ajax({
          url: url,
          method: "GET",
          dataType: "json",
          success: resolve,
          error: function (xhr, status, error) {
            var failure = new Error(String(error || status || "HireHop data request failed"));
            failure.status = Number(xhr && xhr.status) || 0;
            reject(failure);
          }
        });
      });
    };
    var shared = window.WiseProposalSectionBuilderHireHop;
    var requests = shared && shared.requests;
    if (!requests || typeof requests.request !== "function") return factory();
    return requests.request(key, factory, { priority: 20, minGapMs: 1250, cacheTtlMs: 5 * 60 * 1000 });
  }

  function extractResponseRows(json) {
    if ($.isArray(json)) return json;
    if (!json || typeof json !== "object") return [];
    if ($.isArray(json.data)) return json.data;
    if ($.isArray(json.rows)) return json.rows;
    if ($.isArray(json.items)) return json.items;
    if ($.isArray(json.records)) return json.records;
    if (json.data && $.isArray(json.data.data)) return json.data.data;
    if (json.data && $.isArray(json.data.rows)) return json.data.rows;
    if (json.data && $.isArray(json.data.records)) return json.data.records;
    return [];
  }

  function formatSearchDateTime(date) {
    function pad(value) { return ("0" + value).slice(-2); }
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
  }

  function getTimezone() {
    if (window.timezone) return String(window.timezone);
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { return ""; }
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function findJobInfoRoot($detailsPanel) {
    var panel = $detailsPanel && $detailsPanel.get(0);
    if (!panel) return $();
    // The panel is the stable/safe root. On the live legacy page its direct
    // field-bearing child is table#job_info; using that table as the root
    // would insert the generated <div> beside <tbody>, which is invalid HTML.
    return looksLikeJobInfo($detailsPanel) ? $detailsPanel : $();
  }

  function looksLikeJobInfo($candidate) {
    if (!$candidate || !$candidate.length || $candidate.closest("#proj_info,#items_tab").length) return false;
    if ($candidate.find("#proj_info,#gbox_jobs_grid").length) return false;
    return looksLikeJobInfoText(normaliseText($candidate.text()));
  }

  function looksLikeJobInfoText(text) {
    var label = normaliseLabel(text);
    var hasJobId = label === "job id" || label.indexOf("job id ") === 0 || label.indexOf(" job id ") !== -1;
    return hasJobId &&
      (text.indexOf("kit booking") !== -1 || text.indexOf("job memo") !== -1 || text.indexOf("client reference") !== -1);
  }

  function isProposalCreationDepot() {
    var shared = window.WiseProposalSectionBuilderHireHop;
    if (!shared || !shared.depot) return false;
    try {
      if (typeof shared.depot.isProposalCreation === "function") return shared.depot.isProposalCreation();
      var raw = readCurrentUserDepotValue();
      if (!raw) return false;
      var rawId = shared.depot.normaliseId ? shared.depot.normaliseId(raw) : "";
      var allowedId = (typeof shared.depot.resolveId === "function" && shared.depot.resolveId("Proposal Creation")) || KNOWN_PROPOSAL_CREATION_DEPOT_ID;
      if (rawId && allowedId && rawId === allowedId) return true;
      var rawText = shared.depot.normaliseText ? shared.depot.normaliseText(raw) : normaliseText(raw);
      return rawText === "proposal creation";
    } catch (err) {
      log("depot check failed; native screen retained", err);
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

  function applyAccentColour($root) {
    var element = $root.get(0);
    if (!element) return;
    var rgb = parseRgb(element.style.backgroundColor) || findVisibleAccent($root);
    setStylePropertyIfChanged(element, "--wise-job-accent", rgb ? rgbToHex(rgb) : FALLBACK_ACCENT);
    setStylePropertyIfChanged(element, "--wise-job-accent-rgb", rgb ? rgb.join(",") : FALLBACK_ACCENT_RGB);
  }

  function applyProjectAccentColour($root) {
    var element = $root.get(0);
    if (!element) return;
    var data = state.parentProjectData;
    var colour = data ? customFieldToText(readProjectObjectValue(data, ["COLOUR", "COLOR", "STATUS_COLOUR", "STATUS_COLOR", "colour", "color"])) : "";
    var rgb = parseRgb(colour);
    if (!rgb && data) {
      var status = customFieldToText(readProjectObjectValue(data, ["_Status", "~_Status", "STATUS_NAME", "status_name", "STATUS", "status"]));
      rgb = parseRgb(projectStatusColour(status));
    }
    setStylePropertyIfChanged(element, "--wise-project-window-accent", rgb ? rgbToHex(rgb) : PROJECT_FALLBACK_ACCENT);
    setStylePropertyIfChanged(element, "--wise-project-window-accent-rgb", rgb ? rgb.join(",") : PROJECT_FALLBACK_ACCENT_RGB);
  }

  function projectStatusColour(status) {
    var value = normaliseText(status);
    if (value === "closed lost") return "#7c8794";
    if (value === "quote (new client)" || value === "quote (repeat client)" || value.indexOf("quote") === 0) return "#7c3aed";
    if (value === "very likely") return "#f2c94c";
    if (value === "hold" || value === "hold - work in progress") return "#f97316";
    if (value === "confirmed") return "#16a34a";
    return PROJECT_FALLBACK_ACCENT;
  }

  function setStylePropertyIfChanged(element, name, value) {
    if (element.style.getPropertyValue(name) === value) return;
    element.style.setProperty(name, value);
  }

  // Status/job switches can update only an inline style or class and may not
  // produce an AJAX completion or a new root node. Observe the active native
  // information area so those colour-only changes refresh the card accents
  // immediately. Idempotent CSS-variable writes prevent observer loops.
  function maintainAccentObserver($root) {
    var element = $root && $root.get(0);
    if (!element || !window.MutationObserver) return;
    if (state.accentObserver && state.accentObserverRoot === element) return;

    stopAccentObserver();
    state.accentObserverRoot = element;
    state.accentObserver = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var $target = $(mutations[i].target);
        if (mutations[i].type === "attributes" && !$target.closest(".wise-jg-layout").length) {
          scheduleMaintain(0);
          return;
        }
      }
    });
    state.accentObserver.observe(element, {
      attributes: true,
      subtree: true,
      attributeFilter: ["style", "class"]
    });
  }

  function stopAccentObserver() {
    if (state.accentObserver) state.accentObserver.disconnect();
    state.accentObserver = null;
    state.accentObserverRoot = null;
  }

  function findVisibleAccent($root) {
    var found = null;
    // Once rendered, generated card elements also contain accent-tinted
    // backgrounds. Exclude them so a refresh always reads HireHop's native
    // status colour rather than feeding our own tint back into the accent.
    $root.find("div,header,table,tr").filter(function () {
      return !$(this).closest(".wise-jg-layout").length;
    }).slice(0, 24).each(function () {
      if (found) return;
      var value = this.style && this.style.backgroundColor;
      if (!value && window.getComputedStyle) value = window.getComputedStyle(this).backgroundColor;
      var rgb = parseRgb(value);
      if (rgb && Math.max.apply(Math, rgb) - Math.min.apply(Math, rgb) > 35 && Math.max.apply(Math, rgb) < 250) found = rgb;
    });
    return found;
  }

  function parseRgb(value) {
    value = String(value || "").trim();
    var rgbMatch = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgbMatch) return [parseInt(rgbMatch[1], 10), parseInt(rgbMatch[2], 10), parseInt(rgbMatch[3], 10)];
    var hexMatch = value.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!hexMatch) return null;
    var hex = hexMatch[1];
    if (hex.length === 3) hex = hex.replace(/(.)/g, "$1$1");
    return [parseInt(hex.substr(0, 2), 16), parseInt(hex.substr(2, 2), 16), parseInt(hex.substr(4, 2), 16)];
  }

  function rgbToHex(rgb) {
    return "#" + ("0" + rgb[0].toString(16)).slice(-2) +
      ("0" + rgb[1].toString(16)).slice(-2) + ("0" + rgb[2].toString(16)).slice(-2);
  }

  function installStyles() {
    if (document.getElementById(STYLES_ID)) return;
    var accent = "var(--wise-job-accent," + FALLBACK_ACCENT + ")";
    var accentRgb = "var(--wise-job-accent-rgb," + FALLBACK_ACCENT_RGB + ")";
    var projectAccent = "var(--wise-project-window-accent," + PROJECT_FALLBACK_ACCENT + ")";
    var projectAccentRgb = "var(--wise-project-window-accent-rgb," + PROJECT_FALLBACK_ACCENT_RGB + ")";
    var root = ".wise-jg-active";
    var css = [
      root + "{box-sizing:border-box;}",
      root + ">.wise-jg-native-source-node{display:none!important;}",
      // Fail closed in CSS too: even if a future discovery regression tries
      // to mount against shared #tabs, cards cannot display outside the
      // native details panel.
      root + ">.wise-jg-layout{display:none!important;padding:3px;background:#fff;box-sizing:border-box;font-size:14px;line-height:1.3;}",
      "#main_tab" + root + ">.wise-jg-layout,#main_tab " + root + ">.wise-jg-layout,#details_tab" + root + ">.wise-jg-layout,#details_tab " + root + ">.wise-jg-layout{display:block!important;}",
      root + " .wise-jg-project-grid{display:block;margin-top:8px;}",
      root + " .wise-jg-job-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;align-items:stretch;}",
      root + " .wise-jg-section{display:flex;flex-direction:column;box-sizing:border-box;min-width:0;background:#fff;border:1px solid #e5e7eb;border-left:6px solid " + accent + ";border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 1px 6px rgba(0,0,0,.05);overflow:hidden;}",
      root + " .wise-jg-hdr{display:flex;align-items:center;gap:7px;padding:6px 10px;border-bottom:1px solid #eee;background:#fff;}",
      root + " .wise-jg-hdr-text{font-weight:700;font-size:.8em;letter-spacing:.03em;text-transform:uppercase;color:#1f2937;}",
      root + " .wise-jg-hdr-note{margin-left:auto;padding:2px 6px;border-radius:999px;color:#64748b;font-size:.7em;font-weight:650;letter-spacing:.02em;white-space:nowrap;}",
      root + " .wise-jg-icon{display:inline-flex;flex:0 0 auto;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:rgba(" + accentRgb + ",.18);border:1px solid rgba(" + accentRgb + ",.32);color:" + accent + ";}",
      root + " .wise-jg-body{display:grid;grid-template-columns:minmax(0,1fr);align-content:start;padding:3px 9px 6px;box-sizing:border-box;}",
      root + " .wise-jg-subhead{grid-column:1 / -1;margin-top:3px;padding:6px 1px 3px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:.72em;font-weight:750;letter-spacing:.055em;line-height:1;text-transform:uppercase;}",
      root + " .wise-jg-subhead:first-child{margin-top:0;border-top:0;}",
      root + " .wise-jg-field{display:grid;grid-template-columns:minmax(128px,auto) minmax(0,1fr);align-items:baseline;gap:7px;min-width:0;min-height:22px;padding:2px 1px;border-bottom:0;box-sizing:border-box;}",
      root + " .wise-jg-field[data-wise-span]{grid-column:auto;}",
      root + " .wise-jg-field-label{flex:0 0 auto;font-weight:700;color:#111827;white-space:nowrap;}",
      root + " .wise-jg-field-value{min-width:0;color:#1f2937;overflow-wrap:anywhere;}",
      root + " .wise-jg-field-value.wise-jg-empty{color:#9ca3af;}",
      root + " .wise-jg-field-long-text{grid-template-columns:1fr;align-items:start;gap:2px;min-height:50px;padding-top:4px;}",
      root + " .wise-jg-field-long-text .wise-jg-field-label{white-space:normal;}",
      root + " .wise-jg-field-long-text .wise-jg-field-value{white-space:pre-wrap;line-height:1.35;}",
      root + " [data-wise-job-group='project-details']{border:1px dashed rgba(" + projectAccentRgb + ",.36);border-left:4px solid " + projectAccent + ";background:rgba(" + projectAccentRgb + ",.025);box-shadow:0 1px 4px rgba(15,23,42,.05);}",
      root + " [data-wise-job-group='project-details']>.wise-jg-hdr," + root + " [data-wise-job-group='project-details']>.wise-jg-body{background:rgba(" + projectAccentRgb + ",.025);}",
      root + " [data-wise-job-group='project-details'] .wise-jg-icon{background:rgba(" + projectAccentRgb + ",.12);border-color:rgba(" + projectAccentRgb + ",.28);color:" + projectAccent + ";}",
      root + " [data-wise-job-group='project-details'] .wise-jg-hdr-note{background:rgba(" + projectAccentRgb + ",.09);color:" + projectAccent + ";}",
      root + " [data-wise-job-group='project-details']>.wise-jg-body{display:block;padding:6px 11px 8px 9px;}",
      root + " .wise-jg-project-date-grid{display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:6px;}",
      root + " .wise-jg-project-info-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;}",
      root + " [data-wise-job-group='project-details'] .wise-jg-date-box{border-color:rgba(" + projectAccentRgb + ",.22);background:rgba(" + projectAccentRgb + ",.035);}",
      root + " [data-wise-job-group='project-details'] .wise-jg-subhead{margin:0;padding:6px 1px 4px;}",
      root + " [data-wise-job-group='job-details']{grid-column:1;grid-row:1;}",
      root + " [data-wise-job-group='job-commercial-info']{grid-column:2;grid-row:1;}",
      root + " [data-wise-job-group='job-timings']{grid-column:1 / -1;grid-row:2;}",
      root + " [data-wise-job-group='job-timings']>.wise-jg-body{grid-template-columns:repeat(9,minmax(0,1fr));gap:6px;padding:6px 9px 8px;}",
      root + " .wise-jg-date-box{display:flex;flex-direction:column;align-items:stretch;gap:0;height:74px;min-height:74px;max-height:74px;padding:6px 8px;border:1px solid #e5e7eb;border-radius:7px;background:#fafafa;box-sizing:border-box;overflow:hidden;}",
      root + " .wise-jg-date-box .wise-jg-field-label{display:-webkit-box;height:2.4em;min-height:2.4em;max-height:2.4em;margin-bottom:3px;color:#374151;font-size:.72em;line-height:1.2;white-space:normal;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2;}",
      root + " .wise-jg-date-box .wise-jg-field-value{display:flex;flex-direction:column;gap:2px;margin-top:auto;line-height:1.2;}",
      root + " .wise-jg-date-value{font-size:.92em;font-weight:700;color:#111827;white-space:nowrap;}",
      root + " .wise-jg-time-value{color:#6b7280;font-size:.78em;white-space:nowrap;}",
      root + " .wise-jg-date-box .wise-jg-field-value.wise-jg-empty .wise-jg-date-value," + root + " .wise-jg-date-box .wise-jg-field-value.wise-jg-empty .wise-jg-time-value{color:#9ca3af;}",
      "@media (max-width:1180px){" + root + " [data-wise-job-group='job-timings']>.wise-jg-body," + root + " .wise-jg-project-date-grid{grid-template-columns:repeat(3,minmax(0,1fr));}}",
      "@media (max-width:760px){" + root + " .wise-jg-job-grid{grid-template-columns:1fr;}" + root + " [data-wise-job-group='job-details']," + root + " [data-wise-job-group='job-commercial-info']," + root + " [data-wise-job-group='job-timings']{grid-column:1;grid-row:auto;}" + root + " [data-wise-job-group='job-details']{order:1;}" + root + " [data-wise-job-group='job-commercial-info']{order:2;}" + root + " [data-wise-job-group='job-timings']{order:3;}" + root + " [data-wise-job-group='job-timings']>.wise-jg-body," + root + " .wise-jg-project-date-grid," + root + " .wise-jg-project-info-grid{grid-template-columns:repeat(2,minmax(0,1fr));}" + root + " .wise-jg-field{grid-template-columns:minmax(118px,auto) minmax(0,1fr);}}",
      "@media (max-width:480px){" + root + " [data-wise-job-group='job-timings']>.wise-jg-body," + root + " .wise-jg-project-date-grid," + root + " .wise-jg-project-info-grid{grid-template-columns:1fr;}" + root + " .wise-jg-field{grid-template-columns:1fr;gap:1px;}" + root + " .wise-jg-field-label{white-space:normal;}" + root + " .wise-jg-hdr-note{white-space:normal;text-align:right;} }"
    ].join("\n");
    var style = document.createElement("style");
    style.id = STYLES_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function log() {
    if (!window.console || !window.console.log) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift(LOG_PREFIX);
    window.console.log.apply(window.console, args);
  }

  window.__wiseJobGroups = {
    version: CFG.version,
    refresh: function () { scheduleMaintain(0); },
    describe: function () {
      var $panel = findJobDetailsPanel();
      var $root = findJobInfoRoot($panel);
      return {
        version: CFG.version,
        detailsPanelFound: !!$panel.length,
        detailsPanelActive: !!$panel.length && $panel.is(":visible"),
        rootInsideDetailsPanel: !!$root.length && isInsideDetailsPanel($root.get(0), $panel.get(0)),
        jobInfoFound: !!$root.length,
        depotAllowed: isProposalCreationDepot(),
        grouped: $root.hasClass(ROOT_CLASS),
        activeJobId: state.activeJobId,
        parentProjectId: state.parentProjectId,
        parentProjectSource: state.parentProjectSource,
        parentProjectSupplementError: state.parentProjectSupplementError,
        parentProjectState: state.parentProjectData ? "ready" : state.parentProjectRequest ? "loading" : state.parentProjectError ? "error" : "idle",
        parentProjectError: state.parentProjectError,
        parentProjectAvailableKeys: describeProjectKeys(state.parentProjectData),
        renderedFields: $root.find(".wise-jg-field").length,
        renderedValues: $root.find(".wise-jg-field-value").map(function () {
          var $value = $(this);
          var date = $value.children(".wise-jg-date-value").text();
          var time = $value.children(".wise-jg-time-value").text();
          return date || time ? cleanValue(date + " " + time) : $value.text();
        }).get()
      };
    }
  };
})();
