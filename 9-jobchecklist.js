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
    version: "2026-06-19.1",
    defaultButtonLabel: asText(EXTERNAL_CONFIG.buttonLabel) || "Checklist",
    defaultButtonTitle: asText(EXTERNAL_CONFIG.buttonTitle) || "Open technical checklist",
    buttonIdPrefix: "wise-checklist-tab-",
    stylesId: "wise-job-checklist-styles",
    overlayId: "wise-job-checklist-overlay",
    modalId: "wise-job-checklist-modal",
    titleId: "wise-job-checklist-title",
    commercialTabLabels: ["billing", "purchase orders", "purchase order"],
    pageProfiles: createPageProfiles(),
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
    activeProfile: null,
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
    var match = findChecklistTabsHost();
    var $host = match.host;
    var profile = match.profile;
    if (!$host.length) {
      removeChecklistTab();
      return;
    }

    state.lastHost = $host.get(0);
    state.activeProfile = profile;
    var admin = isAdminUser();
    state.lastAdmin = admin;

    updateCommercialTabs($host, admin);
    installChecklistTab($host, profile);
    redirectHiddenActiveTab($host, profile);
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

  function installChecklistTab($host, profile) {
    var buttonId = getButtonId(profile);
    ensureChecklistPanel($host, profile);
    var $sampleTab = findTabTemplate($host, profile);
    var $existing = $("#" + buttonId);

    if ($existing.length && !$existing.parent().is($host)) {
      $existing.detach();
    }

    var $button = $existing.length ? $existing : buildChecklistTab($sampleTab, profile);
    applyTabTemplate($button, $sampleTab, profile);
    bindChecklistButton($button);
    bindNativeTabReset($host);
    placeChecklistTab($host, $button);
  }

  function buildChecklistTab($sampleTab, profile) {
    var $button = $sampleTab && $sampleTab.length ? $sampleTab.clone(false, false) : $();

    if (!$button.length) {
      $button = $('<li role="tab"><a></a></li>');
    }

    $button
      .attr("id", getButtonId(profile))
      .attr("data-wise-job-checklist", "1")
      .attr("data-wise-checklist-level", profile.key)
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
      .attr("href", "#" + getPanelId(profile))
      .attr("title", profile.buttonTitle)
      .attr("aria-controls", getPanelId(profile))
      .removeAttr("id aria-selected aria-expanded");
    setTabAnchorText($anchor, profile.buttonLabel);

    return $button;
  }

  function applyTabTemplate($button, $sampleTab, profile) {
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
      .attr("href", "#" + getPanelId(profile))
      .attr("title", profile.buttonTitle)
      .attr("aria-controls", getPanelId(profile))
      .removeAttr("id aria-selected aria-expanded");
    setTabAnchorText($anchor, profile.buttonLabel);
  }

  function bindChecklistButton($button) {
    if (!$button || !$button.length) return;

    $button.off(".wiseJobChecklist");
    $button.children("a").off(".wiseJobChecklist");

    $button.add($button.children("a")).on("click.wiseJobChecklist", function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      var profile = getProfileByKey($button.attr("data-wise-checklist-level")) || state.activeProfile || CFG.pageProfiles[0];
      activateChecklistPanel($button.parent(), profile);
      return false;
    });
  }

  function placeChecklistTab($host, $button) {
    if (!$host || !$host.length || !$button || !$button.length) return;

    var profile = getProfileByKey($button.attr("data-wise-checklist-level")) || state.activeProfile || CFG.pageProfiles[0];
    var $after = findFirstTabByLabels($host, profile.insertionAfterLabels);
    if ($after.length && !$button.prev().is($after)) {
      $button.insertAfter($after);
      return;
    }

    var $before = findFirstTabByLabels($host, profile.insertionBeforeLabels);
    if ($before.length && !$button.next().is($before)) {
      $button.insertBefore($before);
      return;
    }

    if (!$button.parent().is($host)) {
      $host.append($button);
    }
  }

  function removeChecklistTab() {
    $('[data-wise-job-checklist="1"]').remove();
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

  function redirectHiddenActiveTab($host, profile) {
    var $activeHidden = $host.children('[data-wise-job-checklist-hidden="1"]').filter(function () {
      var $tab = $(this);
      return $tab.hasClass("ui-tabs-active") || $tab.hasClass("ui-state-active") || $tab.attr("aria-selected") === "true";
    }).first();

    if (!$activeHidden.length) return;

    var $safeTab = findFirstTabByLabels($host, profile.safeLabels).filter(":visible").first();
    var $anchor = $safeTab.children("a").first();
    if ($anchor.length) {
      setTimeout(function () { $anchor.trigger("click"); }, 20);
    }
  }

  function openChecklist() {
    var match = findChecklistTabsHost();
    var $host = match.host.length ? match.host : $(state.lastHost);
    var profile = match.profile || state.activeProfile || CFG.pageProfiles[0];
    if (!$host.length) return;
    activateChecklistPanel($host, profile);
  }

  function activateChecklistPanel($host, profile) {
    if (!$host || !$host.length || !profile) return;

    state.lastHost = $host.get(0);
    state.activeProfile = profile;
    ensureChecklistPanel($host, profile);
    renderChecklistPanel(profile);
    showChecklistPanel($host, profile);
  }

  function ensureChecklistPanel($host, profile) {
    if (!profile) return $();

    var panelId = getPanelId(profile);
    var $panel = $("#" + panelId);
    var $container = getTabsContainer($host);
    var created = false;
    if (!$panel.length) {
      created = true;
      $panel = $('<div></div>')
        .attr("id", panelId)
        .attr("role", "tabpanel")
        .attr("aria-labelledby", getButtonId(profile))
        .attr("data-wise-checklist-panel", "1")
        .attr("data-wise-checklist-level", profile.key)
        .addClass(getPanelClass($host));
      $panel.hide().attr("aria-hidden", "true");
    }

    if ($container.length && !$panel.parent().is($container)) {
      $panel.detach().appendTo($container);
    }
    resetChecklistPanelLayout($panel);

    $panel
      .attr("aria-labelledby", getButtonId(profile))
      .attr("data-wise-checklist-level", profile.key);
    if (created || !$panel.children().length) {
      renderChecklistPanel(profile);
    } else {
      bindChecklistPanelEvents(profile);
    }

    return $panel;
  }

  function renderChecklistPanel(profile) {
    var $panel = $("#" + getPanelId(profile));
    if (!$panel.length) return;

    $panel.html(buildChecklistPanelHtml(profile, readChecklistState(profile)));
    bindChecklistPanelEvents(profile);
  }

  function buildChecklistPanelHtml(profile, checklistState) {
    var entityId = getCurrentEntityId(profile);
    var progress = getChecklistProgress(profile, checklistState);
    var html = '' +
      '<div class="wjc-panel-inner">' +
        '<table class="wjc-actions" cellspacing="0" cellpadding="0">' +
          '<tbody><tr>' +
            '<td><button type="button" class="wjc-reset ui-button ui-corner-all ui-widget" data-wjc-reset>' +
              '<span class="ui-button-icon ui-icon ui-icon-refresh"></span><span class="ui-button-icon-space"> </span>Reset' +
            '</button></td>' +
            '<td class="wjc-progress-cell"><span class="wjc-progress" data-wjc-progress>' + esc(progress.label) + '</span></td>' +
          '</tr></tbody>' +
        '</table>' +
        '<table class="wjc-native-panel ui-corner-all font_scale hirehop_panel" cellspacing="0" cellpadding="2">' +
          '<tbody>' +
            '<tr class="wjc-title-row"><td colspan="2">' +
              '<table class="wjc-header-table" cellspacing="0" cellpadding="0"><tbody><tr>' +
                '<td class="wjc-title">' + esc(profile.title) + '</td>' +
                '<td class="wjc-entity">' + esc(entityId ? profile.levelLabel + " " + entityId : "Current " + profile.levelLabel.toLowerCase()) + '</td>' +
              '</tr></tbody></table>' +
            '</td></tr>' +
            '<tr><td class="wjc-label-cell">Progress</td><td><span class="wjc-progress" data-wjc-progress>' + esc(progress.label) + '</span></td></tr>' +
            '<tr><td class="wjc-label-cell">Checklist</td><td class="wjc-checklist-cell">' +
              '<table class="wjc-checklist-table" cellspacing="0" cellpadding="2">' +
                '<thead><tr class="ui-state-default"><th class="wjc-check-col">Done</th><th>Requirement</th></tr></thead>' +
                '<tbody>';

    for (var i = 0; i < profile.items.length; i++) {
      var item = profile.items[i];
      var checked = !!(checklistState.checked && checklistState.checked[item.key]);
      var fieldId = "wjc-" + (profile.key || "current") + "-" + i + "-" + item.key.replace(/[^a-z0-9_-]/gi, "-");
      html += '' +
        '<tr' + (checked ? ' class="is-complete"' : '') + '>' +
          '<td class="wjc-check-col"><input id="' + escAttr(fieldId) + '" type="checkbox" data-wjc-item="' + escAttr(item.key) + '"' + (checked ? " checked" : "") + '></td>' +
          '<td><label class="wjc-item-label" for="' + escAttr(fieldId) + '">' + esc(item.label) + '</label></td>' +
        '</tr>';
    }

    html += '' +
                '</tbody>' +
              '</table>' +
            '</td></tr>' +
            '<tr><td class="wjc-label-cell">Technical notes</td><td><textarea class="wjc-notes-field data_cell" data-wjc-notes rows="4">' + esc(checklistState.notes || "") + '</textarea></td></tr>' +
          '</tbody>' +
        '</table>' +
      '</div>';

    return html;
  }

  function getChecklistProgress(profile, checklistState) {
    var total = profile && profile.items ? profile.items.length : 0;
    var completed = 0;
    checklistState = checklistState || {};
    checklistState.checked = checklistState.checked || {};

    for (var i = 0; i < total; i++) {
      if (checklistState.checked[profile.items[i].key]) completed++;
    }

    return {
      completed: completed,
      total: total,
      label: total ? completed + " of " + total + " complete" : "No checklist items"
    };
  }

  function bindChecklistPanelEvents(profile) {
    var $panel = $("#" + getPanelId(profile));
    if (!$panel.length) return;

    $panel.find("[data-wjc-reset]").off(".wiseJobChecklist").on("click.wiseJobChecklist", function () {
      var empty = { checked: {}, notes: "" };
      writeChecklistState(profile, empty);
      renderChecklistPanel(profile);
    });

    $panel.find("input[data-wjc-item],textarea[data-wjc-notes]").off(".wiseJobChecklist").on("change.wiseJobChecklist input.wiseJobChecklist", function () {
      saveChecklistStateFromPanel(profile);
    });
  }

  function showChecklistPanel($host, profile) {
    hideChecklistPanels();
    var $container = getTabsContainer($host);
    $container.addClass("wise-checklist-active");
    var $panel = ensureChecklistPanel($host, profile);
    resetChecklistPanelLayout($panel);
    $container.children(".ui-tabs-panel,[role='tabpanel']").not($panel).attr("aria-hidden", "true");
    $panel
      .removeClass("ui-tabs-hide ui-helper-hidden ui-helper-hidden-accessible")
      .show()
      .attr("aria-hidden", "false")
      .removeAttr("hidden");
    setChecklistTabVisualState($host, profile);
  }

  function hideChecklistPanels() {
    $(".wise-checklist-active").removeClass("wise-checklist-active");
    $('[data-wise-checklist-panel="1"]').each(function () {
      resetChecklistPanelLayout($(this));
      $(this).hide().attr("aria-hidden", "true");
    });
    $(window).off(".wiseChecklistPosition");
  }

  function resetChecklistPanelLayout($panel) {
    if (!$panel || !$panel.length) return;
    $panel.css({
      position: "",
      top: "",
      left: "",
      right: "",
      bottom: "",
      zIndex: "",
      overflow: ""
    });
  }

  function setChecklistTabVisualState($host, profile) {
    $host.children('[data-wise-job-checklist="1"]').each(function () {
      var $tab = $(this);
      var active = $tab.is("#" + getButtonId(profile));
      $tab.toggleClass("is-wise-checklist-active", active);
      $tab.attr("aria-selected", active ? "true" : "false");
    });
  }

  function bindNativeTabReset($host) {
    var $nativeTabs = $host.children("li,[role='tab']").not('[data-wise-job-checklist="1"]');
    $nativeTabs.add($nativeTabs.children("a")).off(".wiseChecklistNativeReset").on("mousedown.wiseChecklistNativeReset click.wiseChecklistNativeReset", function () {
      getTabsContainer($host).removeClass("wise-checklist-active");
      hideChecklistPanels();
      $('[data-wise-job-checklist="1"]')
        .removeClass("is-wise-checklist-active")
        .attr("aria-selected", "false")
        .attr("aria-expanded", "false");
    });
  }

  function saveChecklistStateFromPanel(profile) {
    var $panel = $("#" + getPanelId(profile));
    if (!$panel.length) return;

    var checklistState = { checked: {}, notes: "" };
    $panel.find("input[data-wjc-item]").each(function () {
      var key = $(this).attr("data-wjc-item");
      var checked = !!$(this).prop("checked");
      checklistState.checked[key] = checked;
      $(this).closest("tr").toggleClass("is-complete", checked);
    });
    checklistState.notes = asText($panel.find("textarea[data-wjc-notes]").val());
    writeChecklistState(profile, checklistState);
    updateChecklistProgress(profile, checklistState);
  }

  function updateChecklistProgress(profile, checklistState) {
    var progress = getChecklistProgress(profile, checklistState);
    $("#" + getPanelId(profile)).find("[data-wjc-progress]").text(progress.label);
  }

  function readChecklistState(profile) {
    profile = profile || state.activeProfile || CFG.pageProfiles[0];
    var stored = readStoredChecklistState(profile);
    var checked = {};

    for (var i = 0; i < profile.items.length; i++) {
      var item = profile.items[i];
      var field = findConfiguredFieldControl(item);
      if (field.length) {
        checked[item.key] = readBooleanControl(field);
      } else {
        checked[item.key] = !!(stored.checked && stored.checked[item.key]);
      }
    }

    var notesField = findConfiguredNoteControl(profile);
    var notes = notesField.length ? asText(notesField.val()) : asText(stored.notes);

    return {
      checked: checked,
      notes: notes,
      updatedAt: stored.updatedAt || ""
    };
  }

  function writeChecklistState(profile, checklistState) {
    profile = profile || state.activeProfile || CFG.pageProfiles[0];
    checklistState = checklistState || {};
    checklistState.checked = checklistState.checked || {};
    checklistState.notes = asText(checklistState.notes);
    checklistState.updatedAt = new Date().toISOString();

    for (var i = 0; i < profile.items.length; i++) {
      var item = profile.items[i];
      var field = findConfiguredFieldControl(item);
      if (field.length) {
        writeBooleanControl(field, !!checklistState.checked[item.key]);
      }
    }

    var notesField = findConfiguredNoteControl(profile);
    if (notesField.length) {
      notesField.val(checklistState.notes).trigger("input").trigger("change");
    }

    try {
      window.localStorage.setItem(getStorageKey(profile), JSON.stringify(checklistState));
    } catch (err) {
      log("Could not persist checklist state", err);
    }
  }

  function readStoredChecklistState(profile) {
    try {
      var raw = window.localStorage.getItem(getStorageKey(profile));
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

  function getStorageKey(profile) {
    profile = profile || state.activeProfile || CFG.pageProfiles[0];
    return "wise-checklist:" + profile.key + ":" + (getCurrentEntityId(profile) || "unknown");
  }

  function getButtonId(profile) {
    return CFG.buttonIdPrefix + (profile && profile.key ? profile.key : "current");
  }

  function getPanelId(profile) {
    return "wise-checklist-panel-" + (profile && profile.key ? profile.key : "current");
  }

  function getProfileByKey(key) {
    key = asText(key);
    for (var i = 0; i < CFG.pageProfiles.length; i++) {
      if (CFG.pageProfiles[i].key === key) return CFG.pageProfiles[i];
    }
    return null;
  }

  function getTabsContainer($host) {
    $host = $host && $host.length ? $host : $(state.lastHost);
    if (!$host.length) return $("body");

    var $closest = $host.closest(".ui-tabs");
    if ($closest.length) return $closest.first();

    var $parent = $host.parent();
    if ($parent.length && ($parent.hasClass("ui-tabs") || $parent.children(".ui-tabs-panel,[role='tabpanel']").length)) {
      return $parent;
    }

    return $parent.length ? $parent : $("body");
  }

  function getPanelClass($host) {
    var $template = findExistingTabPanelTemplate($host);
    var className = $template.attr("class");
    return normalisePanelClass((className ? className + " " : "ui-tabs-panel ui-widget-content ui-corner-bottom ") + "wise-checklist-panel");
  }

  function normalisePanelClass(value) {
    var remove = {
      "ui-tabs-hide": true,
      "ui-helper-hidden": true,
      "ui-helper-hidden-accessible": true
    };
    var parts = asText(value).split(/\s+/);
    var kept = [];
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i] || remove[parts[i]]) continue;
      if (kept.indexOf(parts[i]) === -1) kept.push(parts[i]);
    }
    if (kept.indexOf("wise-checklist-panel") === -1) kept.push("wise-checklist-panel");
    return kept.join(" ");
  }

  function findExistingTabPanelTemplate($host) {
    var $tabs = getCandidateTabs($host);
    for (var i = 0; i < $tabs.length; i++) {
      var id = getPanelIdFromTab($($tabs[i]));
      if (!id || id.indexOf("wise-checklist-panel-") === 0) continue;
      var $panel = $("#" + cssIdentifier(id));
      if ($panel.length) return $panel.first();
    }
    return $();
  }

  function getPanelIdFromTab($tab) {
    var controls = asText($tab.attr("aria-controls")).trim();
    if (controls) return controls.replace(/^#/, "");

    var href = asText($tab.children("a").first().attr("href")).trim();
    if (!href || href.charAt(0) !== "#") return "";
    return href.slice(1);
  }

  function getCurrentEntityId(profile) {
    if (profile && profile.key === "project") return getCurrentProjectId() || getCurrentJobId();
    return getCurrentJobId();
  }

  function findConfiguredFieldControl(item) {
    var selectors = [];
    appendSelectors(selectors, item.selector);
    appendSelectors(selectors, item.selectors);
    appendFieldSelectors(selectors, item.fieldName);
    appendFieldSelectors(selectors, item.fieldNames);
    return findFirstControl(selectors);
  }

  function findConfiguredNoteControl(profile) {
    var selectors = [];
    var noteField = profile && profile.noteField;
    if (noteField) {
      appendSelectors(selectors, noteField.selector);
      appendSelectors(selectors, noteField.selectors);
      appendFieldSelectors(selectors, noteField.fieldName);
      appendFieldSelectors(selectors, noteField.fieldNames);
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

  function findChecklistTabsHost() {
    var selectors = [
      "#tabs > ul.ui-tabs-nav:first",
      "#tabs > ul:first",
      ".hh-framework_tabs > ul.ui-tabs-nav:first",
      ".hh-framework_tabs > ul:first",
      ".ui-tabs > ul.ui-tabs-nav:first",
      "ul.ui-tabs-nav"
    ];

    for (var i = 0; i < selectors.length; i++) {
      var match = findMatchingTabsHost($(selectors[i]));
      if (match.host.length) return match;
    }

    return findMatchingTabsHost($("ul"));
  }

  function findMatchingTabsHost($hosts) {
    var empty = { host: $(), profile: null };
    var hosts = $hosts || $();

    for (var i = 0; i < hosts.length; i++) {
      var $host = $(hosts[i]);
      var profile = getTabsHostProfile($host);
      if (profile) return { host: $host, profile: profile };
    }

    return empty;
  }

  function getTabsHostProfile($host) {
    if (!$host || !$host.length) return false;
    if ($host.closest("#" + CFG.modalId + ",#" + CFG.overlayId).length) return false;

    var labels = getTabLabels($host);

    for (var p = 0; p < CFG.pageProfiles.length; p++) {
      var profile = CFG.pageProfiles[p];
      if (!hasAnyLabel(labels, profile.requiredLabels)) continue;

      var supporting = 0;
      for (var i = 0; i < profile.supportingLabels.length; i++) {
        if (labels[profile.supportingLabels[i]]) supporting++;
      }
      if (supporting >= profile.minimumSupportingLabels) return profile;
    }

    return null;
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
    return $host.children("li,[role='tab']").not('[data-wise-job-checklist="1"],#wise-job-checklist-button');
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

  function findTabTemplate($host, profile) {
    var labels = profile && profile.templateLabels ? profile.templateLabels : ["files", "schedule", "emails", "notes", "tasks"];
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
    $anchor.empty().text(label);
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

  function getCurrentProjectId() {
    var href = asText(window.location && window.location.href);
    var match = href.match(/[?&](?:project|project_id|main_id|id)=(\d+)/i) || href.match(/\/project\/(\d+)/i) || href.match(/\/projects\/(\d+)/i);
    if (match && match[1]) return match[1];

    var selectors = ['input[name="project"]', 'input[name="project_id"]', 'input[name="main_id"]', 'input[name="id"]', "#project_id", "#main_id"];
    for (var i = 0; i < selectors.length; i++) {
      var value = $.trim(asText($(selectors[i]).first().val()));
      if (/^\d+$/.test(value)) return value;
    }

    if (window.project_id && /^\d+$/.test(asText(window.project_id))) return asText(window.project_id);
    if (window.project && typeof window.project === "object") {
      var id = window.project.ID || window.project.id || window.project.PROJECT_ID || window.project.project_id;
      if (/^\d+$/.test(asText(id))) return asText(id);
    }

    return "";
  }

  function createPageProfiles() {
    var projectConfig = getExternalProfileConfig("project");
    var jobConfig = getExternalProfileConfig("job");
    var globalItems = EXTERNAL_CONFIG.items || EXTERNAL_CONFIG.checklistItems || DEFAULT_ITEMS;

    return [
      {
        key: "project",
        levelLabel: "Project",
        title: asText(projectConfig.title) || "Project checklist",
        buttonLabel: asText(projectConfig.buttonLabel) || CFG_DEFAULT_LABEL(),
        buttonTitle: asText(projectConfig.buttonTitle) || "Open project checklist",
        requiredLabels: ["project details"],
        supportingLabels: ["tasks", "notes", "files", "schedule", "emails"],
        minimumSupportingLabels: 3,
        insertionAfterLabels: ["files"],
        insertionBeforeLabels: ["schedule", "emails"],
        templateLabels: ["files", "notes", "tasks", "schedule", "emails", "project details"],
        safeLabels: ["project details", "tasks", "notes", "files", "schedule", "emails"],
        items: normaliseChecklistItems(projectConfig.items || projectConfig.checklistItems || EXTERNAL_CONFIG.projectItems || globalItems),
        noteField: projectConfig.noteField || projectConfig.notesField || null
      },
      {
        key: "job",
        levelLabel: "Job",
        title: asText(jobConfig.title) || "Job checklist",
        buttonLabel: asText(jobConfig.buttonLabel) || CFG_DEFAULT_LABEL(),
        buttonTitle: asText(jobConfig.buttonTitle) || "Open job checklist",
        requiredLabels: ["event requirements", "job details"],
        supportingLabels: ["tasks", "notes", "files", "supplying", "archive", "billing", "purchase orders", "schedule", "emails"],
        minimumSupportingLabels: 3,
        insertionAfterLabels: ["files"],
        insertionBeforeLabels: ["supplying", "archive", "billing", "purchase orders", "schedule", "emails"],
        templateLabels: ["files", "notes", "tasks", "supplying", "schedule", "emails", "event requirements"],
        safeLabels: ["event requirements", "job details", "tasks", "notes", "files", "supplying", "archive", "schedule", "emails"],
        items: normaliseChecklistItems(jobConfig.items || jobConfig.checklistItems || EXTERNAL_CONFIG.jobItems || globalItems),
        noteField: jobConfig.noteField || jobConfig.notesField || null
      }
    ];
  }

  function CFG_DEFAULT_LABEL() {
    return asText(EXTERNAL_CONFIG.buttonLabel) || "Checklist";
  }

  function getExternalProfileConfig(key) {
    var direct = EXTERNAL_CONFIG[key];
    if (direct && typeof direct === "object") return direct;
    var named = EXTERNAL_CONFIG[key + "Checklist"];
    return named && typeof named === "object" ? named : {};
  }

  function installStyles() {
    if ($("#" + CFG.stylesId).length) return;

    var css = [
      ".wise-checklist-panel{box-sizing:border-box;background:#fff;}",
      ".wise-checklist-active>.ui-tabs-panel:not([data-wise-checklist-panel]),.wise-checklist-active>[role='tabpanel']:not([data-wise-checklist-panel]){display:none!important;}",
      ".wise-checklist-active>[data-wise-checklist-panel='1']{display:block!important;}",
      '[data-wise-job-checklist="1"].is-wise-checklist-active{background:#1f75cf!important;border-color:#1f75cf!important;}',
      '[data-wise-job-checklist="1"].is-wise-checklist-active>a{color:#fff!important;}',
      ".wise-checklist-panel .wjc-panel-inner{padding:14px 16px 18px;font-family:inherit;color:inherit;box-sizing:border-box;}",
      ".wise-checklist-panel .wjc-actions{width:100%;margin:0 0 6px;border-collapse:collapse;}",
      ".wise-checklist-panel .wjc-actions td{padding:0 4px 6px 0;white-space:nowrap;}",
      ".wise-checklist-panel .wjc-actions .wjc-progress-cell{text-align:right;font-weight:bold;}",
      ".wise-checklist-panel .wjc-reset{width:136px;}",
      ".wise-checklist-panel .wjc-native-panel{width:100%;border:1px solid #a1a1a1;border-collapse:separate;border-spacing:0;background:#fff;table-layout:fixed;}",
      ".wise-checklist-panel .wjc-native-panel td{padding:5px 6px;border-top:1px solid #d0d0d0;vertical-align:top;}",
      ".wise-checklist-panel .wjc-native-panel>tbody>tr:first-child>td{border-top:0;}",
      ".wise-checklist-panel .wjc-title-row>td{padding:0;}",
      ".wise-checklist-panel .wjc-header-table{width:100%;border-collapse:collapse;background:#f0f0f0;}",
      ".wise-checklist-panel .wjc-header-table td{border:0;padding:6px 6px;}",
      ".wise-checklist-panel .wjc-title{font-size:1.2em;font-weight:bold;}",
      ".wise-checklist-panel .wjc-entity{text-align:right;white-space:nowrap;}",
      ".wise-checklist-panel .wjc-label-cell{width:145px;color:#333;white-space:nowrap;}",
      ".wise-checklist-panel .wjc-progress{font-weight:bold;}",
      ".wise-checklist-panel .wjc-checklist-cell{padding:0!important;}",
      ".wise-checklist-panel .wjc-checklist-table{width:100%;border-collapse:collapse;table-layout:fixed;}",
      ".wise-checklist-panel .wjc-checklist-table th{padding:5px 6px;text-align:left;font-weight:bold;border-bottom:1px solid #a1a1a1;}",
      ".wise-checklist-panel .wjc-check-col{width:58px;text-align:center!important;}",
      ".wise-checklist-panel .wjc-checklist-table td{border-top:1px solid #dedede;padding:5px 6px;vertical-align:middle;}",
      ".wise-checklist-panel .wjc-checklist-table tbody tr:first-child td{border-top:0;}",
      ".wise-checklist-panel .wjc-checklist-table tr.is-complete td{background:#f7f7f7;color:#555;}",
      ".wise-checklist-panel .wjc-item-label{display:block;line-height:1.4;cursor:pointer;}",
      ".wise-checklist-panel .wjc-notes-field{display:block;width:100%;height:72px;min-height:72px;resize:vertical;border:1px solid #a1a1a1;padding:4px;box-sizing:border-box;font:inherit;background:#fff;}",
      "@media(max-width:620px){.wise-checklist-panel .wjc-panel-inner{padding:10px 8px 14px;}.wise-checklist-panel .wjc-actions td{display:block;text-align:left!important;}.wise-checklist-panel .wjc-reset{width:136px;}.wise-checklist-panel .wjc-entity{text-align:left;white-space:normal;}.wise-checklist-panel .wjc-native-panel,.wise-checklist-panel .wjc-native-panel tbody,.wise-checklist-panel .wjc-native-panel tr,.wise-checklist-panel .wjc-native-panel td{display:block;width:auto;}.wise-checklist-panel .wjc-label-cell{width:auto;background:#f7f7f7;border-bottom:1px solid #d0d0d0;}.wise-checklist-panel .wjc-check-col{width:46px;}}"
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
      var match = findChecklistTabsHost();
      var $host = match.host;
      var profile = match.profile || state.activeProfile;
      return {
        version: CFG.version,
        tabsFound: !!$host.length,
        level: profile ? profile.key : "",
        admin: isAdminUser(),
        checklistItems: profile && profile.items ? profile.items.length : 0,
        currentEntityId: profile ? getCurrentEntityId(profile) : "",
        hiddenCommercialTabs: $host.length ? $host.children('[data-wise-job-checklist-hidden="1"]').length : 0
      };
    }
  };
})();
