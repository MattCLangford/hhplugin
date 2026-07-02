/* ===========================================================================
 * Wise Project Field Groups
 * ---------------------------------------------------------------------------
 * Groups the native Project Details fields (in #proj_info) into 5 boxed
 * sections, reorders them so Salesforce/Wise info leads and native HireHop
 * record fields take a back seat, and styles them so Wise Project Details
 * reads as the main attraction while the rest (and especially System
 * Details) stay visually quieter. Verified against the real page markup:
 *
 *   - Project ID# through Project/Onsite End (the header identity strip,
 *     contact/company/address, project type/warehouse/headline, and
 *     venue/delivery/dates blocks) are native HireHop record fields.
 *   - Status through YE Promo Budget Allocation are Salesforce-linked,
 *     read-only mirrors of Salesforce data (not editable in HireHop).
 *   - Project Manager through Production Assigned are also Salesforce
 *     fields; Technical (TPM) and Production additionally have a native
 *     HireHop equivalent (the "managed by" field in the header strip) —
 *     that native/Salesforce overlap is left as-is this pass.
 *   - Install Start through Plan are operational fields assigned directly
 *     in HireHop for the event.
 *
 *   - #proj_info is a CSS Grid (3 columns). Its native direct children are:
 *     the project-id/managed-by header block, the contact/company/address
 *     block, the project-type/warehouse/headline block, the venue/delivery
 *     /dates block, and #custom_fields_container.
 *   - #custom_fields_container is a flex-wrap block whose children are
 *     ALREADY laid out by HireHop in 4 contiguous runs separated by <hr>,
 *     in this fixed order: Wise Project Details fields, then Project
 *     Ownership fields, then Operational Timings fields, then Working
 *     Links fields. Nothing needs to be relocated across the page for
 *     these — only wrapped in place.
 *
 * Grouping technique: each group is wrapped in place with `.wrapAll()`
 * into <div data-wise-group="..." class="wise-pg-section"><div
 * class="wise-pg-hdr">Title</div><div class="wise-pg-body">...fields...
 * </div></div>. Nothing is cloned, renamed, or removed — every native
 * field/input keeps its name/id/value/listeners untouched, it is only
 * reparented one level deeper. No cross-container relocation happens (the
 * "system-details" group and #custom_fields_container's four sub-groups
 * are all built from elements that already lived together), so there is
 * nothing to "release"/"undo" on a project switch — a freshly rendered
 * #proj_info just gets grouped again from a clean, native state.
 *
 * Layout technique: #proj_info's own CSS Grid and #custom_fields_container's
 * own flex-wrap are replicated one level deeper on each section's
 * `.wise-pg-body` (grid for System Details, flex-wrap for the other four),
 * so every field still sizes/wraps the same way it did natively — the
 * `calc(33% - 4px)` etc. inline widths HireHop already put on individual
 * fields are untouched and still compute against a comparable container
 * width. The section boxes themselves (`.wise-pg-section`) get real
 * border/background styling since this pass IS the intentional styling
 * step (grouping-only was the previous pass).
 *
 * Colour hierarchy (per request — Wise info is the main attraction, native
 * HireHop info takes a back seat):
 *   - Wise Project Details: white body, bold 4px accent-coloured top
 *     border, larger header — the primary section.
 *   - Project Ownership / Operational Timings / Working Links: light grey
 *     body, thinner 2px accent top border — supporting sections.
 *   - System Details: NO background override, so #proj_info's own native
 *     project-colour banding (the coloured header strip, white row
 *     backgrounds) keeps rendering exactly as HireHop draws it — only a
 *     thin border and a small muted caption are added, plus a smaller
 *     base font-size for the section as a whole.
 *
 * Accent colour: #proj_info already carries the live project colour as its
 * own inline `background-color` (confirmed from real markup, e.g.
 * `style="background-color: rgb(20, 196, 8)"`) — read directly and exposed
 * as the `--wise-project-accent` CSS variable on #proj_info, so every
 * section above inherits it. Falls back to the existing HireHop-orange
 * accent already used elsewhere in this codebase only when no colour can
 * be read.
 *
 * Deferred to a later pass (left in native position, ungrouped, for now):
 *   - Project/Onsite Start & End (the unlabeled `.start_date`/`.finish_date`
 *     rows inside #dates_container) — these currently rely on being
 *     adjacent to the (hidden) Kit Booking rows for their date column, and
 *     moving them needs to be verified separately so that behaviour isn't
 *     broken.
 *   - The delivery/collection/use-at address switcher (#job_info_delivery)
 *     — a compound interactive widget; safer to leave untouched until we
 *     confirm it doesn't rely on being at its current DOM position.
 *
 * Restricted to the Proposal Creation depot — gated on the logged-in
 * user's own active depot (window.user), not the shared 5-hirehop.js DOM
 * scan, which was confirmed unreliable on this specific page (see
 * isProposalCreationDepot below for why). On every other depot this
 * module does nothing at all, and none of the CSS below applies (every
 * rule is scoped under the `.wise-pg-active` class this module adds to
 * #proj_info only once grouping has actually run).
 * ========================================================================= */
