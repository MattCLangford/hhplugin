/* ===========================================================================
 * Wise Project Field Groups
 * ---------------------------------------------------------------------------
 * Groups the native Project Details fields (in #proj_info) into 5 logical
 * groups and reorders the two top-level blocks so Salesforce/Wise info
 * leads and native HireHop record fields take a back seat. No new styling,
 * headings, relabeling, or colour — this is a pure DOM grouping/position
 * pass, verified against the real page markup:
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
 * Grouping technique: each group is a plain <div data-wise-group="...">
 * created with `.wrapAll()` around the elements that already sit together
 * in the DOM, given `display:contents`. That one inline style is
 * structural, not decorative — it makes the wrapper invisible to
 * #proj_info's grid layout and #custom_fields_container's flex layout, so
 * every field keeps rendering in exactly the same place, at exactly the
 * same size, as it does natively today. Nothing is cloned, renamed, or
 * removed, and no cross-container relocation happens, so there is nothing
 * for this module to "release" or "undo" on a project switch — a freshly
 * rendered #proj_info just gets grouped again from a clean, native state.
 *
 * Reordering: once grouped, #proj_info has exactly two top-level children —
 * #custom_fields_container and the "system-details" wrapper. These are
 * swapped (a plain DOM move, `insertBefore`) so #custom_fields_container
 * renders first. #custom_fields_container is moved as one already
 * self-contained unit, so its own flex layout needs no changes either.
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
 * module does nothing at all.
 *
 * Colour: #proj_info already carries the live project colour as its own
 * inline `background-color` (confirmed from real markup, e.g.
 * `style="background-color: rgb(20, 196, 8)"`). No detection heuristics
 * are needed — reading that one property is enough. This module does not
 * apply any colour yet (no styling in this pass); recorded here for the
 * follow-up styling module to use directly.
 * ========================================================================= */
(function () {
  "use strict";

  var $ = window.jQuery;
  if (!$) return;

  var LOG_PREFIX = "[Wise Project Groups]";
  var GROUP_ATTR = "data-wise-group";
  var CUSTOM_FIELD_GROUP_KEYS = ["wise-project-details", "project-ownership", "operational-timings", "working-links"];

  var CFG = {
    version: "2026-07-03.3",
    maintainRecoveryMs: 5000
  };

  var state = {
    maintainTimer: null,
    maintainScheduled: null
  };

  bootstrap();

  function bootstrap() {
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
      $(runs[i]).wrapAll(makeGroupWrapper(CUSTOM_FIELD_GROUP_KEYS[i]));
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
  // self-contained unit — its own flex layout is untouched, so this is a
  // pure position change with no new styling.
  function reorderGroups($projectInfo) {
    var $container = $projectInfo.find("#custom_fields_container").first();
    var $systemDetails = $projectInfo.children("[" + GROUP_ATTR + "='system-details']").first();
    if (!$container.length || !$systemDetails.length) return;
    if ($container.next().is($systemDetails)) return; // already in the desired order

    $container.insertBefore($systemDetails);
  }

  // `display:contents` is a structural style, not decoration: it makes the
  // wrapper invisible to #proj_info's CSS Grid and #custom_fields_container's
  // flex layout, so every field keeps rendering exactly where and how it
  // does today. It is the only inline style this module ever sets.
  function makeGroupWrapper(key) {
    return $("<div></div>").attr(GROUP_ATTR, key).css("display", "contents");
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
        groups: $projectInfo.length ? $projectInfo.find("[" + GROUP_ATTR + "]").map(function () {
          return $(this).attr(GROUP_ATTR);
        }).get() : []
      };
    }
  };
})();
