/* ===========================================================================
 * Wise Project Field Groups
 * ---------------------------------------------------------------------------
 * Groups the native Project Details fields (in #proj_info) into 5 logical
 * groups WITHOUT any visual change: no new styling, no headings, no
 * relabeling, no colour. This is a pure DOM-grouping pass to set up for a
 * later styling change, verified against the real page markup:
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
 * Restricted to the Proposal Creation depot (reuses the shared depot
 * module from 5-hirehop.js, loaded alongside this file — see
 * 0-loader.js). On every other depot this module does nothing at all.
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
    version: "2026-07-03.1",
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
  }

  // ---- Depot gate ----------------------------------------------------------
  // Reuses the shared, already-tested depot-detection module from
  // 5-hirehop.js rather than re-implementing depot detection here. Its
  // default rule is already "Proposal Creation" only. Fails closed (no
  // grouping) if the shared module isn't available or can't detect a
  // depot — the native layout is always a safe fallback.
  function isProposalCreationDepot() {
    var shared = window.WiseProposalSectionBuilderHireHop;
    if (!shared || !shared.depot || typeof shared.depot.isAllowed !== "function") return false;

    try {
      return !!shared.depot.isAllowed();
    } catch (err) {
      log("depot check failed, grouping left inactive as a precaution", err);
      return false;
    }
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
      return {
        version: CFG.version,
        projectInfoFound: !!$projectInfo.length,
        depotAllowed: isProposalCreationDepot(),
        groups: $projectInfo.length ? $projectInfo.find("[" + GROUP_ATTR + "]").map(function () {
          return $(this).attr(GROUP_ATTR);
        }).get() : []
      };
    }
  };
})();