(function () {
  "use strict";

  var $ = window.jQuery;
  if (!$) return;

  var LOG_PREFIX = "[Wise Project Groups]";
  var GROUP_ATTR = "data-wise-group";
  var ROOT_CLASS = "wise-pg-active";
  var STYLES_ID = "wise-project-groups-styles";
  var FALLBACK_ACCENT = "#f97316"; // Safe fallback only — real accent is read from #proj_info's own colour.
  var CUSTOM_FIELD_GROUP_KEYS = ["wise-project-details", "project-ownership", "operational-timings", "working-links"];
  var GROUP_TITLES = {
    "wise-project-details": "Wise Project Details",
    "project-ownership": "Project Ownership",
    "operational-timings": "Operational Timings",
    "working-links": "Working Links",
    "system-details": "System Details (HireHop)"
  };

  var CFG = {
    version: "2026-07-04.1",
    maintainRecoveryMs: 5000
  };

  var state = {
    maintainTimer: null,
    maintainScheduled: null
  };

  bootstrap();

  function bootstrap() {
    installStyles();
    scheduleMaintain(0);
    state.maintainTimer = setInterval(function () { scheduleMaintain(0); }, CFG.maintainRecoveryMs);

    $(window).on("load.wiseProjectGroups focus.wiseProjectGroups resize.wiseProjectGroups hashchange.wiseProjectGroups", function () {
      scheduleMaintain(60);
    });
    $(document).on("ajaxComplete.wiseProjectGroups", function () {
      scheduleMaintain(80);
    });
  }

  function scheduleMaintain(delay) {
    if (state.maintainScheduled) clearTimeout(state.maintainScheduled);
    state.maintainScheduled = setTimeout(function () {
      state.maintainScheduled = null;
      // Progressive enhancement: a failure here must never take the
      // native HireHop screen down with it.
      try {
        maintain();
      } catch (err) {
        log("maintain failed, native screen unaffected", err);
      }
    }, Math.max(0, Number(delay) || 0));
  }

  function maintain() {
    var $projectInfo = $("#proj_info").first();
    if (!$projectInfo.length) return;
    if (!isProposalCreationDepot()) return; // other depots: leave the native screen completely untouched

    groupCustomFields($projectInfo);
    groupSystemDetails($projectInfo);
    reorderGroups($projectInfo);
    applyAccentColour($projectInfo);
    $projectInfo.addClass(ROOT_CLASS);
  }

  // ---- Depot gate ----------------------------------------------------------
  // This gate must reflect the logged-in USER's assigned/active depot (a
  // session-level permissions barrier), not which depot any given project
  // happens to belong to.
  //
  // 5-hirehop.js's shared `depot.isAllowed()` was deliberately NOT reused
  // here: on the project details page it was confirmed (via
  // WiseProposalSectionBuilderHireHop.depot.debug()) to always resolve to
  // {id:"14", name:"proposal creation"} regardless of the user's actual
  // active depot — its DOM-wide `select,input,textarea` scan is latching
  // onto some other always-present element on this page, not the header
  // depot switcher. That heuristic is shared with other pages that DO
  // depend on it working as-is, so it wasn't safe to change; instead this
  // module reads the one signal that was confirmed (via the same debug
  // output) to actually track the live active depot: window.user's own
  // depot field, which changed from 17 to 14 when the depot was switched
  // to Proposal Creation in testing.
  //
  // ASSUMPTION: window.user exposes the active depot as an id under one of
  // USER_DEPOT_KEYS below (confirmed present, exact key not individually
  // isolated). depot id 14 = "Proposal Creation" was confirmed the same
  // way; resolved dynamically via window.depots when available, with that
  // confirmed id as a fallback if the depots table isn't loaded on this
  // page. Fails closed (no grouping) whenever this can't be confirmed.
  var USER_DEPOT_KEYS = [
    "DEPOT_ID", "depot_id", "DEFAULT_DEPOT_ID", "default_depot_id",
    "BRANCH_ID", "branch_id", "WAREHOUSE_ID", "warehouse_id",
    "DEPOT", "depot", "DEPOT_NAME", "depot_name",
    "DEFAULT_DEPOT", "default_depot", "WAREHOUSE", "warehouse"
  ];
  var KNOWN_PROPOSAL_CREATION_DEPOT_ID = "14"; // confirmed via depot.debug(); used only if window.depots can't resolve it dynamically

  function isProposalCreationDepot() {
    var shared = window.WiseProposalSectionBuilderHireHop;
    if (!shared || !shared.depot) return false;

    try {
      var raw = readCurrentUserDepotValue();
      if (!raw) return false; // can't confirm the user's depot — fail closed

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

  // ---- Group: Wise Project Details / Project Ownership / Operational
  // Timings / Working Links ---------------------------------------------
  // #custom_fields_container's children are already exactly 4 contiguous
  // runs separated by <hr>, in this fixed native order. Each run is
  // wrapped in place with `.wrapAll()` — nothing is moved between runs.
  function groupCustomFields($projectInfo) {
    var $container = $projectInfo.find("#custom_fields_container").first();
    if (!$container.length) return;
    if ($container.children("[" + GROUP_ATTR + "]").length) return; // already grouped on an earlier pass

    var runs = splitByHr($container.children());
    if (runs.length !== CUSTOM_FIELD_GROUP_KEYS.length) {
      log("Unexpected custom field layout (" + runs.length + " groups, expected " + CUSTOM_FIELD_GROUP_KEYS.length + ") — left ungrouped, native layout unaffected.");
      return;
    }

    for (var i = 0; i < runs.length; i++) {
      if (!runs[i].length) continue;
      var key = CUSTOM_FIELD_GROUP_KEYS[i];
      $(runs[i]).wrapAll(makeGroupWrapper(key));
      addSectionHeader($container.children("[" + GROUP_ATTR + "='" + key + "']"), GROUP_TITLES[key]);
    }
  }

  function splitByHr($children) {
    var runs = [];
    var current = [];

    $children.each(function () {
      if (this.tagName && this.tagName.toLowerCase() === "hr") {
        runs.push(current);
        current = [];
        return;
      }
      current.push(this);
    });
    runs.push(current);

    return runs;
  }

  // ---- Group: System Details (HireHop) -------------------------------------
  // Everything under #proj_info that isn't #custom_fields_container is
  // native HireHop/system field markup (project id, contact, project
  // type, warehouse, headline, venue/delivery/dates). Wrapped together
  // once, in place.
  function groupSystemDetails($projectInfo) {
    if ($projectInfo.children("[" + GROUP_ATTR + "='system-details']").length) return; // already grouped

    var toWrap = [];
    $projectInfo.children().each(function () {
      var $child = $(this);
      if ($child.is("#custom_fields_container")) return;
      if ($child.is("[" + GROUP_ATTR + "]")) return; // defensive: skip any group wrapper already present
      toWrap.push(this);
    });

    if (!toWrap.length) return;
    $(toWrap).wrapAll(makeGroupWrapper("system-details"));
    addSectionHeader($projectInfo.children("[" + GROUP_ATTR + "='system-details']"), GROUP_TITLES["system-details"]);
  }

  // ---- Reorder: Salesforce/Wise info before native System Details ---------
  // #proj_info has exactly two top-level children once grouped:
  // #custom_fields_container (Wise Project Details, Project Ownership,
  // Operational Timings, Working Links — all Salesforce-linked or
  // HireHop-assigned operational fields) and the "system-details" wrapper
  // (Project ID through Project/Onsite End — native HireHop record
  // fields). Per request, the native block should take a back seat: this
  // just swaps which of the two comes first among #proj_info's direct
  // children. #custom_fields_container is moved as a single, already
  // self-contained unit — its own flex layout is untouched.
  function reorderGroups($projectInfo) {
    var $container = $projectInfo.find("#custom_fields_container").first();
    var $systemDetails = $projectInfo.children("[" + GROUP_ATTR + "='system-details']").first();
    if (!$container.length || !$systemDetails.length) return;
    if ($container.next().is($systemDetails)) return; // already in the desired order

    $container.insertBefore($systemDetails);
  }

  // Each group becomes <div data-wise-group="key" class="wise-pg-section">
  // wrapping a single <div class="wise-pg-body"> — wrapAll() places the
  // matched fields into that inner body (the one unambiguous innermost
  // element in this structure). The header caption is added afterwards
  // (see addSectionHeader) rather than as a sibling inside this same
  // structure, since wrapAll can only target a single nested chain, not a
  // branching one.
  function makeGroupWrapper(key) {
    return $('<div><div class="wise-pg-body"></div></div>')
      .attr(GROUP_ATTR, key)
      .addClass("wise-pg-section");
  }

  function addSectionHeader($section, title) {
    if (!$section.length || $section.children(".wise-pg-hdr").length) return;
    $("<div></div>").addClass("wise-pg-hdr").text(title).prependTo($section);
  }

  // ---- Accent colour --------------------------------------------------------
  // #proj_info's own inline background-color IS the live project colour
  // (this is how HireHop already colours the header strip and job rows) —
  // read it directly rather than guessing at swatches elsewhere on the
  // page. Exposed as --wise-project-accent on #proj_info so every section
  // box (all descendants) can use it via var(--wise-project-accent).
  function applyAccentColour($projectInfo) {
    var el = $projectInfo.get(0);
    if (!el) return;

    var hex = rgbToHex($projectInfo.css("background-color"));
    el.style.setProperty("--wise-project-accent", hex || FALLBACK_ACCENT);
  }

  function rgbToHex(value) {
    var match = String(value || "").match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!match) return "";
    return "#" +
      ("0" + parseInt(match[1], 10).toString(16)).slice(-2) +
      ("0" + parseInt(match[2], 10).toString(16)).slice(-2) +
      ("0" + parseInt(match[3], 10).toString(16)).slice(-2);
  }

  // ---- Styles ---------------------------------------------------------------
  // Everything here is scoped under #proj_info.wise-pg-active so it can
  // never affect any other page, and only ever applies once this module
  // has actually grouped the fields on an allowed depot.
  function installStyles() {
    if (document.getElementById(STYLES_ID)) return;

    var accentVar = "var(--wise-project-accent," + FALLBACK_ACCENT + ")";
    var css = [
      // Shared section-box base: full-width row (whether a flex child of
      // #custom_fields_container or a grid item of #proj_info) with a
      // thin native-style border.
      "#proj_info.wise-pg-active [" + GROUP_ATTR + "]{box-sizing:border-box;width:100%;flex:1 1 100%;border:1px solid #a1a1a1;}",
      "#proj_info.wise-pg-active #custom_fields_container>hr{display:none;}", // redundant once boxes provide the visual break

      "#proj_info.wise-pg-active .wise-pg-hdr{font-weight:bold;padding:4px 8px;border-bottom:1px solid #a1a1a1;box-sizing:border-box;}",
      "#proj_info.wise-pg-active .wise-pg-body{box-sizing:border-box;}",

      // Wise Project Details: the primary/main-attraction section.
      "#proj_info.wise-pg-active [" + GROUP_ATTR + "='wise-project-details']{background:#fff;border-top:4px solid " + accentVar + ";}",
      "#proj_info.wise-pg-active [" + GROUP_ATTR + "='wise-project-details']>.wise-pg-hdr{font-size:1.05em;background:#f7f7f7;}",
      "#proj_info.wise-pg-active [" + GROUP_ATTR + "='wise-project-details']>.wise-pg-body{display:flex;flex-flow:wrap;justify-content:left;gap:4px;padding:6px 8px;}",

      // Project Ownership / Operational Timings / Working Links: supporting
      // sections — still boxed and accented, but visually lighter than
      // Wise Project Details.
      "#proj_info.wise-pg-active [" + GROUP_ATTR + "='project-ownership'],#proj_info.wise-pg-active [" + GROUP_ATTR + "='operational-timings'],#proj_info.wise-pg-active [" + GROUP_ATTR + "='working-links']{background:#f7f7f7;border-top:2px solid " + accentVar + ";margin-top:6px;}",
      "#proj_info.wise-pg-active [" + GROUP_ATTR + "='project-ownership']>.wise-pg-hdr,#proj_info.wise-pg-active [" + GROUP_ATTR + "='operational-timings']>.wise-pg-hdr,#proj_info.wise-pg-active [" + GROUP_ATTR + "='working-links']>.wise-pg-hdr{font-size:0.95em;}",
      "#proj_info.wise-pg-active [" + GROUP_ATTR + "='project-ownership']>.wise-pg-body,#proj_info.wise-pg-active [" + GROUP_ATTR + "='operational-timings']>.wise-pg-body,#proj_info.wise-pg-active [" + GROUP_ATTR + "='working-links']>.wise-pg-body{display:flex;flex-flow:wrap;justify-content:left;gap:4px;padding:4px 8px;}",

      // System Details: no background override, so the native project-
      // colour header strip and native white row backgrounds keep
      // rendering exactly as HireHop draws them today — only a thin
      // border, a smaller base font, and a small muted caption are added.
      "#proj_info.wise-pg-active [" + GROUP_ATTR + "='system-details']{grid-column:1 / -1;font-size:0.92em;margin-top:6px;}",
      "#proj_info.wise-pg-active [" + GROUP_ATTR + "='system-details']>.wise-pg-hdr{font-size:0.85em;color:#555;background:#f0f0f0;}",
      "#proj_info.wise-pg-active [" + GROUP_ATTR + "='system-details']>.wise-pg-body{display:grid;grid-template-columns:repeat(3,1fr);}"
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

  window.__wiseProjectGroups = {
    version: CFG.version,
    refresh: function () { scheduleMaintain(0); },
    describe: function () {
      var $projectInfo = $("#proj_info").first();
      var shared = window.WiseProposalSectionBuilderHireHop;
      var rawDepot = readCurrentUserDepotValue();

      return {
        version: CFG.version,
        projectInfoFound: !!$projectInfo.length,
        depotAllowed: isProposalCreationDepot(),
        depotDebug: {
          currentUserDepotRaw: rawDepot,
          currentUserDepotId: rawDepot && shared && shared.depot && shared.depot.normaliseId ? shared.depot.normaliseId(rawDepot) : "",
          resolvedProposalCreationId: (shared && shared.depot && typeof shared.depot.resolveId === "function" && shared.depot.resolveId("Proposal Creation")) || KNOWN_PROPOSAL_CREATION_DEPOT_ID + " (fallback, window.depots unavailable)"
        },
        accentColour: $projectInfo.length ? $projectInfo.get(0).style.getPropertyValue("--wise-project-accent") : "",
        groups: $projectInfo.length ? $projectInfo.find("[" + GROUP_ATTR + "]").map(function () {
          return $(this).attr(GROUP_ATTR);
        }).get() : []
      };
    }
  };
})();
