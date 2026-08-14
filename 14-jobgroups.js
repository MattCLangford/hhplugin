/* Wise Job Details Layout
 * Proposal Creation-only canonical presentation for the read-only job page.
 * HireHop's native DOM remains in place but hidden; this module reads its live
 * values and renders a clean, deterministic three-card layout.
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
  var USER_DEPOT_KEYS = [
    "DEPOT_ID", "depot_id", "DEFAULT_DEPOT_ID", "default_depot_id",
    "BRANCH_ID", "branch_id", "WAREHOUSE_ID", "warehouse_id",
    "DEPOT", "depot", "DEPOT_NAME", "depot_name",
    "DEFAULT_DEPOT", "default_depot", "WAREHOUSE", "warehouse"
  ];
  var KNOWN_PROPOSAL_CREATION_DEPOT_ID = "14";
  var CFG = { version: "2026-08-14.6", maintainRecoveryMs: 5000 };

  var GROUPS = [
    {
      key: "job-info",
      title: "Job Info",
      icon: '<svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor"><rect x="2" y="4" width="16" height="13" rx="2"/><path d="M6 4V2h8v2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="5" y="8" width="10" height="2" rx="1" fill="#fff"/><rect x="5" y="12" width="7" height="2" rx="1" fill="#fff"/></svg>',
      fields: [
        field("job-id", "Job ID", ["Job ID", "Job ID#"], { always: true, section: "Job" }),
        field("job-name", "Job name", ["Job name"], { span: 2 }),
        field("job-type", "Job type", ["Job type"]),
        field("company", "Company", ["Company"], { section: "Client & venue" }),
        field("contact-name", "Contact name", ["Contact name"], { span: 2 }),
        field("venue", "Venue", ["Venue"]),
        field("address", "Address", ["Address"], { span: 2 }),
        field("delivery-address", "Delivery address", ["Delivery address"], { span: 2 }),
        field("collection-address", "Collection address", ["Collection address"], { span: 2 }),
        field("use-at-address", "Use at address", ["Use at address"], { span: 2 }),
        field("contact-telephone", "Contact telephone", ["Telephone"], { occurrence: 0 }),
        field("mobile", "Mobile", ["Mobile"]),
        field("email", "Email", ["Email"]),
        field("venue-telephone", "Venue telephone", ["Telephone"], { occurrence: 1 }),
        field("warehouse", "Warehouse", ["Warehouse Name", "Warehouse"], { section: "Operations & record" }),
        field("technical", "Technical", ["Technical"]),
        field("empties", "Empties stored on truck?", ["Empties stored on truck?", "Empties stored on truck"], { always: true }),
        field("created-by", "Created by", ["Created by"], { span: 2 }),
        field("version", "Version", ["Version"], { always: true }),
        field("job-memo", "Job memo", ["Job memo"], { span: 4 })
      ]
    },
    {
      key: "job-dates-times",
      title: "Job Dates and Times",
      icon: '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2" y="3.5" width="16" height="14" rx="2"/><path d="M6 1.5v4M14 1.5v4M2 7.5h16"/><circle cx="10" cy="12" r="3"/><path d="M10 10.5V12l1.3.9" stroke-linecap="round"/></svg>',
      fields: [
        field("kit-booking-start", "Kit Booking Start", ["Kit Booking Start"], { always: true, section: "Booking & preparation" }),
        field("wise-prep-start", "Wise Prep Start", ["Wise Prep Start"], { always: true }),
        field("vehicle-load", "Vehicle Load", ["Vehicle Load"], { always: true }),
        field("vehicle-install", "Vehicle Onsite - Install", ["Vehicle Onsite - Install", "Vehicle Onsite Install"], { always: true, section: "On site" }),
        field("project-start", "Project/Onsite Start", ["Project/Onsite Start", "Project Onsite Start"], { always: true }),
        field("project-end", "Project/Onsite End", ["Project/Onsite End", "Project Onsite End"], { always: true }),
        field("vehicle-derig", "Vehicle Onsite - Derig", ["Vehicle Onsite - Derig", "Vehicle Onsite Derig"], { always: true }),
        field("vehicle-tip", "Vehicle Tip", ["Vehicle Tip"], { always: true, section: "Return" }),
        field("kit-booking-end", "Kit Booking End", ["Kit Booking End"], { always: true })
      ]
    },
    {
      key: "job-commercial-info",
      title: "Job Commercial Info",
      icon: '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2" y="3" width="16" height="14" rx="2"/><path d="M2 7h16M5 12h4M12 12h3" stroke-linecap="round"/></svg>',
      fields: [
        field("price-group", "Price group", ["Price group"], { section: "Pricing" }),
        field("price-structure", "Price structure", ["Price structure"]),
        field("charge-period", "Charge period", ["Charge period"]),
        field("client-reference", "Client reference", ["Client reference"], { section: "Billing & returns" }),
        field("credit-period", "Credit period", ["Credit period"]),
        field("late-fees", "Calculate late fees", ["Calculate late fees"]),
        field("early-returns", "Allow early returns", ["Allow early returns"]),
        field("default-discount", "Default discount/markup", ["Default discount/markup"], { section: "Adjustments & commission" }),
        field("discretionary-discount", "Discretionary discount", ["Discretionary Discount", "Discretionary discount"], { always: true }),
        field("venue-commission", "Venue commission", ["Venue Commission", "Venue commission"], { always: true }),
        field("client-commission", "Client commission", ["Client Commission", "Client commission"], { always: true })
      ]
    }
  ];

  var ALL_LABELS = buildAllLabels();
  var state = {
    maintainTimer: null,
    maintainScheduled: null,
    accentObserver: null,
    accentObserverRoot: null,
    lastRoot: null,
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
      always: !!options.always
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
    for (var g = 0; g < GROUPS.length; g++) {
      var group = GROUPS[g];
      var $section = makeGroup(group);
      var $body = $section.children(".wise-jg-body");
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
      $layout.append($section);
    }
    return $layout;
  }

  function makeGroup(group) {
    var $section = $("<section></section>").attr("data-wise-job-group", group.key).addClass("wise-jg-section");
    var $header = $("<div></div>").addClass("wise-jg-hdr");
    $("<span></span>").addClass("wise-jg-icon").html(group.icon).appendTo($header);
    $("<span></span>").addClass("wise-jg-hdr-text").text(group.title).appendTo($header);
    $section.append($header, $("<div></div>").addClass("wise-jg-body"));
    return $section;
  }

  function renderField($body, spec, value) {
    var $field = $("<div></div>")
      .addClass("wise-jg-field")
      .attr("data-wise-job-field", spec.key)
      .attr("data-wise-span", spec.span);
    $("<span></span>").addClass("wise-jg-field-label").text(spec.label).appendTo($field);
    $("<span></span>")
      .addClass("wise-jg-field-value")
      .toggleClass("wise-jg-empty", !value)
      .text(value || "—")
      .appendTo($field);
    $body.append($field);
  }

  function renderSubhead($body, label) {
    $("<div></div>")
      .addClass("wise-jg-subhead")
      .text(label)
      .appendTo($body);
  }

  function readFieldValue($root, spec) {
    var customValue = readCustomFieldValue($root, spec);
    if (customValue.found) return customValue.value;

    var matches = findLabelMatches($root, spec);
    if (!matches.length) return "";
    var $label = $(matches[Math.min(spec.occurrence, matches.length - 1)]);
    return readValueFromLabel($label, spec);
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
    for (var g = 0; g < GROUPS.length; g++) {
      for (var f = 0; f < GROUPS[g].fields.length; f++) {
        var aliases = GROUPS[g].fields[f].aliases;
        for (var a = 0; a < aliases.length; a++) {
          var label = normaliseLabel(aliases[a]);
          if (labels.indexOf(label) === -1) labels.push(label);
        }
      }
    }
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
    return text.indexOf("job id") !== -1 &&
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
    var root = ".wise-jg-active";
    var css = [
      root + "{box-sizing:border-box;}",
      root + ">.wise-jg-native-source-node{display:none!important;}",
      // Fail closed in CSS too: even if a future discovery regression tries
      // to mount against shared #tabs, cards cannot display outside the
      // native details panel.
      root + ">.wise-jg-layout{display:none!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;align-items:stretch;padding:5px;background:#fff;box-sizing:border-box;}",
      "#main_tab" + root + ">.wise-jg-layout,#main_tab " + root + ">.wise-jg-layout,#details_tab" + root + ">.wise-jg-layout,#details_tab " + root + ">.wise-jg-layout{display:grid!important;}",
      root + " .wise-jg-section{display:flex;flex-direction:column;box-sizing:border-box;min-width:0;background:#fff;border:1px solid #e5e7eb;border-left:6px solid " + accent + ";border-radius:10px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 1px 8px rgba(0,0,0,.06);overflow:hidden;}",
      root + " .wise-jg-hdr{display:flex;align-items:center;gap:7px;padding:7px 10px;border-bottom:1px solid #e5e7eb;background:#fff;}",
      root + " .wise-jg-hdr-text{font-weight:700;font-size:.76em;letter-spacing:.025em;text-transform:uppercase;color:#1f2937;}",
      root + " .wise-jg-icon{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;background:rgba(" + accentRgb + ",.18);border:1px solid rgba(" + accentRgb + ",.32);color:" + accent + ";}",
      root + " .wise-jg-body{display:grid;grid-template-columns:minmax(0,1fr);align-content:start;padding:4px 11px 9px;box-sizing:border-box;}",
      root + " .wise-jg-subhead{margin-top:6px;padding:7px 2px 4px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:.69em;font-weight:750;letter-spacing:.055em;line-height:1;text-transform:uppercase;}",
      root + " .wise-jg-subhead:first-child{margin-top:0;border-top:0;}",
      root + " .wise-jg-field{display:grid;grid-template-columns:minmax(132px,auto) minmax(0,1fr);align-items:baseline;gap:8px;min-width:0;min-height:25px;padding:4px 2px;border-bottom:1px solid #f0f1f3;box-sizing:border-box;}",
      root + " .wise-jg-field[data-wise-span]{grid-column:auto;}",
      root + " .wise-jg-field-label{flex:0 0 auto;font-weight:700;color:#111827;white-space:nowrap;}",
      root + " .wise-jg-field-value{min-width:0;color:#1f2937;overflow-wrap:anywhere;}",
      root + " .wise-jg-field-value.wise-jg-empty{color:#9ca3af;}",
      "@media (max-width:1280px){" + root + ">.wise-jg-layout{grid-template-columns:repeat(2,minmax(0,1fr));}" + root + " [data-wise-job-group='job-info']{grid-column:1 / -1;}" + root + " [data-wise-job-group='job-info']>.wise-jg-body{grid-template-columns:repeat(2,minmax(0,1fr));gap:0 18px;}" + root + " [data-wise-job-group='job-info'] .wise-jg-subhead{grid-column:1 / -1;}" + root + " [data-wise-job-group='job-info'] .wise-jg-field[data-wise-span='2']," + root + " [data-wise-job-group='job-info'] .wise-jg-field[data-wise-span='4']{grid-column:1 / -1;}}",
      "@media (max-width:760px){" + root + ">.wise-jg-layout{grid-template-columns:1fr;}" + root + " [data-wise-job-group='job-info']{grid-column:auto;}" + root + " [data-wise-job-group='job-info']>.wise-jg-body{grid-template-columns:1fr;gap:0;}" + root + " [data-wise-job-group='job-info'] .wise-jg-field[data-wise-span]{grid-column:auto;}" + root + " .wise-jg-field{grid-template-columns:minmax(118px,auto) minmax(0,1fr);}}",
      "@media (max-width:480px){" + root + " .wise-jg-field{grid-template-columns:1fr;gap:1px;}" + root + " .wise-jg-field-label{white-space:normal;} }"
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
        renderedFields: $root.find(".wise-jg-field").length,
        renderedValues: $root.find(".wise-jg-field-value").map(function () { return $(this).text(); }).get()
      };
    }
  };
})();
