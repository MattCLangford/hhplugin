(function () {
  "use strict";

  var $ = window.jQuery;
  if (!$) return;

  var LOG_PREFIX = "[Wise Job Checklist]";
  var EXTERNAL_CONFIG = window.WiseJobChecklistConfig && typeof window.WiseJobChecklistConfig === "object"
    ? window.WiseJobChecklistConfig
    : {};

  var DEFAULT_ITEMS = [
    { key: "technical_brief_reviewed", label: "Technical brief reviewed" },
    { key: "site_measurements_confirmed", label: "Site measurements confirmed" },
    { key: "access_loading_checked", label: "Access, loading and egress checked" },
    { key: "power_requirements_confirmed", label: "Power requirements confirmed" },
    { key: "rigging_plant_checked", label: "Rigging, plant and special kit checked" },
    { key: "drawings_issued", label: "Production drawings issued" },
    { key: "crew_transport_checked", label: "Crew and transport requirements checked" },
    { key: "rams_permits_checked", label: "RAMS and permits checked" },
    { key: "technical_signoff_received", label: "Technical sign-off received" }
  ];

  var CFG = {
    version: "2026-06-18.1",
    buttonLabel: asText(EXTERNAL_CONFIG.buttonLabel) || "Checklist",
    buttonTitle: asText(EXTERNAL_CONFIG.buttonTitle) || "Open technical checklist",
    buttonId: "wise-job-checklist-button",
    stylesId: "wise-job-checklist-styles",
    overlayId: "wise-job-checklist-overlay",
    modalId: "wise-job-checklist-modal",
    titleId: "wise-job-checklist-title",
    storagePrefix: "wise-job-checklist:",
    commercialTabLabels: ["billing", "purchase orders", "purchase order"],
    insertionAfterLabels: ["files"],
    insertionBeforeLabels: ["billing", "purchase orders", "purchase order", "schedule", "emails"],
    jobPageRequiredLabels: ["project details"],
    jobPageSupportingLabels: ["tasks", "notes", "files", "billing", "purchase orders", "schedule", "emails"],
    items: normaliseChecklistItems(EXTERNAL_CONFIG.items || EXTERNAL_CONFIG.checklistItems || DEFAULT_ITEMS),
    noteField: EXTERNAL_CONFIG.noteField || EXTERNAL_CONFIG.notesField || null,
    adminUserIds: normaliseTextList(EXTERNAL_CONFIG.adminUserIds),
    adminUserEmails: normaliseTextList(EXTERNAL_CONFIG.adminUserEmails || EXTERNAL_CONFIG.adminEmails),
    adminUserNames: normaliseTextList(EXTERNAL_CONFIG.adminUserNames || EXTERNAL_CONFIG.adminNames),
    adminRoles: normaliseTextList(EXTERNAL_CONFIG.adminRoles || [
      "admin",
      "administrator",
      "system admin",
      "super admin",
      "superuser",
      "owner"
    ])
  };

  var state = {
    lastAdmin: null,
    lastHost: null,
    maintainTimer: null
  };

  bootstrap();

  function bootstrap() {
    installStyles();
    maintainJobTabs();
    state.maintainTimer = setInterval(maintainJobTabs, 900);

    $(window).on("load.wiseJobChecklist focus.wiseJobChecklist hashchange.wiseJobChecklist", function () {
      setTimeout(maintainJobTabs, 60);
    });
    $(document).on("ajaxComplete.wiseJobChecklist", function () {
      setTimeout(maintainJobTabs, 80);
    });
  }

  function maintainJobTabs() {
    var $host = findJobTabsHost();
    if (!$host.length) {
      removeChecklistTab();
      return;
    }

    state.lastHost = $host.get(0);
    var admin = isAdminUser();
    state.lastAdmin = admin;

    updateCommercialTabs($host, admin);
    installChecklistTab($host);
    redirectHiddenActiveTab($host);
  }

  function updateCommercialTabs($host, admin) {
    findTabsByLabels($host, CFG.commercialTabLabels).each(function () {
      var $tab = $(this);
      if (admin) {
        restoreTab($tab);
      } else {
        hideTab($tab);
      }
    });
  }

  function installChecklistTab($host) {
    var $sampleTab = findTabTemplate($host);
    var $existing = $("#" + CFG.buttonId);

    if ($existing.length && !$existing.parent().is($host)) {
      $existing.detach();
    }

    var $button = $existing.length ? $existing : buildChecklistTab($sampleTab);
    applyTabTemplate($button, $sampleTab);
    bindChecklistButton($button);
    placeChecklistTab($host, $button);
  }

  function buildChecklistTab($sampleTab) {
    var $button = $sampleTab && $sampleTab.length ? $sampleTab.clone(false, false) : $();

    if (!$button.length) {
      $button = $('<li role="tab"><a href="#wise-job-checklist-open"></a></li>');
    }

    $button
      .attr("id", CFG.buttonId)
      .attr("data-wise-job-checklist", "1")
      .removeClass("ui-tabs-active ui-state-active ui-state-focus ui-state-hover ui-tabs-loading")
      .attr("aria-selected", "false")
      .attr("aria-expanded", "false")
      .removeAttr("aria-controls aria-labelledby data-wise-job-checklist-hidden data-wise-job-checklist-display");

    var $anchor = $button.children("a").first();
    if (!$anchor.length) {
      $anchor = $('<a></a>').appendTo($button);
    }

    $button.children().not($anchor).remove();
    $anchor
      .attr("href", "#wise-job-checklist-open")
      .attr("title", CFG.buttonTitle)
      .removeAttr("id aria-controls aria-selected aria-expanded");
    setTabAnchorText($anchor, CFG.buttonLabel);

    return $button;
  }

  function applyTabTemplate($button, $sampleTab) {
    if (!$button || !$button.length) return;

    if ($sampleTab && $sampleTab.length) {
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
        "borderLeftStyle",
        "borderTopColor",
        "borderRightColor",
        "borderBottomColor",
        "borderLeftColor",
        "backgroundColor"
      ]);
    } else {
      $button.attr("class", normaliseTabClass($button.attr("class") || ""));
    }

    $button
      .removeClass("ui-tabs-active ui-state-active ui-state-focus ui-state-hover ui-tabs-loading")
      .attr("aria-selected", "false")
      .attr("aria-expanded", "false")
      .css("display", "")
      .removeAttr("aria-controls aria-labelledby");

    var $anchor = $button.children("a").first();
    var $sampleAnchor = $sampleTab && $sampleTab.length ? $sampleTab.children("a").first() : $();
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
    }

    $anchor
      .attr("href", "#wise-job-checklist-open")
      .attr("title", CFG.buttonTitle)
      .removeAttr("id aria-controls aria-selected aria-expanded");
    setTabAnchorText($anchor, CFG.buttonLabel);
  }

  function bindChecklistButton($button) {
    if (!$button || !$button.length) return;

    $button.off(".wiseJobChecklist");
    $button.children("a").off(".wiseJobChecklist");

    $button.add($button.children("a")).on("click.wiseJobChecklist", function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openChecklist();
      return false;
    });
  }

  function placeChecklistTab($host, $button) {
    if (!$host || !$host.length || !$button || !$button.length) return;

    var $after = findFirstTabByLabels($host, CFG.insertionAfterLabels);
    if ($after.length && !$button.prev().is($after)) {
      $button.insertAfter($after);
      return;
    }

    var $before = findFirstTabByLabels($host, CFG.insertionBeforeLabels);
    if ($before.length && !$button.next().is($before)) {
      $button.insertBefore($before);
      return;
    }

    if (!$button.parent().is($host)) {
      $host.append($button);
    }
  }

  function removeChecklistTab() {
    $("#" + CFG.buttonId).remove();
  }

  function hideTab($tab) {
    if (!$tab || !$tab.length) return;
    if ($tab.attr("data-wise-job-checklist-hidden") !== "1") {
      $tab.attr("data-wise-job-checklist-display", $tab.get(0).style.display || "");
      $tab.attr("data-wise-job-checklist-hidden", "1");
    }
    $tab.css("display", "none");
  }

  function restoreTab($tab) {
    if (!$tab || !$tab.length) return;
    if ($tab.attr("data-wise-job-checklist-hidden") !== "1") return;

    var display = $tab.attr("data-wise-job-checklist-display");
    $tab.css("display", display || "");
    $tab.removeAttr("data-wise-job-checklist-hidden data-wise-job-checklist-display");
  }

  function redirectHiddenActiveTab($host) {
    var $activeHidden = $host.children('[data-wise-job-checklist-hidden="1"]').filter(function () {
      var $tab = $(this);
      return $tab.hasClass("ui-tabs-active") || $tab.hasClass("ui-state-active") || $tab.attr("aria-selected") === "true";
    }).first();

    if (!$activeHidden.length) return;

    var $safeTab = findFirstTabByLabels($host, ["project details", "tasks", "notes", "files", "schedule", "emails"]).filter(":visible").first();
    var $anchor = $safeTab.children("a").first();
    if ($anchor.length) {
      setTimeout(function () { $anchor.trigger("click"); }, 20);
    }
  }

  function openChecklist() {
    $("#" + CFG.overlayId).remove();
    $("body").append(buildChecklistHtml(readChecklistState()));
    bindModalEvents();
  }

  function closeChecklist() {
    $("#" + CFG.overlayId).remove();
  }

  function buildChecklistHtml(checklistState) {
    var jobId = getCurrentJobId();
    var html = '' +
      '<div id="' + CFG.overlayId + '" class="wjc-overlay">' +
        '<div id="' + CFG.modalId + '" class="wjc-modal" role="dialog" aria-modal="true" aria-labelledby="' + CFG.titleId + '">' +
          '<div class="wjc-head">' +
            '<div>' +
              '<div id="' + CFG.titleId + '" class="wjc-title">Technical checklist</div>' +
              '<div class="wjc-subtitle">' + esc(jobId ? "Job " + jobId : "Current job") + '</div>' +
            '</div>' +
            '<button type="button" class="wjc-icon-btn" data-wjc-close aria-label="Close">x</button>' +
          '</div>' +
          '<div class="wjc-body">' +
            '<div class="wjc-list">';

    for (var i = 0; i < CFG.items.length; i++) {
      var item = CFG.items[i];
      var checked = !!(checklistState.checked && checklistState.checked[item.key]);
      html += '' +
        '<label class="wjc-item">' +
          '<input type="checkbox" data-wjc-item="' + escAttr(item.key) + '"' + (checked ? " checked" : "") + '>' +
          '<span>' + esc(item.label) + '</span>' +
        '</label>';
    }

    html += '' +
            '</div>' +
            '<label class="wjc-notes">' +
              '<span>Technical notes</span>' +
              '<textarea data-wjc-notes rows="4">' + esc(checklistState.notes || "") + '</textarea>' +
            '</label>' +
          '</div>' +
          '<div class="wjc-foot">' +
            '<button type="button" class="wjc-btn wjc-btn-secondary" data-wjc-reset>Reset</button>' +
            '<button type="button" class="wjc-btn wjc-btn-primary" data-wjc-done>Done</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    return html;
  }

  function bindModalEvents() {
    var $overlay = $("#" + CFG.overlayId);
    if (!$overlay.length) return;

    $overlay.on("click.wiseJobChecklist", function (event) {
      if (event.target === $overlay.get(0)) closeChecklist();
    });

    $overlay.find("[data-wjc-close],[data-wjc-done]").on("click.wiseJobChecklist", function () {
      saveChecklistStateFromModal();
      closeChecklist();
    });

    $overlay.find("[data-wjc-reset]").on("click.wiseJobChecklist", function () {
      var empty = { checked: {}, notes: "" };
      writeChecklistState(empty);
      renderChecklistState(empty);
    });

    $overlay.find("input[data-wjc-item],textarea[data-wjc-notes]").on("change.wiseJobChecklist input.wiseJobChecklist", function () {
      saveChecklistStateFromModal();
    });

    $(document)
      .off("keydown.wiseJobChecklistModal")
      .on("keydown.wiseJobChecklistModal", function (event) {
        if (event.key === "Escape" && $("#" + CFG.overlayId).length) {
          saveChecklistStateFromModal();
          closeChecklist();
          $(document).off("keydown.wiseJobChecklistModal");
        }
      });

    setTimeout(function () {
      $overlay.find('input[data-wjc-item],textarea[data-wjc-notes],button').filter(":visible").first().trigger("focus");
    }, 20);
  }

  function renderChecklistState(checklistState) {
    var $overlay = $("#" + CFG.overlayId);
    if (!$overlay.length) return;

    $overlay.find("input[data-wjc-item]").each(function () {
      var key = $(this).attr("data-wjc-item");
      $(this).prop("checked", !!(checklistState.checked && checklistState.checked[key]));
    });
    $overlay.find("textarea[data-wjc-notes]").val(checklistState.notes || "");
  }

  function saveChecklistStateFromModal() {
    var $overlay = $("#" + CFG.overlayId);
    if (!$overlay.length) return;

    var checklistState = { checked: {}, notes: "" };
    $overlay.find("input[data-wjc-item]").each(function () {
      var key = $(this).attr("data-wjc-item");
      checklistState.checked[key] = !!$(this).prop("checked");
    });
    checklistState.notes = asText($overlay.find("textarea[data-wjc-notes]").val());
    writeChecklistState(checklistState);
  }

  function readChecklistState() {
    var stored = readStoredChecklistState();
    var checked = {};

    for (var i = 0; i < CFG.items.length; i++) {
      var item = CFG.items[i];
      var field = findConfiguredFieldControl(item);
      if (field.length) {
        checked[item.key] = readBooleanControl(field);
      } else {
        checked[item.key] = !!(stored.checked && stored.checked[item.key]);
      }
    }

    var notesField = findConfiguredNoteControl();
    var notes = notesField.length ? asText(notesField.val()) : asText(stored.notes);

    return {
      checked: checked,
      notes: notes,
      updatedAt: stored.updatedAt || ""
    };
  }

  function writeChecklistState(checklistState) {
    checklistState = checklistState || {};
    checklistState.checked = checklistState.checked || {};
    checklistState.notes = asText(checklistState.notes);
    checklistState.updatedAt = new Date().toISOString();

    for (var i = 0; i < CFG.items.length; i++) {
      var item = CFG.items[i];
      var field = findConfiguredFieldControl(item);
      if (field.length) {
        writeBooleanControl(field, !!checklistState.checked[item.key]);
      }
    }

    var notesField = findConfiguredNoteControl();
    if (notesField.length) {
      notesField.val(checklistState.notes).trigger("input").trigger("change");
    }

    try {
      window.localStorage.setItem(getStorageKey(), JSON.stringify(checklistState));
    } catch (err) {
      log("Could not persist checklist state", err);
    }
  }

  function readStoredChecklistState() {
    try {
      var raw = window.localStorage.getItem(getStorageKey());
      if (!raw) return { checked: {}, notes: "" };
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return { checked: {}, notes: "" };
      return {
        checked: parsed.checked && typeof parsed.checked === "object" ? parsed.checked : {},
        notes: asText(parsed.notes),
        updatedAt: asText(parsed.updatedAt)
      };
    } catch (err) {
      return { checked: {}, notes: "" };
    }
  }

  function getStorageKey() {
    return CFG.storagePrefix + (getCurrentJobId() || "unknown");
  }

  function findConfiguredFieldControl(item) {
    var selectors = [];
    appendSelectors(selectors, item.selector);
    appendSelectors(selectors, item.selectors);
    appendFieldSelectors(selectors, item.fieldName);
    appendFieldSelectors(selectors, item.fieldNames);
    return findFirstControl(selectors);
  }

  function findConfiguredNoteControl() {
    var selectors = [];
    if (CFG.noteField) {
      appendSelectors(selectors, CFG.noteField.selector);
      appendSelectors(selectors, CFG.noteField.selectors);
      appendFieldSelectors(selectors, CFG.noteField.fieldName);
      appendFieldSelectors(selectors, CFG.noteField.fieldNames);
    }
    appendSelectors(selectors, EXTERNAL_CONFIG.noteSelector || EXTERNAL_CONFIG.notesSelector);
    appendFieldSelectors(selectors, EXTERNAL_CONFIG.noteFieldName || EXTERNAL_CONFIG.notesFieldName);
    appendFieldSelectors(selectors, EXTERNAL_CONFIG.noteFieldNames || EXTERNAL_CONFIG.notesFieldNames);
    return findFirstControl(selectors);
  }

  function findFirstControl(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var selector = selectors[i];
      if (!selector) continue;
      var $match;
      try {
        $match = $(selector).filter("input,select,textarea").first();
        if (!$match.length) {
          $match = $(selector).find("input,select,textarea").first();
        }
      } catch (err) {
        $match = $();
      }
      if ($match && $match.length) return $match;
    }
    return $();
  }

  function appendSelectors(target, value) {
    var list = normaliseArray(value);
    for (var i = 0; i < list.length; i++) {
      if (list[i]) target.push(asText(list[i]));
    }
  }

  function appendFieldSelectors(target, value) {
    var names = normaliseArray(value);
    for (var i = 0; i < names.length; i++) {
      var name = asText(names[i]).trim();
      if (!name) continue;
      var attr = cssAttr(name);
      var id = cssIdentifier(name);
      target.push("#" + id);
      target.push('[name="' + attr + '"]');
      target.push('[data-field="' + attr + '"]');
      target.push('[data-name="' + attr + '"]');
      target.push('[name="job:' + attr + '"]');
      target.push('[name="project:' + attr + '"]');
    }
  }

  function readBooleanControl($field) {
    if (!$field || !$field.length) return false;

    var $control = $field.first();
    if ($control.is(":checkbox,:radio")) return !!$control.prop("checked");

    var value = normaliseSearch($control.val());
    return /^(1|true|yes|y|on|checked|complete|completed|done)$/i.test(value);
  }

  function writeBooleanControl($field, checked) {
    if (!$field || !$field.length) return;

    var $control = $field.first();
    if ($control.is(":checkbox,:radio")) {
      $control.prop("checked", !!checked).trigger("input").trigger("change");
      return;
    }

    if ($control.is("select")) {
      var desired = checked ? ["1", "true", "yes", "y", "on", "checked", "complete", "completed", "done"] : ["0", "false", "no", "n", "off", "unchecked", "incomplete", "not done", ""];
      var selectedValue = "";
      $control.find("option").each(function () {
        if (selectedValue) return;
        var value = normaliseSearch($(this).attr("value"));
        var text = normaliseSearch($(this).text());
        if (desired.indexOf(value) !== -1 || desired.indexOf(text) !== -1) {
          selectedValue = $(this).attr("value");
        }
      });
      $control.val(selectedValue).trigger("input").trigger("change");
      return;
    }

    $control.val(checked ? "Yes" : "").trigger("input").trigger("change");
  }

  function findJobTabsHost() {
    var selectors = [
      "#tabs > ul.ui-tabs-nav:first",
      "#tabs > ul:first",
      ".hh-framework_tabs > ul.ui-tabs-nav:first",
      ".hh-framework_tabs > ul:first",
      ".ui-tabs > ul.ui-tabs-nav:first",
      "ul.ui-tabs-nav"
    ];

    for (var i = 0; i < selectors.length; i++) {
      var $matches = $(selectors[i]).filter(function () {
        return isJobTabsHost($(this));
      });
      if ($matches.length) return $matches.first();
    }

    return $("ul").filter(function () {
      return isJobTabsHost($(this));
    }).first();
  }

  function isJobTabsHost($host) {
    if (!$host || !$host.length) return false;
    if ($host.closest("#" + CFG.modalId + ",#" + CFG.overlayId).length) return false;

    var labels = getTabLabels($host);
    if (!hasAnyLabel(labels, CFG.jobPageRequiredLabels)) return false;

    var supporting = 0;
    for (var i = 0; i < CFG.jobPageSupportingLabels.length; i++) {
      if (labels[CFG.jobPageSupportingLabels[i]]) supporting++;
    }
    return supporting >= 3;
  }

  function getTabLabels($host) {
    var out = {};
    getCandidateTabs($host).each(function () {
      var label = normaliseSearch(getTabText($(this)));
      if (label) out[label] = true;
    });
    return out;
  }

  function hasAnyLabel(labels, required) {
    for (var i = 0; i < required.length; i++) {
      if (labels[required[i]]) return true;
    }
    return false;
  }

  function getCandidateTabs($host) {
    return $host.children("li,[role='tab']").not("#" + CFG.buttonId);
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
    var labels = ["files", "schedule", "emails", "notes", "tasks", "project details"];
    for (var i = 0; i < labels.length; i++) {
      var $match = findTabsByLabels($host, [labels[i]]).filter(":visible").last();
      if ($match.length) return $match;
    }
    return getCandidateTabs($host).filter(":visible").last();
  }

  function getTabText($tab) {
    var $anchor = $tab.children("a").first();
    return $.trim(asText($anchor.length ? $anchor.text() : $tab.text()));
  }

  function setTabAnchorText($anchor, label) {
    var $textNodeHost = $anchor.find("span").filter(function () {
      return $.trim(asText($(this).text())) !== "";
    }).last();

    if ($textNodeHost.length) {
      $textNodeHost.text(label);
      return;
    }

    $anchor.text(label);
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

  function isAdminUser() {
    if (typeof EXTERNAL_CONFIG.isAdmin === "boolean") return EXTERNAL_CONFIG.isAdmin;
    if (typeof EXTERNAL_CONFIG.forceAdmin === "boolean") return EXTERNAL_CONFIG.forceAdmin;
    if (typeof EXTERNAL_CONFIG.isAdmin === "function") {
      try {
        if (EXTERNAL_CONFIG.isAdmin(window.user || null) === true) return true;
      } catch (err) {}
    }

    var user = window.user && typeof window.user === "object" ? window.user : null;
    if (user) {
      if (matchesConfiguredAdminUser(user)) return true;
      if (objectHasAdminMarker(user, 0)) return true;
    }

    var globals = [
      window.current_user,
      window.currentUser,
      window.hh_user,
      window.HireHopUser,
      window.permissions,
      window.user_permissions,
      window.userPermissions
    ];
    for (var i = 0; i < globals.length; i++) {
      if (objectHasAdminMarker(globals[i], 0)) return true;
    }

    return domHasAdminMarker();
  }

  function matchesConfiguredAdminUser(user) {
    var ids = normaliseTextList([
      user.ID,
      user.id,
      user.USER_ID,
      user.user_id,
      user.CONTACT_ID,
      user.contact_id
    ]);
    var emails = normaliseTextList([
      user.EMAIL,
      user.email,
      user.USER_EMAIL,
      user.user_email
    ]);
    var names = normaliseTextList([
      user.NAME,
      user.name,
      user.USER_NAME,
      user.user_name,
      user.FULL_NAME,
      user.full_name
    ]);

    return intersects(ids, CFG.adminUserIds) || intersects(emails, CFG.adminUserEmails) || intersects(names, CFG.adminUserNames);
  }

  function objectHasAdminMarker(value, depth) {
    if (value == null || depth > 3) return false;

    if (typeof value === "boolean") return value === true && depth > 0;
    if (typeof value === "number") return value === 1 && depth > 0;
    if (typeof value === "string") return isAdminRoleText(value);

    if ($.isArray(value)) {
      for (var a = 0; a < value.length; a++) {
        if (objectHasAdminMarker(value[a], depth + 1)) return true;
      }
      return false;
    }

    if (typeof value !== "object") return false;

    for (var key in value) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      var keyText = normaliseSearch(key);
      var next = value[key];
      if (/^(is_?)?admin(istrator)?$|super_?admin|admin_?user|administrator|user_?admin/.test(keyText.replace(/\s+/g, "_")) && isTruthy(next)) {
        return true;
      }
      if (/role|roles|permission|permissions|rights|access|group|groups|type|user_?type|level/.test(keyText) && objectHasAdminMarker(next, depth + 1)) {
        return true;
      }
    }

    return false;
  }

  function domHasAdminMarker() {
    var bodyClass = asText(document.body && document.body.className);
    if (/(^|\s)(admin|administrator|is-admin|user-admin|hh-admin)(\s|$)/i.test(bodyClass)) return true;

    var selectors = [
      "#admin_menu",
      ".admin-menu",
      ".hh-admin",
      ".user-admin",
      "[data-user-role]",
      "[data-role]",
      "[data-permission]",
      "[data-permissions]",
      "[data-user-type]"
    ];

    for (var i = 0; i < selectors.length; i++) {
      var $match = $(selectors[i]).filter(":visible").filter(function () {
        var $el = $(this);
        return isAdminRoleText($el.attr("data-user-role")) ||
          isAdminRoleText($el.attr("data-role")) ||
          isAdminRoleText($el.attr("data-permission")) ||
          isAdminRoleText($el.attr("data-permissions")) ||
          isAdminRoleText($el.attr("data-user-type")) ||
          isAdminRoleText($el.text());
      }).first();
      if ($match.length) return true;
    }

    return false;
  }

  function isAdminRoleText(value) {
    var text = normaliseSearch(value);
    if (!text || text === "0" || text === "false" || text === "no") return false;
    if (/^(non|not|no)\s+admin/.test(text)) return false;

    for (var i = 0; i < CFG.adminRoles.length; i++) {
      var role = normaliseSearch(CFG.adminRoles[i]);
      if (!role) continue;
      if (text === role) return true;
      if (new RegExp("(^|[^a-z0-9])" + escapeRegExp(role) + "([^a-z0-9]|$)", "i").test(text)) return true;
    }

    return false;
  }

  function isTruthy(value) {
    if (value === true) return true;
    if (typeof value === "number") return value === 1;
    var text = normaliseSearch(value);
    return /^(1|true|yes|y|on|admin|administrator|super admin|owner)$/.test(text);
  }

  function getCurrentJobId() {
    var href = asText(window.location && window.location.href);
    var match = href.match(/[?&](?:job|job_id|main_id|id)=(\d+)/i) || href.match(/\/job\/(\d+)/i) || href.match(/\/jobs\/(\d+)/i);
    if (match && match[1]) return match[1];

    var selectors = ['input[name="job"]', 'input[name="job_id"]', 'input[name="main_id"]', 'input[name="id"]', "#job_id", "#main_id"];
    for (var i = 0; i < selectors.length; i++) {
      var value = $.trim(asText($(selectors[i]).first().val()));
      if (/^\d+$/.test(value)) return value;
    }

    if (window.job_id && /^\d+$/.test(asText(window.job_id))) return asText(window.job_id);
    if (window.job && typeof window.job === "object") {
      var id = window.job.ID || window.job.id || window.job.JOB_ID || window.job.job_id;
      if (/^\d+$/.test(asText(id))) return asText(id);
    }

    return "";
  }

  function installStyles() {
    if ($("#" + CFG.stylesId).length) return;

    var css = [
      "#" + CFG.overlayId + "{position:fixed;inset:0;z-index:100180;background:rgba(15,23,42,.46);display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box;}",
      "#" + CFG.modalId + "{width:min(560px,100%);max-height:calc(100vh - 36px);display:flex;flex-direction:column;background:#fff;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 22px 70px rgba(15,23,42,.34);font-family:Arial,Helvetica,sans-serif;color:#172033;overflow:hidden;}",
      "#" + CFG.modalId + " .wjc-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:16px 18px 13px;border-bottom:1px solid #e2e8f0;background:#f8fafc;}",
      "#" + CFG.modalId + " .wjc-title{font-size:18px;line-height:1.2;font-weight:700;color:#111827;}",
      "#" + CFG.modalId + " .wjc-subtitle{margin-top:3px;font-size:12px;color:#64748b;}",
      "#" + CFG.modalId + " .wjc-icon-btn{width:30px;height:30px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#334155;font-size:16px;line-height:1;cursor:pointer;}",
      "#" + CFG.modalId + " .wjc-icon-btn:hover{background:#eef2f7;}",
      "#" + CFG.modalId + " .wjc-body{padding:16px 18px;overflow:auto;}",
      "#" + CFG.modalId + " .wjc-list{display:grid;grid-template-columns:1fr;gap:8px;}",
      "#" + CFG.modalId + " .wjc-item{display:flex;align-items:center;gap:10px;min-height:36px;padding:8px 10px;border:1px solid #d9e2ec;border-radius:6px;background:#fff;box-sizing:border-box;font-size:13px;line-height:1.3;color:#172033;cursor:pointer;}",
      "#" + CFG.modalId + " .wjc-item:hover{background:#f8fafc;border-color:#b6c5d6;}",
      "#" + CFG.modalId + " .wjc-item input{width:16px;height:16px;flex:0 0 auto;margin:0;}",
      "#" + CFG.modalId + " .wjc-notes{display:block;margin-top:14px;font-size:12px;font-weight:700;color:#334155;}",
      "#" + CFG.modalId + " .wjc-notes textarea{display:block;width:100%;margin-top:6px;resize:vertical;min-height:86px;border:1px solid #cbd5e1;border-radius:6px;padding:9px 10px;font:13px/1.4 Arial,Helvetica,sans-serif;color:#172033;box-sizing:border-box;}",
      "#" + CFG.modalId + " .wjc-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid #e2e8f0;background:#f8fafc;}",
      "#" + CFG.modalId + " .wjc-btn{min-height:32px;border:1px solid #b6c5d6;border-radius:6px;padding:6px 13px;font:700 13px/1.2 Arial,Helvetica,sans-serif;cursor:pointer;}",
      "#" + CFG.modalId + " .wjc-btn-primary{background:#1769aa;border-color:#1769aa;color:#fff;}",
      "#" + CFG.modalId + " .wjc-btn-primary:hover{background:#10598f;}",
      "#" + CFG.modalId + " .wjc-btn-secondary{background:#fff;color:#334155;}",
      "#" + CFG.modalId + " .wjc-btn-secondary:hover{background:#eef2f7;}",
      "@media(max-width:620px){#" + CFG.overlayId + "{padding:0;}#" + CFG.modalId + "{max-height:100vh;border-radius:0;border-left:0;border-right:0;}#" + CFG.modalId + " .wjc-foot{justify-content:stretch;}#" + CFG.modalId + " .wjc-btn{flex:1 1 0;}}"
    ].join("\n");

    $("<style></style>", { id: CFG.stylesId, text: css }).appendTo("head");
  }

  function normaliseChecklistItems(items) {
    var list = normaliseArray(items);
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var raw = list[i];
      var item = typeof raw === "string" ? { label: raw } : raw;
      if (!item || typeof item !== "object") continue;
      var label = asText(item.label || item.title || item.name).trim();
      if (!label) continue;
      out.push({
        key: asText(item.key || item.id || label).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
        label: label,
        selector: item.selector,
        selectors: item.selectors,
        fieldName: item.fieldName,
        fieldNames: item.fieldNames
      });
    }
    return out.length ? out : DEFAULT_ITEMS;
  }

  function normaliseArray(value) {
    if (value == null) return [];
    return $.isArray(value) ? value : [value];
  }

  function normaliseTextList(value) {
    var list = normaliseArray(value);
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var text = normaliseSearch(list[i]);
      if (text) out.push(text);
    }
    return out;
  }

  function intersects(left, right) {
    if (!left.length || !right.length) return false;
    for (var i = 0; i < left.length; i++) {
      if (right.indexOf(left[i]) !== -1) return true;
    }
    return false;
  }

  function normaliseSearch(value) {
    return asText(value)
      .replace(/\(\s*\d+\s*\)/g, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
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

  function escAttr(value) {
    return esc(value);
  }

  function cssAttr(value) {
    return asText(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function cssIdentifier(value) {
    if ($.escapeSelector) return $.escapeSelector(asText(value));
    return asText(value).replace(/([ #;?%&,.+*~':"!^$[\]()=>|/@])/g, "\\$1");
  }

  function escapeRegExp(value) {
    return asText(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function log() {
    if (!window.console || !window.console.log) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift(LOG_PREFIX);
    window.console.log.apply(window.console, args);
  }

  window.__wiseJobChecklist = {
    version: CFG.version,
    refresh: maintainJobTabs,
    open: openChecklist,
    isAdmin: isAdminUser,
    describe: function () {
      var $host = findJobTabsHost();
      return {
        version: CFG.version,
        jobTabsFound: !!$host.length,
        admin: isAdminUser(),
        checklistItems: CFG.items.length,
        currentJobId: getCurrentJobId(),
        hiddenCommercialTabs: $host.length ? $host.children('[data-wise-job-checklist-hidden="1"]').length : 0
      };
    }
  };
})();
