/* ===========================================================================
 * Wise Project Field Groups
 * ---------------------------------------------------------------------------
 * Groups the native Project Details fields (in #proj_info) into boxed
 * "card" sections, reorders them so Wise Project Details (Salesforce-
 * linked, the main attraction) leads, Project Ownership / Operational
 * Timings / Working Links follow as a row of three supporting cards, and
 * System Details (compact, native HireHop record fields) takes a back
 * seat at the bottom. Verified against the real page markup:
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
 * width. Project Ownership / Operational Timings / Working Links are
 * additionally wrapped together in a `quick-info-row` flex row so they
 * render as three equal cards side by side.
 *
 * Visual design: every section is styled as a white, rounded, subtly
 * shadowed "card" with a bold accent-coloured left rail, an accent-tinted
 * icon badge, and an uppercase title in its header — deliberately closer
 * to a dashboard-style layout than plain bordered boxes, and deliberately
 * making the live project/stage colour hard to miss (thicker rail on
 * Wise Project Details specifically, as the primary card). System
 * Details, being native/lower-priority information, is intentionally
 * compact by default with a "Show more" / "Show less" toggle that
 * expands its body, and forces dark text on its body (see the system-
 * details CSS rules) because some of its native rows are styled by
 * HireHop as white text meant to sit on #proj_info's own native coloured
 * fill, which our white card background would otherwise hide behind.
 * Wise Project Details itself is laid out as 3 equal columns (its
 * native per-field inline widths are overridden for this). The Status
 * field inside Wise Project Details gets a small coloured pill
 * (best-effort text match against known status values — see
 * applyStatusBadge — since the native markup for individual fields isn't
 * something this module otherwise inspects) using a fixed palette:
 * purple=quote, yellow=very likely, orange=hold, green=confirmed,
 * grey=closed/lost/cancelled, blue=completed/invoiced.
 *
 * Accent colour: #proj_info already carries the live project colour as its
 * own inline `background-color` (confirmed from real markup, e.g.
 * `style="background-color: rgb(20, 196, 8)"`) — read directly and exposed
 * as the `--wise-project-accent` (hex) and `--wise-project-accent-rgb`
 * ("r,g,b", for translucent tints) CSS variables on #proj_info, so every
 * section above inherits it (left rails, icon badges). Falls back to the
 * existing HireHop-orange accent already used elsewhere in this codebase
 * only when no colour can be read. The Status pill is the one exception:
 * it deliberately does NOT use this dynamic accent — it follows the
 * fixed stage palette above instead, per request, since it needs to
 * reflect the specific Salesforce stage rather than whatever colour
 * happens to be on #proj_info. NOTE: the dynamic accent itself is still
 * NOT yet uniform across every element that arguably should use it (e.g.
 * some native HireHop chrome still uses its own colouring) — known gap,
 * intentionally left for a later pass.
 *
 * Deferred to a later pass (left in native position, ungrouped, for now):
 *   - Project/Onsite Start & End (the unlabeled `.start_date`/`.finish_date`
 *     rows inside #dates_container) — these currently rely on being
 *     adjacent to the (hidden) Kit Booking rows for their date column, and
 *     moving them needs to be verified separately so that behaviour isn't
 *     broken.
 *   - The delivery/collection/use-at address switcher (#job_info_delivery)
 *     — a compound interactive widget; safer to leave untouched until we
 *     confirm it doesn't rely on being at its current DOM position. This
 *     also means the "Venue & Delivery" sub-panel stays inside System
 *     Details rather than moving next to Wise Project Details.
 *   - A "Delivery Packages (Jobs)" table listing the project's linked jobs
 *     — that's job data that doesn't currently live in #proj_info at all,
 *     so it's out of scope until we've confirmed where/how to source it.
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

  if (window.__wiseProjectGroupsLoaded) return;
  window.__wiseProjectGroupsLoaded = true;

  var $ = window.jQuery;
  if (!$) return;

  var LOG_PREFIX = "[Wise Project Groups]";
  var GROUP_ATTR = "data-wise-group";
  var ROOT_CLASS = "wise-pg-active";
  var STYLES_ID = "wise-project-groups-styles";
  var FALLBACK_ACCENT = "#f97316"; // Safe fallback only — real accent is read from #proj_info's own colour.
  var FALLBACK_ACCENT_RGB = "249,115,22";
  var CUSTOM_FIELD_GROUP_KEYS = ["wise-project-details", "project-ownership", "operational-timings", "working-links"];
  var QUICK_INFO_ROW_KEYS = ["project-ownership", "operational-timings", "working-links"];
  var GROUP_TITLES = {
    "wise-project-details": "Wise Project Details (from Salesforce)",
    "project-ownership": "Project Ownership",
    "operational-timings": "Operational Timings",
    "working-links": "Working Links",
    "system-details": "System Details (HireHop)"
  };

  // Small, deliberately simple icon glyphs (decorative only) — flat/line
  // SVGs sized to sit inside the 24px accent-tinted badge in each header.
  var ICONS = {
    "system-details": '<svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor"><circle cx="4" cy="6" r="2"/><rect x="8" y="5" width="11" height="2" rx="1"/><rect x="1" y="9" width="11" height="2" rx="1"/><circle cx="15" cy="10" r="2"/><circle cx="4" cy="14" r="2"/><rect x="8" y="13" width="11" height="2" rx="1"/></svg>',
    "wise-project-details": '<svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor"><rect x="3" y="2" width="14" height="17" rx="1"/><rect x="6" y="5" width="2.5" height="2.5" fill="#fff"/><rect x="11.5" y="5" width="2.5" height="2.5" fill="#fff"/><rect x="6" y="9" width="2.5" height="2.5" fill="#fff"/><rect x="11.5" y="9" width="2.5" height="2.5" fill="#fff"/><rect x="8" y="13" width="4" height="6" fill="#fff"/></svg>',
    "project-ownership": '<svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor"><circle cx="7" cy="6" r="3"/><circle cx="15" cy="7" r="2.4"/><path d="M7 10.5c-3.3 0-6 2.3-6 5.5v1h11v-1c0-1.6-.6-3-1.7-4.1-1-1-2.3-1.4-3.3-1.4z"/><path d="M15 10.9c-.6 0-1.2.1-1.8.3 1 1.2 1.5 2.7 1.5 4.3v1.5h5.3v-1c0-2.7-2.2-5.1-5-5.1z"/></svg>',
    "operational-timings": '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="8"/><path d="M10 5.5v5l3.5 2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "working-links": '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1.5" y="6.5" width="8" height="6" rx="3" transform="rotate(-45 5.5 9.5)"/><rect x="10.5" y="6.5" width="8" height="6" rx="3" transform="rotate(-45 14.5 9.5)"/></svg>'
  };

  // Fixed stage colour palette (per request) for any on-page colour that
  // codes project stage but ISN'T simply mirroring the live, dynamic
  // --wise-project-accent (which already reflects the true HireHop/
  // Salesforce project colour and is used as-is for borders/icons
  // elsewhere in this file). The Status pill is the one place this module
  // invents its own stage colour, so it follows this palette rather than
  // guessing: purple=quote, yellow=very likely, orange=hold, green=
  // confirmed, grey=closed/lost/cancelled, blue=completed/invoiced.
  // Order matters — first matching pattern wins (checked top to bottom).
  var STATUS_STAGE_PATTERNS = [
    { key: "quote", re: /\bquote\b/i },
    { key: "very-likely", re: /very\s*likely/i },
    { key: "hold", re: /\bhold\b/i },
    { key: "confirmed", re: /\bconfirmed\b/i },
    { key: "closed", re: /closed|lost|cancelled/i },
    { key: "completed", re: /completed|invoiced/i }
  ];

  var CFG = {
    version: "2026-07-21.5",
    maintainRecoveryMs: 5000
  };

  var state = {
    maintainTimer: null,
    maintainScheduled: null,
    recoveryCount: 0,
    recoveryChecks: 12
  };

  bootstrap();

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
    wrapQuickInfoRow($projectInfo.find("#custom_fields_container").first());
    reorderGroups($projectInfo);
    applyAccentColour($projectInfo);
    applyStatusBadge($projectInfo);
    applySystemDetailsPeek($projectInfo);
    $projectInfo.addClass(ROOT_CLASS);
  }

  // System Details collapses to just its first grid row (Project ID# /
  // Technical / Created by) rather than fully to nothing, so there's still
  // an at-a-glance identifier when collapsed. Measured live off the DOM
  // (the offset of the first item in row 2) instead of a guessed pixel
  // value, since row height depends on font/content and this stays correct
  // if either changes. overflow:hidden doesn't affect layout, so this is
  // safe to measure even while the collapsed max-height is already applied.
  function applySystemDetailsPeek($projectInfo) {
    var $section = $projectInfo.children("[" + GROUP_ATTR + "='system-details']").first();
    if (!$section.length) return;
    var $body = $section.children(".wise-pg-body").first();
    if (!$body.length) return;

    var $children = $body.children();
    if ($children.length <= 3) return; // one row or less already — nothing to collapse

    var bodyTop = $body.get(0).getBoundingClientRect().top;
    var rowTwoTop = $children.get(3).getBoundingClientRect().top;
    var peek = Math.round(rowTwoTop - bodyTop);
    if (peek > 0) $section.get(0).style.setProperty("--wise-system-peek-height", peek + "px");
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
      if (typeof shared.depot.isProposalCreation === "function") return shared.depot.isProposalCreation();
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
      addSectionHeader($container.children("[" + GROUP_ATTR + "='" + key + "']"), key);
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
    addSectionHeader($projectInfo.children("[" + GROUP_ATTR + "='system-details']"), "system-details");
  }

  // ---- Group: Project Ownership + Operational Timings + Working Links
  // as one "quick info" row of three equal cards -----------------------
  function wrapQuickInfoRow($container) {
    if (!$container || !$container.length) return;
    if ($container.children("[" + GROUP_ATTR + "='quick-info-row']").length) return; // already wrapped

    var $groups = $container.children().filter(function () {
      var key = $(this).attr(GROUP_ATTR);
      return key && QUICK_INFO_ROW_KEYS.indexOf(key) !== -1;
    });
    if ($groups.length !== QUICK_INFO_ROW_KEYS.length) return; // not all three present yet — leave for next pass

    $groups.wrapAll('<div class="wise-pg-row" data-wise-group="quick-info-row"></div>');
  }

  // ---- Reorder: Wise Project Details + the ownership/timings/links row
  // first (Salesforce-linked and HireHop-assigned operational info, the
  // main attraction), then System Details (compact/native) ------------
  // #proj_info has exactly two top-level children once grouped:
  // #custom_fields_container (Wise Project Details + the quick-info row)
  // and the "system-details" wrapper (Project ID through Project/Onsite
  // End — native HireHop record fields). #custom_fields_container is
  // moved as a single, already self-contained unit — its own flex layout
  // is untouched.
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

  function addSectionHeader($section, key) {
    if (!$section.length || $section.children(".wise-pg-hdr").length) return;

    var $hdr = $("<div></div>").addClass("wise-pg-hdr");
    $("<span></span>").addClass("wise-pg-icon").html(ICONS[key] || "").appendTo($hdr);
    $("<span></span>").addClass("wise-pg-hdr-text").text(GROUP_TITLES[key] || "").appendTo($hdr);
    $hdr.prependTo($section);

    if (key === "system-details") addShowMoreToggle($section, $hdr);
  }

  // System Details is native/lower-priority info that can get long (full
  // contact/venue/delivery/dates block) — collapsed to a peek height by
  // default with a toggle button, so it reads as compact rather than
  // competing with Wise Project Details for attention.
  function addShowMoreToggle($section, $hdr) {
    if ($hdr.find(".wise-pg-toggle").length) return;

    var $btn = $("<button type='button'></button>").addClass("wise-pg-toggle").text("Show more");
    $btn.on("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var expanded = $section.toggleClass("wise-pg-expanded").hasClass("wise-pg-expanded");
      $btn.text(expanded ? "Show less" : "Show more");
    });
    $btn.appendTo($hdr);
  }

  // ---- Status pill ----------------------------------------------------------
  // Best-effort only: this module never inspects individual native field
  // markup elsewhere (fields are moved as opaque chunks), so rather than
  // assume a specific label/value DOM shape, this scans each direct field
  // in Wise Project Details' body for one whose text starts with "Status",
  // then wraps the first recognised status keyword found in THAT field's
  // own HTML in a coloured pill span. Read-only display text only (no
  // inputs/listeners involved), so this light HTML surgery is low-risk;
  // if the regex can't find a safe match it simply leaves the field alone.
  function applyStatusBadge($projectInfo) {
    var $body = $projectInfo.find("[" + GROUP_ATTR + "='wise-project-details']>.wise-pg-body").first();
    if (!$body.length) return;

    var $field = findFieldByLabel($body, "Status");
    if (!$field || !$field.length) return;
    if ($field.find(".wise-status-badge").length) return; // already badged

    var html = $field.html();
    var text = $field.text();
    var matched = null;
    for (var i = 0; i < STATUS_STAGE_PATTERNS.length; i++) {
      var m = text.match(STATUS_STAGE_PATTERNS[i].re);
      if (m) {
        matched = { key: STATUS_STAGE_PATTERNS[i].key, text: m[0] };
        break;
      }
    }
    if (!matched) return;

    // Negative lookahead avoids matching text that's actually inside a
    // tag (e.g. an attribute value) rather than visible field text.
    var re = new RegExp("(" + escapeRegExp(matched.text) + ")(?![^<]*>)", "i");
    var newHtml = html.replace(re, '<span class="wise-status-badge" data-wise-status="' + matched.key + '">$1</span>');
    if (newHtml === html) return; // couldn't safely isolate the value — leave native text untouched

    $field.html(newHtml);
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function findFieldByLabel($body, label) {
    var re = new RegExp("^\\s*" + label + "\\s*:?", "i");
    var found = null;
    $body.children().each(function () {
      if (found) return;
      if (re.test($(this).text())) found = this;
    });
    return found ? $(found) : null;
  }

  // ---- Accent colour --------------------------------------------------------
  // #proj_info's own inline background-color IS the live project colour
  // (this is how HireHop already colours the header strip and job rows) —
  // read it directly rather than guessing at swatches elsewhere on the
  // page. Exposed as --wise-project-accent (hex) and
  // --wise-project-accent-rgb ("r,g,b", for rgba() tints) on #proj_info so
  // every section box (all descendants) can use it via
  // var(--wise-project-accent).
  function applyAccentColour($projectInfo) {
    var el = $projectInfo.get(0);
    if (!el) return;

    // Read el.style (the element's own inline declaration) rather than the
    // computed/cascaded value: once wise-pg-active is applied, our own
    // stylesheet forces #proj_info's visible background to white
    // (see installStyles) to stop it bleeding through card gaps, which
    // would otherwise make the computed background-color white too on
    // every cycle after the first and overwrite the accent back to white.
    // The inline declaration itself is untouched and still the true
    // native colour HireHop set.
    var rgb = parseRgb(el.style.backgroundColor);
    el.style.setProperty("--wise-project-accent", rgb ? rgbToHex(rgb) : FALLBACK_ACCENT);
    el.style.setProperty("--wise-project-accent-rgb", rgb ? rgb.join(",") : FALLBACK_ACCENT_RGB);
  }

  // Native getComputedStyle always reports colours as rgb()/rgba(), but
  // some browser extensions rewrite computed colour values to hex before
  // jQuery's .css() ever sees them (confirmed live: .css("background-color")
  // returned "#14c408" instead of "rgb(20, 196, 8)" on a real project page)
  // — so both shapes have to be accepted or the accent colour silently
  // falls back to orange whenever that happens.
  function parseRgb(value) {
    value = String(value || "").trim();

    var rgbMatch = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgbMatch) {
      return [parseInt(rgbMatch[1], 10), parseInt(rgbMatch[2], 10), parseInt(rgbMatch[3], 10)];
    }

    var hexMatch = value.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hexMatch) {
      var hex = hexMatch[1];
      if (hex.length === 3) hex = hex.replace(/(.)/g, "$1$1");
      return [parseInt(hex.substr(0, 2), 16), parseInt(hex.substr(2, 2), 16), parseInt(hex.substr(4, 2), 16)];
    }

    return null;
  }

  function rgbToHex(rgb) {
    return "#" +
      ("0" + rgb[0].toString(16)).slice(-2) +
      ("0" + rgb[1].toString(16)).slice(-2) +
      ("0" + rgb[2].toString(16)).slice(-2);
  }

  // ---- Styles ---------------------------------------------------------------
  // Everything here is scoped under #proj_info.wise-pg-active so it can
  // never affect any other page, and only ever applies once this module
  // has actually grouped the fields on an allowed depot.
  function installStyles() {
    if (document.getElementById(STYLES_ID)) return;

    var accentVar = "var(--wise-project-accent," + FALLBACK_ACCENT + ")";
    var accentRgbVar = "var(--wise-project-accent-rgb," + FALLBACK_ACCENT_RGB + ")";
    var css = [
      // Shared card base: full-width row (whether a flex child of
      // #custom_fields_container or a grid item of #proj_info), rounded,
      // white, subtly shadowed. A bold accent-coloured left rail on every
      // card keeps the live project/stage colour clearly visible
      // throughout, not just as a thin decorative line.
      // :not(quick-info-row) — the row wrapper carries the same
      // data-wise-group attribute as every real card (see wrapQuickInfoRow)
      // purely so wrapAll() had a single element to target; it isn't a
      // titled section itself (no .wise-pg-hdr). Without this exclusion it
      // ALSO matched this generic rule and grew its own accent rail/border/
      // shadow directly around the Project Ownership card's own rail,
      // producing a doubled/stacked accent line down the left edge.
      "#proj_info.wise-pg-active [" + GROUP_ATTR + "]:not([" + GROUP_ATTR + "='quick-info-row']){box-sizing:border-box;width:100%;flex:1 1 100%;background:#fff;border:1px solid #e5e7eb;border-left:6px solid " + accentVar + ";border-radius:10px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 1px 8px rgba(0,0,0,.06);margin-top:10px;overflow:hidden;}",
      "#proj_info.wise-pg-active [" + GROUP_ATTR + "]:first-child{margin-top:0;}",
      // !important: confirmed live that HireHop's own native CSS forces
      // these hr to display:flex at higher specificity, so a plain
      // display:none here silently loses that fight — the hr's own box
      // stays tiny (~1px) but its native vertical margin still renders,
      // which was the real source of the leftover gaps between cards.
      "#proj_info.wise-pg-active #custom_fields_container>hr{display:none!important;margin:0!important;}",
      // display:block (rather than leaving #proj_info's own native grid in
      // control) drops any native row-gap/track sizing that HireHop had
      // calculated for the old, taller, multi-row ungrouped layout — that
      // leftover native spacing, not our own margins, was the source of
      // the large empty gaps above/below this container.
      "#proj_info.wise-pg-active{display:block;}",
      // #proj_info's own inline background-color (the live project colour
      // we read for every card rail) is also used natively by HireHop to
      // draw a border/outline around the whole block — not something this
      // module ever added, but not wanted once the individual card rails
      // already carry that colour, so it's explicitly cancelled here.
      "#proj_info.wise-pg-active{border:none!important;outline:none!important;}",
      // #proj_info's own inline background-color is also still literally
      // green behind everything — the margin gaps between cards are
      // transparent, so that native green was bleeding through in every
      // gap. Forcing it white makes those gaps read as plain whitespace.
      "#proj_info.wise-pg-active{background:#fff!important;}",
      "#proj_info.wise-pg-active #custom_fields_container{display:block;padding:0;margin:0;}",

      // Header: icon badge + uppercase title, optional right-aligned
      // "Show more" toggle. Icon badge uses a stronger accent tint (and a
      // matching border) so the stage colour reads clearly at a glance.
      "#proj_info.wise-pg-active .wise-pg-hdr{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid #eee;background:#fff;}",
      "#proj_info.wise-pg-active .wise-pg-hdr-text{font-weight:700;font-size:.8em;letter-spacing:.03em;text-transform:uppercase;color:#1f2937;}",
      "#proj_info.wise-pg-active .wise-pg-icon{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;width:26px;height:26px;border-radius:7px;background:rgba(" + accentRgbVar + ",.2);border:1px solid rgba(" + accentRgbVar + ",.35);color:" + accentVar + ";}",
      "#proj_info.wise-pg-active .wise-pg-toggle{margin-left:auto;border:1px solid #d1d5db;background:#fff;border-radius:6px;padding:3px 10px;font-size:.72em;font-weight:600;color:#374151;cursor:pointer;}",
      "#proj_info.wise-pg-active .wise-pg-toggle:hover{background:#f9fafb;}",

      "#proj_info.wise-pg-active .wise-pg-body{box-sizing:border-box;}",

      // Wise Project Details: the primary/main-attraction section — an
      // extra-bold left rail, always-expanded body, laid out as 3 equal
      // columns (overriding the native per-field inline widths, which
      // were sized for the old 2-up flex-wrap).
      "#proj_info.wise-pg-active [" + GROUP_ATTR + "='wise-project-details']{border-left-width:10px;}",
      "#proj_info.wise-pg-active [" + GROUP_ATTR + "='wise-project-details']>.wise-pg-body{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 16px;padding:14px;}",
      "#proj_info.wise-pg-active [" + GROUP_ATTR + "='wise-project-details']>.wise-pg-body>*{width:auto!important;max-width:none!important;flex:none!important;}",

      // Project Ownership / Operational Timings / Working Links: three
      // equal supporting cards in a row.
      "#proj_info.wise-pg-active .wise-pg-row{display:flex;flex:1 1 100%;gap:10px;align-items:stretch;margin-top:10px;}",
      "#proj_info.wise-pg-active .wise-pg-row:first-child{margin-top:0;}",
      "#proj_info.wise-pg-active .wise-pg-row>[" + GROUP_ATTR + "]{flex:1 1 0;width:auto;margin-top:0;min-width:0;}",
      // These 3 cards are only ~1/3 page width, but each native field still
      // carries HireHop's own inline width (a calc(33%-4px)-style percentage
      // sized for the old full-width layout) — at a third of the space that
      // shrinks to a sliver, forcing "Label : Value" to wrap word-by-word.
      // Stacking one field per row (matching the wise-project-details
      // override above) keeps every value on a single, legible line.
      "#proj_info.wise-pg-active [" + GROUP_ATTR + "='project-ownership']>.wise-pg-body,#proj_info.wise-pg-active [" + GROUP_ATTR + "='operational-timings']>.wise-pg-body,#proj_info.wise-pg-active [" + GROUP_ATTR + "='working-links']>.wise-pg-body{display:flex;flex-direction:column;gap:7px;padding:10px 12px;}",
      "#proj_info.wise-pg-active [" + GROUP_ATTR + "='project-ownership']>.wise-pg-body>*,#proj_info.wise-pg-active [" + GROUP_ATTR + "='operational-timings']>.wise-pg-body>*,#proj_info.wise-pg-active [" + GROUP_ATTR + "='working-links']>.wise-pg-body>*{width:100%!important;max-width:none!important;flex:none!important;white-space:normal;}",

      // System Details: compact/collapsed by default (native, lower-
      // priority info) — same card chrome as everything else, just a
      // clipped body with a fade + "Show more" toggle to expand. Text
      // colour is forced dark (!important) because some native rows here
      // (e.g. the Project ID#/Technical/Production/Created by strip) are
      // styled by HireHop as white text meant to sit on #proj_info's own
      // native coloured fill — our white card background sits on top of
      // that and would otherwise leave the text unreadable.
      "#proj_info.wise-pg-active [" + GROUP_ATTR + "='system-details']{grid-column:1 / -1;font-size:.92em;}",
      // Collapsed by default down to just the first grid row (Project ID#/
      // Technical/Created by) via --wise-system-peek-height, measured live
      // off the DOM (see applySystemDetailsPeek) — 44px is only a sane
      // fallback for the brief moment before that measurement has run. No
      // fade needed since the cut lands cleanly on a row boundary.
      "#proj_info.wise-pg-active [" + GROUP_ATTR + "='system-details']>.wise-pg-body{display:grid;grid-template-columns:repeat(3,1fr);max-height:var(--wise-system-peek-height,44px);overflow:hidden;transition:max-height .2s ease;}",
      "#proj_info.wise-pg-active [" + GROUP_ATTR + "='system-details']>.wise-pg-body,#proj_info.wise-pg-active [" + GROUP_ATTR + "='system-details']>.wise-pg-body *{color:#111827!important;}",
      "#proj_info.wise-pg-active [" + GROUP_ATTR + "='system-details'].wise-pg-expanded>.wise-pg-body{max-height:none;overflow:visible;}",

      // Status pill (best-effort — see applyStatusBadge). Fixed palette
      // per request: purple=quote, yellow=very likely, orange=hold,
      // green=confirmed, grey=closed/lost/cancelled, blue=completed/
      // invoiced. Deliberately NOT derived from --wise-project-accent —
      // this is the one spot the module invents its own stage colour
      // rather than mirroring the live project colour.
      "#proj_info.wise-pg-active .wise-status-badge{display:inline-block;padding:2px 10px;margin-left:4px;border-radius:999px;font-weight:700;font-size:.85em;background:#f3f4f6;color:#374151;}",
      "#proj_info.wise-pg-active .wise-status-badge[data-wise-status='quote']{background:#ede9fe;color:#6d28d9;}",
      "#proj_info.wise-pg-active .wise-status-badge[data-wise-status='very-likely']{background:#fef9c3;color:#854d0e;}",
      "#proj_info.wise-pg-active .wise-status-badge[data-wise-status='hold']{background:#ffedd5;color:#c2410c;}",
      "#proj_info.wise-pg-active .wise-status-badge[data-wise-status='confirmed']{background:#dcfce7;color:#15803d;}",
      "#proj_info.wise-pg-active .wise-status-badge[data-wise-status='closed']{background:#f3f4f6;color:#6b7280;}",
      "#proj_info.wise-pg-active .wise-status-badge[data-wise-status='completed']{background:#dbeafe;color:#1d4ed8;}"
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
