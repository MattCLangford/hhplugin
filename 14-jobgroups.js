/* Wise Job Field Groups
 * Proposal Creation-only presentation layer for the native job details page.
 * Fields are moved intact into three cards; nothing is cloned or renamed.
 */
(function () {
  "use strict";

  var $ = window.jQuery;
  if (!$) return;

  var LOG_PREFIX = "[Wise Job Groups]";
  var GROUP_ATTR = "data-wise-job-group";
  var ROOT_CLASS = "wise-jg-active";
  var STYLES_ID = "wise-job-groups-styles";
  var FALLBACK_ACCENT = "#f97316";
  var FALLBACK_ACCENT_RGB = "249,115,22";
  var GROUP_ORDER = ["job-info", "job-dates-times", "job-commercial-info"];
  var GROUP_TITLES = {
    "job-info": "Job Info",
    "job-dates-times": "Job Dates and Times",
    "job-commercial-info": "Job Commercial Info"
  };
  var ICONS = {
    "job-info": '<svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor"><rect x="2" y="4" width="16" height="13" rx="2"/><path d="M6 4V2h8v2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="5" y="8" width="10" height="2" rx="1" fill="#fff"/><rect x="5" y="12" width="7" height="2" rx="1" fill="#fff"/></svg>',
    "job-dates-times": '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2" y="3.5" width="16" height="14" rx="2"/><path d="M6 1.5v4M14 1.5v4M2 7.5h16"/><circle cx="10" cy="12" r="3"/><path d="M10 10.5V12l1.3.9" stroke-linecap="round"/></svg>',
    "job-commercial-info": '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2" y="3" width="16" height="14" rx="2"/><path d="M2 7h16M5 12h4M12 12h3" stroke-linecap="round"/></svg>'
  };

  var COMMERCIAL_TERMS = [
    /\bclient\s*reference\b/i, /\bcredit\s*period\b/i, /\bdiscount\b/i, /\bmarkup\b/i,
    /\bprice\s*group\b/i, /\bprice\s*structure\b/i, /\blate\s*fees?\b/i,
    /\bearly\s*returns?\b/i, /\bcommission\b/i, /\bcommercial\b/i
  ];
  var DATES_TERMS = [
    /\bkit\s*booking\b/i, /\bproject\s*\/\s*onsite\b/i, /\bproject\s+onsite\b/i,
    /\bgoods\s*out\b/i, /\bgoods\s*in\b/i, /\bcharge\s*period\b/i, /\bwise\s*prep\b/i,
    /\bvehicle\s*load\b/i, /\bvehicle\s*onsite\b/i, /\bvehicle\s*tip\b/i,
    /\bstart\s*(date|time)\b/i, /\bend\s*(date|time)\b/i,
    /\bfinish\s*(date|time)\b/i, /\bdelivery\s*(date|time)\b/i, /\bcollection\s*(date|time)\b/i
  ];
  var INFO_TERMS = [
    /\bjob\s*id\b/i, /\bjob\s*type\b/i, /\bjob\s*memo\b/i, /\bjob\s*name\b/i, /\bversion\b/i,
    /\bcontact\s*name\b/i, /\bcompany\b/i, /\btelephone\b/i, /\bmobile\b/i, /\bemail\b/i,
    /\bvenue\b/i, /\bdelivery\s*address\b/i, /\bcollection\s*address\b/i,
    /\buse\s*at\s*address\b/i, /\bwarehouse\s*name\b/i, /\bcreated\s*by\b/i,
    /\bempties\s*stored(?:\s*on\s*truck)?\b/i
  ];
  var EXPLICIT_INFO_RE = /\b(job\s*memo|version|empties\s*stored(?:\s*on\s*truck)?|goods\s*out|goods\s*in)\b/i;
  var EXPLICIT_COMMERCIAL_RE = /\b(price\s*structure|discretionary\s*discount|(?:client|venue)\s*commission|commission|charge\s*period)\b/i;
  var DATE_PROGRESS_RULES = [
    /\bkit\s*booking\s*start\b/i,
    /\bwise\s*prep\s*start\b/i,
    /\bvehicle\s*load\b/i,
    /\bvehicle\s*onsite\s*[-–—:]?\s*install\b/i,
    /\bproject\s*\/\s*onsite\s*start\b/i,
    /\bvehicle\s*onsite\s*[-–—:]?\s*derig\b/i,
    /\bproject\s*\/\s*onsite\s*end\b/i,
    /\bvehicle\s*tip\b/i,
    /\bkit\s*booking\s*end\b/i
  ];
  var FULL_WIDTH_INFO_RE = /\b(job\s*memo|job\s*name)\b/i;
  var USER_DEPOT_KEYS = [
    "DEPOT_ID", "depot_id", "DEFAULT_DEPOT_ID", "default_depot_id",
    "BRANCH_ID", "branch_id", "WAREHOUSE_ID", "warehouse_id",
    "DEPOT", "depot", "DEPOT_NAME", "depot_name",
    "DEFAULT_DEPOT", "default_depot", "WAREHOUSE", "warehouse"
  ];
  var KNOWN_PROPOSAL_CREATION_DEPOT_ID = "14";
  var CFG = { version: "2026-07-15.5", maintainRecoveryMs: 5000 };
  var state = { maintainTimer: null, maintainScheduled: null, lastRoot: null };

  bootstrap();

  function bootstrap() {
    installStyles();
    scheduleMaintain(0);
    state.maintainTimer = setInterval(function () { scheduleMaintain(0); }, CFG.maintainRecoveryMs);
    $(window).on("load.wiseJobGroups focus.wiseJobGroups resize.wiseJobGroups hashchange.wiseJobGroups", function () {
      scheduleMaintain(60);
    });
    $(document).on("ajaxComplete.wiseJobGroups", function () { scheduleMaintain(80); });
  }

  function scheduleMaintain(delay) {
    if (state.maintainScheduled) clearTimeout(state.maintainScheduled);
    state.maintainScheduled = setTimeout(function () {
      state.maintainScheduled = null;
      try { maintain(); } catch (err) { log("maintain failed, native screen unaffected", err); }
    }, Math.max(0, Number(delay) || 0));
  }

  function maintain() {
    var $jobInfo = findJobInfoRoot();
    if (!$jobInfo.length || $jobInfo.hasClass(ROOT_CLASS) || !isProposalCreationDepot()) return;

    var units = collectGroupableUnits($jobInfo);
    if (units.length < 3) {
      log("Job details structure was not recognised safely; native layout left unchanged.");
      return;
    }

    applyAccentColour($jobInfo);
    buildGroups($jobInfo, units);
    $jobInfo.addClass(ROOT_CLASS);
    state.lastRoot = $jobInfo.get(0);
  }

  function findJobInfoRoot() {
    if (state.lastRoot && document.documentElement.contains(state.lastRoot)) return $(state.lastRoot);

    var selectors = [
      "#job_info", "#job_details", "#job_detail", "#job_info_container",
      "[data-page='job-details']", "[data-page='job_detail']"
    ];
    for (var i = 0; i < selectors.length; i++) {
      var $candidate = $(selectors[i]).first();
      var $safeCandidate = findBestGroupingContainer($candidate);
      if ($safeCandidate.length) return $safeCandidate;
    }

    return findJobInfoFromLabel();
  }

  function looksLikeJobInfo($candidate) {
    if (!$candidate || !$candidate.length || $candidate.is("#proj_info") || $candidate.closest("#proj_info,#items_tab").length) return false;
    if ($candidate.find("#proj_info,#gbox_jobs_grid").length) return false;
    var text = normaliseText($candidate.text());
    return /\bjob\s*id\b/.test(text) &&
      (/\bkit\s*booking\b/.test(text) || /\bjob\s*memo\b/.test(text) || /\bclient\s*reference\b/.test(text));
  }

  function findJobInfoFromLabel() {
    var $best = $();
    var bestSize = Infinity;

    $("label,td,th,span,b,strong,div").each(function () {
      var ownText = normaliseText($(this).clone().children().remove().end().text());
      if (!/^job\s*id\s*#?\s*:?(?:\s*\d+)?$/i.test(ownText)) return;

      var node = this;
      for (var depth = 0; node && node !== document.body && depth < 12; depth += 1, node = node.parentNode) {
        var $candidate = findBestGroupingContainer($(node));
        if (!$candidate.length) continue;
        var size = $candidate.find("*").length;
        if (size < bestSize) {
          $best = $candidate;
          bestSize = size;
        }
      }
    });

    return $best;
  }

  function findBestGroupingContainer($candidate) {
    if (!$candidate || !$candidate.length) return $();
    var $best = $();
    var bestSize = Infinity;
    var $pool = $candidate.add($candidate.find("div,section,form"));

    $pool.each(function () {
      var $item = $(this);
      if (!looksLikeJobInfo($item) || countPotentialUnits($item) < 3) return;
      var size = $item.find("*").length;
      if (size < bestSize) {
        $best = $item;
        bestSize = size;
      }
    });

    return $best;
  }

  function countPotentialUnits($container) {
    var count = 0;
    $container.children().each(function () {
      var $child = $(this);
      if ($child.is("script,style,link,hr")) return;
      if ($child.is("#custom_fields_container")) {
        count += $child.children().filter(function () {
          return !$(this).is("hr") && !!normaliseText($(this).text());
        }).length;
        return;
      }
      if (normaliseText($child.text())) count += 1;
    });
    return count;
  }

  function collectGroupableUnits($jobInfo) {
    var units = [];
    collectAllCustomFieldUnits($jobInfo, units);

    $jobInfo.children().each(function () {
      var $child = $(this);
      if ($child.is("script,style,link") || $child.is("[" + GROUP_ATTR + "]") ||
          $child.hasClass("wise-jg-layout") || $child.hasClass("wise-jg-source-container")) return;
      if ($child.is("hr")) {
        $child.addClass("wise-jg-native-separator");
        return;
      }
      collectUnitsFromNode($child, units, "native");
    });
    return units;
  }

  // HireHop's job page uses the custom_fields widget's real runtime shape:
  // .hh_custom_fields > .custom_field_container. This is intentionally
  // broader than the project page's #custom_fields_container selector.
  function collectAllCustomFieldUnits($jobInfo, units) {
    var $containers = $jobInfo.find(".hh_custom_fields,#custom_fields_container").addBack(".hh_custom_fields,#custom_fields_container");
    $containers.each(function () {
      var $container = $(this);
      var found = 0;
      $container.children(".custom_field_container").each(function () {
        if (!normaliseText($(this).text())) return;
        units.push({ element: this, source: "custom" });
        found += 1;
      });
      $container.children("hr").addClass("wise-jg-native-separator");
      if (found) $container.addClass("wise-jg-source-container");
    });
  }

  // HireHop groups several visually separate fields inside layout wrappers.
  // Split only div/section wrappers with at least two recognisable field
  // children and no direct form control/text of their own. This keeps each
  // real control intact while allowing mixed native rows (for example Job
  // memo + Client reference, or Warehouse + Price structure) to separate
  // cleanly into the requested cards.
  function collectUnitsFromNode($node, units, source) {
    if (!$node || !$node.length || !normaliseText($node.text())) return 0;

    var tableFragments = extractTableFragments($node);
    if (tableFragments.length >= 2) {
      $node.addClass("wise-jg-source-container");
      for (var t = 0; t < tableFragments.length; t++) {
        units.push({ element: tableFragments[t], source: source + "-table" });
      }
      return tableFragments.length;
    }

    var $children = $node.children("div,section").filter(function () {
      return !!normaliseText($(this).text());
    });
    var recognised = 0;
    $children.each(function () {
      if (getPlacementScores(normaliseText($(this).text())).recognised) recognised += 1;
    });

    var canSplit = $children.length >= 2 && recognised >= 2 &&
      !$node.children("input,select,textarea,button,table").length &&
      !hasMeaningfulDirectText($node);

    if (!canSplit) {
      units.push({ element: $node.get(0), source: source });
      return 1;
    }

    var added = 0;
    $node.addClass("wise-jg-source-container");
    $children.each(function () {
      added += collectUnitsFromNode($(this), units, source);
    });
    return added;
  }

  // Native job details are table-driven. Extract either meaningful rows or,
  // for one-row layout tables, their meaningful cells. Each extracted row or
  // cell is moved intact into a small standalone table so ids, classes,
  // controls and event handlers remain attached to the original DOM nodes.
  function extractTableFragments($node) {
    var $table = $node.is("table") ? $node : $node.children("table").first();
    if (!$table.length) $table = $node.find("table").first();
    if (!$table.length) return [];
    if (!$node.is("table") && hasMeaningfulTextOutsideTables($node)) return [];

    var $rows = $table.find("tr").filter(function () {
      return $(this).closest("table").get(0) === $table.get(0) && !!normaliseText($(this).text());
    });
    var recognisedRows = countRecognisedElements($rows);
    var fragments = [];

    if ($rows.length >= 2 && recognisedRows >= 2) {
      $rows.each(function () {
        fragments.push(makeTableRowFragment($(this)).get(0));
      });
      return fragments;
    }

    if ($rows.length === 1) {
      var $cells = $rows.first().children("td,th").filter(function () {
        return !!normaliseText($(this).text());
      });
      if ($cells.length >= 2 && countRecognisedElements($cells) >= 2) {
        $cells.each(function () {
          fragments.push(makeTableCellFragment($(this)).get(0));
        });
      }
    }

    return fragments;
  }

  function hasMeaningfulTextOutsideTables($node) {
    var $clone = $node.clone();
    $clone.find("table").remove();
    return !!normaliseText($clone.text());
  }

  function countRecognisedElements($elements) {
    var count = 0;
    $elements.each(function () {
      var text = normaliseText($(this).text());
      if (getPlacementScores(text).recognised || EXPLICIT_INFO_RE.test(text) || EXPLICIT_COMMERCIAL_RE.test(text)) count += 1;
    });
    return count;
  }

  function makeTableRowFragment($row) {
    var $fragment = $("<div></div>").addClass("wise-jg-table-fragment");
    var $table = $("<table><tbody></tbody></table>").addClass("wise-jg-fragment-table").appendTo($fragment);
    $row.appendTo($table.children("tbody"));
    return $fragment;
  }

  function makeTableCellFragment($cell) {
    var $fragment = $("<div></div>").addClass("wise-jg-table-fragment");
    var $table = $("<table><tbody><tr></tr></tbody></table>").addClass("wise-jg-fragment-table").appendTo($fragment);
    $cell.appendTo($table.find("tr"));
    return $fragment;
  }

  function hasMeaningfulDirectText($node) {
    var found = false;
    $node.contents().each(function () {
      if (this.nodeType === 3 && normaliseText(this.nodeValue)) found = true;
    });
    return found;
  }

  function buildGroups($jobInfo, units) {
    var $layout = $("<div></div>").addClass("wise-jg-layout");
    var bodies = {};
    for (var i = 0; i < GROUP_ORDER.length; i++) {
      var key = GROUP_ORDER[i];
      var $section = makeGroup(key);
      bodies[key] = $section.children(".wise-jg-body").first();
      $layout.append($section);
    }
    $jobInfo.append($layout);

    for (var n = 0; n < units.length; n++) {
      var $unit = $(units[n].element);
      var text = normaliseText($unit.text());
      var group = classifyUnit(text);
      $unit.addClass("wise-jg-field-unit")
        .attr("data-wise-job-field-source", units[n].source)
        .appendTo(bodies[group]);
      if (group === "job-info" && isFullWidthInfo(text)) $unit.addClass("wise-jg-span-all");
    }

    orderDateProgression(bodies["job-dates-times"]);
  }

  function orderDateProgression($body) {
    if (!$body || !$body.length) return;
    var fields = $body.children(".wise-jg-field-unit").get().map(function (element, originalIndex) {
      var text = normaliseText($(element).text());
      var order = getDateProgressOrder(text);
      $(element).attr("data-wise-job-date-order", order);
      return { element: element, order: order, originalIndex: originalIndex };
    });

    fields.sort(function (a, b) {
      return a.order - b.order || a.originalIndex - b.originalIndex;
    });
    for (var n = 0; n < fields.length; n++) $body.append(fields[n].element);
  }

  function getDateProgressOrder(text) {
    for (var i = 0; i < DATE_PROGRESS_RULES.length; i++) {
      if (DATE_PROGRESS_RULES[i].test(text)) return i;
    }
    return DATE_PROGRESS_RULES.length;
  }

  function isFullWidthInfo(text) {
    return FULL_WIDTH_INFO_RE.test(text) ||
      (/\bjob\s*id\b/i.test(text) && /\b(technical|created\s*by)\b/i.test(text));
  }

  function classifyUnit(text) {
    if (getDateProgressOrder(text) < DATE_PROGRESS_RULES.length) return "job-dates-times";
    if (EXPLICIT_INFO_RE.test(text)) return "job-info";
    if (EXPLICIT_COMMERCIAL_RE.test(text)) return "job-commercial-info";
    var scores = getPlacementScores(text);
    if (scores.commercial && scores.commercial >= scores.dates && scores.commercial > scores.info) return "job-commercial-info";
    if (scores.dates > scores.info) return "job-dates-times";
    return "job-info";
  }

  function getPlacementScores(text) {
    var commercial = scoreTerms(text, COMMERCIAL_TERMS);
    var dates = scoreTerms(text, DATES_TERMS);
    var info = scoreTerms(text, INFO_TERMS);
    return {
      commercial: commercial,
      dates: dates,
      info: info,
      recognised: commercial + dates + info > 0
    };
  }

  function scoreTerms(text, terms) {
    var score = 0;
    for (var i = 0; i < terms.length; i++) {
      if (terms[i].test(text)) score += 1;
    }
    return score;
  }

  function makeGroup(key) {
    var $section = $("<section></section>").attr(GROUP_ATTR, key).addClass("wise-jg-section");
    var $header = $("<div></div>").addClass("wise-jg-hdr");
    $("<span></span>").addClass("wise-jg-icon").html(ICONS[key] || "").appendTo($header);
    $("<span></span>").addClass("wise-jg-hdr-text").text(GROUP_TITLES[key] || "").appendTo($header);
    $section.append($header, $("<div></div>").addClass("wise-jg-body"));
    return $section;
  }

  function isProposalCreationDepot() {
    var shared = window.WiseProposalSectionBuilderHireHop;
    if (!shared || !shared.depot) return false;
    try {
      var raw = readCurrentUserDepotValue();
      if (!raw) return false;
      var rawId = shared.depot.normaliseId ? shared.depot.normaliseId(raw) : "";
      var allowedId = (typeof shared.depot.resolveId === "function" && shared.depot.resolveId("Proposal Creation")) || KNOWN_PROPOSAL_CREATION_DEPOT_ID;
      if (rawId && allowedId && rawId === allowedId) return true;
      var rawText = shared.depot.normaliseText ? shared.depot.normaliseText(raw) : String(raw).trim().toLowerCase();
      return rawText === "proposal creation";
    } catch (err) {
      log("depot check failed, grouping left inactive as a precaution", err);
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

  function applyAccentColour($jobInfo) {
    var element = $jobInfo.get(0);
    if (!element) return;
    var rgb = parseRgb(element.style.backgroundColor) || findVisibleAccent($jobInfo);
    element.style.setProperty("--wise-job-accent", rgb ? rgbToHex(rgb) : FALLBACK_ACCENT);
    element.style.setProperty("--wise-job-accent-rgb", rgb ? rgb.join(",") : FALLBACK_ACCENT_RGB);
  }

  function findVisibleAccent($jobInfo) {
    var found = null;
    $jobInfo.find("div,header,section,table,tr").slice(0, 20).each(function () {
      if (found) return;
      var value = this.style && this.style.backgroundColor;
      if (!value && window.getComputedStyle) value = window.getComputedStyle(this).backgroundColor;
      var rgb = parseRgb(value);
      if (rgb && isUsefulAccent(rgb)) found = rgb;
    });
    return found;
  }

  function isUsefulAccent(rgb) {
    var max = Math.max(rgb[0], rgb[1], rgb[2]);
    var min = Math.min(rgb[0], rgb[1], rgb[2]);
    return max - min > 35 && max < 250;
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

  function normaliseText(value) {
    return String(value || "").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "").toLowerCase();
  }

  function installStyles() {
    if (document.getElementById(STYLES_ID)) return;
    var accent = "var(--wise-job-accent," + FALLBACK_ACCENT + ")";
    var accentRgb = "var(--wise-job-accent-rgb," + FALLBACK_ACCENT_RGB + ")";
    var roots = ".wise-jg-active";
    var css = [
      roots + "{display:block!important;background:#fff!important;border:0!important;outline:0!important;padding:5px!important;box-sizing:border-box;}",
      roots + " .wise-jg-native-separator," + roots + " .wise-jg-source-container{display:none!important;}",
      roots + ">.wise-jg-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;align-items:start;}",
      roots + " .wise-jg-section{box-sizing:border-box;min-width:0;background:#fff;border:1px solid #e5e7eb;border-left:6px solid " + accent + ";border-radius:10px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 1px 8px rgba(0,0,0,.06);overflow:hidden;}",
      roots + " [" + GROUP_ATTR + "='job-info']{grid-column:1 / -1;border-left-width:8px;}",
      roots + " .wise-jg-hdr{display:flex;align-items:center;gap:7px;padding:6px 10px;border-bottom:1px solid #eee;background:#fff;}",
      roots + " .wise-jg-hdr-text{font-weight:700;font-size:.76em;letter-spacing:.025em;text-transform:uppercase;color:#1f2937;}",
      roots + " .wise-jg-icon{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;width:24px;height:24px;border-radius:6px;background:rgba(" + accentRgb + ",.18);border:1px solid rgba(" + accentRgb + ",.32);color:" + accent + ";}",
      roots + " .wise-jg-body{box-sizing:border-box;padding:7px 9px;min-width:0;color:#111827!important;}",
      roots + " [" + GROUP_ATTR + "='job-info']>.wise-jg-body{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px 14px;align-items:start;}",
      roots + " [" + GROUP_ATTR + "='job-dates-times']>.wise-jg-body," + roots + " [" + GROUP_ATTR + "='job-commercial-info']>.wise-jg-body{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px 12px;align-items:start;}",
      roots + " .wise-jg-field-unit{box-sizing:border-box;width:100%!important;max-width:none!important;min-width:0!important;min-height:0!important;height:auto!important;margin:0!important;padding:2px 3px!important;border:0!important;line-height:1.25!important;color:#111827!important;}",
      roots + " .wise-jg-field-unit div," + roots + " .wise-jg-field-unit tr," + roots + " .wise-jg-field-unit td{min-height:0!important;height:auto!important;}",
      roots + " .wise-jg-field-unit *{color:#111827!important;}",
      roots + " .wise-jg-field-unit a{color:#d00!important;}",
      roots + " .wise-jg-field-unit [disabled]," + roots + " .wise-jg-field-unit .ui-state-disabled{color:#9ca3af!important;}",
      roots + " .wise-jg-field-unit textarea{box-sizing:border-box!important;width:100%!important;min-height:42px!important;height:42px!important;resize:vertical;}",
      roots + " .wise-jg-fragment-table{width:100%!important;border-collapse:collapse!important;border-spacing:0!important;}",
      roots + " .wise-jg-fragment-table>tbody>tr>td," + roots + " .wise-jg-fragment-table>tbody>tr>th{width:auto!important;padding:1px 2px!important;border:0!important;vertical-align:top!important;}",
      roots + " .wise-jg-span-all{grid-column:1 / -1;}",
      "@media (max-width:900px){" + roots + ">.wise-jg-layout{grid-template-columns:1fr;}" + roots + " [" + GROUP_ATTR + "='job-info']{grid-column:auto;}" + roots + " [" + GROUP_ATTR + "='job-info']>.wise-jg-body," + roots + " [" + GROUP_ATTR + "='job-dates-times']>.wise-jg-body," + roots + " [" + GROUP_ATTR + "='job-commercial-info']>.wise-jg-body{grid-template-columns:1fr;}" + roots + " .wise-jg-span-all{grid-column:auto;}}"
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
      var $jobInfo = findJobInfoRoot();
      var counts = {};
      for (var i = 0; i < GROUP_ORDER.length; i++) {
        counts[GROUP_ORDER[i]] = $jobInfo.find("[" + GROUP_ATTR + "='" + GROUP_ORDER[i] + "']>.wise-jg-body>.wise-jg-field-unit").length;
      }
      return {
        version: CFG.version,
        jobInfoFound: !!$jobInfo.length,
        rootTag: $jobInfo.length ? String($jobInfo.get(0).tagName || "").toLowerCase() : "",
        rootId: $jobInfo.attr("id") || "",
        depotAllowed: isProposalCreationDepot(),
        grouped: $jobInfo.hasClass(ROOT_CLASS),
        accentColour: $jobInfo.length ? $jobInfo.get(0).style.getPropertyValue("--wise-job-accent") : "",
        fieldCounts: counts
      };
    }
  };
})();
