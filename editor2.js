(function () {
  "use strict";

  var $ = window.jQuery;
  if (!$) return;

  var CFG = {
    version: "2026-04-30.05-labour-layout-cleanup-and-brand-refresh",
    buttonId: "wise-proposal-page-editor-button",
    stylesId: "wise-proposal-page-editor-styles",
    overlayId: "wise-proposal-page-editor-overlay",
    modalId: "wise-proposal-page-editor-modal",
    titleId: "wise-proposal-page-editor-title",
    bodyId: "wise-proposal-page-editor-body",
    statusId: "wise-proposal-page-editor-status",
    saveId: "wise-proposal-page-editor-save",
    closeId: "wise-proposal-page-editor-close",
    nativeFallbackId: "wise-native-line-editor-button",
    defaultEditClass: "wise-default-proposal-editor",
    defaultEditEnabled: true,
    defaultOpenOnTreeDoubleClick: true,
    defaultOpenOnEnter: false,
    nativeFallbackLabel: "Edit",
    visualEditLabel: "Visual Page Editor",
    sectionName: "Event Overview",
    requiredRawSectionName: "// Section: Event Overview",
    maxSchedules: 3,
    maxRows: 10,
    allowedDepotIds: ["14"],
    allowedDepotNames: ["Project Costs"],
    blockWhenDepotUndetected: true,
    bootstrapMaxTries: 120,
    bootstrapRetryMs: 500,
    writeThrottleMs: 1150,
    rateLimitRetryMs: 65000,
    saveMaxAttempts: 2,
    metaStart: "[WisePageMeta]",
    metaEnd: "[/WisePageMeta]",
    profileKey: "event_overview_schedule",
    rootTemplateKey: "section_event_overview",
    deptTemplateKey: "dept_proposed_timings"
  };

  var LAYOUT_IMAGE = "image";
  var LAYOUT_COLUMNS = "columns";
  var VARIANT_HALF_IMAGE = "half_image";
  var VARIANT_THREE_COLUMNS = "three_columns";
  var LEGACY_VARIANT_COLUMNS = "no_image_multi";
  var SLOT_KEYS = ["primary", "secondary", "tertiary"];
  var UI_COMPACT = {
    modalMaxWidth: 1080,
    modalViewportGap: 10,
    proofMaxWidth: 920,
    proofMinWidth: 640
  };

  var EDITOR_PREVIEW = {
    dockId: "wise-proposal-page-editor-preview-dock",
    placeholderId: "wise-proposal-page-editor-preview-placeholder",
    previewWorkspaceId: "wise-doc-preview-workspace",
    previewRightPaneId: "wise-doc-preview-right-pane",
    minViewportWidth: 1460
  };

  var editor = {
    ready: false,
    saving: false,
    original: null,
    current: null,
    rootNode: null,
    selectedRegionId: "",
    lastClickedNodeId: "",
    lastWriteAt: 0,
    uid: 0,
    depotSignature: "",
    nativeEditEl: null,
    nativeEditCaptureInstalled: false,
    nativeBypassClick: false,
    treeDefaultOpenInstalled: false,
    previewDocked: false,
    previewSuppressed: false
  };

  log("Proposal page editor loaded", CFG.version);
  boot();

  function boot() {
    var tries = 0;

    function attempt() {
      tries += 1;

      if (!isAllowedDepot(getActiveDepotContext())) {
        if (tries < CFG.bootstrapMaxTries) setTimeout(attempt, CFG.bootstrapRetryMs);
        return;
      }

      if (!$("#items_tab").length) {
        if (tries < CFG.bootstrapMaxTries) setTimeout(attempt, CFG.bootstrapRetryMs);
        return;
      }

      if (!editor.ready) {
        editor.ready = true;
        injectStyles();
        ensureModal();
        installTreeClickTracker();
      }

      maintainDefaultSupplyingListEditor();
    }

    if (document.readyState === "loading") $(attempt);
    else attempt();

    $(window).on("load.wiseEventOverview focus.wiseEventOverview", attempt);
    $(document).on("ajaxComplete.wiseEventOverview", attempt);
    $(window).on("resize.wiseToolbarCompression", function () {
      if (editor.ready) {
        updateToolbarCompression();
        if ($("#" + CFG.overlayId).is(":visible")) attachEditorPreviewDock();
      }
    });
    $(document).on("click.wiseToolbarCompression", "#wise-doc-preview-toggle", function () {
      setTimeout(updateToolbarCompression, 80);
      setTimeout(updateToolbarCompression, 450);
    });
    setInterval(function () {
      if (editor.ready) maintainDefaultSupplyingListEditor();
    }, 2500);
  }

  function injectEventOverviewStyles() {
    if ($("#" + CFG.stylesId).length) return;

    var css = [
      "#" + CFG.overlayId + "{position:fixed;inset:0;display:none;align-items:center;justify-content:center;gap:0;padding:" + UI_COMPACT.modalViewportGap + "px;background:rgba(9,15,28,.56);backdrop-filter:blur(3px);z-index:100000;}",
      "#" + CFG.overlayId + ".has-preview-dock{justify-content:center;}",
      "#" + CFG.modalId + "{width:min(" + UI_COMPACT.modalMaxWidth + "px,calc(100vw - " + (UI_COMPACT.modalViewportGap * 2) + "px));max-height:calc(100vh - " + (UI_COMPACT.modalViewportGap * 2) + "px);display:flex;flex-direction:column;overflow:hidden;background:#f6f8fb;border:1px solid #d0d5dd;border-radius:16px;box-shadow:0 24px 64px rgba(15,23,42,.28);color:#1f2937;font-family:inherit;}",
      "#" + CFG.overlayId + ".has-preview-dock #" + CFG.modalId + "{border-top-right-radius:0;border-bottom-right-radius:0;}",
      "#" + EDITOR_PREVIEW.dockId + "{display:none;width:min(630px,50vw);max-height:calc(100vh - " + (UI_COMPACT.modalViewportGap * 2) + "px);border:1px solid #d0d5dd;border-left:0;border-radius:0 16px 16px 0;overflow:hidden;background:#fff;box-shadow:0 24px 64px rgba(15,23,42,.18);}",
      "#" + CFG.overlayId + ".has-preview-dock #" + EDITOR_PREVIEW.dockId + "{display:flex;flex-direction:column;}",
      "#" + EDITOR_PREVIEW.dockId + " > #" + EDITOR_PREVIEW.previewRightPaneId + "{display:flex!important;flex:1 1 auto!important;width:100%!important;height:100%!important;min-width:0!important;border-left:0!important;background:#fff;}",
      "#" + EDITOR_PREVIEW.dockId + " > #" + EDITOR_PREVIEW.previewRightPaneId + ".is-wide-doc{display:flex!important;flex:1 1 auto!important;width:100%!important;height:100%!important;min-width:0!important;}",
      "#" + EDITOR_PREVIEW.dockId + " #wise-doc-preview-panel{display:flex!important;flex-direction:column!important;min-height:0!important;height:100%!important;}",
      "#" + EDITOR_PREVIEW.dockId + " #wise-doc-preview-panel .wise-doc-preview-toolbar{gap:8px;}",
      "#" + EDITOR_PREVIEW.dockId + " #wise-doc-preview-panel .wise-doc-preview-render,#" + EDITOR_PREVIEW.dockId + " #wise-doc-preview-refresh,#" + EDITOR_PREVIEW.dockId + " #wise-doc-preview-auto{display:none!important;}",
      "#" + EDITOR_PREVIEW.dockId + " #wise-doc-preview-viewport{flex:1 1 auto!important;min-height:0!important;height:auto!important;}",
      "#" + CFG.modalId + " .weo-image-placeholder{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.56);background:linear-gradient(145deg,#0f172a,#1d4ed8);}",
      "#" + CFG.modalId + " *{box-sizing:border-box;}",
      "#" + CFG.modalId + " .weo-head{display:flex;gap:10px;align-items:flex-start;justify-content:space-between;padding:11px 14px 8px;background:linear-gradient(180deg,#fff 0%,#f8fafc 100%);border-bottom:1px solid #e4e8ef;}",
      "#" + CFG.modalId + " .weo-title{font-size:16px;font-weight:800;line-height:1.15;letter-spacing:-.01em;color:#101828;}",
      "#" + CFG.modalId + " .weo-subtitle{margin-top:2px;color:#667085;font-size:10px;line-height:1.35;max-width:720px;}",
      "#" + CFG.modalId + " .weo-x{border:0;background:transparent;color:#667085;cursor:pointer;font-size:24px;line-height:1;padding:0 2px;}",
      "#" + CFG.modalId + " .weo-body{padding:8px 10px 10px;overflow:auto;background:#e9edf3;display:flex;flex-direction:column;gap:7px;}",
      "#" + CFG.modalId + " .weo-message{border:1px dashed #d0d5dd;border-radius:14px;background:#f9fafb;padding:18px;color:#344054;font-size:14px;line-height:1.55;}",
      "#" + CFG.modalId + " .weo-message strong{display:block;margin-bottom:6px;color:#101828;font-size:15px;}",
      "#" + CFG.modalId + " .weo-visual-editor{display:grid;gap:7px;min-width:0;}",
      "#" + CFG.modalId + " .weo-layout-strip{display:flex;gap:7px;align-items:stretch;justify-content:space-between;}",
      "#" + CFG.modalId + " .weo-layout-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;width:min(520px,100%);}",
      "#" + CFG.modalId + " .weo-layout-pill{display:grid;grid-template-columns:18px minmax(0,1fr);gap:7px;align-items:center;border:1px solid #d4dbe7;border-radius:12px;background:#fff;padding:7px 9px;cursor:pointer;box-shadow:0 4px 12px rgba(15,23,42,.04);}",
      "#" + CFG.modalId + " .weo-layout-pill input{margin:0;}",
      "#" + CFG.modalId + " .weo-layout-pill b{display:block;font-size:11px;line-height:1.15;color:#101828;}",
      "#" + CFG.modalId + " .weo-layout-pill span span{display:block;margin-top:2px;font-size:10px;line-height:1.25;color:#667085;}",
      "#" + CFG.modalId + " .weo-layout-pill.is-selected{border-color:#175cd3;background:#eef4ff;box-shadow:inset 0 0 0 1px rgba(23,92,211,.08),0 4px 12px rgba(23,92,211,.08);}",
      "#" + CFG.modalId + " .weo-layout-note{align-self:center;max-width:380px;border:1px solid #d9e2ec;border-radius:12px;background:#fff;padding:7px 9px;font-size:10px;line-height:1.3;color:#475467;}",
      "#" + CFG.modalId + " .weo-canvas-shell{border:1px solid #d6deea;border-radius:16px;background:#dfe5ee;padding:10px;overflow:auto;}",
      "#" + CFG.modalId + " .weo-proof-page{--paper:#fffdf9;--ink:#0d1226;--heritage:#EC9797;position:relative;width:min(100%," + UI_COMPACT.proofMaxWidth + "px);min-width:" + UI_COMPACT.proofMinWidth + "px;aspect-ratio:318/178.9;margin:0 auto;background:var(--paper);overflow:hidden;border-radius:8px;box-shadow:0 10px 30px rgba(15,23,42,.18);color:var(--ink);font-family:Lato,'Segoe UI',Arial,sans-serif;}",
      "#" + CFG.modalId + " .weo-proof-logo{position:absolute;left:2.6%;top:4%;z-index:5;width:96px;height:22px;border:1px solid rgba(13,18,38,.18);border-radius:999px;background:rgba(13,18,38,.05);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;letter-spacing:.08em;color:rgba(13,18,38,.68);text-transform:uppercase;}",
      "#" + CFG.modalId + " .weo-proof-footer{position:absolute;left:2.6%;right:2.6%;bottom:4%;z-index:7;display:flex;justify-content:space-between;gap:18px;font-size:9px;color:rgba(13,18,38,.62);pointer-events:none;}",
      "#" + CFG.modalId + " .weo-page-title-fixed{position:absolute;z-index:6;font-family:'Albra Sans',Lato,'Segoe UI',Arial,sans-serif;font-size:clamp(21px,2.7vw,36px);font-weight:400;line-height:.95;text-transform:uppercase;letter-spacing:.01em;}",
      "#" + CFG.modalId + " .weo-page-field{width:100%;border:1px dashed rgba(23,92,211,.28);border-radius:8px;background:rgba(255,255,255,.72);color:#0d1226;font:inherit;box-shadow:0 1px 2px rgba(15,23,42,.04);transition:border-color .12s,box-shadow .12s,background .12s;}",
      "#" + CFG.modalId + " .weo-page-field:hover{border-color:rgba(23,92,211,.55);background:rgba(255,255,255,.9);}",
      "#" + CFG.modalId + " .weo-page-field:focus{outline:none;border-color:#175cd3;background:#fff;box-shadow:0 0 0 3px rgba(23,92,211,.14);}",
      "#" + CFG.modalId + " .weo-page-field::placeholder{color:rgba(13,18,38,.34);}",
      "#" + CFG.modalId + " textarea.weo-page-field{resize:none;line-height:1.25;}",
      "#" + CFG.modalId + " .weo-proof-kicker{font-family:'Albra Sans',Lato,'Segoe UI',Arial,sans-serif;font-size:clamp(10px,1vw,13px);line-height:1.05;color:var(--heritage);letter-spacing:.03em;margin-bottom:5px;}",
      "#" + CFG.modalId + " .weo-day-heading{font-weight:800;text-transform:uppercase;line-height:1.15;padding:5px 7px;font-size:clamp(10px,.96vw,13px);}",
      "#" + CFG.modalId + " .weo-day-blurb{min-height:60px;padding:6px 7px;font-size:clamp(9px,.88vw,12px);}",
      "#" + CFG.modalId + " .weo-time-list{display:grid;gap:3px;margin-top:5px;}",
      "#" + CFG.modalId + " .weo-time-row{display:grid;grid-template-columns:minmax(50px,.34fr) 12px minmax(0,1fr) 22px;gap:4px;align-items:center;padding-top:3px;border-top:1px solid rgba(236,151,151,.48);}",
      "#" + CFG.modalId + " .weo-time-row:first-child{border-top:0;padding-top:0;}",
      "#" + CFG.modalId + " .weo-time-row .weo-page-field{padding:4px 5px;font-size:clamp(9px,.84vw,11px);}",
      "#" + CFG.modalId + " .weo-row-sep{font-size:11px;text-align:center;color:rgba(13,18,38,.35);}",
      "#" + CFG.modalId + " .weo-mini-remove{width:22px;height:22px;border:1px solid #fecdca;border-radius:7px;background:#fff;color:#b42318;cursor:pointer;font-size:15px;line-height:17px;padding:0;}",
      "#" + CFG.modalId + " .weo-mini-remove:hover{background:#fff5f5;}",
      "#" + CFG.modalId + " .weo-page-mini-btn{border:1px solid #cfd4dc;border-radius:999px;background:#fff;color:#1f2937;cursor:pointer;font-size:9px;font-weight:800;padding:4px 7px;line-height:1.1;}",
      "#" + CFG.modalId + " .weo-page-mini-btn:hover{background:#f9fafb;}",
      "#" + CFG.modalId + " .weo-page-mini-btn.is-danger{border-color:#fecdca;color:#b42318;}",
      "#" + CFG.modalId + " .weo-card-actions{display:flex;justify-content:space-between;gap:6px;align-items:center;margin-top:5px;}",
      "#" + CFG.modalId + " .weo-row-count{font-size:9px;font-weight:800;color:rgba(13,18,38,.45);}",
      "#" + CFG.modalId + " .weo-proof-page.is-image-layout .weo-proof-image-panel{position:absolute;right:0;top:0;bottom:0;width:50%;z-index:1;background:linear-gradient(145deg,#0f172a,#1d4ed8);overflow:hidden;}",
      "#" + CFG.modalId + " .weo-proof-page.is-image-layout .weo-proof-image-panel img{width:100%;height:100%;object-fit:cover;display:block;}",
      "#" + CFG.modalId + " .weo-proof-page.is-image-layout .weo-image-url-card{position:absolute;left:7%;right:7%;top:8%;z-index:4;border:1px solid rgba(255,255,255,.28);border-radius:12px;background:rgba(13,18,38,.58);backdrop-filter:blur(3px);padding:8px;color:#fff;}",
      "#" + CFG.modalId + " .weo-proof-page.is-image-layout .weo-image-url-card label{display:block;margin-bottom:4px;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.82);}",
      "#" + CFG.modalId + " .weo-proof-page.is-image-layout .weo-image-url-card input{width:100%;border:1px solid rgba(255,255,255,.3);border-radius:8px;background:rgba(255,255,255,.93);font-size:11px;padding:6px 7px;color:#0d1226;}",
      "#" + CFG.modalId + " .weo-proof-page.is-image-layout .weo-page-title-fixed{right:5.2%;bottom:11%;width:40%;text-align:right;color:rgba(255,253,249,.94);text-shadow:0 2px 16px rgba(0,0,0,.24);}",
      "#" + CFG.modalId + " .weo-proof-page.is-image-layout .weo-proof-copy-pane{position:absolute;left:5.1%;top:21%;bottom:13%;width:34.5%;z-index:4;display:flex;flex-direction:column;min-height:0;}",
      "#" + CFG.modalId + " .weo-proof-page.is-image-layout .weo-day-blurb{margin-bottom:10px;}",
      "#" + CFG.modalId + " .weo-proof-page.is-image-layout .weo-schedule-box{display:flex;flex-direction:column;min-height:0;}",
      "#" + CFG.modalId + " .weo-columns-grid{position:absolute;left:2.6%;right:2.6%;top:8%;bottom:12%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2.6%;z-index:3;}",
      "#" + CFG.modalId + " .weo-column{display:flex;flex-direction:column;min-width:0;min-height:0;}",
      "#" + CFG.modalId + " .weo-column .weo-page-title-fixed{position:static;width:100%;margin:0 0 8px 0;color:#0d1226;}",
      "#" + CFG.modalId + " .weo-opening-field{min-height:72px;margin:0 0 8px 0;padding:6px 7px;font-size:clamp(9px,.88vw,12px);}",
      "#" + CFG.modalId + " .weo-col-schedule{display:flex;flex-direction:column;min-height:0;}",
      "#" + CFG.modalId + " .weo-col-schedule.is-empty{opacity:.82;}",
      "#" + CFG.modalId + " .weo-col-schedule .weo-day-heading{font-family:'Albra Sans',Lato,'Segoe UI',Arial,sans-serif;font-weight:400;font-size:clamp(15px,1.7vw,23px);line-height:1;text-transform:uppercase;padding:5px 7px;margin-top:5px;}",
      "#" + CFG.modalId + " .weo-col-schedule .weo-day-blurb{min-height:54px;}",
      "#" + CFG.modalId + " .weo-editor-help{display:flex;flex-wrap:wrap;align-items:center;gap:6px;border:1px solid #d9e2ec;border-radius:12px;background:#fff;padding:7px 9px;font-size:10px;line-height:1.3;color:#475467;}",
      "#" + CFG.modalId + " .weo-editor-help span{display:inline-flex;align-items:center;border:1px solid #e4e8ef;border-radius:999px;background:#fbfcfe;padding:3px 7px;font-size:10px;font-weight:800;color:#667085;}",
      "#" + CFG.modalId + " .weo-editor-help strong{font-weight:800;color:#101828;}",
      "#" + CFG.modalId + " .weo-editor-help.is-warning{border-color:#fedf89;background:#fffaeb;color:#93370d;}",
      "#" + CFG.modalId + " .weo-btn{border:1px solid #cfd4dc;border-radius:8px;background:#fff;color:#1f2937;cursor:pointer;font-size:10px;font-weight:800;padding:5px 7px;line-height:1.15;}",
      "#" + CFG.modalId + " .weo-btn:hover{background:#f9fafb;}",
      "#" + CFG.modalId + " .weo-btn.is-primary{border-color:#175cd3;background:#175cd3;color:#fff;}",
      "#" + CFG.modalId + " .weo-footer{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding-top:7px;border-top:1px solid #e4e8ef;}",
      "#" + CFG.statusId + "{min-height:13px;font-size:10px;font-weight:700;padding-left:1px;}",
      "#" + CFG.statusId + ".is-error{color:#b42318;}",
      "#" + CFG.statusId + ".is-success{color:#027a48;}",
      "#" + CFG.statusId + ".is-warning{color:#b54708;}",
      "#" + CFG.statusId + ".is-info{color:#175cd3;}",
      "@media(max-width:900px){#" + CFG.modalId + "{width:calc(100vw - 16px);max-height:calc(100vh - 16px);}#" + CFG.overlayId + "{padding:8px;}#" + CFG.modalId + " .weo-layout-strip{display:grid;}#" + CFG.modalId + " .weo-layout-options{width:100%;}#" + CFG.modalId + " .weo-proof-page{min-width:600px;}#" + CFG.modalId + " .weo-canvas-shell{padding:8px;}#" + EDITOR_PREVIEW.dockId + "{display:none!important;}}",
      "@media(max-width:720px){#" + CFG.modalId + " .weo-layout-options{grid-template-columns:1fr;}#" + CFG.modalId + " .weo-footer{flex-direction:column;align-items:stretch;}#" + CFG.modalId + " .weo-footer .weo-btn{width:100%;}}"
    ].join("");

    $("head").append('<style id="' + CFG.stylesId + '">' + css + "</style>");
  }

  function ensureModal() {
    if ($("#" + CFG.overlayId).length) return;

    var html = '' +
      '<div id="' + CFG.overlayId + '">' +
        '<div id="' + CFG.modalId + '" role="dialog" aria-modal="true" aria-labelledby="' + CFG.titleId + '">' +
          '<div class="weo-head">' +
            '<div>' +
              '<div id="' + CFG.titleId + '" class="weo-title">Proposal Page Editor</div>' +
              '<div class="weo-subtitle">Edit the selected proposal page visually. Pick a heading in the supplying list, then open this editor.</div>' +
            '</div>' +
            '<button type="button" class="weo-x" aria-label="Close">&times;</button>' +
          '</div>' +
          '<div class="weo-body">' +
            '<div id="' + CFG.bodyId + '"></div>' +
            '<div id="' + CFG.statusId + '"></div>' +
            '<div class="weo-footer">' +
              '<button type="button" id="' + CFG.closeId + '" class="weo-btn">Cancel</button>' +
              '<button type="button" id="' + CFG.saveId + '" class="weo-btn is-primary">Save changes</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div id="' + EDITOR_PREVIEW.dockId + '" aria-hidden="true"></div>' +
      '</div>';

    $("body").append(html);

    $("#" + CFG.modalId + " .weo-x,#" + CFG.closeId).on("click", requestCloseEditor);
    $("#" + CFG.saveId).on("click", saveEditor);

    $(document).on("keydown.wiseEventOverview", function (e) {
      if (e.key === "Escape" && $("#" + CFG.overlayId).is(":visible")) requestCloseEditor();
    });

    $("#" + CFG.bodyId).on("change", 'input[name="weo-layout"]', function () {
      if (editor.saving) return;
      editor.current = readFormState(editor.current);
      renderEditor(editor.current);
      setStatus("", "");
    });

    $("#" + CFG.bodyId).on("change", 'input[name="wpe-dept-layout"],[data-generic-field="titleSuffix"],[data-generic-field="hidden"],[data-generic-field="additionalOptions"]', function () {
      if (editor.saving || editor.mode !== MODE_GENERIC) return;
      editor.current = readGenericFormState(editor.current);
      renderEditor(editor.current);
      setStatus("", "");
    });

    $("#" + CFG.bodyId).on("change", '[data-generic-field="renderType"]', async function () {
      if (editor.saving || editor.mode !== MODE_GENERIC) return;
      var nextRenderType = String($(this).val() || "");
      if (nextRenderType === "dept" && shouldOpenGenericDeptChildFromSection()) {
        $(this).val("section");
        await openOrCreateGenericDeptChildFromSection();
        return;
      }
      editor.current = readGenericFormState(editor.current);
      renderEditor(editor.current);
      setStatus("", "");
    });

    $("#" + CFG.bodyId).on("input", '[data-field="imageUrl"]', function () {
      var $panel = $(this).closest(".weo-proof-image-panel");
      $panel.find("img").remove();
    });

    $("#" + CFG.bodyId).on("input", '[data-generic-field="technical"]', function () {
      syncGenericPageImagePreview($(this));
    });

    $("#" + CFG.bodyId).on("input", '[data-generic-row-field="imageUrl"]', function () {
      syncGenericRowImagePreview($(this));
    });

    $("#" + CFG.bodyId).on("click", "[data-weo-action]", function (e) {
      e.preventDefault();
      if (editor.saving) return;
      runEditorAction($(this));
    });
  }

  function addToolbarButton() {
    polishToolbarLine();
  }

  function polishToolbarLine() {
    var $host = findToolbarHost();
    if (!$host.length) {
      setTimeout(polishToolbarLine, 1000);
      return;
    }

    $host.addClass("wise-supply-toolbar");
    $("#" + CFG.buttonId + ",#" + CFG.nativeFallbackId).remove();

    var $nativeEdit = findNativeEditButton();
    if ($nativeEdit.length) promoteNativeEditButton($nativeEdit);

    updateToolbarCompression($host);
  }

  function updateToolbarCompression($host) {
    $host = $host && $host.length ? $host : findToolbarHost();
    if (!$host.length) return;

    var host = $host.get(0);
    if (!host) return;

    $host.addClass("wise-supply-toolbar");
    $host.removeClass("is-wise-preview-compact is-wise-preview-tight");

    var previewOpen = isPreviewWindowOpen();
    var available = $host.innerWidth() || host.clientWidth || 0;
    var shouldCompact = previewOpen || available < 860 || host.scrollWidth > host.clientWidth + 2;

    if (shouldCompact) $host.addClass("is-wise-preview-compact");

    var stillOverflowing = host.scrollWidth > host.clientWidth + 2;
    var shouldTighten = stillOverflowing || available < 620;
    if (shouldTighten) $host.addClass("is-wise-preview-tight");
  }

  function isPreviewWindowOpen() {
    var $toggle = $("#wise-doc-preview-toggle").first();
    if ($toggle.length) {
      var aria = String($toggle.attr("aria-pressed") || $toggle.attr("data-active") || "").toLowerCase();
      if (aria === "true" || aria === "1") return true;
      if ($toggle.hasClass("active") || $toggle.hasClass("is-active") || $toggle.hasClass("ui-state-active")) return true;

      var label = $.trim(String($toggle.text() || $toggle.val() || $toggle.attr("title") || $toggle.attr("aria-label") || "")).toLowerCase();
      if (/hide|close|collapse|preview\s+on|preview\s+open/.test(label)) return true;
    }

    var selectors = [
      "#wise-doc-preview", "#wise-doc-preview-panel", "#wise-doc-preview-frame",
      "#doc_preview", "#doc_preview_div", "#preview_pane", "#preview_panel",
      ".wise-doc-preview", ".doc-preview", ".document-preview", ".preview-pane", ".preview_panel"
    ];

    for (var i = 0; i < selectors.length; i++) {
      var $el = $(selectors[i]).filter(":visible").first();
      if (!$el.length) continue;
      if ($el.closest("#" + CFG.overlayId).length) continue;
      var w = $el.outerWidth() || 0;
      var h = $el.outerHeight() || 0;
      if (w > 120 && h > 80) return true;
    }

    return false;
  }

  function findToolbarHost() {
    var $preview = $("#wise-doc-preview-toggle");
    if ($preview.length && $preview.parent().length) return $preview.parent();

    var $edit = findToolbarActionButton(/^edit\b/i);
    if ($edit.length && $edit.parent().length) return $edit.parent();

    var $new = findToolbarActionButton(/^new\b/i);
    if ($new.length && $new.parent().length) return $new.parent();

    return $("#items_tab > div:first-child");
  }

  function findToolbarActionButton(pattern) {
    var $scope = $("#items_tab > div:first-child");
    if (!$scope.length) return $();
    return $scope.find('button,a,[role="button"],input[type="button"],input[type="submit"]').filter(":visible").filter(function () {
      var text = $.trim($(this).text() || $(this).val() || $(this).attr("title") || $(this).attr("aria-label") || "");
      return pattern.test(text);
    }).first();
  }


  function maintainDefaultSupplyingListEditor() {
    addToolbarButton();
    installTreeDefaultOpenHandler();
  }

  function findNativeEditButton() {
    var $scope = $("#items_tab > div:first-child");
    if (!$scope.length) return $();

    return $scope.find('button,a,[role="button"],input[type="button"],input[type="submit"]').filter(":visible").filter(function () {
      var $el = $(this);
      if ($el.closest("#" + CFG.overlayId).length) return false;
      if ($el.is("#" + CFG.buttonId) || $el.is("#" + CFG.nativeFallbackId)) return false;
      if ($el.attr("data-wise-native-edit") === "1") return true;

      var text = $.trim($el.text() || $el.val() || $el.attr("title") || $el.attr("aria-label") || "");
      return /^edit\b/i.test(text);
    }).first();
  }

  function promoteNativeEditButton($nativeEdit) {
    if (!$nativeEdit || !$nativeEdit.length) return;

    $nativeEdit.attr("data-wise-native-edit", "1");
    $nativeEdit.removeClass(CFG.defaultEditClass);
    $nativeEdit.attr("title", "Open HireHop's line editor for the selected supplying-list line");
    $nativeEdit.attr("aria-label", CFG.nativeFallbackLabel);
    setToolbarButtonText($nativeEdit, CFG.nativeFallbackLabel);

    if ($nativeEdit.is("button") || $nativeEdit.attr("role") === "button") {
      $nativeEdit.css({ width: "auto", minWidth: "58px", margin: "0 2px" });
    }
  }

  function ensureNativeFallbackButton($nativeEdit) {
    $("#" + CFG.nativeFallbackId).remove();
  }

  function setToolbarButtonText($button, text) {
    if (!$button || !$button.length) return;
    var value = String(text || "");
    if ($button.is("input")) {
      $button.val(value);
      return;
    }

    var $label = $button.find(".ui-button-text").first();
    if ($label.length) {
      $label.text(value);
      return;
    }

    $button.text(value);
  }

  function installNativeEditCapture(el) {
    if (!el || el.__wiseDefaultEditCaptureInstalled) return;
    el.__wiseDefaultEditCaptureInstalled = true;

    el.addEventListener("click", function (e) {
      if (!CFG.defaultEditEnabled) return;

      if (editor.nativeBypassClick) {
        editor.nativeBypassClick = false;
        return;
      }

      if ($("#" + CFG.overlayId).is(":visible")) return;
      if (!canOpenVisualEditorForCurrentSelection()) return;

      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      openEditor();
    }, true);
  }

  function openNativeLineEditor() {
    var $nativeEdit = findNativeEditButton();
    if (!$nativeEdit.length) {
      setStatus("Native HireHop edit button could not be found.", "warning");
      return;
    }

    editor.nativeBypassClick = true;
    try {
      $nativeEdit.get(0).click();
    } catch (err) {
      editor.nativeBypassClick = false;
      warn("Native line edit fallback failed", err);
      setStatus("Could not open the native line editor.", "error");
    }
  }

  function installTreeDefaultOpenHandler() {
    if (editor.treeDefaultOpenInstalled) return;
    editor.treeDefaultOpenInstalled = true;

    document.addEventListener("dblclick", function (e) {
      if (!CFG.defaultOpenOnTreeDoubleClick) return;
      handleDefaultTreeOpenEvent(e, "dblclick");
    }, true);

    document.addEventListener("keydown", function (e) {
      if (!CFG.defaultOpenOnEnter) return;
      if (e.key !== "Enter") return;
      handleDefaultTreeOpenEvent(e, "enter");
    }, true);
  }

  function handleDefaultTreeOpenEvent(e, reason) {
    if (!CFG.defaultEditEnabled) return;
    if ($("#" + CFG.overlayId).is(":visible")) return;

    var $target = $(e.target);
    if (!$target.closest("#items_tab").length) return;
    if (!$target.closest(".jstree,li.jstree-node,a.jstree-anchor").length) return;

    var tree = getTree();
    if (!tree) return;

    var $li = $target.is("li.jstree-node") ? $target : $target.closest("li.jstree-node");
    if ($li.length) editor.lastClickedNodeId = $.trim(String($li.attr("id") || ""));

    var targetNode = null;
    if ($li.length) {
      try { targetNode = tree.get_node(editor.lastClickedNodeId); } catch (err) { targetNode = null; }
    }

    if (!canOpenVisualEditorForNode(targetNode)) return;

    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    openEditor();
  }

  function canOpenVisualEditorForNode(node) {
    return !!(node && node.data && Number(node.data.kind) === 0);
  }

  function canOpenVisualEditorForCurrentSelection() {
    var tree = getTree();
    if (!tree) return false;

    var selected = getSelectedTreeNode(tree);
    if ((!selected || !selected.id) && editor.lastClickedNodeId) {
      try { selected = tree.get_node(editor.lastClickedNodeId); } catch (e) { selected = null; }
    }

    return canOpenVisualEditorForNode(selected);
  }

  function installTreeClickTracker() {
    $(document).off(".wiseEventOverviewSelection").on(
      "mousedown.wiseEventOverviewSelection click.wiseEventOverviewSelection dblclick.wiseEventOverviewSelection",
      "#items_tab li.jstree-node,#items_tab a.jstree-anchor",
      function () {
        var $li = $(this).is("li.jstree-node") ? $(this) : $(this).closest("li.jstree-node");
        if ($li.length) editor.lastClickedNodeId = $.trim(String($li.attr("id") || ""));
      }
    );
  }

  function openEventOverviewEditor() {
    ensureModal();
    setStatus("", "");
    setSaveEnabled(false);

    try {
      var tree = getTree();
      if (!tree) {
        showMessage("Items list not ready", "The items list could not be detected yet. Open the supplying list and try again.");
        showOverlay();
        return;
      }

      var match = chooseEventOverviewSection(tree);
      if (match.error) {
        showMessage(match.title || "Event Overview not found", match.error);
        showOverlay();
        return;
      }

      editor.rootNode = match.node;
      editor.original = readEventOverviewState(tree, match.node);
      editor.current = clone(editor.original);
      editor.selectedRegionId = "";
      renderEditor(editor.current);
      showOverlay();
    } catch (err) {
      editor.rootNode = null;
      editor.original = null;
      editor.current = null;
      warn("openEditor failed", err);
      showMessage("Could not open Event Overview", getErrorMessage(err, "The editor hit an unexpected error while reading the selected section."));
      showOverlay();
    }
  }

  function requestCloseEditor() {
    if (editor.saving) return;

    if (hasUnsavedEditorChanges()) {
      var discard = window.confirm("Discard your unsaved page editor changes?");
      if (!discard) return;
    }

    closeEditor();
  }

  function closeEditor() {
    if (editor.saving) return;
    closeEditorPreviewPanel();
    $("#" + CFG.overlayId).hide();
    setStatus("", "");
  }

  function showOverlay() {
    $("#" + CFG.overlayId).css("display", "flex");
    editor.previewSuppressed = false;
    ensureEditorPreviewPanelOpen();
    attachEditorPreviewDockSoon();
    refreshEditorPreviewForCurrentHeadingSoon();
  }

  function hideEditorOverlayForNativePopup() {
    closeEditorPreviewPanel();
    $("#" + CFG.overlayId).hide();
  }

  function attachEditorPreviewDockSoon() {
    setTimeout(function () { ensureEditorPreviewPanelOpen(); attachEditorPreviewDock(); }, 10);
    setTimeout(function () { ensureEditorPreviewPanelOpen(); attachEditorPreviewDock(); }, 180);
    setTimeout(function () { ensureEditorPreviewPanelOpen(); attachEditorPreviewDock(); }, 720);
    setTimeout(function () { ensureEditorPreviewPanelOpen(); attachEditorPreviewDock(); }, 1600);
  }

  function ensureEditorPreviewPanelOpen() {
    if (!$("#" + CFG.overlayId).is(":visible")) return;
    if (window.innerWidth < EDITOR_PREVIEW.minViewportWidth) return;
    if (editor.previewSuppressed) return;

    var $toggle = $("#wise-doc-preview-toggle").first();
    if (!$toggle.length) return;

    var $rightPane = $("#" + EDITOR_PREVIEW.previewRightPaneId);
    if ($rightPane.length && $rightPane.is(":visible")) return;

    try { $toggle.get(0).click(); } catch (e) {}
  }

  function attachEditorPreviewDock() {
    var $overlay = $("#" + CFG.overlayId);
    var $dock = $("#" + EDITOR_PREVIEW.dockId);
    var $rightPane = $("#" + EDITOR_PREVIEW.previewRightPaneId);

    if (!$overlay.is(":visible") || !$dock.length) return;
    if (window.innerWidth < EDITOR_PREVIEW.minViewportWidth || !$rightPane.length || !$rightPane.is(":visible")) {
      detachEditorPreviewDock();
      return;
    }

    if (!$("#" + EDITOR_PREVIEW.placeholderId).length) {
      $('<div id="' + EDITOR_PREVIEW.placeholderId + '" style="display:none;"></div>').insertBefore($rightPane);
    }

    if ($rightPane.parent().attr("id") !== EDITOR_PREVIEW.dockId) {
      $dock.empty().append($rightPane);
    }

    prepareDockedPreviewToolbar($dock);
    matchDockedPreviewHeight();
    $overlay.addClass("has-preview-dock");
    editor.previewDocked = true;
    updateToolbarCompression();
  }

  function prepareDockedPreviewToolbar($dock) {
    if (!$dock || !$dock.length) return;

    $dock.find("#wise-doc-preview-refresh").hide();
    $dock.find("#wise-doc-preview-auto").closest("label").hide();
    $dock.find(".wise-doc-preview-render").hide();
    $dock.find("#wise-doc-preview-close").off("click").on("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      closeDockedPreviewFromEditor();
    });
  }

  function matchDockedPreviewHeight() {
    var $dock = $("#" + EDITOR_PREVIEW.dockId);
    var $modal = $("#" + CFG.modalId);
    if (!$dock.length || !$modal.length) return;

    var height = $modal.outerHeight() || 0;
    if (height > 0) $dock.css("height", height + "px");
  }

  function closeDockedPreviewFromEditor() {
    closeEditorPreviewPanel();
  }

  function closeEditorPreviewPanel() {
    editor.previewSuppressed = true;
    detachEditorPreviewDock();
    clearEditorPreviewSelectionOverride();
    setTimeout(function () {
      var $toggle = $("#wise-doc-preview-toggle").first();
      if ($toggle.length && isPreviewWindowOpen()) {
        try { $toggle.get(0).click(); } catch (e) {}
      }
      updateToolbarCompression();
    }, 0);
  }

  function setEditorPreviewSelectionOverride() {
    var tree = getTree();
    var node = editor.rootNode;
    if (tree && node && getNodeDataId(node)) node = findHeadingNodeByDataId(tree, getNodeDataId(node)) || node;
    if (tree && node && getNodeDataId(node)) selectTreeHeadingByDataId(tree, getNodeDataId(node));

    if (node && node.id) {
      window.wiseProposalEditorPreviewSelectionIds = [String(node.id)];
      return;
    }

    clearEditorPreviewSelectionOverride();
  }

  function clearEditorPreviewSelectionOverride() {
    try { delete window.wiseProposalEditorPreviewSelectionIds; } catch (e) { window.wiseProposalEditorPreviewSelectionIds = null; }
  }

  function refreshEditorPreviewForCurrentHeadingSoon() {
    setEditorPreviewSelectionOverride();
    setTimeout(refreshEditorPreviewForCurrentHeading, 260);
    setTimeout(refreshEditorPreviewForCurrentHeading, 1100);
  }

  function refreshEditorPreviewForCurrentHeading() {
    if (!$("#" + CFG.overlayId).is(":visible")) return;
    setEditorPreviewSelectionOverride();

    var $refresh = $("#wise-doc-preview-refresh").first();
    if ($refresh.length && isPreviewWindowOpen()) {
      try { $refresh.get(0).click(); } catch (e) {}
    }
  }

  function detachEditorPreviewDock() {
    var $overlay = $("#" + CFG.overlayId);
    var $dock = $("#" + EDITOR_PREVIEW.dockId);
    var $rightPane = $("#" + EDITOR_PREVIEW.previewRightPaneId);
    var $placeholder = $("#" + EDITOR_PREVIEW.placeholderId);

    if ($rightPane.length && $placeholder.length) {
      $placeholder.before($rightPane);
      $placeholder.remove();
    }

    if ($dock.length) $dock.empty();
    $dock.css("height", "");
    $overlay.removeClass("has-preview-dock");
    editor.previewDocked = false;
  }

  function showMessage(title, message) {
    $("#" + CFG.bodyId).html('<div class="weo-message"><strong>' + esc(title) + "</strong>" + esc(message) + "</div>");
    setSaveEnabled(false);
  }

  function renderEventOverviewEditor(state) {
    state = normaliseVisualEditorState(state || blankState());
    editor.current = state;
    editor.selectedRegionId = "";

    var html = '' +
      '<div class="weo-visual-editor">' +
        visualLayoutSwitchHtml(state) +
        '<div class="weo-canvas-shell">' + visualCanvasHtml(state) + '</div>' +
      '</div>';

    $("#" + CFG.bodyId).html(html);
    setSaveEnabled(true);
    if ($("#" + CFG.overlayId).is(":visible")) {
      attachEditorPreviewDockSoon();
      refreshEditorPreviewForCurrentHeadingSoon();
    }
  }

  function normaliseVisualEditorState(state) {
    state = normaliseEditorState(state || blankState());

    if (state.layout === LAYOUT_COLUMNS) {
      while (state.schedules.length < CFG.maxSchedules) {
        state.schedules.push(blankSchedule(state.schedules.length === 0 ? "Day of event" : ""));
      }
    }

    if (!state.schedules.length) state.schedules = [blankSchedule("Day of event")];
    return state;
  }

  function visualLayoutSwitchHtml(state) {
    var layout = normaliseLayout(state.layout);

    return '' +
      '<div class="weo-layout-strip">' +
        '<div class="weo-layout-options">' +
          visualLayoutPillHtml(LAYOUT_IMAGE, layout, "Image split", "One image-led schedule page. Uses one day only.") +
          visualLayoutPillHtml(LAYOUT_COLUMNS, layout, "Three columns", "No image. Shows up to three day columns.") +
        '</div>' +
        proposalNavigationCardHtml() +
      '</div>';
  }

  function visualLayoutPillHtml(value, current, title, note) {
    return '' +
      '<label class="weo-layout-pill' + (value === current ? ' is-selected' : '') + '">' +
        '<input type="radio" name="weo-layout" value="' + attr(value) + '"' + (value === current ? ' checked' : '') + '>' +
        '<span><b>' + esc(title) + '</b><span>' + esc(note) + '</span></span>' +
      '</label>';
  }

  function visualCanvasHtml(state) {
    return normaliseLayout(state.layout) === LAYOUT_COLUMNS
      ? columnsVisualPageHtml(state)
      : imageVisualPageHtml(state);
  }

  function proofLogoHtml() {
    return '<div class="weo-proof-logo">Wise logo</div>';
  }

  function proofFooterHtml() {
    return '<div class="weo-proof-footer"><span>Event date · Job · Version</span><span>Page no.</span></div>';
  }

  function imageVisualPageHtml(state) {
    var schedule = getScheduleAtIndex(state, 0);
    var imageUrl = $.trim(String(state.imageUrl || ""));

    return '' +
      '<div class="weo-proof-page is-image-layout">' +
        proofLogoHtml() +
        '<div class="weo-proof-image-panel">' +
          '<div class="weo-image-placeholder">Image shown in document preview</div>' +
          '<div class="weo-image-url-card">' +
            '<label>Feature image URL</label>' +
            '<input type="text" data-field="imageUrl" value="' + attr(imageUrl) + '" placeholder="https://...">' +
          '</div>' +
        '</div>' +
        '<div class="weo-page-title-fixed">Event Overview<br>&amp; Schedule</div>' +
        '<div class="weo-proof-copy-pane weo-day-card" data-schedule-index="0" data-schedule-uid="' + attr(schedule.uid) + '" data-schedule-id="' + attr(schedule.id) + '">' +
          '<div class="weo-proof-kicker">The brief</div>' +
          '<textarea class="weo-page-field weo-day-blurb" data-field="scheduleIntro" placeholder="Short brief text shown beside the image.">' + esc(schedule.intro) + '</textarea>' +
          '<div class="weo-schedule-box">' +
            '<input class="weo-page-field weo-day-heading" type="text" data-field="scheduleTitle" value="' + attr(schedule.title) + '" placeholder="Day of event">' +
            visualRowsHtml(schedule, 0) +
            visualScheduleActionsHtml(schedule, 0, false) +
          '</div>' +
        '</div>' +
        proofFooterHtml() +
      '</div>';
  }

  function columnsVisualPageHtml(state) {
    var columns = [];

    for (var i = 0; i < CFG.maxSchedules; i++) {
      var schedule = getScheduleAtIndex(state, i);
      columns.push('' +
        '<div class="weo-column">' +
          (i === 0 ? columnsPageIntroHtml(state) : '') +
          visualScheduleCardHtml(schedule, i) +
        '</div>'
      );
    }

    return '' +
      '<div class="weo-proof-page is-columns-layout">' +
        proofLogoHtml() +
        '<div class="weo-columns-grid">' + columns.join("") + '</div>' +
        proofFooterHtml() +
      '</div>';
  }

  function columnsPageIntroHtml(state) {
    return '' +
      '<div class="weo-page-title-fixed">Event Overview<br>&amp; Schedule</div>' +
      '<div class="weo-proof-kicker">The brief</div>' +
      '<textarea class="weo-page-field weo-opening-field" data-field="openingText" placeholder="Opening text shown above the first column.">' + esc(state.openingText) + '</textarea>';
  }

  function visualScheduleCardHtml(schedule, index) {
    schedule = normaliseSchedule(schedule);

    var classes = ["weo-col-schedule", "weo-day-card"];
    if (!isMeaningfulScheduleState(schedule)) classes.push("is-empty");

    return '' +
      '<div class="' + classes.join(" ") + '" data-schedule-index="' + index + '" data-schedule-uid="' + attr(schedule.uid) + '" data-schedule-id="' + attr(schedule.id) + '">' +
        '<input class="weo-page-field weo-day-heading" type="text" data-field="scheduleTitle" value="' + attr(schedule.title) + '" placeholder="' + attr(index === 0 ? "Day of event" : "Day " + String(index + 1)) + '">' +
        '<textarea class="weo-page-field weo-day-blurb" data-field="scheduleIntro" placeholder="Optional short note below this day heading.">' + esc(schedule.intro) + '</textarea>' +
        visualRowsHtml(schedule, index) +
        visualScheduleActionsHtml(schedule, index, index > 0) +
      '</div>';
  }

  function visualRowsHtml(schedule, scheduleIndex) {
    schedule = normaliseSchedule(schedule);
    var rows = schedule.rows && schedule.rows.length ? schedule.rows : [blankRow()];
    var html = [];

    for (var i = 0; i < rows.length && i < CFG.maxRows; i++) {
      html.push(visualRowHtml(rows[i], scheduleIndex, i));
    }

    return '<div class="weo-time-list">' + html.join("") + '</div>';
  }

  function visualRowHtml(row, scheduleIndex, rowIndex) {
    row = normaliseRow(row);

    return '' +
      '<div class="weo-time-row" data-row-index="' + rowIndex + '" data-row-uid="' + attr(row.uid) + '" data-row-id="' + attr(row.id) + '">' +
        '<input class="weo-page-field" type="text" data-field="rowTime" value="' + attr(row.time) + '" placeholder="09:00" maxlength="32">' +
        '<span class="weo-row-sep">–</span>' +
        '<input class="weo-page-field" type="text" data-field="rowText" value="' + attr(row.text) + '" placeholder="What happens?">' +
        '<button type="button" class="weo-mini-remove" data-weo-action="remove-row" data-schedule-index="' + scheduleIndex + '" data-row-index="' + rowIndex + '" aria-label="Remove time row">&times;</button>' +
      '</div>';
  }

  function visualScheduleActionsHtml(schedule, index, canClear) {
    var liveRows = getRowsToSave(schedule).length;

    return '' +
      '<div class="weo-card-actions">' +
        '<button type="button" class="weo-page-mini-btn" data-weo-action="add-row" data-schedule-index="' + index + '"' + ((schedule.rows || []).length >= CFG.maxRows ? ' disabled' : '') + '>+ Add time</button>' +
        '<span class="weo-row-count">' + esc(String(liveRows) + " / " + String(CFG.maxRows)) + '</span>' +
        (canClear ? '<button type="button" class="weo-page-mini-btn is-danger" data-weo-action="clear-schedule" data-schedule-index="' + index + '">Clear</button>' : '') +
      '</div>';
  }

  function visualEditorHelpHtml(state) {
    var active = getActiveSchedules(state);
    var warning = state.layout === LAYOUT_IMAGE && active.length > 1;

    if (warning) {
      return '<div class="weo-editor-help is-warning"><strong>Image split saves one schedule only.</strong> Extra active days are not hidden by the document renderer; they would create extra overview pages. This editor will keep the first day only when saved.</div>';
    }

    return '' +
      '<div class="weo-editor-help">' +
        '<span>Fixed title</span>' +
        '<span>Locked page layout</span>' +
        '<span>Clean text fields</span>' +
        '<strong>Tip:</strong> times render as “09:00 - description” in the final proposal.' +
      '</div>';
  }

  function runEventOverviewEditorAction($btn) {
    var action = String($btn.attr("data-weo-action") || "");
    var scheduleIndex = toInt($btn.attr("data-schedule-index"), -1);
    var rowIndex = toInt($btn.attr("data-row-index"), -1);
    var state = readFormState(editor.current);

    if (action === "navigate-prev") {
      navigateProposalEditor(-1);
      return;
    }

    if (action === "navigate-next") {
      navigateProposalEditor(1);
      return;
    }

    if (scheduleIndex >= 0) {
      while (state.schedules.length <= scheduleIndex && state.schedules.length < CFG.maxSchedules) {
        state.schedules.push(blankSchedule(state.schedules.length === 0 ? "Day of event" : ""));
      }
    }

    if (action === "add-row" && scheduleIndex >= 0 && state.schedules[scheduleIndex]) {
      var rows = state.schedules[scheduleIndex].rows || [];
      if (rows.length >= CFG.maxRows) {
        setStatus("Each schedule can have up to " + CFG.maxRows + " times.", "warning");
        return;
      }
      rows.push(blankRow());
      state.schedules[scheduleIndex].rows = rows;
    }

    if (action === "remove-row" && scheduleIndex >= 0 && state.schedules[scheduleIndex]) {
      var targetRows = state.schedules[scheduleIndex].rows || [];
      if (rowIndex >= 0 && rowIndex < targetRows.length) targetRows.splice(rowIndex, 1);
      if (!targetRows.length) targetRows.push(blankRow());
      state.schedules[scheduleIndex].rows = targetRows;
    }

    if (action === "clear-schedule" && scheduleIndex > 0 && state.schedules[scheduleIndex]) {
      state.schedules[scheduleIndex] = blankSchedule("");
    }

    editor.current = normaliseVisualEditorState(state);
    editor.selectedRegionId = "";
    renderEditor(editor.current);
    setStatus("", "");
  }

  function readEventOverviewFormState(previous) {
    var prior = normaliseVisualEditorState(previous || editor.current || blankState());
    var state = clone(prior);
    var $body = $("#" + CFG.bodyId);
    var checkedLayout = $body.find('input[name="weo-layout"]:checked').val();

    state.layout = normaliseLayout(checkedLayout || state.layout);

    var $image = $body.find('[data-field="imageUrl"]').first();
    state.imageUrl = $image.length ? $.trim(String($image.val() || "")) : $.trim(String(prior.imageUrl || ""));

    var $opening = $body.find('[data-field="openingText"]').first();
    state.openingText = $opening.length ? String($opening.val() || "") : String(prior.openingText || "");

    var nextSchedules = Array.isArray(prior.schedules) ? prior.schedules.slice(0, CFG.maxSchedules).map(normaliseSchedule) : [];
    if (!nextSchedules.length) nextSchedules.push(blankSchedule("Day of event"));

    $body.find(".weo-day-card[data-schedule-uid]").each(function () {
      var $card = $(this);
      var scheduleIndex = toInt($card.attr("data-schedule-index"), -1);
      if (scheduleIndex < 0 || scheduleIndex >= CFG.maxSchedules) return;

      while (nextSchedules.length <= scheduleIndex) {
        nextSchedules.push(blankSchedule(scheduleIndex === 0 ? "Day of event" : ""));
      }

      var oldSchedule = normaliseSchedule(nextSchedules[scheduleIndex] || {});
      var oldRows = indexByUid(oldSchedule.rows || []);
      var rows = [];

      $card.find("[data-row-uid]").each(function () {
        var $row = $(this);
        var rowUid = String($row.attr("data-row-uid") || newUid("row"));
        var oldRow = oldRows[rowUid] || {};
        var time = $.trim(String($row.find('[data-field="rowTime"]').val() || ""));
        var text = $.trim(String($row.find('[data-field="rowText"]').val() || ""));

        rows.push(normaliseRow({
          uid: rowUid,
          id: String($row.attr("data-row-id") || oldRow.id || ""),
          time: time,
          text: text,
          title: composeRowTitle(time, text),
          note: oldRow.note || getSnapshotField(oldRow.nodeData, "ADDITIONAL") || "",
          memo: oldRow.memo || getSnapshotField(oldRow.nodeData, "TECHNICAL") || "",
          nodeData: oldRow.nodeData || null
        }));
      });

      if (!rows.length) rows.push(blankRow());

      nextSchedules[scheduleIndex] = normaliseSchedule({
        uid: String($card.attr("data-schedule-uid") || oldSchedule.uid || newUid("schedule")),
        id: String($card.attr("data-schedule-id") || oldSchedule.id || ""),
        title: cleanHeadingTitle($card.find('[data-field="scheduleTitle"]').first().val()),
        intro: String($card.find('[data-field="scheduleIntro"]').first().val() || ""),
        baseMemo: oldSchedule.baseMemo || "",
        meta: oldSchedule.meta || null,
        nodeData: oldSchedule.nodeData || null,
        rows: rows
      });
    });

    if (state.layout === LAYOUT_IMAGE) {
      state.schedules = [normaliseSchedule(nextSchedules[0] || blankSchedule("Day of event"))];
    } else {
      while (nextSchedules.length < CFG.maxSchedules) {
        nextSchedules.push(blankSchedule(nextSchedules.length === 0 ? "Day of event" : ""));
      }
      state.schedules = nextSchedules.slice(0, CFG.maxSchedules).map(normaliseSchedule);
    }

    return normaliseVisualEditorState(state);
  }

  function hasEventOverviewUnsavedEditorChanges() {
    if (!editor.original) return false;
    if (!$("#" + CFG.overlayId).is(":visible")) return false;
    if (!hasEditableEditorForm()) return false;

    var currentState = readFormState(editor.current || editor.original || blankState());
    return buildEditorStateSignature(currentState) !== buildEditorStateSignature(editor.original || blankState());
  }

  function hasEditableEditorForm() {
    var $body = $("#" + CFG.bodyId);
    return !!$body.find('[data-field="imageUrl"], [data-field="openingText"], [data-schedule-uid]').length;
  }

  function buildEditorStateSignature(state) {
    state = normaliseEditorState(state || blankState());
    var schedules = getComparableSchedules(state);
    var signature = {
      layout: normaliseLayout(state.layout),
      imageUrl: $.trim(String(state.imageUrl || "")),
      openingText: $.trim(String(state.openingText || "")),
      schedules: []
    };

    for (var i = 0; i < schedules.length; i++) {
      var schedule = normaliseSchedule(schedules[i]);
      var rows = getRowsToSave(schedule).map(function (row) {
        row = normaliseRow(row);
        return {
          time: $.trim(String(row.time || "")),
          text: $.trim(String(row.text || ""))
        };
      });

      signature.schedules.push({
        id: String(schedule.id || ""),
        title: $.trim(String(schedule.title || "")),
        intro: $.trim(String(schedule.intro || "")),
        rows: rows
      });
    }

    return JSON.stringify(signature);
  }

  function getComparableSchedules(state) {
    var schedules = Array.isArray(state && state.schedules) ? state.schedules.slice(0, CFG.maxSchedules).map(normaliseSchedule) : [];

    while (schedules.length > 1 && !isMeaningfulScheduleState(schedules[schedules.length - 1])) {
      schedules.pop();
    }

    return schedules;
  }

  function validateEventOverviewState(state) {
    state = normaliseEditorState(state);
    var active = getActiveSchedules(state);

    if (state.layout === LAYOUT_IMAGE && !$.trim(state.imageUrl)) {
      return "Add an image link for this layout.";
    }

    if (!active.length) return "Add at least one schedule.";
    if (active.length > CFG.maxSchedules) return "Use no more than three schedules.";

    for (var i = 0; i < active.length; i++) {
      var schedule = active[i];
      var title = $.trim(schedule.title || "");
      var rows = getRowsToSave(schedule);

      if (!title) return "Each schedule needs a title.";
      if (!rows.length) return "“" + title + "” needs at least one time.";
      if (rows.length > CFG.maxRows) return "Keep each schedule to " + CFG.maxRows + " times or fewer.";

      for (var r = 0; r < rows.length; r++) {
        if (!$.trim(rows[r].time) || !$.trim(rows[r].text)) {
          return "Each schedule row needs both a time and a description.";
        }
      }
    }

    return "";
  }

  async function saveEventOverviewEditor() {
    await persistEventOverviewStateIfNeeded({
      savingMessage: "Saving changes...",
      successMessage: "Saved.",
      errorMessage: "Could not save changes.",
      missingNodeMessage: "Could not find “" + CFG.requiredRawSectionName + "” before saving.",
      rerender: true,
      refreshList: true
    });
  }

  async function persistEventOverviewStateIfNeeded(options) {
    options = options || {};
    if (editor.saving) return { ok: false };

    var state = readFormState(editor.current);
    var error = validateEventOverviewState(state);
    if (error) {
      setStatus(error, "error");
      return { ok: false };
    }

    var tree = getTree();
    if (!tree || !editor.rootNode) {
      setStatus(options.missingNodeMessage || "Could not find the Event Overview page before saving.", "error");
      return { ok: false };
    }

    var changed = buildEditorStateSignature(state) !== buildEditorStateSignature(editor.original || blankState());
    if (!changed) {
      editor.current = clone(state);
      if (options.rerender !== false) renderEditor(editor.current);
      if (options.successMessage) setStatus(options.successMessage, "success");
      if (options.refreshPreview !== false) refreshEditorPreviewForCurrentHeadingSoon();
      return { ok: true, changed: false, state: normaliseEditorState(state), tree: tree };
    }

    var jobId = getCurrentJobId();
    if (!jobId) {
      setStatus("Could not detect the current job ID.", "error");
      return { ok: false };
    }

    var rootId = state.rootId || getNodeDataId(editor.rootNode);
    var rootNode = findHeadingNodeByDataId(tree, rootId) || getEventOverviewRootForSelection(tree, editor.rootNode);
    if (!rootNode) {
      var match = chooseEventOverviewSection(tree);
      rootNode = match && !match.error ? match.node : null;
    }
    if (!rootNode) {
      setStatus(options.missingNodeMessage || "Could not find the Event Overview page before saving.", "error");
      return { ok: false };
    }

    editor.saving = true;
    setBusy(true);
    setStatus(options.savingMessage || "Saving changes...", "info");

    try {
      var savedState = await applyEventOverviewState(jobId, tree, rootNode, state);
      savedState.mode = MODE_EVENT_OVERVIEW;
      editor.original = clone(savedState);
      editor.current = clone(savedState);
      if (options.rerender !== false) renderEditor(editor.current);
      if (options.successMessage) setStatus(options.successMessage, "success");
      if (options.refreshList) {
        refreshSupplyingList();
        setTimeout(refreshSupplyingList, 900);
      }
      if (options.refreshPreview !== false) refreshEditorPreviewForCurrentHeadingSoon();
      return { ok: true, changed: true, state: savedState, tree: tree };
    } catch (err) {
      warn("Event Overview save failed", err);
      setStatus(getErrorMessage(err, options.errorMessage || "Could not save changes."), "error");
      return { ok: false, error: err };
    } finally {
      editor.saving = false;
      setBusy(false);
    }
  }

  async function applyEventOverviewState(jobId, tree, rootNode, nextState) {
    var saved = normaliseEditorState(clone(nextState));
    var original = normaliseEditorState(editor.original || blankState());
    var schedulesToSave = getSchedulesToSave(saved);
    var originalById = indexById(original.schedules);
    var nextIds = [];

    for (var i = 0; i < schedulesToSave.length; i++) {
      var schedule = schedulesToSave[i];
      var originalSchedule = schedule.id ? originalById[schedule.id] : null;

      if (!schedule.id) {
        setStatus("Creating “" + schedule.title + "”...", "info");
        var created = await saveHeadingItemDirect({
          jobId: jobId,
          id: "",
          parentId: getNodeDataId(rootNode),
          renderType: "dept",
          title: schedule.title,
          desc: schedule.intro,
          memo: "",
          flag: getSnapshotFlag(schedule.nodeData),
          customFields: getSnapshotCustomFields(schedule.nodeData)
        });
        schedule.id = String(created.id || "");
        schedule.nodeData = extendSnapshot(schedule.nodeData, { ID: schedule.id });
      }

      setStatus("Saving “" + schedule.title + "” times...", "info");
      schedule.rows = await saveScheduleRows(jobId, schedule, originalSchedule);

      var itemIds = schedule.rows.map(function (row) { return row.id; }).filter(Boolean);
      schedule.meta = buildScheduleMeta(saved, schedule, i, itemIds, originalSchedule && originalSchedule.meta && originalSchedule.meta.updatedAt);

      var storageBaseMemo = getScheduleBaseMemoForSave(saved, schedule, i);
      var memo = composeStoredPageMetaText(storageBaseMemo, schedule.meta);

      if (scheduleNeedsSave(schedule, originalSchedule, memo)) {
        schedule.meta.updatedAt = formatLocalDateTime(new Date());
        memo = composeStoredPageMetaText(storageBaseMemo, schedule.meta);
        setStatus("Saving “" + schedule.title + "”...", "info");
        var updated = await saveHeadingItemDirect({
          jobId: jobId,
          id: schedule.id,
          parentId: getNodeDataId(rootNode),
          renderType: "dept",
          title: schedule.title,
          desc: schedule.intro,
          memo: memo,
          flag: getSnapshotFlag(schedule.nodeData),
          customFields: getSnapshotCustomFields(schedule.nodeData)
        });
        schedule.id = String(updated.id || schedule.id || "");
      }

      schedule.baseMemo = storageBaseMemo;
      schedule.nodeData = extendSnapshot(schedule.nodeData, { ID: schedule.id, TECHNICAL: memo, DESCRIPTION: schedule.intro });
      nextIds.push(schedule.id);
    }

    await deleteRemovedSchedules(jobId, original, nextIds);

    saved.schedules = mergeSavedSchedules(saved.schedules, schedulesToSave);
    saved.rootMeta = buildRootMeta(saved, nextIds, original.rootMeta && original.rootMeta.updatedAt);
    var rootMemo = composeStoredPageMetaText(saved.rootBaseMemo || "", saved.rootMeta);

    if (rootNeedsSave(saved, original, rootMemo)) {
      saved.rootMeta.updatedAt = formatLocalDateTime(new Date());
      rootMemo = composeStoredPageMetaText(saved.rootBaseMemo || "", saved.rootMeta);
      setStatus("Saving page settings...", "info");
      await saveHeadingItemDirect({
        jobId: jobId,
        id: getNodeDataId(rootNode),
        parentId: getParentHeadingDataId(tree, rootNode),
        rawName: getNodeRawTitle(rootNode),
        renderType: "section",
        title: CFG.sectionName,
        desc: saved.openingText || "",
        memo: rootMemo,
        flag: getNodeFlag(rootNode),
        customFields: getNodeCustomFields(rootNode)
      });
    }

    return normaliseEditorState(saved);
  }

  function getScheduleBaseMemoForSave(state, schedule, index) {
    var base = stripImageUrlsFromMemo(schedule.baseMemo || "");
    var imageUrl = $.trim(String(state.imageUrl || ""));

    if (state.layout === LAYOUT_IMAGE && index === 0 && imageUrl) {
      return $.trim(imageUrl + (base ? "\n\n" + base : ""));
    }

    return base;
  }

  function stripImageUrlsFromMemo(text) {
    return $.trim(String(text || "")
      .replace(/https?:\/\/[^\s"'<>]+/ig, "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n"));
  }

  async function saveScheduleRows(jobId, schedule, originalSchedule) {
    var rowsToSave = getRowsToSave(schedule);
    var originalRows = indexById(originalSchedule ? originalSchedule.rows : []);
    var keepIds = [];
    var savedRows = [];

    for (var i = 0; i < rowsToSave.length; i++) {
      var row = rowsToSave[i];
      var originalRow = row.id ? originalRows[row.id] : null;

      if (!row.id || rowNeedsSave(row, originalRow)) {
        var result = await saveCustomItemDirect({
          jobId: jobId,
          parentId: schedule.id,
          row: row,
          sourceData: row.nodeData || {}
        });
        row.id = String(result.id || row.id || "");
        row.nodeData = extendSnapshot(row.nodeData, {
          ID: row.id,
          title: composeRowTitle(row.time, row.text),
          ADDITIONAL: row.note || "",
          TECHNICAL: row.memo || ""
        });
      }

      keepIds.push(row.id);
      savedRows.push(row);
    }

    var deleteIds = [];
    if (originalSchedule && originalSchedule.rows) {
      for (var d = 0; d < originalSchedule.rows.length; d++) {
        var oldId = originalSchedule.rows[d] && originalSchedule.rows[d].id;
        if (oldId && keepIds.indexOf(oldId) === -1) deleteIds.push(oldId);
      }
    }

    if (deleteIds.length) {
      setStatus("Removing deleted times...", "info");
      await deleteItemsDirect(deleteIds, jobId, 3);
    }

    return savedRows.length ? savedRows : [blankRow()];
  }

  async function deleteRemovedSchedules(jobId, original, nextIds) {
    var idsToKeep = nextIds || [];
    var schedules = original.schedules || [];

    for (var i = 0; i < schedules.length; i++) {
      var schedule = schedules[i];
      if (!schedule || !schedule.id || idsToKeep.indexOf(schedule.id) !== -1) continue;

      var rowIds = getRowsToSave(schedule).map(function (row) { return row.id; }).filter(Boolean);
      if (rowIds.length) {
        setStatus("Removing deleted schedule times...", "info");
        await deleteItemsDirect(rowIds, jobId, 3);
      }

      setStatus("Removing deleted schedule...", "info");
      await deleteItemsDirect([schedule.id], jobId, 0);
    }
  }

  function mergeSavedSchedules(allSchedules, savedSchedules) {
    var savedByUid = indexByUid(savedSchedules);
    var merged = [];

    for (var i = 0; i < allSchedules.length; i++) {
      var schedule = allSchedules[i];
      if (savedByUid[schedule.uid]) merged.push(savedByUid[schedule.uid]);
      else if (isScheduleActive(schedule)) merged.push(schedule);
      else merged.push(schedule);
    }

    return merged.slice(0, CFG.maxSchedules);
  }

  function rowNeedsSave(row, originalRow) {
    if (!originalRow) return true;
    return composeRowTitle(row.time, row.text) !== composeRowTitle(originalRow.time, originalRow.text) ||
      String(row.note || "") !== String(originalRow.note || "") ||
      String(row.memo || "") !== String(originalRow.memo || "");
  }

  function scheduleNeedsSave(schedule, originalSchedule, memo) {
    if (!originalSchedule) return true;
    return String(schedule.title || "") !== String(originalSchedule.title || "") ||
      String(schedule.intro || "") !== String(originalSchedule.intro || "") ||
      String(memo || "") !== composeStoredPageMetaText(originalSchedule.baseMemo || "", originalSchedule.meta || null);
  }

  function rootNeedsSave(saved, original, rootMemo) {
    return String(saved.openingText || "") !== String(original.openingText || "") ||
      String(rootMemo || "") !== composeStoredPageMetaText(original.rootBaseMemo || "", original.rootMeta || null);
  }

  function buildRootMeta(state, scheduleIds, previousUpdatedAt) {
    return {
      editor: "eventOverview",
      profileKey: CFG.profileKey,
      templateKey: CFG.rootTemplateKey,
      version: 2,
      layout: state.layout,
      variant: layoutToVariant(state.layout),
      imageUrl: state.layout === LAYOUT_IMAGE ? $.trim(state.imageUrl || "") : "",
      scheduleHeadingIds: normaliseIdList(scheduleIds),
      updatedAt: previousUpdatedAt || formatLocalDateTime(new Date())
    };
  }

  function buildScheduleMeta(state, schedule, index, itemIds, previousUpdatedAt) {
    return {
      editor: "eventOverview",
      profileKey: CFG.profileKey,
      templateKey: CFG.deptTemplateKey,
      parentTemplateKey: CFG.rootTemplateKey,
      slotKey: SLOT_KEYS[index] || SLOT_KEYS[0],
      columnIndex: index,
      version: 2,
      layout: state.layout,
      variant: layoutToVariant(state.layout),
      imageUrl: state.layout === LAYOUT_IMAGE && index === 0 ? $.trim(state.imageUrl || "") : "",
      blurbSource: state.layout === LAYOUT_COLUMNS ? "section_description" : "dept_description",
      scheduleFormat: "time_text_custom_items",
      maxScheduleRows: CFG.maxRows,
      headingId: String(schedule.id || ""),
      itemIds: normaliseIdList(itemIds),
      updatedAt: previousUpdatedAt || formatLocalDateTime(new Date())
    };
  }

  function readEventOverviewState(tree, rootNode) {
    var rootMetaInfo = extractStoredPageMeta(getNodeTechnical(rootNode));
    var rootMeta = normaliseMeta(rootMetaInfo.meta) || {};
    var childHeadings = getDirectChildHeadingNodes(tree, rootNode);
    var schedules = [];

    for (var i = 0; i < childHeadings.length && schedules.length < CFG.maxSchedules; i++) {
      schedules.push(readScheduleState(tree, childHeadings[i]));
    }

    if (!schedules.length) schedules.push(blankSchedule("Day of event"));

    var firstScheduleMeta = normaliseMeta(schedules[0] && schedules[0].meta) || {};
    var firstMemoUrl = schedules[0] ? extractFirstUrl(schedules[0].baseMemo || getSnapshotField(schedules[0].nodeData, "TECHNICAL")) : "";
    var imageUrl = $.trim(String(rootMeta.imageUrl || firstScheduleMeta.imageUrl || firstMemoUrl || ""));
    var explicitLayout = rootMeta.layout || rootMeta.variant || firstScheduleMeta.layout || firstScheduleMeta.variant || "";
    var layout = explicitLayout ? normaliseLayout(explicitLayout) : (imageUrl ? LAYOUT_IMAGE : LAYOUT_COLUMNS);
    if (!explicitLayout && childHeadings.length > 1) layout = LAYOUT_COLUMNS;

    return normaliseEditorState({
      rootId: getNodeDataId(rootNode),
      rootBaseMemo: rootMetaInfo.baseText || "",
      rootMeta: rootMeta,
      layout: layout,
      imageUrl: imageUrl,
      openingText: getNodeDescription(rootNode),
      schedules: schedules,
      extraHeadingCount: Math.max(0, childHeadings.length - CFG.maxSchedules)
    });
  }

  function readScheduleState(tree, headingNode) {
    var metaInfo = extractStoredPageMeta(getNodeTechnical(headingNode));
    var rows = getDirectChildCustomNodes(tree, headingNode).slice(0, CFG.maxRows).map(readRowState);

    return normaliseSchedule({
      uid: newUid("schedule"),
      id: getNodeDataId(headingNode),
      title: getNodeTitle(headingNode),
      intro: getNodeDescription(headingNode),
      baseMemo: metaInfo.baseText || "",
      meta: normaliseMeta(metaInfo.meta),
      nodeData: cloneItemSnapshot(headingNode.data),
      rows: rows.length ? rows : [blankRow()]
    });
  }

  function readRowState(node) {
    var title = node && node.data ? String(node.data.title || node.data.TITLE || node.text || "") : "";
    var parsed = parseRowTitle(title);

    return normaliseRow({
      uid: newUid("row"),
      id: node && node.data ? String(node.data.ID || "") : "",
      time: parsed.time,
      text: parsed.text,
      title: composeRowTitle(parsed.time, parsed.text),
      note: node && node.data ? String(node.data.ADDITIONAL || "") : "",
      memo: node && node.data ? String(node.data.TECHNICAL || "") : "",
      nodeData: node && node.data ? cloneItemSnapshot(node.data) : null
    });
  }

  function chooseEventOverviewSection(tree) {
    var matches = getAllHeadingNodes(tree).filter(isEventOverviewSection);
    var selectedRoot = getSelectedEventOverviewRoot(tree);

    if (selectedRoot) return { node: selectedRoot };

    if (!matches.length) {
      return { title: "Event Overview not found", error: "Select the Event Overview section or add a hidden section called “" + CFG.requiredRawSectionName + "” to the supplying list." };
    }

    if (matches.length === 1) return { node: matches[0] };

    return {
      title: "More than one Event Overview found",
      error: "There should only be one “" + CFG.requiredRawSectionName + "” section. Select the one you want to edit, then open this editor again."
    };
  }

  function isEventOverviewSection(node) {
    if (!node || !node.data || Number(node.data.kind) !== 0) return false;
    var heading = parseHeadingBaseMeta(getNodeRawTitle(node));
    return heading.hidden === true && heading.renderType === "section" && normaliseText(heading.name) === normaliseText(CFG.sectionName);
  }

  function isNamedEventOverviewSection(node) {
    if (!node || !node.data || Number(node.data.kind) !== 0) return false;
    return normaliseText(getNodeTitle(node)) === normaliseText(CFG.sectionName);
  }

  function isEventOverviewRootMetaNode(node) {
    if (!node || !node.data || Number(node.data.kind) !== 0) return false;
    var metaInfo = extractStoredPageMeta(getNodeTechnical(node));
    var meta = normaliseMeta(metaInfo.meta);
    return !!(meta && String(meta.templateKey || "") === CFG.rootTemplateKey);
  }

  function isEventOverviewDeptNode(node) {
    if (!node || !node.data || Number(node.data.kind) !== 0) return false;

    var metaInfo = extractStoredPageMeta(getNodeTechnical(node));
    var meta = normaliseMeta(metaInfo.meta);
    if (meta && String(meta.templateKey || "") === CFG.deptTemplateKey) return true;

    return normaliseText(getNodeTitle(node)) === normaliseText("Proposed Timings");
  }

  function isSelectableEventOverviewRoot(node) {
    return isEventOverviewSection(node) || isNamedEventOverviewSection(node) || isEventOverviewRootMetaNode(node);
  }

  function findEventOverviewAncestor(tree, node) {
    var current = node;
    while (current && current.id && current.id !== "#") {
      if (isSelectableEventOverviewRoot(current)) return current;
      var parentId = tree.get_parent(current);
      if (!parentId || parentId === "#") break;
      current = tree.get_node(parentId);
    }
    return null;
  }

  function getSelectedEventOverviewRoot(tree) {
    var selected = getSelectedTreeNode(tree);
    if (!selected) return null;

    var headingNode = selected;
    if (!headingNode.data || Number(headingNode.data.kind) !== 0) {
      headingNode = getParentHeadingNode(tree, headingNode);
    }
    if (!headingNode) return null;

    if (isSelectableEventOverviewRoot(headingNode)) return headingNode;

    var parentHeading = getParentHeadingNode(tree, headingNode);
    if (isEventOverviewDeptNode(headingNode) && parentHeading) return parentHeading;
    if (parentHeading && isSelectableEventOverviewRoot(parentHeading)) return parentHeading;

    return findEventOverviewAncestor(tree, headingNode);
  }

  function getTree() {
    var $trees = $("#items_tab").find(".jstree");
    for (var i = 0; i < $trees.length; i++) {
      try {
        var tree = $($trees[i]).jstree(true);
        if (tree) return tree;
      } catch (e) {}
    }
    return null;
  }

  function getAllTreeNodes(tree) {
    var out = [];
    var seen = {};

    function add(node) {
      if (!node || !node.id || node.id === "#" || seen[node.id]) return;
      seen[node.id] = true;
      out.push(node);
    }

    try {
      if (tree && typeof tree.get_json === "function") {
        var flat = tree.get_json("#", { flat: true }) || [];
        for (var i = 0; i < flat.length; i++) add(tree.get_node(flat[i].id));
      }
    } catch (e) {}

    try {
      if (tree && tree._model && tree._model.data) {
        $.each(tree._model.data, function (id, node) { add(node); });
      }
    } catch (e2) {}

    return out;
  }

  function getAllHeadingNodes(tree) {
    return getAllTreeNodes(tree).filter(function (node) {
      return !!(node && node.data && Number(node.data.kind) === 0);
    });
  }

  function getSelectedTreeNodes(tree) {
    var nodes = [];
    var seen = {};

    if (tree && typeof tree.get_selected === "function") {
      var selected = tree.get_selected(true) || [];
      for (var i = 0; i < selected.length; i++) {
        addTreeNode(selected[i], nodes, seen);
      }
    }

    collectTreeNodesFromDom(tree, $("#items_tab .jstree-clicked"), nodes, seen);

    if (!nodes.length) {
      collectTreeNodesFromDom(
        tree,
        $("#items_tab li.jstree-node.jstree-clicked, #items_tab li.jstree-selected, #items_tab li[aria-selected='true'], #items_tab a.jstree-anchor[aria-selected='true']"),
        nodes,
        seen
      );
    }

    if (!nodes.length && editor.lastClickedNodeId) {
      addTreeNode(tree.get_node(editor.lastClickedNodeId), nodes, seen);
    }

    if (!nodes.length && document.activeElement) {
      collectTreeNodesFromDom(tree, $(document.activeElement), nodes, seen);
    }

    if (nodes.length > 1 && editor.lastClickedNodeId) {
      var lastClickedNode = tree.get_node(editor.lastClickedNodeId);
      if (lastClickedNode && lastClickedNode.id) return [lastClickedNode];
    }

    return nodes;
  }

  function collectTreeNodesFromDom(tree, $elements, out, seen) {
    if (!tree || !$elements || !$elements.length) return;

    $elements.each(function () {
      var $li = $(this).is("li.jstree-node") ? $(this) : $(this).closest("li.jstree-node");
      if (!$li.length) return;
      addTreeNode(tree.get_node($.trim(String($li.attr("id") || ""))), out, seen);
    });
  }

  function addTreeNode(node, out, seen) {
    if (!node || !node.id || seen[node.id]) return;
    seen[node.id] = true;
    out.push(node);
  }

  function getSelectedTreeNode(tree) {
    var nodes = getSelectedTreeNodes(tree);
    return nodes.length ? nodes[0] : null;
  }

  function getDirectChildNodes(tree, node) {
    var children = [];
    if (!tree || !node || !node.children) return children;

    for (var i = 0; i < node.children.length; i++) {
      var child = tree.get_node(node.children[i]);
      if (child && child.id) children.push(child);
    }

    return children;
  }

  function getDirectChildHeadingNodes(tree, node) {
    return getDirectChildNodes(tree, node).filter(function (child) {
      return !!(child && child.data && Number(child.data.kind) === 0);
    });
  }

  function getDirectChildCustomNodes(tree, node) {
    return getDirectChildNodes(tree, node).filter(function (child) {
      return !!(child && child.data && Number(child.data.kind) === 3);
    });
  }

  function getParentHeadingNode(tree, node) {
    if (!tree || !node) return null;
    var parentId = tree.get_parent(node);
    while (parentId && parentId !== "#") {
      var parent = tree.get_node(parentId);
      if (parent && parent.data && Number(parent.data.kind) === 0) return parent;
      parentId = parent ? tree.get_parent(parent) : "#";
    }
    return null;
  }

  function getParentHeadingDataId(tree, node) {
    var parent = getParentHeadingNode(tree, node);
    return parent && parent.data ? String(parent.data.ID || "0") : "0";
  }

  function normaliseEditorState(state) {
    state = state || {};
    var schedules = Array.isArray(state.schedules) ? state.schedules.slice(0, CFG.maxSchedules).map(normaliseSchedule) : [];
    if (!schedules.length) schedules.push(blankSchedule("Day of event"));

    return {
      rootId: String(state.rootId || ""),
      rootBaseMemo: String(state.rootBaseMemo || ""),
      rootMeta: normaliseMeta(state.rootMeta),
      layout: normaliseLayout(state.layout),
      imageUrl: $.trim(String(state.imageUrl || "")),
      openingText: String(state.openingText || ""),
      schedules: schedules,
      extraHeadingCount: Math.max(0, Number(state.extraHeadingCount || 0))
    };
  }

  function normaliseSchedule(schedule) {
    schedule = schedule || {};
    var rows = Array.isArray(schedule.rows) ? schedule.rows.slice(0, CFG.maxRows).map(normaliseRow) : [];
    if (!rows.length) rows.push(blankRow());

    return {
      uid: String(schedule.uid || newUid("schedule")),
      id: String(schedule.id || ""),
      title: cleanHeadingTitle(schedule.title || ""),
      intro: String(schedule.intro || ""),
      baseMemo: String(schedule.baseMemo || ""),
      meta: schedule.meta || null,
      nodeData: schedule.nodeData || null,
      rows: rows
    };
  }

  function normaliseRow(row) {
    row = row || {};
    var parsed = parseRowTitle(row.title || "");
    var time = $.trim(String(row.time || parsed.time || ""));
    var text = $.trim(String(row.text || parsed.text || ""));

    return {
      uid: String(row.uid || newUid("row")),
      id: String(row.id || row.rowId || ""),
      time: time,
      text: text,
      title: composeRowTitle(time, text),
      note: String(row.note || ""),
      memo: String(row.memo || ""),
      nodeData: row.nodeData || null
    };
  }

  function blankState() {
    return {
      rootId: "",
      rootBaseMemo: "",
      rootMeta: null,
      layout: LAYOUT_IMAGE,
      imageUrl: "",
      openingText: "",
      schedules: [blankSchedule("Day of event")],
      extraHeadingCount: 0
    };
  }

  function blankSchedule(defaultTitle) {
    return {
      uid: newUid("schedule"),
      id: "",
      title: defaultTitle == null ? "" : String(defaultTitle),
      intro: "",
      baseMemo: "",
      meta: null,
      nodeData: null,
      rows: [blankRow()]
    };
  }

  function blankRow() {
    return {
      uid: newUid("row"),
      id: "",
      time: "",
      text: "",
      title: "",
      note: "",
      memo: "",
      nodeData: null
    };
  }

  function getScheduleAtIndex(state, index) {
    var schedules = state && state.schedules ? state.schedules : [];
    var fallbackTitle = index === 0 ? "Day of event" : "";
    return normaliseSchedule(schedules[index] || blankSchedule(fallbackTitle));
  }

  function getActiveSchedules(state) {
    var out = [];
    var schedules = state && state.schedules ? state.schedules : [];
    for (var i = 0; i < schedules.length; i++) {
      if (isScheduleActive(schedules[i])) out.push(normaliseSchedule(schedules[i]));
    }
    return out;
  }

  function getSchedulesToSave(state) {
    var active = getActiveSchedules(state);
    return state.layout === LAYOUT_IMAGE ? active.slice(0, 1) : active.slice(0, CFG.maxSchedules);
  }

  function isScheduleActive(schedule) {
    schedule = normaliseSchedule(schedule);
    return !!(schedule.id || $.trim(schedule.title) || $.trim(schedule.intro) || getRowsToSave(schedule).length);
  }

  function isMeaningfulScheduleState(schedule) {
    schedule = normaliseSchedule(schedule);
    return !!(schedule.id || $.trim(String(schedule.title || "")) || $.trim(String(schedule.intro || "")) || getRowsToSave(schedule).length);
  }

  function getRowsToSave(schedule) {
    var rows = [];
    var source = schedule && schedule.rows ? schedule.rows : [];

    for (var i = 0; i < source.length; i++) {
      var row = normaliseRow(source[i]);
      if ($.trim(row.time) || $.trim(row.text) || row.id) {
        if ($.trim(row.time) || $.trim(row.text)) rows.push(row);
      }
    }

    return rows.slice(0, CFG.maxRows);
  }

  function cleanHeadingTitle(value) {
    var parsed = parseHeadingBaseMeta(String(value || ""));
    return normaliseWhitespace(parsed.name || value || "");
  }

  function parseRowTitle(value) {
    var title = $.trim(String(value || ""));
    var match = title.match(/^(.{1,32}?)\s*(?:-|\u2013|\u2014)\s*(.+)$/);
    if (!match) return { time: "", text: title };
    return { time: $.trim(match[1] || ""), text: $.trim(match[2] || "") };
  }

  function composeRowTitle(time, text) {
    var t = $.trim(String(time || ""));
    var v = $.trim(String(text || ""));
    if (t && v) return t + " - " + v;
    return t || v;
  }

  function normaliseLayout(value) {
    var text = String(value || "").toLowerCase();
    if (text === LAYOUT_COLUMNS || text === VARIANT_THREE_COLUMNS || text === LEGACY_VARIANT_COLUMNS) return LAYOUT_COLUMNS;
    return LAYOUT_IMAGE;
  }

  function layoutToVariant(layout) {
    return normaliseLayout(layout) === LAYOUT_COLUMNS ? VARIANT_THREE_COLUMNS : VARIANT_HALF_IMAGE;
  }

  async function saveHeadingItemDirect(options) {
    if (!options || !options.jobId) throw new Error("Missing heading save details.");

    var name = options.rawName && (shouldUseRawHeadingName(options.rawName) || options.allowPlainRawName)
      ? String(options.rawName)
      : composeStoredHeading(options.renderType || "section", options.title || "");

    return postItemsSave({
      parent: String(options.parentId || "0"),
      flag: String(options.flag == null ? 0 : options.flag),
      priority_confirm: "0",
      custom_fields: normaliseCustomFields(options.customFields),
      kind: "0",
      local: formatLocalDateTime(new Date()),
      id: String(options.id || "0"),
      name: name,
      desc: String(options.desc || ""),
      memo: String(options.memo || ""),
      set_child_dates: "0",
      job: String(options.jobId || ""),
      no_availability: "0",
      ignore: "0"
    }, options.id);
  }

  async function saveCustomItemDirect(options) {
    if (!options || !options.jobId || !options.parentId) throw new Error("Missing schedule row save details.");

    var row = normaliseRow(options.row);
    var source = options.sourceData || {};
    var rowTitle = composeRowTitle(row.time, row.text);

    return postItemsSave({
      parent: String(options.parentId || "0"),
      flag: String(source.FLAG == null ? 0 : source.FLAG),
      priority_confirm: "0",
      custom_fields: normaliseCustomFields(source.CUSTOM_FIELDS),
      kind: "3",
      local: formatLocalDateTime(new Date()),
      id: String(row.id || source.ID || "0"),
      qty: "1",
      name: rowTitle,
      list_id: String(source.LIST_ID || "0"),
      cust_add: String(row.note || source.ADDITIONAL || ""),
      memo: String(row.memo || source.TECHNICAL || ""),
      price_type: String(source.PRICE_TYPE == null ? 0 : source.PRICE_TYPE),
      weight: String(source.weight == null ? (source.WEIGHT == null ? 0 : source.WEIGHT) : source.weight),
      vat_rate: String(source.VAT_RATE == null ? getDefaultVatRate() : source.VAT_RATE),
      value: String(source.value == null ? (source.VALUE == null ? 0 : source.VALUE) : source.value),
      acc_nominal: String(source.ACC_NOMINAL == null ? getDefaultNominalId(1) : source.ACC_NOMINAL),
      acc_nominal_po: String(source.ACC_NOMINAL_PO == null ? getDefaultNominalId(2) : source.ACC_NOMINAL_PO),
      cost_price: String(source.COST_PRICE == null ? 0 : source.COST_PRICE),
      no_scan: String(source.NO_SCAN == 1 ? 1 : 0),
      country_origin: String(source.COUNTRY_ORIGIN || ""),
      hs_code: String(source.HS_CODE || ""),
      category_id: String(source.CATEGORY_ID == null ? 0 : source.CATEGORY_ID),
      no_shortfall: String(source.NO_SHORTFALL == 1 ? 1 : 0),
      unit_price: "0",
      price: "0",
      job: String(options.jobId || ""),
      no_availability: "0",
      ignore: "0"
    }, row.id || source.ID);
  }

  async function deleteItemsDirect(ids, jobId, kind) {
    var idList = normaliseIdList(ids);
    if (!idList.length) return;

    var prefix = getTreeNodePrefixForKind(kind);
    var prefixed = idList.map(function (id) { return prefix + id; });
    var payload = { ids: prefixed.join(","), job: String(jobId || ""), no_availability: "0" };
    var attempts = 0;

    while (attempts < CFG.saveMaxAttempts) {
      attempts += 1;
      await throttleWrite();

      var response = await fetch("/php_functions/items_delete.php", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
        body: $.param(payload)
      });

      var text = await response.text();
      var json = tryParseJson(text);

      if (!response.ok) throw new Error("items_delete failed with status " + response.status);
      if (isRateLimitResponse(json) && attempts < CFG.saveMaxAttempts) {
        await waitForRateLimit();
        continue;
      }
      if (json && typeof json.error !== "undefined") throw new Error(readServerMessage(json.error, "Could not delete removed items."));
      return;
    }
  }

  async function postItemsSave(payload, fallbackId) {
    var attempts = 0;

    while (attempts < CFG.saveMaxAttempts) {
      attempts += 1;
      await throttleWrite();

      var response = await fetch("/php_functions/items_save.php", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
        body: $.param(payload || {})
      });

      var text = await response.text();
      var json = tryParseJson(text);

      if (!response.ok) throw new Error("items_save failed with status " + response.status);
      if (isRateLimitResponse(json) && attempts < CFG.saveMaxAttempts) {
        await waitForRateLimit();
        continue;
      }
      if (json && typeof json.error !== "undefined") throw new Error(readServerMessage(json.error, "HireHop returned an error."));
      if (json && typeof json.warning !== "undefined") throw new Error(readServerMessage(json.warning, "HireHop returned a warning."));

      var id = getSavedItemId(json) || String(fallbackId || "");
      if (!id) throw new Error("HireHop did not return a saved item ID.");
      return { id: String(id), json: json };
    }

    throw new Error("HireHop rate limit hit. Wait a minute and save again.");
  }

  async function throttleWrite() {
    var now = Date.now();
    var wait = Math.max(0, CFG.writeThrottleMs - (now - editor.lastWriteAt));
    if (wait > 0) await delay(wait);
    editor.lastWriteAt = Date.now();
  }

  async function waitForRateLimit() {
    setStatus("HireHop rate limit reached. Waiting, then retrying...", "warning");
    await delay(CFG.rateLimitRetryMs);
  }

  function setBusy(isBusy) {
    $("#" + CFG.bodyId).find("input,textarea,button,select").prop("disabled", !!isBusy);
    $("#" + CFG.closeId + ",#" + CFG.modalId + " .weo-x").prop("disabled", !!isBusy);
    $("#" + CFG.saveId).prop("disabled", !!isBusy).text(isBusy ? "Saving..." : "Save changes");
  }

  function setSaveEnabled(enabled) {
    $("#" + CFG.saveId).prop("disabled", !enabled || editor.saving);
  }

  function setStatus(message, tone) {
    var $status = $("#" + CFG.statusId);
    $status.removeClass("is-error is-success is-warning is-info").text(message || "");
    if (tone) $status.addClass("is-" + tone);
  }

  function refreshSupplyingList() {
    var $btn = findRefreshControl();
    if ($btn.length) $btn.get(0).click();
  }

  function findRefreshControl() {
    var selector = 'button,a,[role="button"],input[type="button"],input[type="submit"]';
    var scopes = [$("#items_tab > div:first-child").get(0), $("#items_tab").get(0), document.body];

    for (var i = 0; i < scopes.length; i++) {
      if (!scopes[i]) continue;
      var $match = $(scopes[i]).find(selector).filter(":visible").filter(function () {
        if ($(this).closest("#" + CFG.overlayId).length) return false;
        var text = $.trim($(this).text() || $(this).val() || $(this).attr("title") || $(this).attr("aria-label") || "");
        return /^refresh\b/i.test(text);
      }).first();
      if ($match.length) return $match;
    }

    return $();
  }

  function getCurrentJobId() {
    var href = String(window.location.href || "");
    var match = href.match(/[?&](?:job|job_id|main_id|id)=(\d+)/i) || href.match(/\/job\/(\d+)/i) || href.match(/\/jobs\/(\d+)/i);
    if (match && match[1]) return match[1];

    var selectors = ['input[name="job"]', 'input[name="job_id"]', 'input[name="main_id"]', 'input[name="id"]', "#job_id", "#main_id"];
    for (var i = 0; i < selectors.length; i++) {
      var $el = $(selectors[i]).first();
      var value = $.trim(String($el.val() || ""));
      if (/^\d+$/.test(value)) return value;
    }

    if (window.main_id && /^\d+$/.test(String(window.main_id))) return String(window.main_id);
    if (window.job_id && /^\d+$/.test(String(window.job_id))) return String(window.job_id);
    return "";
  }

  function extractStoredPageMeta(text) {
    var raw = String(text || "");
    var start = raw.indexOf(CFG.metaStart);
    var end = start === -1 ? -1 : raw.indexOf(CFG.metaEnd, start + CFG.metaStart.length);
    if (start === -1 || end === -1) return { baseText: $.trim(raw), meta: null };

    var before = $.trim(raw.slice(0, start));
    var jsonText = raw.slice(start + CFG.metaStart.length, end);
    var after = $.trim(raw.slice(end + CFG.metaEnd.length));
    var base = [];
    var meta = null;

    if (before) base.push(before);
    if (after) base.push(after);

    try { meta = JSON.parse(jsonText); } catch (e) { meta = null; }
    return { baseText: $.trim(base.join("\n\n")), meta: meta };
  }

  function composeStoredPageMetaText(baseText, meta) {
    var parts = [];
    var base = $.trim(String(baseText || ""));
    if (base) parts.push(base);
    if (meta) parts.push(CFG.metaStart + JSON.stringify(meta) + CFG.metaEnd);
    return parts.join("\n\n");
  }

  function parseHeadingBaseMeta(value) {
    var raw = $.trim(String(value || ""));
    var meta = { additionalOptions: false, hidden: false, renderType: "normal", name: raw };
    var changed = true;

    while (changed) {
      changed = false;
      if (/^\/\/\s*/i.test(raw)) {
        meta.hidden = true;
        raw = raw.replace(/^\/\/\s*/i, "");
        changed = true;
      }
      if (/^\$\s*/i.test(raw)) {
        meta.additionalOptions = true;
        raw = raw.replace(/^\$\s*/i, "");
        changed = true;
      }
    }

    if (/^section\s*:\s*/i.test(raw)) {
      meta.renderType = "section";
      raw = raw.replace(/^section\s*:\s*/i, "");
    } else if (/^dept\s*:\s*/i.test(raw)) {
      meta.renderType = "dept";
      raw = raw.replace(/^dept\s*:\s*/i, "");
    }

    meta.name = $.trim(raw);
    return meta;
  }

  function composeStoredHeading(renderType, title) {
    return headingPrefixForRenderType(renderType || "section") + cleanHeadingTitle(title || "");
  }

  function headingPrefixForRenderType(renderType) {
    if (renderType === "section") return "Section: ";
    if (renderType === "dept") return "Dept: ";
    return "";
  }

  function shouldUseRawHeadingName(value) {
    var text = $.trim(String(value == null ? "" : value));
    return !!text && (/^(\/\/\s*)?(\$\s*)?(section|dept)\s*:/i.test(text) || /^\/\/\s*/.test(text) || /^\$\s*/.test(text));
  }

  function getNodeTitle(node) {
    if (!node) return "";
    var raw = "";
    if (node.data) raw = node.data.title != null ? node.data.title : (node.data.TITLE != null ? node.data.TITLE : node.data.name);
    if (!$.trim(String(raw || "")) && node.text != null) raw = node.text;
    return normaliseWhitespace(parseHeadingBaseMeta(raw).name);
  }

  function getNodeRawTitle(node) {
    if (!node) return "";
    var candidates = [];
    if (node.data) candidates.push(node.data.title, node.data.TITLE, node.data.name, node.data.NAME);
    if (node.original) candidates.push(node.original.title, node.original.text, node.original.name);
    candidates.push(node.text);

    for (var i = 0; i < candidates.length; i++) {
      var value = $.trim(String(candidates[i] == null ? "" : candidates[i]));
      if (value && shouldUseRawHeadingName(value)) return value;
    }

    for (var j = 0; j < candidates.length; j++) {
      var fallback = $.trim(String(candidates[j] == null ? "" : candidates[j]));
      if (fallback) return fallback;
    }

    return "";
  }

  function getNodeDescription(node) { return node && node.data ? String(node.data.DESCRIPTION || "") : ""; }
  function getNodeTechnical(node) { return node && node.data ? String(node.data.TECHNICAL || "") : ""; }
  function getNodeFlag(node) { return node && node.data && node.data.FLAG != null ? node.data.FLAG : 0; }
  function getNodeCustomFields(node) { return node && node.data && node.data.CUSTOM_FIELDS ? node.data.CUSTOM_FIELDS : ""; }
  function getNodeDataId(node) { return node && node.data ? String(node.data.ID || "") : ""; }
  function getSnapshotFlag(snapshot) { return snapshot && snapshot.FLAG != null ? snapshot.FLAG : 0; }
  function getSnapshotCustomFields(snapshot) { return snapshot && snapshot.CUSTOM_FIELDS ? snapshot.CUSTOM_FIELDS : ""; }
  function getSnapshotField(snapshot, field) { return snapshot && snapshot[field] != null ? String(snapshot[field]) : ""; }
  function cloneItemSnapshot(data) { return data ? $.extend(true, {}, data) : null; }
  function extendSnapshot(snapshot, updates) { return $.extend(true, {}, snapshot || {}, updates || {}); }

  function getTreeNodePrefixForKind(kind) {
    var prefixes = { 0: "a", 1: "b", 2: "c", 3: "d", 4: "e", 5: "f", 6: "g" };
    return prefixes[Number(kind)] || "";
  }

  function getSavedItemId(json) {
    if (!json || !json.items || !json.items.length) return "";
    var item = json.items[0] || {};
    return String(item.ID || item.id || "");
  }

  function tryParseJson(text) {
    try { return JSON.parse(text); } catch (e) { return null; }
  }

  function isRateLimitResponse(json) {
    if (!json) return false;
    return isRateLimitCode(json.error) || isRateLimitCode(json.warning);
  }

  function isRateLimitCode(value) {
    return $.trim(String(value == null ? "" : value)) === "327";
  }

  function readServerMessage(value, fallback) {
    if (value == null || value === "") return fallback;
    if (isRateLimitCode(value)) return "HireHop rate limit reached. Wait a minute and save again.";
    return String(value);
  }

  function getDefaultVatRate() {
    if (window.user && window.user.DEFAULT_TAX_GROUP != null) return window.user.DEFAULT_TAX_GROUP;
    return 0;
  }

  function getDefaultNominalId(type) {
    var items = window.nominal_codes || [];
    var first = 0;

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (!item || Number(item.TYPE) !== Number(type) || Number(item.HIDDEN) === 1) continue;
      if (!first) first = item.ID;
      if (Number(item.DEFAULT) === 1) return item.ID;
    }

    return first || 0;
  }

  function normaliseCustomFields(value) {
    if (!value) return "";
    if ($.isPlainObject(value) && $.isEmptyObject(value)) return "";
    return value;
  }

  function getActiveDepotContext() {
    var $select = findHeaderDepotSelect();
    var $selected = $select.length ? $select.find("option:selected").first() : $();
    return {
      id: normaliseDepotId($select.length ? ($select.val() || $selected.attr("value") || "") : ""),
      name: normaliseDepotText($selected.length ? ($selected.text() || "") : "", true)
    };
  }

  function isAllowedDepot(context) {
    var allowedIds = CFG.allowedDepotIds.map(normaliseDepotId).filter(Boolean);
    var allowedNames = CFG.allowedDepotNames.map(function (name) { return normaliseDepotText(name, false); }).filter(Boolean);
    var hasDetected = !!(context && (context.id || context.name));
    var allowed = false;

    if (context && context.id && allowedIds.indexOf(normaliseDepotId(context.id)) !== -1) allowed = true;
    if (context && context.name && allowedNames.indexOf(normaliseDepotText(context.name, false)) !== -1) allowed = true;

    if (!allowed) {
      logDepotDecision(hasDetected ? "blocked" : "undetected", context);
      return hasDetected ? false : !CFG.blockWhenDepotUndetected;
    }

    logDepotDecision("matched", context);
    return true;
  }

  function logDepotDecision(decision, context) {
    var signature = decision + "|" + String((context && context.id) || "") + "|" + String((context && context.name) || "");
    if (signature === editor.depotSignature) return;
    editor.depotSignature = signature;
    log("Depot " + decision, context);
  }

  function findHeaderDepotSelect() {
    var $label = $('[data-label="depotTxt"]').first();
    var $select = findSelectNear($label);
    if ($select.length) return $select;

    var $textLabel = $("b,strong,label,span,td,th").filter(function () {
      var text = $.trim(String($(this).text() || "")).replace(/\s+/g, " ");
      return /^warehouse name\s*:?\s*$/i.test(text) || /^depot\s*:?\s*$/i.test(text);
    }).first();

    return findSelectNear($textLabel);
  }

  function findSelectNear($label) {
    if (!$label || !$label.length) return $();
    var $select = $label.siblings("select").first();
    if ($select.length) return $select;
    $select = $label.nextAll("select").first();
    if ($select.length) return $select;
    $select = $label.parent().find("select").first();
    if ($select.length) return $select;
    return $label.closest("td,th,div,span").find("select").first();
  }

  function normaliseDepotId(value) {
    var text = $.trim(String(value == null ? "" : value));
    if (!text) return "";
    var match = text.match(/(\d+)/);
    return match && match[1] ? match[1] : text.toLowerCase();
  }

  function normaliseDepotText(value, preserveCase) {
    var text = $.trim(String(value == null ? "" : value)).replace(/\s+/g, " ");
    return preserveCase ? text : text.toLowerCase();
  }

  function normaliseMeta(meta) {
    return $.isPlainObject(meta) ? $.extend(true, {}, meta) : null;
  }

  function normaliseIdList(values) {
    var source = Array.isArray(values) ? values : (values ? [values] : []);
    var out = [];

    for (var i = 0; i < source.length; i++) {
      var id = $.trim(String(source[i] == null ? "" : source[i]));
      if (id && out.indexOf(id) === -1) out.push(id);
    }

    return out;
  }

  function indexById(items) {
    var out = {};
    for (var i = 0; i < (items || []).length; i++) {
      var id = items[i] && items[i].id;
      if (id && !out[id]) out[id] = items[i];
    }
    return out;
  }

  function indexByUid(items) {
    var out = {};
    for (var i = 0; i < (items || []).length; i++) {
      var uid = items[i] && items[i].uid;
      if (uid && !out[uid]) out[uid] = items[i];
    }
    return out;
  }

  function newUid(prefix) {
    editor.uid += 1;
    return String(prefix || "id") + "_" + editor.uid + "_" + Date.now().toString(36);
  }

  function clone(value) {
    return $.extend(true, Array.isArray(value) ? [] : {}, value);
  }

  function toInt(value, fallback) {
    var n = parseInt(String(value), 10);
    return isNaN(n) ? fallback : n;
  }

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function formatLocalDateTime(date) {
    function pad(n) { return String(n).padStart(2, "0"); }
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
  }

  function extractFirstUrl(text) {
    var s = String(text || "").trim();
    if (!s) return "";
    var m = s.match(/https?:\/\/[^\s"'<>]+/i);
    if (!m) return "";
    return m[0].replace(/[)\],.]+$/g, "");
  }

  function normaliseDisplayText(value) {
    return $.trim(String(value || "").replace(/<br\s*\/?>/gi, " "));
  }

  function normaliseText(value) {
    return normaliseDisplayText(value).replace(/\s+/g, " ").toLowerCase();
  }

  function normaliseWhitespace(value) {
    return $.trim(String(value || "").replace(/\s+/g, " "));
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function attr(value) {
    return esc(value).replace(/\r?\n/g, "&#10;");
  }

  function getErrorMessage(err, fallback) {
    return err && err.message ? err.message : fallback;
  }

  function log() {
    try {
      var args = Array.prototype.slice.call(arguments);
      args.unshift("[WiseHireHop EventOverview]");
      console.warn.apply(console, args);
    } catch (e) {}
  }

  function warn() { log.apply(null, arguments); }



  /* ============================================================
     FULL PROPOSAL PAGE EDITOR EXTENSION
     ============================================================ */
  var MODE_EVENT_OVERVIEW = "eventOverview";
  var MODE_GENERIC = "generic";
  var GENERIC_META_EDITOR = "genericPage";
  var GENERIC_META_VERSION = 1;
  var LABOUR_DAY_META_EDITOR = "genericLabourDay";
  var LABOUR_DAY_META_VERSION = 1;

  var GENERIC_LAYOUTS = {
    HERO: "hero",
    SECTION_COVER: "section-cover",
    DEPT_TABLE: "dept-table",
    SUMMARY: "summary",
    VISUAL: "visual",
    FPVISUAL: "fpvisual",
    VENUE_HERO: "venue-hero",
    EXP: "exp",
    EXPERTS: "experts",
    PM: "pm",
    TEAM: "team",
    CRITICAL_PATH: "critical-path",
    THANKYOU: "thankyou",
    SUSTAINABILITY: "sustainability",
    ABOUT_US: "about-us",
    DETAILS_CONTAINER: "details-container"
  };

  var GENERIC_MAX_PEOPLE = 8;
  var GENERIC_MAX_MILESTONES = 10;
  var GENERIC_MAX_COST_LINES = 40;
  var COSTING_TECHNICAL_SUMMARY_TITLE = "Technical Summary";
  var COSTING_TECHNICAL_USE_TITLE = "Technical Use";

  function injectStyles() {
    injectEventOverviewStyles();
    injectGenericStyles();
  }

  function injectGenericStyles() {
    var id = CFG.stylesId + "-generic";
    if ($("#" + id).length) return;

    var css = [
      ".wise-supply-toolbar{display:flex!important;align-items:center!important;gap:4px!important;flex-wrap:nowrap!important;min-width:0!important;overflow:hidden!important;}",
      ".wise-supply-toolbar button,.wise-supply-toolbar a,.wise-supply-toolbar [role='button'],.wise-supply-toolbar input[type='button'],.wise-supply-toolbar input[type='submit']{box-sizing:border-box!important;flex:0 1 auto!important;width:auto!important;min-width:30px!important;max-width:150px!important;margin:0 2px!important;padding:5px 7px!important;white-space:nowrap!important;}",
      ".wise-supply-toolbar .ui-button-text{display:inline-block!important;max-width:112px!important;overflow:hidden!important;text-overflow:ellipsis!important;vertical-align:middle!important;white-space:nowrap!important;}",
      ".wise-supply-toolbar .ui-button-icon-primary{margin-right:3px!important;}",
      ".wise-supply-toolbar > button.fixed_width,.wise-supply-toolbar > .fixed_width{flex:0 0 32px!important;width:32px!important;min-width:32px!important;max-width:32px!important;padding-left:0!important;padding-right:0!important;position:relative!important;z-index:2!important;}",
      ".wise-supply-toolbar #wise-doc-preview-toggle{flex:0 0 auto!important;max-width:120px!important;position:relative!important;z-index:2!important;}",
      ".wise-supply-toolbar.is-wise-preview-compact button,.wise-supply-toolbar.is-wise-preview-compact a,.wise-supply-toolbar.is-wise-preview-compact [role='button'],.wise-supply-toolbar.is-wise-preview-compact input[type='button'],.wise-supply-toolbar.is-wise-preview-compact input[type='submit']{max-width:104px!important;padding-left:5px!important;padding-right:5px!important;}",
      ".wise-supply-toolbar.is-wise-preview-compact .ui-button-text{max-width:74px!important;}",
      ".wise-supply-toolbar.is-wise-preview-tight button,.wise-supply-toolbar.is-wise-preview-tight a,.wise-supply-toolbar.is-wise-preview-tight [role='button']{max-width:42px!important;}",
      ".wise-supply-toolbar.is-wise-preview-tight .ui-button-text{display:none!important;}",
      ".wise-supply-toolbar.is-wise-preview-tight [data-wise-native-edit='1']{max-width:64px!important;min-width:54px!important;}",
      ".wise-supply-toolbar.is-wise-preview-tight [data-wise-native-edit='1'] .ui-button-text{display:inline-block!important;max-width:34px!important;}",
      ".wise-supply-toolbar.is-wise-preview-tight #wise-doc-preview-toggle{max-width:74px!important;min-width:38px!important;}",
      ".wise-supply-toolbar.is-wise-preview-tight #wise-doc-preview-toggle .ui-button-text{display:inline-block!important;max-width:42px!important;}",
      "." + CFG.defaultEditClass + "{box-shadow:none!important;}",
      "#" + CFG.buttonId + ",#" + CFG.nativeFallbackId + "{display:none!important;}",
      "#" + CFG.modalId + " .wpe-editor{display:grid;gap:7px;min-width:0;}",
      "#" + CFG.modalId + " .wpe-topbar{display:flex;gap:7px;align-items:stretch;justify-content:space-between;}",
      "#" + CFG.modalId + " .wpe-layout-card{border:1px solid #d6deea;border-radius:12px;background:#fff;padding:8px 9px;box-shadow:0 4px 12px rgba(15,23,42,.04);min-width:240px;}",
      "#" + CFG.modalId + " .wpe-nav-card{display:grid;gap:6px;min-width:210px;border:1px solid #d6deea;border-radius:12px;background:#fff;padding:8px 9px;box-shadow:0 4px 12px rgba(15,23,42,.04);}",
      "#" + CFG.modalId + " .wpe-nav-head{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:10px;font-weight:900;color:#101828;}",
      "#" + CFG.modalId + " .wpe-nav-pos{font-size:9px;color:#667085;}",
      "#" + CFG.modalId + " .wpe-nav-actions{display:flex;gap:6px;}",
      "#" + CFG.modalId + " .wpe-nav-card .wpe-mini-btn{flex:1 1 0;}",
      "#" + CFG.modalId + " .wpe-nav-caption{font-size:10px;line-height:1.3;color:#667085;}",
      "#" + CFG.modalId + " .wpe-layout-kicker{font-size:9px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:#98a2b3;}",
      "#" + CFG.modalId + " .wpe-layout-title{margin-top:2px;font-size:12px;font-weight:900;color:#101828;line-height:1.15;}",
      "#" + CFG.modalId + " .wpe-layout-note{margin-top:3px;font-size:10px;color:#667085;line-height:1.3;}",
      "#" + CFG.modalId + " .wpe-canvas-shell{border:1px solid #d6deea;border-radius:16px;background:#dfe5ee;padding:10px;overflow:auto;}",
      "#" + CFG.modalId + " .wpe-proof{--paper:#fffdf9;--ink:#0d1226;--heritage:#EC9797;position:relative;width:min(100%," + UI_COMPACT.proofMaxWidth + "px);min-width:" + UI_COMPACT.proofMinWidth + "px;aspect-ratio:318/178.9;margin:0 auto;background:var(--paper);overflow:hidden;border-radius:8px;box-shadow:0 10px 30px rgba(15,23,42,.18);color:var(--ink);font-family:Lato,'Segoe UI',Arial,sans-serif;}",
      "#" + CFG.modalId + " .wpe-proof.is-dark{background:#0d1226;color:#fffdf9;}",
      "#" + CFG.modalId + " .wpe-logo{position:absolute;left:2.6%;top:4%;z-index:9;width:96px;height:22px;border:1px solid rgba(13,18,38,.18);border-radius:999px;background:rgba(13,18,38,.05);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;letter-spacing:.08em;color:rgba(13,18,38,.68);text-transform:uppercase;}",
      "#" + CFG.modalId + " .wpe-proof.is-dark .wpe-logo,.wpe-on-image .wpe-logo{border-color:rgba(255,255,255,.32);background:rgba(255,255,255,.1);color:rgba(255,253,249,.86);}",
      "#" + CFG.modalId + " .wpe-footer{position:absolute;left:2.6%;right:2.6%;bottom:4%;z-index:9;display:flex;justify-content:space-between;gap:18px;font-size:9px;color:rgba(13,18,38,.62);pointer-events:none;}",
      "#" + CFG.modalId + " .wpe-proof.is-dark .wpe-footer,.wpe-on-image .wpe-footer{color:rgba(255,253,249,.78);}",
      "#" + CFG.modalId + " .wpe-field{width:100%;border:1px dashed rgba(23,92,211,.32);border-radius:8px;background:rgba(255,255,255,.78);color:#0d1226;font:inherit;box-shadow:0 1px 2px rgba(15,23,42,.04);transition:border-color .12s,box-shadow .12s,background .12s;}",
      "#" + CFG.modalId + " .wpe-field:hover{border-color:rgba(23,92,211,.58);background:rgba(255,255,255,.92);}",
      "#" + CFG.modalId + " .wpe-field:focus{outline:none;border-color:#175cd3;background:#fff;box-shadow:0 0 0 3px rgba(23,92,211,.14);}",
      "#" + CFG.modalId + " textarea.wpe-field{resize:none;line-height:1.25;}",
      "#" + CFG.modalId + " .wpe-heading{font-family:'Albra Sans',Lato,'Segoe UI',Arial,sans-serif;font-weight:400;text-transform:uppercase;line-height:.98;letter-spacing:.01em;}",
      "#" + CFG.modalId + " textarea.wpe-heading{font-size:clamp(22px,2.7vw,36px);padding:6px 8px;min-height:48px;}",
      "#" + CFG.modalId + " .wpe-blurb{font-size:clamp(9px,.88vw,12px);padding:6px 7px;min-height:88px;}",
      "#" + CFG.modalId + " .wpe-small-label{display:block;font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#98a2b3;margin:0 0 4px;}",
      "#" + CFG.modalId + " .wpe-kicker{font-family:'Albra Sans',Lato,'Segoe UI',Arial,sans-serif;font-size:clamp(11px,1.02vw,14px);line-height:1.05;color:#EC9797;letter-spacing:.03em;margin-bottom:5px;}",
      "#" + CFG.modalId + " .wpe-image-preview{position:relative;overflow:hidden;background:linear-gradient(145deg,#d9e2ec,#f8fafc);border:1px solid rgba(15,23,42,.12);border-radius:12px;min-height:72px;display:flex;align-items:center;justify-content:center;text-align:center;padding:18px;color:rgba(13,18,38,.42);font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;}",
      "#" + CFG.modalId + " .wpe-image-preview span{position:relative;z-index:1;}",
      "#" + CFG.modalId + " .wpe-image-preview.is-cover-status{align-items:flex-end;justify-content:flex-start;text-align:left;padding:16px 18px 14px;}",
      "#" + CFG.modalId + " .wpe-image-preview.is-cover-status span{padding:6px 8px;border-radius:999px;background:rgba(255,255,255,.86);color:rgba(13,18,38,.58);box-shadow:0 4px 14px rgba(15,23,42,.08);}",
      "#" + CFG.modalId + " .wpe-image-preview img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;}",
      "#" + CFG.modalId + " .wpe-image-url{position:absolute;left:12px;right:12px;top:12px;z-index:8;border:1px solid rgba(255,255,255,.28);border-radius:12px;background:rgba(13,18,38,.56);backdrop-filter:blur(3px);padding:7px;color:#fff;}",
      "#" + CFG.modalId + " .wpe-image-url label{display:block;margin-bottom:4px;font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.84);}",
      "#" + CFG.modalId + " .wpe-image-url input{width:100%;border:1px solid rgba(255,255,255,.3);border-radius:8px;background:rgba(255,255,255,.93);font-size:10px;padding:5px 6px;color:#0d1226;}",
      "#" + CFG.modalId + " .wpe-left-copy{position:absolute;left:5.1%;top:21%;bottom:13%;width:35%;z-index:5;display:flex;flex-direction:column;gap:7px;}",
      "#" + CFG.modalId + " .wpe-half-image{position:absolute;right:0;top:0;bottom:0;width:50%;z-index:1;border-radius:0;}",
      "#" + CFG.modalId + " .wpe-half-image .wpe-image-preview{height:100%;border:0;border-radius:0;}",
      "#" + CFG.modalId + " .wpe-right-title{position:absolute;right:5.2%;bottom:11%;width:40%;z-index:6;text-align:right;color:rgba(255,253,249,.94);text-shadow:0 2px 16px rgba(0,0,0,.24);}",
      "#" + CFG.modalId + " .wpe-right-title textarea{color:#fffdf9;background:rgba(13,18,38,.34);border-color:rgba(255,255,255,.34);text-align:right;}",
      "#" + CFG.modalId + " .wpe-center-title{position:absolute;left:16%;right:16%;top:38%;z-index:5;text-align:center;}",
      "#" + CFG.modalId + " .wpe-center-title textarea{text-align:center;font-size:clamp(28px,3.7vw,50px);min-height:70px;}",
      "#" + CFG.modalId + " .wpe-full-image{position:absolute;inset:0;z-index:1;border-radius:0;}",
      "#" + CFG.modalId + " .wpe-full-image .wpe-image-preview{height:100%;border:0;border-radius:0;background:#0d1226;color:rgba(255,255,255,.5);}",
      "#" + CFG.modalId + " .wpe-venue-copy{position:absolute;left:5.1%;bottom:18%;width:31%;z-index:5;color:#fffdf9;}",
      "#" + CFG.modalId + " .wpe-venue-copy textarea{background:rgba(13,18,38,.42);border-color:rgba(255,255,255,.32);color:#fffdf9;}",
      "#" + CFG.modalId + " .wpe-venue-copy textarea:focus{background:rgba(13,18,38,.62);border-color:rgba(255,255,255,.55);color:#fffdf9;box-shadow:0 0 0 3px rgba(255,255,255,.16);}",
      "#" + CFG.modalId + " .wpe-venue-title-lock{border:1px dashed rgba(255,255,255,.34);border-radius:10px;background:rgba(13,18,38,.36);padding:7px 8px;color:#fffdf9;}",
      "#" + CFG.modalId + " .wpe-venue-title-lock b{display:block;font-family:'Albra Sans',Lato,'Segoe UI',Arial,sans-serif;font-size:clamp(22px,2.7vw,36px);font-weight:400;line-height:.98;text-transform:uppercase;letter-spacing:.01em;}",
      "#" + CFG.modalId + " .wpe-venue-title-lock span{display:block;margin-top:5px;font-size:10px;line-height:1.3;color:rgba(255,253,249,.72);}",
      "#" + CFG.modalId + " .wpe-fixed-title-lock{border:1px dashed rgba(255,255,255,.34);border-radius:10px;background:rgba(13,18,38,.36);padding:10px 12px;color:#fffdf9;}",
      "#" + CFG.modalId + " .wpe-fixed-title-lock b{display:block;font-family:'Albra Sans',Lato,'Segoe UI',Arial,sans-serif;font-size:clamp(28px,3.7vw,50px);font-weight:400;line-height:.98;text-transform:uppercase;letter-spacing:.01em;}",
      "#" + CFG.modalId + " .wpe-fixed-title-lock span{display:block;margin-top:6px;font-size:10px;line-height:1.3;color:rgba(255,253,249,.76);}",
      "#" + CFG.modalId + " .wpe-visual-stage{position:absolute;inset:0;display:grid;grid-template-columns:25% 75%;z-index:2;}",
      "#" + CFG.modalId + " .wpe-visual-copy{display:flex;flex-direction:column;justify-content:flex-end;gap:7px;padding:0 8% 13%;}",
      "#" + CFG.modalId + " .wpe-visual-image{height:100%;border-radius:0;}",
      "#" + CFG.modalId + " .wpe-visual-image .wpe-image-preview{height:100%;border-radius:0;border:0;}",
      "#" + CFG.modalId + " .wpe-pm-title{position:absolute;left:3%;top:12%;width:48%;z-index:5;}",
      "#" + CFG.modalId + " .wpe-pm-stage{position:absolute;left:3%;right:3%;top:34%;bottom:13%;z-index:5;display:grid;grid-template-columns:54% 46%;gap:14px;align-items:center;}",
      "#" + CFG.modalId + " .wpe-pm-person{display:grid;gap:7px;text-align:right;}",
      "#" + CFG.modalId + " .wpe-pm-person .wpe-field{text-align:right;}",
      "#" + CFG.modalId + " .wpe-pm-image{width:min(100%,232px);aspect-ratio:1/1;border-radius:999px;justify-self:center;}",
      "#" + CFG.modalId + " .wpe-team-title{position:absolute;left:5%;right:5%;top:13%;z-index:5;}",
      "#" + CFG.modalId + " .wpe-people-grid{position:absolute;left:5%;right:5%;top:34%;bottom:13%;z-index:5;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;align-items:start;}",
      "#" + CFG.modalId + " .wpe-person-card{display:grid;gap:5px;min-width:0;}",
      "#" + CFG.modalId + " .wpe-avatar{width:64px;height:64px;border-radius:999px;margin:0 auto 2px;}",
      "#" + CFG.modalId + " .wpe-person-card .wpe-field{text-align:center;font-size:10px;padding:4px 5px;}",
      "#" + CFG.modalId + " .wpe-person-card textarea.wpe-field{min-height:36px;}",
      "#" + CFG.modalId + " .wpe-timeline-title{position:absolute;left:3%;right:3%;top:12%;z-index:5;}",
      "#" + CFG.modalId + " .wpe-timeline{position:absolute;left:3%;right:3%;top:44%;bottom:14%;z-index:5;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;align-items:start;border-top:5px solid #EC9797;padding-top:10px;}",
      "#" + CFG.modalId + " .wpe-milestone-card{display:grid;gap:5px;min-width:0;}",
      "#" + CFG.modalId + " .wpe-milestone-card .wpe-field{font-size:10px;padding:4px 5px;}",
      "#" + CFG.modalId + " .wpe-milestone-card textarea.wpe-field{min-height:50px;}",
      "#" + CFG.modalId + " .wpe-row-actions{display:flex;gap:5px;justify-content:center;align-items:center;}",
      "#" + CFG.modalId + " .wpe-mini-btn{border:1px solid #cfd4dc;border-radius:999px;background:#fff;color:#1f2937;cursor:pointer;font-size:9px;font-weight:900;padding:4px 7px;line-height:1.1;}",
      "#" + CFG.modalId + " .wpe-mini-btn:hover{background:#f9fafb;}",
      "#" + CFG.modalId + " .wpe-mini-btn.is-danger{border-color:#fecdca;color:#b42318;}",
      "#" + CFG.modalId + " .wpe-proof > .wpe-image-url,#" + CFG.modalId + " .wpe-full-image .wpe-image-url{left:auto;right:2.6%;top:4%;width:min(420px,38%);}",
      "#" + CFG.modalId + " .wpe-visual-image{position:relative;}",
      "#" + CFG.modalId + " .wpe-visual-image .wpe-image-url{left:14px;right:14px;top:14px;width:auto;}",
      "#" + CFG.modalId + " .wpe-half-image .wpe-image-url{left:14px;right:14px;top:14px;width:auto;}",
      "#" + CFG.modalId + " .wpe-modifier-strip{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px;}",
      "#" + CFG.modalId + " .wpe-toggle-pill{display:inline-flex;align-items:center;gap:6px;border:1px solid #d9e2ec;border-radius:999px;background:#fbfcfe;padding:4px 7px;font-size:9px;font-weight:900;color:#475467;}",
      "#" + CFG.modalId + " .wpe-toggle-pill input{margin:0;}",
      "#" + CFG.modalId + " .wpe-select-pill{display:inline-flex;align-items:center;gap:6px;border:1px solid #d9e2ec;border-radius:999px;background:#fbfcfe;padding:4px 7px;font-size:9px;font-weight:900;color:#475467;}",
      "#" + CFG.modalId + " .wpe-select-pill select{border:0;background:transparent;font-size:9px;font-weight:900;color:#101828;outline:0;}",
      "#" + CFG.modalId + " .wpe-input-pill{display:inline-flex;align-items:center;gap:6px;border:1px solid #d9e2ec;border-radius:999px;background:#fbfcfe;padding:4px 7px;font-size:9px;font-weight:900;color:#475467;}",
      "#" + CFG.modalId + " .wpe-input-pill input{border:0;background:transparent;font-size:9px;font-weight:700;color:#101828;outline:0;min-width:150px;}",
      "#" + CFG.modalId + " .wpe-inline-group{display:flex;flex-wrap:wrap;gap:6px;align-items:center;}",
      "#" + CFG.modalId + " .wpe-title-cover-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%;flex-basis:100%;}",
      "#" + CFG.modalId + " .wpe-title-cover-option{display:grid;gap:6px;align-content:start;border:1px solid #e4e8ef;border-radius:12px;background:#fbfcfe;padding:8px;}",
      "#" + CFG.modalId + " .wpe-title-cover-option b{display:block;font-size:10px;color:#101828;line-height:1.2;}",
      "#" + CFG.modalId + " .wpe-title-cover-option span{display:block;margin-top:2px;font-size:9px;line-height:1.25;color:#667085;}",
      "#" + CFG.modalId + " .wpe-title-cover-option .wpe-select-pill,#" + CFG.modalId + " .wpe-title-cover-option .wpe-input-pill{border-radius:10px;justify-content:space-between;}",
      "#" + CFG.modalId + " .wpe-title-cover-option .wpe-select-pill select{max-width:170px;}",
      "#" + CFG.modalId + " .wpe-title-cover-option .wpe-mini-btn{justify-self:start;}",
      "#" + CFG.modalId + " .wpe-dept-layout-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;width:100%;flex-basis:100%;}",
      "#" + CFG.modalId + " .wpe-dept-layout-pill{display:grid;grid-template-columns:18px minmax(0,1fr);gap:7px;align-items:start;border:1px solid #d4dbe7;border-radius:12px;background:#fff;padding:7px 9px;cursor:pointer;box-shadow:0 4px 12px rgba(15,23,42,.04);}",
      "#" + CFG.modalId + " .wpe-dept-layout-pill input{margin:1px 0 0;}",
      "#" + CFG.modalId + " .wpe-dept-layout-pill b{display:block;font-size:10px;line-height:1.15;color:#101828;}",
      "#" + CFG.modalId + " .wpe-dept-layout-pill span span{display:block;margin-top:2px;font-size:9px;line-height:1.25;color:#667085;}",
      "#" + CFG.modalId + " .wpe-dept-layout-pill.is-selected{border-color:#175cd3;background:#eef4ff;box-shadow:inset 0 0 0 1px rgba(23,92,211,.08),0 4px 12px rgba(23,92,211,.08);}",
      "#" + CFG.modalId + " .wpe-locked-panel{position:absolute;left:8%;right:8%;top:28%;z-index:6;border:1px dashed rgba(23,92,211,.30);border-radius:14px;background:rgba(255,255,255,.88);padding:18px;text-align:center;color:#344054;}",
      "#" + CFG.modalId + " .wpe-locked-panel b{display:block;margin-bottom:6px;font-size:16px;color:#101828;}",
      "#" + CFG.modalId + " .wpe-locked-panel p{margin:0 0 10px;font-size:12px;line-height:1.4;}",
      "#" + CFG.modalId + " .wpe-native-items-note{position:absolute;left:8%;right:8%;top:30%;z-index:6;border:1px dashed rgba(23,92,211,.30);border-radius:14px;background:rgba(255,255,255,.9);padding:18px;text-align:center;color:#344054;}",
      "#" + CFG.modalId + " .wpe-native-items-note b{display:block;margin-bottom:6px;font-size:16px;color:#101828;}",
      "#" + CFG.modalId + " .wpe-native-items-note p{margin:0 0 10px;font-size:12px;line-height:1.4;}",
      "#" + CFG.modalId + " .wpe-separator-note{position:absolute;left:11%;right:11%;bottom:17%;z-index:6;border:1px dashed rgba(23,92,211,.30);border-radius:14px;background:rgba(255,255,255,.88);padding:12px;text-align:center;color:#344054;font-size:12px;line-height:1.4;}",
      "#" + CFG.modalId + " .wpe-separator-note b{display:block;margin-bottom:5px;color:#101828;font-size:14px;}",
      "#" + CFG.modalId + " .wpe-costing-panel{display:grid;gap:8px;border:1px solid #d9e2ec;border-radius:12px;background:#fff;padding:9px;}",
      "#" + CFG.modalId + " .wpe-costing-head{display:flex;gap:10px;align-items:flex-start;justify-content:space-between;}",
      "#" + CFG.modalId + " .wpe-costing-title{font-size:12px;font-weight:900;color:#101828;}",
      "#" + CFG.modalId + " .wpe-costing-note{font-size:10px;color:#667085;line-height:1.35;margin-top:2px;}",
      "#" + CFG.modalId + " .wpe-costing-lines{display:grid;gap:5px;}",
      "#" + CFG.modalId + " .wpe-costing-row{display:grid;grid-template-columns:minmax(0,1fr) 120px 70px;gap:6px;align-items:center;}",
      "#" + CFG.modalId + " .wpe-costing-row .wpe-field{font-size:10px;padding:5px 6px;}",
      "#" + CFG.modalId + " .wpe-costing-actions{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;align-items:center;}",
      "#" + CFG.modalId + " .wpe-cost-preview{display:grid;gap:4px;margin-top:7px;border-top:1px solid rgba(236,151,151,.55);padding-top:6px;font-size:clamp(9px,.84vw,11px);}",
      "#" + CFG.modalId + " .wpe-cost-preview-section{display:grid;gap:4px;}",
      "#" + CFG.modalId + " .wpe-cost-preview-section + .wpe-cost-preview-section{margin-top:5px;padding-top:5px;border-top:1px dashed rgba(13,18,38,.16);}",
      "#" + CFG.modalId + " .wpe-cost-preview-heading{font-weight:900;text-transform:uppercase;color:#0d1226;letter-spacing:.02em;}",
      "#" + CFG.modalId + " .wpe-cost-preview-heading.is-hidden{color:rgba(13,18,38,.42);}",
      "#" + CFG.modalId + " .wpe-cost-preview-row{display:grid;grid-template-columns:minmax(0,1fr) 72px;gap:8px;align-items:start;border-top:1px solid rgba(236,151,151,.35);padding-top:4px;}",
      "#" + CFG.modalId + " .wpe-cost-preview-row:first-of-type{border-top:0;}",
      "#" + CFG.modalId + " .wpe-cost-preview-row span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      "#" + CFG.modalId + " .wpe-cost-preview-price{text-align:right;font-weight:800;}",
      "#" + CFG.modalId + " .wpe-cost-preview-empty{font-size:10px;color:rgba(13,18,38,.42);font-style:italic;}",
      "#" + CFG.modalId + " .wpe-labour-copy{width:40%;}",
      "#" + CFG.modalId + " .wpe-labour-days{display:grid;gap:7px;margin-top:2px;min-width:0;}",
      "#" + CFG.modalId + " .wpe-labour-days.is-columns{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;}",
      "#" + CFG.modalId + " .wpe-labour-day{display:grid;gap:5px;min-width:0;border:1px solid rgba(13,18,38,.12);border-radius:12px;background:rgba(255,255,255,.92);padding:8px;box-shadow:0 4px 12px rgba(15,23,42,.05);}",
      "#" + CFG.modalId + " .wpe-labour-day.is-empty{border-style:dashed;background:rgba(255,255,255,.76);}",
      "#" + CFG.modalId + " .wpe-labour-day-head{display:flex;justify-content:space-between;gap:8px;align-items:center;}",
      "#" + CFG.modalId + " .wpe-labour-day-count{font-size:9px;font-weight:900;color:#667085;text-transform:uppercase;letter-spacing:.05em;}",
      "#" + CFG.modalId + " .wpe-labour-day .wpe-field{font-size:10px;padding:4px 5px;}",
      "#" + CFG.modalId + " .wpe-labour-day textarea.wpe-field{min-height:48px;}",
      "#" + CFG.modalId + " .wpe-labour-day-items{min-height:28px;font-size:10px;line-height:1.35;color:#344054;border-top:1px solid rgba(13,18,38,.08);padding-top:5px;}",
      "#" + CFG.modalId + " .wpe-labour-day-items.is-empty{color:#98a2b3;font-style:italic;}",
      "#" + CFG.modalId + " .wpe-labour-day-actions{display:flex;gap:5px;flex-wrap:wrap;}",
      "#" + CFG.modalId + " .wpe-labour-day-actions .wpe-mini-btn{flex:1 1 0;min-width:96px;}",
      "#" + CFG.modalId + " .wpe-labour-columns-shell{position:absolute;left:5%;right:5%;top:12%;bottom:13%;z-index:5;display:grid;grid-template-rows:auto 1fr;gap:10px;}",
      "#" + CFG.modalId + " .wpe-labour-columns-copy{display:grid;gap:7px;max-width:46%;}",
      "#" + CFG.modalId + " .wpe-dept-columns-grid{position:absolute;left:3.2%;right:3.2%;top:12%;bottom:14%;z-index:5;display:grid;grid-template-columns:1.05fr 1.1fr .85fr;gap:2.4%;align-items:start;}",
      "#" + CFG.modalId + " .wpe-dept-columns-copy,.wpe-dept-columns-table,.wpe-dept-columns-note{min-width:0;display:grid;gap:7px;}",
      "#" + CFG.modalId + " .wpe-dept-columns-copy .wpe-blurb{min-height:126px;}",
      "#" + CFG.modalId + " .wpe-dept-columns-note{border-left:1px solid rgba(236,151,151,.55);padding-left:10px;font-size:clamp(9px,.84vw,11px);line-height:1.35;color:#475467;}",
      "#" + CFG.modalId + " .wpe-dept-columns-note b{display:block;color:#0d1226;text-transform:uppercase;letter-spacing:.03em;margin-bottom:4px;}",
      "#" + CFG.modalId + " .wpe-thank-alt-title{position:absolute;left:5%;right:43%;bottom:17%;z-index:6;}",
      "#" + CFG.modalId + " .wpe-thank-alt-title textarea{text-align:left;color:#fffdf9;background:rgba(13,18,38,.38);border-color:rgba(255,255,255,.34);}",
      "#" + CFG.modalId + " .wpe-thank-alt-note{position:absolute;right:5%;bottom:18%;width:32%;z-index:6;background:rgba(13,18,38,.55);color:#fffdf9;border-color:rgba(255,255,255,.28);}",
      "#" + CFG.modalId + " .wpe-page-actions{display:flex;gap:8px;align-items:center;justify-content:flex-end;border:1px solid #d9e2ec;border-radius:12px;background:#fff;padding:7px 9px;}",
      "#" + CFG.modalId + " .wpe-note-box{position:absolute;left:8%;right:8%;bottom:16%;z-index:6;border:1px dashed rgba(23,92,211,.32);border-radius:12px;background:rgba(255,255,255,.82);padding:10px;font-size:11px;line-height:1.35;color:#475467;}",
      "#" + CFG.modalId + " .wpe-note-box.wpe-thank-alt-note{left:auto;right:5%;bottom:18%;width:32%;background:rgba(13,18,38,.55);color:#fffdf9;border-color:rgba(255,255,255,.28);}",
      "#" + CFG.overlayId + "{background:rgba(13,18,38,.72);backdrop-filter:blur(10px);}",
      "#" + CFG.modalId + "{background:#FFFDF9;border:1px solid rgba(236,151,151,.34);border-radius:22px;box-shadow:0 34px 90px rgba(13,18,38,.34);font-family:Lato,'Segoe UI',Arial,sans-serif;color:#0D1226;}",
      "#" + CFG.modalId + " .weo-head{background:linear-gradient(135deg,rgba(255,253,249,.98) 0%,rgba(236,151,151,.18) 100%);border-bottom:1px solid rgba(236,151,151,.3);padding:14px 16px 10px;}",
      "#" + CFG.modalId + " .weo-body{background:linear-gradient(180deg,#fffdf9 0%,#f4efe9 100%);padding:10px 12px 12px;}",
      "#" + CFG.modalId + " .weo-title,#" + CFG.modalId + " .wpe-layout-title,#" + CFG.modalId + " .wpe-costing-title,#" + CFG.modalId + " .wpe-nav-head span:first-child{font-family:'Albra Sans',Lato,'Segoe UI',Arial,sans-serif;font-weight:400;letter-spacing:.01em;color:#0D1226;}",
      "#" + CFG.modalId + " .weo-subtitle,#" + CFG.modalId + " .weo-layout-note,#" + CFG.modalId + " .wpe-layout-note,#" + CFG.modalId + " .wpe-nav-caption,#" + CFG.modalId + " .wpe-costing-note,#" + CFG.modalId + " .wpe-page-actions span,#" + CFG.modalId + " .wpe-note-box,#" + CFG.modalId + " .wpe-dept-columns-note{font-family:Lato,'Segoe UI',Arial,sans-serif;font-weight:300;color:rgba(13,18,38,.78);}",
      "#" + CFG.modalId + " .weo-canvas-shell,#" + CFG.modalId + " .wpe-canvas-shell{background:linear-gradient(160deg,rgba(13,18,38,.08) 0%,rgba(236,151,151,.17) 100%);border:1px solid rgba(13,18,38,.1);border-radius:20px;box-shadow:inset 0 1px 0 rgba(255,255,255,.5);}",
      "#" + CFG.modalId + " .weo-layout-note,#" + CFG.modalId + " .wpe-layout-card,#" + CFG.modalId + " .wpe-nav-card,#" + CFG.modalId + " .wpe-costing-panel,#" + CFG.modalId + " .wpe-page-actions,#" + CFG.modalId + " .wpe-title-cover-option,#" + CFG.modalId + " .wpe-locked-panel,#" + CFG.modalId + " .wpe-native-items-note,#" + CFG.modalId + " .wpe-separator-note{background:rgba(255,253,249,.95);border:1px solid rgba(236,151,151,.32);box-shadow:0 18px 42px rgba(13,18,38,.08);}",
      "#" + CFG.modalId + " .weo-layout-pill,#" + CFG.modalId + " .wpe-dept-layout-pill{background:rgba(255,253,249,.96);border:1px solid rgba(13,18,38,.12);box-shadow:0 10px 24px rgba(13,18,38,.06);}",
      "#" + CFG.modalId + " .weo-layout-pill.is-selected,#" + CFG.modalId + " .wpe-dept-layout-pill.is-selected{border-color:#EC9797;background:rgba(236,151,151,.14);box-shadow:inset 0 0 0 1px rgba(236,151,151,.16),0 14px 32px rgba(13,18,38,.09);}",
      "#" + CFG.modalId + " .weo-page-field,#" + CFG.modalId + " .wpe-field{border:1px solid rgba(236,151,151,.42);background:rgba(255,253,249,.92);color:#0D1226;font-family:Lato,'Segoe UI',Arial,sans-serif;font-weight:300;box-shadow:0 8px 18px rgba(13,18,38,.05);}",
      "#" + CFG.modalId + " .weo-page-field:hover,#" + CFG.modalId + " .wpe-field:hover{border-color:rgba(236,151,151,.72);background:#fff;}",
      "#" + CFG.modalId + " .weo-page-field:focus,#" + CFG.modalId + " .wpe-field:focus{border-color:#0D1226;background:#fff;box-shadow:0 0 0 3px rgba(236,151,151,.22);}",
      "#" + CFG.modalId + " .weo-btn,#" + CFG.modalId + " .wpe-mini-btn{border:1px solid rgba(13,18,38,.16);border-radius:999px;background:#FFFDF9;color:#0D1226;font-family:Lato,'Segoe UI',Arial,sans-serif;font-weight:700;box-shadow:0 10px 22px rgba(13,18,38,.08);}",
      "#" + CFG.modalId + " .weo-btn:hover,#" + CFG.modalId + " .wpe-mini-btn:hover{background:#EC9797;border-color:#EC9797;color:#0D1226;}",
      "#" + CFG.modalId + " .weo-btn.is-primary{border-color:#0D1226;background:#0D1226;color:#FFFDF9;}",
      "#" + CFG.modalId + " .weo-btn.is-primary:hover{background:#EC9797;border-color:#EC9797;color:#0D1226;}",
      "#" + CFG.modalId + " .wpe-mini-btn.is-danger{border-color:rgba(13,18,38,.2);background:rgba(13,18,38,.04);color:#0D1226;}",
      "#" + CFG.modalId + " .wpe-mini-btn.is-danger:hover{background:#0D1226;border-color:#0D1226;color:#FFFDF9;}",
      "#" + CFG.modalId + " .wpe-toggle-pill,#" + CFG.modalId + " .wpe-select-pill,#" + CFG.modalId + " .wpe-input-pill{background:rgba(255,253,249,.94);border:1px solid rgba(236,151,151,.32);color:#0D1226;}",
      "#" + CFG.modalId + " .wpe-toggle-pill select,#" + CFG.modalId + " .wpe-select-pill select,#" + CFG.modalId + " .wpe-input-pill input{color:#0D1226;font-family:Lato,'Segoe UI',Arial,sans-serif;}",
      "#" + CFG.modalId + " .wpe-heading,#" + CFG.modalId + " .weo-day-heading,#" + CFG.modalId + " .weo-page-title-fixed,#" + CFG.modalId + " .wpe-small-label,#" + CFG.modalId + " .wpe-layout-kicker,#" + CFG.modalId + " .wpe-kicker{font-family:'Albra Sans',Lato,'Segoe UI',Arial,sans-serif;}",
      "#" + CFG.modalId + " .wpe-layout-kicker,#" + CFG.modalId + " .wpe-small-label,#" + CFG.modalId + " .wpe-labour-day-count{color:rgba(13,18,38,.58);}",
      "#" + CFG.modalId + " .wpe-image-preview{background:linear-gradient(145deg,rgba(13,18,38,.1),rgba(236,151,151,.22));border:1px solid rgba(13,18,38,.1);color:rgba(13,18,38,.55);}",
      "#" + CFG.modalId + " .wpe-image-url{background:rgba(13,18,38,.76);border:1px solid rgba(236,151,151,.34);}",
      "#" + CFG.modalId + " .wpe-labour-day{border:1px solid rgba(13,18,38,.08);border-radius:16px;background:linear-gradient(180deg,rgba(255,253,249,.98) 0%,rgba(236,151,151,.1) 100%);box-shadow:0 14px 30px rgba(13,18,38,.08);padding:10px;}",
      "#" + CFG.modalId + " .wpe-labour-day.is-empty{border-style:dashed;background:rgba(255,253,249,.8);}",
      "#" + CFG.modalId + " .wpe-labour-day-items{border-top:1px solid rgba(236,151,151,.34);padding-top:7px;color:rgba(13,18,38,.78);}",
      "@media(max-width:900px){#" + CFG.modalId + " .wpe-topbar{display:grid;}#" + CFG.modalId + " .wpe-proof{min-width:600px;}#" + CFG.modalId + " .wpe-canvas-shell{padding:8px;}#" + CFG.modalId + " .wpe-title-cover-options,#" + CFG.modalId + " .wpe-dept-layout-options{grid-template-columns:1fr;}}"
    ].join("");

    $("head").append('<style id="' + id + '">' + css + "</style>");
  }

  function openEditor() {
    ensureModal();
    injectGenericStyles();
    setStatus("", "");
    setSaveEnabled(false);

    try {
      var tree = getTree();
      if (!tree) {
        showMessage("Items list not ready", "The items list could not be detected yet. Open the supplying list and try again.");
        showOverlay();
        return;
      }

      var selected = getSelectedTreeNode(tree);
      var headingNode = selected && selected.data && Number(selected.data.kind) === 0 ? selected : getParentHeadingNode(tree, selected);

      if (!headingNode) {
        showMessage("Select a proposal page", "Select a Section or Dept heading in the supplying list, then open the editor again.");
        showOverlay();
        return;
      }

      openEditorForHeadingNode(tree, headingNode, { showOverlay: true });
    } catch (err) {
      editor.rootNode = null;
      editor.original = null;
      editor.current = null;
      warn("openEditor failed", err);
      showMessage("Could not open page editor", getErrorMessage(err, "The editor hit an unexpected error while reading the selected page."));
      showOverlay();
    }
  }

  function setModalTitle(title, subtitle) {
    $("#" + CFG.titleId).text(title || "Proposal Page Editor");
    $("#" + CFG.modalId + " .weo-subtitle").text(subtitle || "");
  }

  function getEventOverviewRootForSelection(tree, headingNode) {
    if (!tree || !headingNode) return null;
    if (isSelectableEventOverviewRoot(headingNode)) return headingNode;

    var parentHeading = getParentHeadingNode(tree, headingNode);
    if (isEventOverviewDeptNode(headingNode) && parentHeading && isSelectableEventOverviewRoot(parentHeading)) return parentHeading;
    if (parentHeading && isSelectableEventOverviewRoot(parentHeading)) return parentHeading;

    return findEventOverviewAncestor(tree, headingNode);
  }

  function getCostingSupportParentForSelection(tree, headingNode) {
    if (!tree || !headingNode || !headingNode.data || Number(headingNode.data.kind) !== 0) return null;

    var title = normalizeGenericMatchText(getNodeTitle(headingNode));
    var isSummary = title === normalizeGenericMatchText(COSTING_TECHNICAL_SUMMARY_TITLE);
    var isUse = title === normalizeGenericMatchText(COSTING_TECHNICAL_USE_TITLE);
    if (!isSummary && !isUse) return null;

    var parent = getParentHeadingNode(tree, headingNode);
    if (!parent) return null;

    var parentParsed = parseHeadingBaseMeta(getNodeRawTitle(parent));
    if (parentParsed && parentParsed.renderType === "section") return null;

    return {
      parent: parent,
      kind: isSummary ? "summary" : "use",
      notice: (isSummary ? "Technical Summary" : "Technical Use") + " is a support folder, not a proposal page. Opened the parent Dept page so you can add rows in context."
    };
  }

  function getLabourDayParentForSelection(tree, headingNode) {
    if (!tree || !headingNode || !headingNode.data || Number(headingNode.data.kind) !== 0) return null;

    var parent = getParentHeadingNode(tree, headingNode);
    if (!parent) return null;

    var parentHeadingMeta = parseHeadingBaseMeta(getNodeRawTitle(parent));
    var parentTitleInfo = splitEditableTitleSuffix(getNodeTitle(parent));
    var parentLayoutId = resolveGenericLayoutId(tree, parent, parentTitleInfo.title || parentHeadingMeta.name, readGenericLayoutIdFromMeta(extractStoredPageMeta(getNodeTechnical(parent)).meta));
    var parentRenderType = getGenericRenderTypeForStorage(parentHeadingMeta, parentTitleInfo.title);
    if (!isLabourDeptLayoutState({ layoutId: parentLayoutId, renderType: parentRenderType, title: parentTitleInfo.title })) return null;

    var metaInfo = extractStoredPageMeta(getNodeTechnical(headingNode));
    var dayMeta = readLabourDayMeta(metaInfo.meta);
    var title = normalizeGenericMatchText(getNodeTitle(headingNode));
    if (!dayMeta && !/^day\b/.test(title)) return null;

    return {
      parent: parent,
      kind: "labourDay",
      notice: "This Day folder stores crew resource items. Opened the parent Labour page so you can manage the day cards in context."
    };
  }

  function renderEditor(state) {
    if ((state && state.mode === MODE_GENERIC) || editor.mode === MODE_GENERIC) return renderGenericEditor(state || editor.current);
    if (state) state.mode = MODE_EVENT_OVERVIEW;
    return renderEventOverviewEditor(state);
  }

  function readFormState(previous) {
    if ((previous && previous.mode === MODE_GENERIC) || editor.mode === MODE_GENERIC) return readGenericFormState(previous || editor.current);
    return readEventOverviewFormState(previous);
  }

  function runEditorAction($btn) {
    if (editor.mode === MODE_GENERIC) return runGenericEditorAction($btn);
    return runEventOverviewEditorAction($btn);
  }

  function hasUnsavedEditorChanges() {
    if (editor.mode === MODE_GENERIC) return hasGenericUnsavedEditorChanges();
    return hasEventOverviewUnsavedEditorChanges();
  }

  async function saveEditor() {
    if (editor.mode === MODE_GENERIC) return saveGenericEditor();
    return saveEventOverviewEditor();
  }

  function readGenericPageState(tree, node) {
    var rawTitle = getNodeRawTitle(node);
    var headingMeta = parseHeadingBaseMeta(rawTitle);
    var technicalInfo = extractStoredPageMeta(getNodeTechnical(node));
    var titleInfo = splitEditableTitleSuffix(getNodeTitle(node));
    var layoutId = resolveGenericLayoutId(tree, node, titleInfo.title || headingMeta.name, readGenericLayoutIdFromMeta(technicalInfo.meta));
    var directRows = getDirectChildCustomNodes(tree, node);
    var directHeadings = getDirectChildHeadingNodes(tree, node);
    var totalChildItems = getDirectChildNodes(tree, node).filter(function (child) {
      return !!(child && child.data && Number(child.data.kind) !== 0);
    }).length;
    var genericRows = directRows.map(function (rowNode) { return readGenericRowState(rowNode, layoutId); });
    var managedRows = getManagedRowsForLayout(layoutId, genericRows);
    var costingTechnicalSummaryNode = findChildHeadingByName(directHeadings, COSTING_TECHNICAL_SUMMARY_TITLE);
    var costingTechnicalUseNode = findChildHeadingByName(directHeadings, COSTING_TECHNICAL_USE_TITLE);
    var costingTechnicalSummaryId = costingTechnicalSummaryNode ? getNodeDataId(costingTechnicalSummaryNode) : "";
    var costingTechnicalUseId = costingTechnicalUseNode ? getNodeDataId(costingTechnicalUseNode) : "";
    var costingSummaryRows = costingTechnicalSummaryNode ? getDirectChildCustomNodes(tree, costingTechnicalSummaryNode).map(function (rowNode) { return readGenericRowState(rowNode, layoutId); }) : [];
    var costingUseRows = costingTechnicalUseNode ? getDirectChildCustomNodes(tree, costingTechnicalUseNode).map(function (rowNode) { return readGenericRowState(rowNode, layoutId); }) : [];
    var renderType = getGenericRenderTypeForStorage(headingMeta, titleInfo.title);
    var canUseDeptLayout = isLabourDeptLayoutState({ layoutId: layoutId, renderType: renderType, title: titleInfo.title });
    var labourDays = canUseDeptLayout ? readLabourDayStates(tree, node, directHeadings, technicalInfo.meta) : [];

    return normaliseGenericState({
      mode: MODE_GENERIC,
      rootId: getNodeDataId(node),
      parentId: getParentHeadingDataId(tree, node),
      rawName: rawTitle,
      renderType: renderType,
      hidden: !!headingMeta.hidden,
      additionalOptions: !!headingMeta.additionalOptions,
      title: titleInfo.title,
      titleSuffix: titleInfo.suffix,
      blurb: getNodeDescription(node),
      technical: technicalInfo.baseText,
      layoutId: layoutId,
      deptLayout: canUseDeptLayout ? (readGenericDeptLayoutFromMeta(technicalInfo.meta) || LAYOUT_IMAGE) : LAYOUT_IMAGE,
      layoutLabel: canUseDeptLayout ? "Labour day-folder page" : genericLayoutLabel(layoutId),
      sectionTitle: getNearestSectionTitleForGeneric(tree, node),
      flag: getNodeFlag(node),
      customFields: getNodeCustomFields(node),
      pageMeta: technicalInfo.meta,
      nodeData: cloneItemSnapshot(node.data),
      rows: managedRows,
      labourDays: labourDays,
      originalManagedIds: managedRows.map(function (row) { return row.id; }).filter(Boolean),
      totalChildRows: directRows.length,
      totalChildItems: totalChildItems,
      costingTechnicalSummaryId: costingTechnicalSummaryId,
      costingTechnicalUseId: costingTechnicalUseId,
      costingSummaryRows: costingSummaryRows,
      costingUseRows: costingUseRows,
      originalCostingSummaryIds: costingSummaryRows.map(function (row) { return row.id; }).filter(Boolean),
      originalCostingUseIds: costingUseRows.map(function (row) { return row.id; }).filter(Boolean)
    });
  }

  function findChildHeadingByName(headings, targetName) {
    var target = normalizeGenericMatchText(targetName);
    for (var i = 0; i < (headings || []).length; i++) {
      var title = normalizeGenericMatchText(getNodeTitle(headings[i]));
      if (title === target) return headings[i];
    }
    return null;
  }

  function findChildHeadingDataIdByName(headings, targetName) {
    var target = normalizeGenericMatchText(targetName);
    for (var i = 0; i < (headings || []).length; i++) {
      var title = normalizeGenericMatchText(getNodeTitle(headings[i]));
      if (title === target) return getNodeDataId(headings[i]);
    }
    return "";
  }

  function readLabourDayStates(tree, node, directHeadings) {
    var days = [];
    var candidates = (directHeadings || []).filter(function (heading) {
      var title = normalizeGenericMatchText(getNodeTitle(heading));
      return title !== normalizeGenericMatchText(COSTING_TECHNICAL_SUMMARY_TITLE) && title !== normalizeGenericMatchText(COSTING_TECHNICAL_USE_TITLE);
    });
    var bySlot = {};
    var fallback = [];

    for (var i = 0; i < candidates.length; i++) {
      var heading = candidates[i];
      var meta = readLabourDayMeta(extractStoredPageMeta(getNodeTechnical(heading)).meta);
      var slotIndex = meta && meta.slotKey ? SLOT_KEYS.indexOf(String(meta.slotKey || "")) : -1;
      if (slotIndex === -1 && meta && meta.columnIndex != null) slotIndex = toInt(meta.columnIndex, -1);
      if (slotIndex >= 0 && slotIndex < CFG.maxSchedules && !bySlot[slotIndex]) bySlot[slotIndex] = heading;
      else fallback.push(heading);
    }

    for (var slot = 0; slot < CFG.maxSchedules; slot++) {
      var headingNode = bySlot[slot] || null;
      if (!headingNode && fallback.length) headingNode = fallback.shift();
      days.push(headingNode ? readLabourDayState(tree, headingNode, slot) : blankLabourDay(slot === 0 ? "Day of event" : ""));
    }

    return days.slice(0, CFG.maxSchedules);
  }

  function readLabourDayState(tree, headingNode, index) {
    var metaInfo = extractStoredPageMeta(getNodeTechnical(headingNode));
    var childItems = getDirectChildNodes(tree, headingNode).filter(function (child) {
      return !!(child && child.data && Number(child.data.kind) !== 0);
    });
    var itemIds = [];
    var itemNames = [];
    var itemRefs = [];

    for (var i = 0; i < childItems.length; i++) {
      var child = childItems[i];
      var id = getNodeDataId(child);
      var name = getGenericNodeName(child);
      if (id) itemIds.push(id);
      if (name && itemNames.length < 4) itemNames.push(name);
      if (id) {
        itemRefs.push({
          id: id,
          kind: Number(child.data && child.data.kind != null ? child.data.kind : 0),
          name: name
        });
      }
    }

    return normaliseLabourDay({
      uid: newUid("labourday"),
      id: getNodeDataId(headingNode),
      title: getNodeTitle(headingNode) || (index === 0 ? "Day of event" : ""),
      intro: getNodeDescription(headingNode),
      baseMemo: metaInfo.baseText || "",
      meta: readLabourDayMeta(metaInfo.meta),
      nodeData: cloneItemSnapshot(headingNode.data),
      itemIds: itemIds,
      itemCount: childItems.length,
      itemNames: itemNames,
      itemRefs: itemRefs
    });
  }

  function findDeptChildHeadingNode(tree, node, targetTitle) {
    if (!tree || !node) return null;

    var children = getDirectChildHeadingNodes(tree, node);
    var target = normalizeGenericMatchText(targetTitle);
    var fallback = null;

    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      var parsed = parseHeadingBaseMeta(getNodeRawTitle(child));
      if (parsed.renderType !== "dept") continue;
      if (!fallback) fallback = child;
      if (!target || normalizeGenericMatchText(parsed.name || getNodeTitle(child)) === target) return child;
    }

    return fallback;
  }

  function getGenericRenderTypeForStorage(headingMeta, title) {
    var normalisedTitle = normalizeGenericMatchText(title || (headingMeta && headingMeta.name) || "");
    if (normalisedTitle === normalizeGenericMatchText(COSTING_TECHNICAL_SUMMARY_TITLE) ||
        normalisedTitle === normalizeGenericMatchText(COSTING_TECHNICAL_USE_TITLE)) {
      return "normal";
    }
    if (headingMeta && headingMeta.renderType === "section") return "section";
    if (headingMeta && headingMeta.renderType === "dept") return "dept";
    return "normal";
  }

  function inferRenderTypeFromNode(node) {
    var text = normaliseText(getNodeRawTitle(node));
    if (/^section\b/.test(text)) return "section";
    return "dept";
  }

  function shouldOpenGenericDeptChildFromSection() {
    if (editor.mode !== MODE_GENERIC || !editor.rootNode) return false;

    var state = normaliseGenericState(editor.current || {});
    if (state.layoutId !== GENERIC_LAYOUTS.SECTION_COVER) return false;

    return parseHeadingBaseMeta(getNodeRawTitle(editor.rootNode)).renderType === "section";
  }

  async function openOrCreateGenericDeptChildFromSection(options) {
    options = options || {};
    var tree = getTree();
    var sectionNode = editor.rootNode;
    if (!tree || !sectionNode) {
      setStatus("Could not find the current Section page.", "error");
      return;
    }

    var state = readGenericFormState(editor.current);
    var persisted = await persistGenericStateIfNeeded({
      savingMessage: "Saving Section page first...",
      errorMessage: "Could not save the Section page before opening the Dept page.",
      rerender: true,
      refreshList: false
    });
    if (!persisted.ok) return;

    state = persisted.state || state;
    tree = getTree();
    sectionNode = findHeadingNodeByDataId(tree, state.rootId) || sectionNode;
    var jobId = getCurrentJobId();
    if (!jobId) {
      setStatus("Could not detect the current job ID.", "error");
      return;
    }

    var sectionId = getNodeDataId(sectionNode);
    var requestedTitle = cleanHeadingTitle(options.title || state.title || getNodeTitle(sectionNode) || "New Dept");
    var deptId = String(options.targetId || "");
    var deptNode = deptId ? findHeadingNodeByDataId(tree, deptId) : findDeptChildHeadingNode(tree, sectionNode, requestedTitle);
    if (deptNode) deptId = getNodeDataId(deptNode);

    editor.saving = true;
    setBusy(true);

    try {
      if (!deptId) {
        setStatus("Creating Dept page...", "info");
        var created = await saveHeadingItemDirect({
          jobId: jobId,
          id: "",
          parentId: sectionId,
          renderType: "dept",
          title: requestedTitle,
          desc: "",
          memo: composeStoredPageMetaText("", buildGenericPageMeta({ layoutId: GENERIC_LAYOUTS.DEPT_TABLE }, null)),
          flag: getNodeFlag(sectionNode),
          customFields: getNodeCustomFields(sectionNode)
        });
        deptId = String(created.id || "");
      }

      refreshSupplyingList();
      setTimeout(refreshSupplyingList, 450);
      await delay(950);

      tree = getTree();
      var freshSectionNode = findHeadingNodeByDataId(tree, sectionId) || sectionNode;
      deptNode = findHeadingNodeByDataId(tree, deptId) || findDeptChildHeadingNode(tree, freshSectionNode, requestedTitle);
      if (!deptNode) {
        setStatus("Dept page is ready in the supplying list. Select it and open the editor again if it does not appear immediately.", "warning");
        return;
      }

      openEditorForHeadingNode(tree, deptNode, {
        showOverlay: false,
        notice: "Opened Dept costing page."
      });
      refreshSupplyingList();
      setTimeout(refreshSupplyingList, 450);
      attachEditorPreviewDockSoon();
    } catch (err) {
      warn("Could not open Dept child page", err);
      setStatus(getErrorMessage(err, "Could not open the Dept costing page."), "error");
      editor.current = normaliseGenericState(state);
      renderEditor(editor.current);
    } finally {
      editor.saving = false;
      setBusy(false);
    }
  }

  function openEditorForHeadingDataId(dataId, options) {
    var tree = getTree();
    if (!tree || !dataId) return false;
    var node = findHeadingNodeByDataId(tree, dataId);
    if (!node) return false;
    openEditorForHeadingNode(tree, node, options);
    return true;
  }

  function openEditorForHeadingNode(tree, headingNode, options) {
    options = options || {};
    if (!tree || !headingNode) throw new Error("Missing proposal page heading.");

    var supportFolderNotice = "";
    var supportParent = getCostingSupportParentForSelection(tree, headingNode) || getLabourDayParentForSelection(tree, headingNode);
    if (supportParent && supportParent.parent) {
      headingNode = supportParent.parent;
      supportFolderNotice = supportParent.notice;
    }

    var headingId = getNodeDataId(headingNode);
    if (headingId) selectTreeHeadingByDataId(tree, headingId);

    var overviewRoot = getEventOverviewRootForSelection(tree, headingNode);
    if (overviewRoot) {
      editor.mode = MODE_EVENT_OVERVIEW;
      editor.rootNode = overviewRoot;
      editor.original = readEventOverviewState(tree, overviewRoot);
      editor.original.mode = MODE_EVENT_OVERVIEW;
      editor.current = clone(editor.original);
      editor.selectedRegionId = "";
      setModalTitle("Event Overview", "Edit the Event Overview page visually. The title, logo and footer are fixed; the fields on the page are editable.");
      renderEditor(editor.current);
      if (supportFolderNotice) setStatus(supportFolderNotice, "info");
      if (options.showOverlay !== false) showOverlay();
      return;
    }

    editor.mode = MODE_GENERIC;
    editor.rootNode = headingNode;
    editor.original = readGenericPageState(tree, headingNode);
    editor.current = clone(editor.original);
    editor.selectedRegionId = "";
    setModalTitle("Proposal Page Editor", "Edit the selected proposal page visually. Child rows stay untouched unless this page type has an in-editor builder.");
    renderEditor(editor.current);
    if (supportFolderNotice) setStatus(supportFolderNotice, "info");
    if (options.notice) setStatus(options.notice, options.noticeTone || "success");
    if (options.showOverlay !== false) showOverlay();
  }

  function splitEditableTitleSuffix(title) {
    var raw = String(title || "").trim();
    var match = raw.match(/^(.*?)(\s*(?:-|\u2013|\u2014)\s*(?:left|right|alt|none|dept|section))\s*$/i);
    if (!match) return { title: raw, suffix: "" };
    return { title: $.trim(match[1] || raw), suffix: String(match[2] || "") };
  }

  function titleForEditing(value) {
    return String(value || "").replace(/<br\s*\/?>/gi, "\n");
  }

  function titleForStorage(value) {
    return $.trim(String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")).replace(/\n+/g, "<br>");
  }

  function getNearestSectionTitleForGeneric(tree, node) {
    var current = node;
    while (current && current.id && current.id !== "#") {
      if (current.data && Number(current.data.kind) === 0) {
        var parsed = parseHeadingBaseMeta(getNodeRawTitle(current));
        if (parsed.renderType === "section") return splitEditableTitleSuffix(getNodeTitle(current)).title;
      }
      var parentId = tree && typeof tree.get_parent === "function" ? tree.get_parent(current) : "#";
      if (!parentId || parentId === "#") break;
      current = tree.get_node(parentId);
    }
    return "";
  }

  function resolveGenericLayoutId(tree, node, title, preferredLayoutId) {
    var storedLayoutId = normaliseGenericLayoutId(preferredLayoutId);
    if (storedLayoutId) return storedLayoutId;

    var parsed = parseHeadingBaseMeta(getNodeRawTitle(node));
    var renderType = parsed.renderType;
    var t = normalizeGenericMatchText(title || parsed.name || getNodeTitle(node));
    var sectionTitle = normalizeGenericMatchText(getNearestSectionTitleForGeneric(tree, node));

    if (t === "venue hero") return GENERIC_LAYOUTS.VENUE_HERO;

    if (renderType === "section") {
      if (t === "hero" || t === "hero page") return GENERIC_LAYOUTS.HERO;
      if (t === "details") return GENERIC_LAYOUTS.DETAILS_CONTAINER;
      return GENERIC_LAYOUTS.SECTION_COVER;
    }

    if (/^fpv(?:isual)?\b/i.test(String(title || ""))) return GENERIC_LAYOUTS.FPVISUAL;
    if (t.indexOf("project manager") !== -1 || t.indexOf("dedicated project manager") !== -1) return GENERIC_LAYOUTS.PM;
    if (t.indexOf("specialist team") !== -1 || t === "team" || t.indexOf("team") !== -1 && t.indexOf("specialist") !== -1) return GENERIC_LAYOUTS.TEAM;
    if (t.indexOf("experience") !== -1 && t.indexOf("expertise") !== -1) return GENERIC_LAYOUTS.EXP;
    if (t === "our experts" || t.indexOf("experts") !== -1) return GENERIC_LAYOUTS.EXPERTS;
    if (t === "critical path") return GENERIC_LAYOUTS.CRITICAL_PATH;
    if (t === "sustainability") return GENERIC_LAYOUTS.SUSTAINABILITY;
    if (t === "about us") return GENERIC_LAYOUTS.ABOUT_US;
    if (t === "thank you" || t.indexOf("thank you") !== -1) return GENERIC_LAYOUTS.THANKYOU;
    if (t === "project total" || t === "proposal summary") return GENERIC_LAYOUTS.SUMMARY;
    if (sectionTitle === "visual") return GENERIC_LAYOUTS.VISUAL;
    return GENERIC_LAYOUTS.DEPT_TABLE;
  }

  function normalizeGenericMatchText(value) {
    return String(value || "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/[^a-z0-9]+/gi, " ")
      .trim()
      .toLowerCase();
  }

  function normaliseGenericLayoutId(value) {
    var id = String(value || "");
    var keys = Object.keys(GENERIC_LAYOUTS);
    for (var i = 0; i < keys.length; i++) {
      if (GENERIC_LAYOUTS[keys[i]] === id) return id;
    }
    return "";
  }

  function readGenericLayoutIdFromMeta(meta) {
    meta = normaliseMeta(meta);
    if (!meta || String(meta.editor || "") !== GENERIC_META_EDITOR) return "";
    return normaliseGenericLayoutId(meta.layoutId);
  }

  function buildGenericPageMeta(state, existingMeta) {
    var meta = normaliseMeta(existingMeta) || {};
    state = normaliseGenericState(state);
    meta.editor = GENERIC_META_EDITOR;
    meta.version = GENERIC_META_VERSION;
    meta.layoutId = state.layoutId;
    if (isLabourDeptLayoutState(state)) {
      meta.deptLayout = normaliseLayout(state.deptLayout);
      meta.deptVariant = layoutToVariant(state.deptLayout);
      meta.layout = meta.deptLayout;
      meta.variant = meta.deptVariant;
    } else {
      delete meta.deptLayout;
      delete meta.deptVariant;
      delete meta.layout;
      delete meta.variant;
    }
    return meta;
  }

  function readGenericDeptLayoutFromMeta(meta) {
    meta = normaliseMeta(meta);
    if (!meta || String(meta.editor || "") !== GENERIC_META_EDITOR) return "";
    if (!meta.deptLayout && !meta.deptVariant && !meta.layout && !meta.variant) return "";
    return normaliseLayout(meta.deptLayout || meta.layout || meta.deptVariant || meta.variant || LAYOUT_IMAGE);
  }

  function genericLayoutLabel(layoutId) {
    var labels = {};
    labels[GENERIC_LAYOUTS.HERO] = "Hero cover";
    labels[GENERIC_LAYOUTS.SECTION_COVER] = "Title cover";
    labels[GENERIC_LAYOUTS.DEPT_TABLE] = "Dept costing/text page";
    labels[GENERIC_LAYOUTS.SUMMARY] = "Proposal summary / project total";
    labels[GENERIC_LAYOUTS.VISUAL] = "Visual page";
    labels[GENERIC_LAYOUTS.FPVISUAL] = "Full-page visual / embed";
    labels[GENERIC_LAYOUTS.VENUE_HERO] = "Venue hero";
    labels[GENERIC_LAYOUTS.EXP] = "Experience & Expertise";
    labels[GENERIC_LAYOUTS.EXPERTS] = "Our Experts";
    labels[GENERIC_LAYOUTS.PM] = "Project manager";
    labels[GENERIC_LAYOUTS.TEAM] = "Specialist team";
    labels[GENERIC_LAYOUTS.CRITICAL_PATH] = "Critical path";
    labels[GENERIC_LAYOUTS.THANKYOU] = "Thank you";
    labels[GENERIC_LAYOUTS.SUSTAINABILITY] = "Sustainability";
    labels[GENERIC_LAYOUTS.ABOUT_US] = "About us";
    labels[GENERIC_LAYOUTS.DETAILS_CONTAINER] = "Details container";
    return labels[layoutId] || "Proposal page";
  }

  function isOurProposalSeparatorState(state) {
    state = state || {};
    return state.renderType === "section" && normalizeGenericMatchText(state.title) === "our proposal";
  }

  function isVenueHeroState(state) {
    return !!(state && state.layoutId === GENERIC_LAYOUTS.VENUE_HERO);
  }

  function isFixedHeroState(state) {
    return !!(state && state.layoutId === GENERIC_LAYOUTS.HERO && state.renderType === "section");
  }

  function isLabourDeptLayoutState(state) {
    if (!state || state.layoutId !== GENERIC_LAYOUTS.DEPT_TABLE || state.renderType !== "dept") return false;
    return /^labou?r\b/.test(normalizeGenericMatchText(state.title));
  }

  function shouldUseLabourDayFolders(state) {
    return isLabourDeptLayoutState(state) && !isGenericCostingSupportState(state);
  }

  function isCostingSectionLayout(layoutId) {
    return layoutId === GENERIC_LAYOUTS.SECTION_COVER;
  }

  function isOptionalItemsEligibleState(state) {
    state = normaliseGenericState(state || {});
    if (state.renderType !== "section" && state.renderType !== "dept") return false;
    if (isOurProposalSeparatorState(state)) return false;
    if (isGenericCostingSupportState(state)) return false;
    return isCostingSectionLayout(state.layoutId) || isCostingRowsLayout(state.layoutId);
  }

  function getSectionDeptChildPages(tree, node) {
    if (!tree || !node) return [];
    return getDirectChildHeadingNodes(tree, node).filter(function (child) {
      var parsed = parseHeadingBaseMeta(getNodeRawTitle(child));
      return parsed.renderType === "dept";
    });
  }

  function getNavigableProposalHeadingNodes(tree) {
    var out = [];
    if (!tree) return out;

    function walk(childIds) {
      for (var i = 0; i < (childIds || []).length; i++) {
        var node = tree.get_node(childIds[i]);
        if (!node || !node.id || node.id === "#") continue;
        if (isNavigableProposalHeadingNode(tree, node)) out.push(node);
        if (node.children && node.children.length) walk(node.children);
      }
    }

    var root = tree.get_node("#");
    if (root && root.children) walk(root.children);
    return out;
  }

  function isNavigableProposalHeadingNode(tree, node) {
    if (!tree || !node || !node.data || Number(node.data.kind) !== 0) return false;
    if (isSelectableEventOverviewRoot(node)) return true;
    if (findEventOverviewAncestor(tree, node)) return false;

    var parsed = parseHeadingBaseMeta(getNodeRawTitle(node));
    return parsed.renderType === "section" || parsed.renderType === "dept";
  }

  function getEditorNavigationState() {
    if (!editor.rootNode) return null;

    var tree = getTree();
    if (!tree) return null;

    var nodes = getNavigableProposalHeadingNodes(tree);
    var currentId = getNodeDataId(editor.rootNode);
    var index = -1;

    for (var i = 0; i < nodes.length; i++) {
      if (getNodeDataId(nodes[i]) === currentId) {
        index = i;
        break;
      }
    }

    if (index === -1) return null;

    return {
      nodes: nodes,
      index: index,
      prev: index > 0 ? nodes[index - 1] : null,
      next: index < nodes.length - 1 ? nodes[index + 1] : null
    };
  }

  function getGenericNavigationState() {
    return getEditorNavigationState();
  }

  function getManagedRowsForLayout(layoutId, rows) {
    rows = (rows || []).map(normaliseGenericRow);
    if (layoutId === GENERIC_LAYOUTS.CRITICAL_PATH) return rows.slice(0, GENERIC_MAX_MILESTONES).length ? rows.slice(0, GENERIC_MAX_MILESTONES) : [blankGenericRow("milestone")];
    if (layoutId === GENERIC_LAYOUTS.DEPT_TABLE) return rows.slice(0, GENERIC_MAX_COST_LINES);
    return [];
  }

  function isGenericManagedRowsLayout(layoutId) {
    return layoutId === GENERIC_LAYOUTS.CRITICAL_PATH;
  }

  function isCostingRowsLayout(layoutId) {
    return layoutId === GENERIC_LAYOUTS.DEPT_TABLE;
  }

  function isGenericCostingSupportState(state) {
    if (!state || !isCostingRowsLayout(state.layoutId)) return false;
    var title = normalizeGenericMatchText(state.title);
    return title === normalizeGenericMatchText(COSTING_TECHNICAL_SUMMARY_TITLE) ||
      title === normalizeGenericMatchText(COSTING_TECHNICAL_USE_TITLE);
  }

  function isGenericCostingSummaryState(state) {
    if (!state || !isCostingRowsLayout(state.layoutId)) return false;
    return normalizeGenericMatchText(state.title) === normalizeGenericMatchText(COSTING_TECHNICAL_SUMMARY_TITLE);
  }

  function shouldReadGenericRowsLayout(layoutId) {
    return isGenericManagedRowsLayout(layoutId) || isCostingRowsLayout(layoutId);
  }

  function isGenericLockedLayout(layoutId) {
    return layoutId === GENERIC_LAYOUTS.SUSTAINABILITY || layoutId === GENERIC_LAYOUTS.ABOUT_US;
  }

  function readGenericRowState(node, layoutId) {
    var data = node && node.data ? node.data : {};
    return normaliseGenericRow({
      uid: newUid("genericrow"),
      id: getNodeDataId(node),
      kind: layoutId === GENERIC_LAYOUTS.CRITICAL_PATH ? "milestone" : (layoutId === GENERIC_LAYOUTS.DEPT_TABLE ? "costingRevenue" : "person"),
      name: getGenericNodeName(node),
      altName: getGenericDataField(data, ["ALT_NAME", "ALTERNATIVE", "ALTNAME", "alt_name", "altName"]),
      additional: getGenericDataField(data, ["ADDITIONAL", "DESCRIPTION", "additional"]),
      technical: getGenericDataField(data, ["TECHNICAL", "technical"]),
      imageUrl: getGenericDataField(data, ["IMAGE_URL", "image_url", "IMG_URL", "img_url"]),
      revenue: getGenericRevenueFieldValue(data),
      qty: getGenericDataField(data, ["QTY", "qty"]),
      nodeData: cloneItemSnapshot(data)
    });
  }

  function getGenericNodeName(node) {
    if (!node) return "";
    var data = node.data || {};
    var value = data.title != null ? data.title : (data.TITLE != null ? data.TITLE : (data.name != null ? data.name : data.NAME));
    if (!$.trim(String(value || "")) && node.text != null) value = node.text;
    return normaliseWhitespace(value);
  }

  function getGenericDataField(data, keys) {
    data = data || {};
    for (var i = 0; i < keys.length; i++) {
      if (data[keys[i]] != null) return String(data[keys[i]] || "");
    }
    return "";
  }

  function getGenericRevenueFieldValue(data) {
    data = data || {};
    var sellKeys = ["PRICE", "price", "UNIT_PRICE", "unit_price", "TOTAL", "total"];
    var firstSellValue = "";
    var hasSellValue = false;
    var hasNonZeroSellValue = false;

    for (var i = 0; i < sellKeys.length; i++) {
      if (data[sellKeys[i]] == null) continue;
      var sellValue = String(data[sellKeys[i]] || "");
      if (!hasSellValue) firstSellValue = sellValue;
      hasSellValue = true;
      if (normaliseMoneyForPayload(sellValue) !== "0") {
        hasNonZeroSellValue = true;
        return sellValue;
      }
    }

    var expectedCostValue = getGenericDataField(data, ["VALUE", "value"]);
    if (hasSellValue && !hasNonZeroSellValue && normaliseMoneyForPayload(expectedCostValue) !== "0") return expectedCostValue;
    return expectedCostValue || firstSellValue;
  }

  function isLegacyRevenueStoredInExpectedCost(data) {
    data = data || {};
    var sellKeys = ["PRICE", "price", "UNIT_PRICE", "unit_price", "TOTAL", "total"];
    var hasNonZeroSellValue = false;

    for (var i = 0; i < sellKeys.length; i++) {
      if (data[sellKeys[i]] == null) continue;
      if (normaliseMoneyForPayload(String(data[sellKeys[i]] || "")) !== "0") {
        hasNonZeroSellValue = true;
        break;
      }
    }

    var expectedCostValue = getGenericDataField(data, ["VALUE", "value"]);
    return !hasNonZeroSellValue && normaliseMoneyForPayload(expectedCostValue) !== "0";
  }

  function normaliseGenericState(state) {
    state = state || {};
    var layoutId = String(state.layoutId || GENERIC_LAYOUTS.DEPT_TABLE);
    var rows = Array.isArray(state.rows) ? state.rows.map(normaliseGenericRow) : [];
    var labourDays = Array.isArray(state.labourDays) ? state.labourDays.slice(0, CFG.maxSchedules).map(normaliseLabourDay) : [];
    var renderType = state.renderType === "section" ? "section" : (state.renderType === "normal" ? "normal" : "dept");
    var title = String(state.title || "");
    var hidden = !!state.hidden;
    if (isGenericManagedRowsLayout(layoutId) && !rows.length) rows.push(blankGenericRow(layoutId === GENERIC_LAYOUTS.CRITICAL_PATH ? "milestone" : "person"));
    if (layoutId === GENERIC_LAYOUTS.HERO && renderType === "section") {
      title = "Hero";
      hidden = false;
    }

    return {
      mode: MODE_GENERIC,
      rootId: String(state.rootId || ""),
      parentId: String(state.parentId || "0"),
      rawName: String(state.rawName || ""),
      renderType: renderType,
      hidden: hidden,
      additionalOptions: !!state.additionalOptions,
      cascadeAdditionalOptions: !!state.cascadeAdditionalOptions,
      title: title,
      titleSuffix: String(state.titleSuffix || ""),
      blurb: String(state.blurb || ""),
      technical: String(state.technical || ""),
      layoutId: layoutId,
      deptLayout: normaliseLayout(state.deptLayout || LAYOUT_IMAGE),
      layoutLabel: state.layoutLabel || genericLayoutLabel(layoutId),
      sectionTitle: String(state.sectionTitle || ""),
      flag: state.flag == null ? 0 : state.flag,
      customFields: state.customFields || "",
      pageMeta: normaliseMeta(state.pageMeta),
      nodeData: state.nodeData || null,
      rows: rows,
      labourDays: labourDays,
      originalManagedIds: normaliseIdList(state.originalManagedIds || []),
      totalChildRows: Number(state.totalChildRows || 0) || 0,
      totalChildItems: Number(state.totalChildItems || state.totalChildRows || 0) || 0,
      costingTechnicalSummaryId: String(state.costingTechnicalSummaryId || ""),
      costingTechnicalUseId: String(state.costingTechnicalUseId || ""),
      costingSummaryRows: Array.isArray(state.costingSummaryRows) ? state.costingSummaryRows.map(normaliseGenericRow) : [],
      costingUseRows: Array.isArray(state.costingUseRows) ? state.costingUseRows.map(normaliseGenericRow) : [],
      originalCostingSummaryIds: normaliseIdList(state.originalCostingSummaryIds || []),
      originalCostingUseIds: normaliseIdList(state.originalCostingUseIds || [])
    };
  }

  function normaliseGenericRow(row) {
    row = row || {};
    return {
      uid: String(row.uid || newUid("genericrow")),
      id: String(row.id || ""),
      kind: String(row.kind || "person"),
      name: String(row.name || ""),
      altName: String(row.altName || ""),
      additional: String(row.additional || ""),
      technical: String(row.technical || ""),
      imageUrl: String(row.imageUrl || ""),
      revenue: String(row.revenue || ""),
      qty: String(row.qty || ""),
      nodeData: row.nodeData || null
    };
  }

  function blankGenericRow(kind) {
    return {
      uid: newUid("genericrow"),
      id: "",
      kind: kind || "person",
      name: "",
      altName: "",
      additional: "",
      technical: "",
      imageUrl: "",
      revenue: "",
      qty: "",
      nodeData: null
    };
  }

  function getDefaultLabourDayTitle(index) {
    if (Number(index) === 0) return "Day of event";
    return "Day " + String(Number(index) + 1);
  }

  function normaliseLabourDay(day) {
    day = day || {};
    var itemIds = normaliseIdList(day.itemIds || []);
    var itemNames = Array.isArray(day.itemNames) ? day.itemNames.map(function (name) { return String(name || ""); }).filter(Boolean) : [];
    var itemRefs = Array.isArray(day.itemRefs) ? day.itemRefs.map(function (item) {
      item = item || {};
      return {
        id: String(item.id || ""),
        kind: Number(item.kind == null ? 0 : item.kind),
        name: String(item.name || "")
      };
    }).filter(function (item) { return !!item.id; }) : [];

    return {
      uid: String(day.uid || newUid("labourday")),
      id: String(day.id || ""),
      title: cleanHeadingTitle(day.title || ""),
      intro: String(day.intro || ""),
      baseMemo: String(day.baseMemo || ""),
      meta: readLabourDayMeta(day.meta),
      nodeData: day.nodeData || null,
      itemIds: itemIds,
      itemCount: Math.max(itemIds.length, itemRefs.length, Number(day.itemCount || 0) || 0),
      itemNames: itemNames.slice(0, 4),
      itemRefs: itemRefs
    };
  }

  function blankLabourDay(defaultTitle) {
    return normaliseLabourDay({
      title: defaultTitle == null ? "" : String(defaultTitle),
      intro: "",
      baseMemo: "",
      meta: null,
      nodeData: null,
      itemIds: [],
      itemCount: 0,
      itemNames: [],
      itemRefs: []
    });
  }

  function getLabourDayAtIndex(state, index) {
    var days = state && state.labourDays ? state.labourDays : [];
    return normaliseLabourDay(days[index] || blankLabourDay(index === 0 ? "Day of event" : ""));
  }

  function getLabourDaysForEditor(state) {
    var days = [];
    for (var i = 0; i < CFG.maxSchedules; i++) {
      days.push(getLabourDayAtIndex(state, i));
    }
    return days;
  }

  function getLabourDayLimitForState(state) {
    state = normaliseGenericState(state || {});
    return normaliseLayout(state.deptLayout || LAYOUT_IMAGE) === LAYOUT_COLUMNS ? CFG.maxSchedules : 1;
  }

  function getVisibleLabourDays(state) {
    return getLabourDaysForEditor(state).slice(0, getLabourDayLimitForState(state));
  }

  function getLabourDayLabel(day, index) {
    day = normaliseLabourDay(day);
    return $.trim(day.title) || getDefaultLabourDayTitle(index);
  }

  function isMeaningfulLabourDay(day) {
    day = normaliseLabourDay(day);
    return !!(day.id || $.trim(day.title) || $.trim(day.intro) || day.itemCount || day.itemIds.length);
  }

  function indexLabourDaysByUid(days) {
    var out = {};
    for (var i = 0; i < (days || []).length; i++) {
      var day = days[i];
      if (day && day.uid) out[day.uid] = normaliseLabourDay(day);
    }
    return out;
  }

  function readLabourDayMeta(meta) {
    meta = normaliseMeta(meta);
    if (!meta || String(meta.editor || "") !== LABOUR_DAY_META_EDITOR) return null;
    return meta;
  }

  function renderGenericEditor(state) {
    state = normaliseGenericState(state || editor.current || {});
    editor.current = state;

    var html = '' +
      '<div class="wpe-editor">' +
        genericTopbarHtml(state) +
        '<div class="wpe-canvas-shell">' + genericCanvasHtml(state) + '</div>' +
        genericActionsHtml(state) +
      '</div>';

    $("#" + CFG.bodyId).html(html);
    setSaveEnabled(!isGenericLockedLayout(state.layoutId));
    if ($("#" + CFG.overlayId).is(":visible")) {
      attachEditorPreviewDockSoon();
      refreshEditorPreviewForCurrentHeadingSoon();
    }
  }

  function genericTopbarHtml(state) {
    var managed = isGenericManagedRowsLayout(state.layoutId);
    var note = managed
      ? "This page type stores its visible cards as child custom rows."
      : (isCostingRowsLayout(state.layoutId)
        ? "Use the costing builder below for client revenue lines and the hidden Technical Use folder for internal listed items."
        : "This editor updates the heading title, description and technical/image field. Existing costing rows are not changed.");

    if (state.layoutId === GENERIC_LAYOUTS.SECTION_COVER) {
      note = "This title cover is the Section page. Use the Dept controls below to open an existing child costing page or create a new one inside this section.";
    }
    if (isOurProposalSeparatorState(state)) {
      note = "Our Proposal is a fixed visual separator. The only editable setting is whether it is hidden from the proposal.";
    }
    if (isFixedHeroState(state)) {
      note = "Hero is the fixed opening page. Its heading name and visibility are locked; only the background image is edited here.";
    }
    if (isVenueHeroState(state)) {
      note = "The venue name is taken from the project details automatically. You can edit the description, image URL and hide setting only.";
    }
    if (shouldUseLabourDayFolders(state)) {
      note = "Labour uses up to three Day folders for crew resource items. Edit the day titles here, then use each day card to save changes or delete an entire saved crew folder.";
    }
    if (state.layoutId === GENERIC_LAYOUTS.PM || state.layoutId === GENERIC_LAYOUTS.TEAM) {
      note = "People on this page are managed from HireHop's native listed-item picker, not from manual fields in this editor.";
    }
    if (state.layoutId === GENERIC_LAYOUTS.DETAILS_CONTAINER) {
      note = "Details is a locked container. Keep the heading named Details; use the suffix selector only, then select a nested page heading to edit the pages inside.";
    }
    if (isGenericLockedLayout(state.layoutId)) {
      note = "This page is locked because its visible copy is controlled by the renderer.";
    }

    return '' +
      '<div class="wpe-topbar">' +
        '<div class="wpe-layout-card">' +
          '<div class="wpe-layout-kicker">Detected page type</div>' +
          '<div class="wpe-layout-title">' + esc(state.layoutLabel) + '</div>' +
          '<div class="wpe-layout-note">' + esc(note) + '</div>' +
          genericModifierControlsHtml(state) +
        '</div>' +
        proposalNavigationCardHtml() +
      '</div>';
  }

  function genericModifierControlsHtml(state) {
    if (isGenericLockedLayout(state.layoutId)) return '';

    var controls = [];
    if (isOurProposalSeparatorState(state)) {
      return '<div class="wpe-modifier-strip"><label class="wpe-toggle-pill"><input type="checkbox" data-generic-field="hidden"' + (state.hidden ? ' checked' : '') + '> Hide page //</label></div>';
    }
    if (state.layoutId === GENERIC_LAYOUTS.SECTION_COVER) {
      controls.push(sectionDeptPickerHtml(state));
    }
    if (shouldUseLabourDayFolders(state)) {
      controls.push(genericDeptLayoutControlsHtml(state));
    }
    if (state.layoutId !== GENERIC_LAYOUTS.DETAILS_CONTAINER && !isFixedHeroState(state)) {
      controls.push('<label class="wpe-toggle-pill"><input type="checkbox" data-generic-field="hidden"' + (state.hidden ? ' checked' : '') + '> Hide page //</label>');
      if (isOptionalItemsEligibleState(state)) {
        controls.push('<label class="wpe-toggle-pill"><input type="checkbox" data-generic-field="additionalOptions"' + (state.additionalOptions ? ' checked' : '') + '> Optional Items $</label>');
      }
    }

    if (state.layoutId === GENERIC_LAYOUTS.SUMMARY) {
      controls.push(genericSuffixSelectHtml(state.titleSuffix, [
        [" - None", "Project total only"],
        [" - Dept", "Subtotal by Dept"],
        [" - Section", "Subtotal by Section"]
      ]));
    } else if (state.layoutId === GENERIC_LAYOUTS.THANKYOU) {
      controls.push(genericSuffixSelectHtml(state.titleSuffix, [
        ["", "Default layout"],
        [" - Alt", "Alt layout"]
      ]));
    } else if (state.layoutId === GENERIC_LAYOUTS.DETAILS_CONTAINER) {
      controls.push(genericSuffixSelectHtml(state.titleSuffix, [
        ["", "Auto alternate"],
        [" - Left", "First image left"],
        [" - Right", "First image right"]
      ]));
    }

    return controls.length ? '<div class="wpe-modifier-strip">' + controls.join('') + '</div>' : '';
  }

  function proposalNavigationCardHtml() {
    var nav = getEditorNavigationState();
    if (!nav) return "";

    var position = String(nav.index + 1) + " / " + String(nav.nodes.length);
    var caption = nav.prev
      ? "Previous: " + getNodeTitle(nav.prev)
      : (nav.next ? "Next: " + getNodeTitle(nav.next) : "Only one proposal page is available in this list.");

    return '' +
      '<div class="wpe-nav-card">' +
        '<div class="wpe-nav-head"><span>Heading navigation</span><span class="wpe-nav-pos">' + esc(position) + '</span></div>' +
        '<div class="wpe-nav-actions">' +
          '<button type="button" class="wpe-mini-btn" data-weo-action="navigate-prev"' + (nav.prev ? '' : ' disabled') + '>Previous</button>' +
          '<button type="button" class="wpe-mini-btn" data-weo-action="navigate-next"' + (nav.next ? '' : ' disabled') + '>Next</button>' +
        '</div>' +
        '<div class="wpe-nav-caption">' + esc(caption) + '</div>' +
      '</div>';
  }

  function genericNavigationCardHtml() {
    return proposalNavigationCardHtml();
  }

  function sectionDeptPickerHtml(state) {
    var tree = getTree();
    var sectionNode = tree ? (findHeadingNodeByDataId(tree, state.rootId) || editor.rootNode) : editor.rootNode;
    var depts = getSectionDeptChildPages(tree, sectionNode);
    var options = ['<option value="">Select existing Dept page...</option>'];

    for (var i = 0; i < depts.length; i++) {
      options.push('<option value="' + attr(getNodeDataId(depts[i])) + '">' + esc(getNodeTitle(depts[i])) + '</option>');
    }

    return '' +
      '<div class="wpe-title-cover-options">' +
        '<div class="wpe-title-cover-option">' +
          '<div><b>Open a costing page inside this section</b><span>Choose an existing Dept heading and switch straight to editing that page.</span></div>' +
          '<label class="wpe-select-pill">Dept page <select data-generic-field="sectionDeptTarget">' + options.join("") + '</select></label>' +
          '<button type="button" class="wpe-mini-btn" data-weo-action="open-section-dept">Open selected Dept</button>' +
        '</div>' +
        '<div class="wpe-title-cover-option">' +
          '<div><b>Create a new costing page here</b><span>Add a Dept heading under this Section, then open its editor automatically.</span></div>' +
          '<label class="wpe-input-pill">Dept title <input type="text" data-generic-field="newDeptTitle" placeholder="e.g. Labour"></label>' +
          '<button type="button" class="wpe-mini-btn" data-weo-action="create-section-dept">Create Dept + open</button>' +
        '</div>' +
      '</div>';
  }

  function genericDeptLayoutControlsHtml(state) {
    var current = normaliseLayout(state.deptLayout || LAYOUT_IMAGE);
    var isLabour = shouldUseLabourDayFolders(state);

    return '' +
      '<div class="wpe-dept-layout-options">' +
        genericDeptLayoutPillHtml(LAYOUT_IMAGE, current, isLabour ? "Image split" : "Table with half-page image", isLabour ? "Use the image-led layout with the day folders stacked beside it." : "Use one costing table with an image area on the right.") +
        genericDeptLayoutPillHtml(LAYOUT_COLUMNS, current, isLabour ? "Three day columns" : "Three columns, no image", isLabour ? "Use three columns when the labour page needs up to three Day folders side by side." : "Use columns when the page needs more text or rows, not a picture.") +
      '</div>';
  }

  function genericDeptLayoutPillHtml(value, current, title, note) {
    return '' +
      '<label class="wpe-dept-layout-pill' + (value === current ? ' is-selected' : '') + '">' +
        '<input type="radio" name="wpe-dept-layout" data-generic-field="deptLayout" value="' + attr(value) + '"' + (value === current ? ' checked' : '') + '>' +
        '<span><b>' + esc(title) + '</b><span>' + esc(note) + '</span></span>' +
      '</label>';
  }

  function genericSuffixSelectHtml(current, options) {
    var html = '<label class="wpe-select-pill">Suffix <select data-generic-field="titleSuffix">';
    for (var i = 0; i < options.length; i++) {
      var value = options[i][0];
      var label = options[i][1];
      html += '<option value="' + attr(value) + '"' + (String(current || '') === value ? ' selected' : '') + '>' + esc(label) + '</option>';
    }
    html += '</select></label>';
    return html;
  }

  function genericRenderTypeSelectHtml(current, options) {
    var html = '<label class="wpe-select-pill">Open <select data-generic-field="renderType">';
    for (var i = 0; i < options.length; i++) {
      var value = options[i][0];
      var label = options[i][1];
      html += '<option value="' + attr(value) + '"' + (String(current || '') === value ? ' selected' : '') + '>' + esc(label) + '</option>';
    }
    html += '</select></label>';
    return html;
  }

  function genericActionsHtml(state) {
    if (isOurProposalSeparatorState(state)) return '';
    if (shouldUseLabourDayFolders(state)) return genericLabourActionsHtml(state);
    if (state.layoutId === GENERIC_LAYOUTS.DEPT_TABLE) return genericCostingActionsHtml(state);
    if (isGenericLockedLayout(state.layoutId)) return '<div class="wpe-page-actions"><span>This renderer-controlled page is locked. Select another heading to edit.</span></div>';

    var add = "";
    if (state.layoutId === GENERIC_LAYOUTS.CRITICAL_PATH) {
      add = '<button type="button" class="wpe-mini-btn" data-weo-action="add-generic-row" data-row-kind="milestone"' + (state.rows.length >= GENERIC_MAX_MILESTONES ? ' disabled' : '') + '>+ Add milestone</button>';
    }

    var warning = "";
    if ((state.layoutId === GENERIC_LAYOUTS.PM || state.layoutId === GENERIC_LAYOUTS.TEAM)) {
      warning = '<span>People cards are curated via HireHop internal items and are not edited directly here.</span>';
      add = '<button type="button" class="wpe-mini-btn" data-weo-action="open-native-managed-people">Use HireHop listed-item picker</button>';
    } else if (!isGenericManagedRowsLayout(state.layoutId) && state.totalChildRows) {
      warning = '<span>Existing child rows are preserved and not edited here.</span>';
    }

    return '<div class="wpe-page-actions">' + warning + add + '</div>';
  }

  function genericLabourActionsHtml(state) {
    return '<div class="wpe-page-actions"><span>Each Day card saves the Labour page and can delete its saved crew folder. Image split keeps one Day folder; three-column layout can keep up to three.</span></div>';
  }

  function genericCostingActionsHtml(state) {
    var isTechnicalSummary = isGenericCostingSummaryState(state);
    var isSupportFolder = isGenericCostingSupportState(state);
    var rows = (isTechnicalSummary ? (state.rows || []) : (state.costingSummaryRows || [])).map(normaliseGenericRow);
    var rowHtml = rows.map(function (row, index) { return genericCostingRowHtml(row, index); }).join("");
    if (!rowHtml) rowHtml = '<div class="wpe-costing-note">No client-facing revenue lines yet. Add one below.</div>';

    var createSummaryButton = (!isTechnicalSummary && !state.costingTechnicalSummaryId)
      ? '<button type="button" class="wpe-mini-btn" data-weo-action="open-technical-summary-editor">Open/create Technical Summary</button>'
      : '';
    var revenueButton = '<button type="button" class="wpe-mini-btn" data-weo-action="add-costing-revenue-row" data-row-kind="costingRevenue"' + (rows.length >= GENERIC_MAX_COST_LINES ? ' disabled' : '') + '>+ Client revenue line</button>';
    var supportNote = isSupportFolder
      ? 'This support folder is not a rendered proposal page. Save rows here only if you opened it directly; normally edit them from the parent Dept page.'
      : 'Rows below are saved inside Technical Summary, while this visual editor stays on the parent Dept page.';

    return '' +
      '<div class="wpe-costing-panel">' +
        '<div class="wpe-costing-head">' +
          '<div><div class="wpe-costing-title">Costing builder</div><div class="wpe-costing-note">' + esc(supportNote) + ' Internal inventory/package items should live in the hidden // Technical Use folder.</div></div>' +
          '<div class="wpe-costing-actions">' +
            createSummaryButton +
            revenueButton +
            '<button type="button" class="wpe-mini-btn" data-weo-action="open-technical-use-picker">+ Listed internal item</button>' +
          '</div>' +
        '</div>' +
        '<div class="wpe-costing-lines">' + rowHtml + '</div>' +
      '</div>';
  }

  function genericCostingRowHtml(row, index) {
    row = normaliseGenericRow(row);
    return '' +
      '<div class="wpe-costing-row" data-generic-row-uid="' + attr(row.uid) + '" data-row-id="' + attr(row.id) + '" data-row-kind="costingRevenue" data-row-index="' + index + '">' +
        '<input class="wpe-field" data-generic-row-field="name" value="' + attr(row.name) + '" placeholder="Client-friendly line item name">' +
        '<input class="wpe-field" data-generic-row-field="revenue" value="' + attr(row.revenue) + '" placeholder="Revenue £">' +
        '<button type="button" class="wpe-mini-btn is-danger" data-weo-action="remove-generic-row" data-row-index="' + index + '">Remove</button>' +
      '</div>';
  }

  function genericCanvasHtml(state) {
    if (state.layoutId === GENERIC_LAYOUTS.HERO) return genericHeroHtml(state);
    if (state.layoutId === GENERIC_LAYOUTS.SECTION_COVER) return genericSectionCoverHtml(state);
    if (state.layoutId === GENERIC_LAYOUTS.VISUAL) return genericVisualHtml(state);
    if (state.layoutId === GENERIC_LAYOUTS.FPVISUAL) return genericFullVisualHtml(state);
    if (state.layoutId === GENERIC_LAYOUTS.VENUE_HERO) return genericVenueHeroHtml(state);
    if (state.layoutId === GENERIC_LAYOUTS.EXP || state.layoutId === GENERIC_LAYOUTS.EXPERTS) return genericExperienceHtml(state);
    if (state.layoutId === GENERIC_LAYOUTS.PM) return genericProjectManagerHtml(state);
    if (state.layoutId === GENERIC_LAYOUTS.TEAM) return genericTeamHtml(state);
    if (state.layoutId === GENERIC_LAYOUTS.CRITICAL_PATH) return genericCriticalPathHtml(state);
    if (state.layoutId === GENERIC_LAYOUTS.THANKYOU) return genericThankYouHtml(state);
    if (state.layoutId === GENERIC_LAYOUTS.DETAILS_CONTAINER) return genericDetailsContainerHtml(state);
    if (state.layoutId === GENERIC_LAYOUTS.SUSTAINABILITY) return genericLockedPageHtml(state, "Sustainability", "This page is locked. The renderer controls the sustainability title, copy and image treatment.", true);
    if (state.layoutId === GENERIC_LAYOUTS.ABOUT_US) return genericLockedPageHtml(state, "About Us", "This page is locked. The renderer controls the About Us title, copy and image treatment.", true);
    return genericDeptTableHtml(state);
  }

  function proofCommonHtml(dark) {
    return '<div class="wpe-logo">Wise logo</div><div class="wpe-footer"><span>Event date · Job · Version</span><span>Page no.</span></div>';
  }

  function titleFieldHtml(value, className, placeholder) {
    return '<textarea class="wpe-field wpe-heading ' + (className || "") + '" data-generic-field="title" placeholder="' + attr(placeholder || "Page title") + '">' + esc(titleForEditing(value)) + '</textarea>';
  }

  function blurbFieldHtml(value, className, placeholder) {
    return '<textarea class="wpe-field wpe-blurb ' + (className || "") + '" data-generic-field="blurb" placeholder="' + attr(placeholder || "Short page text") + '">' + esc(value) + '</textarea>';
  }

  function fixedTitleLockHtml(title, note) {
    return '<div class="wpe-fixed-title-lock"><b>' + esc(title || "") + '</b><span>' + esc(note || "") + '</span></div>';
  }

  function technicalFieldHtml(value, label, placeholder) {
    return '' +
      '<div class="wpe-image-url">' +
        '<label>' + esc(label || "Image / technical URL") + '</label>' +
        '<input type="text" data-generic-field="technical" value="' + attr(value) + '" placeholder="' + attr(placeholder || "https://...") + '">' +
      '</div>';
  }

  function imagePreviewHtml(url, extraClass) {
    url = $.trim(String(url || ""));
    return '<div class="wpe-image-preview ' + (extraClass || "") + '"><span>' + esc(url ? "Image shown in document preview" : "Image area") + '</span></div>';
  }

  function setImagePreviewUrl($preview, url) {
    if (!$preview || !$preview.length) return;

    var nextUrl = $.trim(String(url || ""));
    var $placeholder = $preview.children("span").first();

    $preview.find("img").remove();
    if ($placeholder.length) $placeholder.text(nextUrl ? "Image shown in document preview" : "Image area").show();
    else $preview.append("<span>" + esc(nextUrl ? "Image shown in document preview" : "Image area") + "</span>");
  }

  function syncGenericPageImagePreview($input) {
    if (!$input || !$input.length) return;
    var url = $.trim(String($input.val() || ""));
    var $scope = $input.closest(".wpe-image-url").parent();
    if (!$scope.length) $scope = $input.closest(".wpe-proof");
    setImagePreviewUrl($scope.find(".wpe-image-preview").first(), url);
  }

  function syncGenericRowImagePreview($input) {
    if (!$input || !$input.length) return;
    var url = $.trim(String($input.val() || ""));
    var $row = $input.closest("[data-generic-row-uid]");
    if (!$row.length) return;

    var $preview = $row.find(".wpe-image-preview").first();
    if (!$preview.length && $row.hasClass("wpe-pm-person")) {
      $preview = $row.closest(".wpe-pm-stage").find(".wpe-pm-image").first();
      if (!url) url = $.trim(String(normaliseGenericState(editor.current || {}).technical || ""));
    }

    setImagePreviewUrl($preview, url);
  }

  function genericHeroHtml(state) {
    return '' +
      '<div class="wpe-proof is-dark wpe-on-image">' +
        '<div class="wpe-full-image">' + imagePreviewHtml(state.technical) + '</div>' +
        technicalFieldHtml(state.technical, "Hero background image") +
        '<div class="wpe-center-title">' + fixedTitleLockHtml("Hero", "This opening page title is fixed by the renderer.") + '</div>' +
        '<div class="wpe-note-box">Hero metadata such as client, venue, date, project number and version comes from HireHop job fields and is not edited here.</div>' +
        proofCommonHtml(true) +
      '</div>';
  }

  function genericSectionCoverHtml(state) {
    if (isOurProposalSeparatorState(state)) return genericOurProposalSeparatorHtml(state);

    var headingLabel = state.renderType === "dept" ? "Dept" : "Section";
    return '' +
      '<div class="wpe-proof">' +
        '<div class="wpe-full-image">' + imagePreviewHtml(state.technical, "is-cover-status") + '</div>' +
        technicalFieldHtml(state.technical, headingLabel + " background image") +
        '<div class="wpe-center-title">' + titleFieldHtml(state.title, "", headingLabel + " title") + '</div>' +
        proofCommonHtml(false) +
      '</div>';
  }

  function genericOurProposalSeparatorHtml(state) {
    return '' +
      '<div class="wpe-proof">' +
        proofCommonHtml(false) +
        '<div class="wpe-center-title"><div class="wpe-heading" style="font-size:clamp(34px,4.4vw,62px);line-height:.98;text-align:center;">OUR<br>PROPOSAL</div></div>' +
        '<div class="wpe-separator-note">' +
          '<b>Visual separator page</b>' +
          '<span>This Section is controlled by the renderer. The only editable setting here is whether this separator is hidden from the proposal.</span>' +
        '</div>' +
      '</div>';
  }

  function genericDeptTableHtml(state) {
    if (shouldUseLabourDayFolders(state) && normaliseLayout(state.deptLayout || LAYOUT_IMAGE) === LAYOUT_COLUMNS) return genericLabourDeptColumnsHtml(state);
    if (shouldUseLabourDayFolders(state)) return genericLabourDeptTableHtml(state);

    var costPreview = genericCostPreviewHtml(state);
    return '' +
      '<div class="wpe-proof">' +
        proofCommonHtml(false) +
        '<div class="wpe-half-image">' + imagePreviewHtml(state.technical) + technicalFieldHtml(state.technical, "Half-page image URL") + '</div>' +
        '<div class="wpe-left-copy">' +
          '<div class="wpe-kicker">' + esc(state.sectionTitle || "Section") + '</div>' +
          titleFieldHtml(state.title, "", "Dept title") +
          blurbFieldHtml(state.blurb, "", "Short blurb above the table") +
          costPreview +
        '</div>' +
      '</div>';
  }

  function genericLabourDeptTableHtml(state) {
    return '' +
      '<div class="wpe-proof">' +
        proofCommonHtml(false) +
        '<div class="wpe-half-image">' + imagePreviewHtml(state.technical) + technicalFieldHtml(state.technical, "Half-page image URL") + '</div>' +
        '<div class="wpe-left-copy wpe-labour-copy">' +
          '<div class="wpe-kicker">' + esc(state.sectionTitle || "Section") + '</div>' +
          titleFieldHtml(state.title, "", "Dept title") +
          blurbFieldHtml(state.blurb, "", "Short intro above the day folders") +
          genericLabourDayCardsHtml(state, false) +
        '</div>' +
      '</div>';
  }

  function genericCostPreviewHtml(state) {
    if (!isCostingRowsLayout(state.layoutId)) return '';

    var title = normalizeGenericMatchText(state.title);
    var isTechnicalSummary = title === normalizeGenericMatchText(COSTING_TECHNICAL_SUMMARY_TITLE);
    var isTechnicalUse = title === normalizeGenericMatchText(COSTING_TECHNICAL_USE_TITLE);

    if (isTechnicalSummary) {
      return costingPreviewSectionHtml(COSTING_TECHNICAL_SUMMARY_TITLE, state.rows || [], false);
    }

    if (isTechnicalUse) {
      return costingPreviewSectionHtml('// ' + COSTING_TECHNICAL_USE_TITLE, state.rows || [], true);
    }

    var sections = [];
    sections.push(costingPreviewSectionHtml(COSTING_TECHNICAL_SUMMARY_TITLE, state.costingSummaryRows || [], false));
    sections.push(costingPreviewSectionHtml('// ' + COSTING_TECHNICAL_USE_TITLE + ' (hidden from client)', state.costingUseRows || [], true));
    return '<div class="wpe-cost-preview">' + sections.join('') + '</div>';
  }

  function costingPreviewSectionHtml(title, rows, hidden) {
    rows = (rows || []).map(normaliseGenericRow).filter(isMeaningfulGenericRow);
    var html = '<div class="wpe-cost-preview-section">' +
      '<div class="wpe-cost-preview-heading' + (hidden ? ' is-hidden' : '') + '">' + esc(title) + '</div>';

    if (!rows.length) {
      html += '<div class="wpe-cost-preview-empty">No rows yet.</div>';
    } else {
      for (var i = 0; i < rows.length; i++) {
        html += costingPreviewRowHtml(rows[i], hidden);
      }
    }

    html += '</div>';
    return html;
  }

  function costingPreviewRowHtml(row, hidden) {
    row = normaliseGenericRow(row);
    var price = row.revenue || getGenericRevenueFieldValue(row.nodeData || {});
    return '<div class="wpe-cost-preview-row' + (hidden ? ' is-hidden' : '') + '">' +
      '<span>' + esc(row.name || 'Untitled item') + '</span>' +
      '<span class="wpe-cost-preview-price">' + esc(price ? formatCostPreviewMoney(price) : '') + '</span>' +
    '</div>';
  }

  function formatCostPreviewMoney(value) {
    var raw = String(value || '').trim();
    if (!raw) return '';
    if (/^[£$€]/.test(raw)) return raw;
    var n = normaliseMoneyForPayload(raw);
    if (n === '0' && !/^0(?:\.0+)?$/.test(raw.replace(/[^0-9.]/g, ''))) return raw;
    return '£' + n;
  }

  function genericVisualHtml(state) {
    return '' +
      '<div class="wpe-proof">' +
        proofCommonHtml(false) +
        '<div class="wpe-visual-stage">' +
          '<div class="wpe-visual-copy">' + titleFieldHtml(state.title, "", "Visual title") + blurbFieldHtml(state.blurb, "", "Visual caption") + '</div>' +
          '<div class="wpe-visual-image">' + imagePreviewHtml(state.technical) + technicalFieldHtml(state.technical, "Visual image URL") + '</div>' +
        '</div>' +
      '</div>';
  }

  function genericFullVisualHtml(state) {
    return '' +
      '<div class="wpe-proof">' +
        '<div class="wpe-full-image">' + imagePreviewHtml(state.technical) + '</div>' +
        technicalFieldHtml(state.technical, "Full-page image or Canva URL", "https://...") +
        '<div class="wpe-note-box"><strong>Full-page visual:</strong> the renderer uses this URL as an image, or embeds it when it is a Canva URL.</div>' +
      '</div>';
  }

  function genericVenueHeroHtml(state) {
    return '' +
      '<div class="wpe-proof is-dark wpe-on-image">' +
        '<div class="wpe-full-image">' + imagePreviewHtml(state.technical) + '</div>' +
        technicalFieldHtml(state.technical, "Venue background image") +
        '<div class="wpe-venue-copy">' +
          '<div class="wpe-kicker">Your venue</div>' +
          '<div class="wpe-venue-title-lock"><b>Venue name</b><span>The proposal renderer uses the venue from the project details, so this heading name is intentionally locked.</span></div>' +
          blurbFieldHtml(state.blurb, "", "Venue description") +
        '</div>' +
        proofCommonHtml(true) +
      '</div>';
  }

  function genericExperienceHtml(state) {
    var titleSide = state.titleSuffix && /left/i.test(state.titleSuffix) ? "right" : "left";
    return '' +
      '<div class="wpe-proof">' +
        proofCommonHtml(false) +
        '<div class="wpe-half-image">' + imagePreviewHtml(state.technical) + technicalFieldHtml(state.technical, "Image URL") + '</div>' +
        '<div class="wpe-left-copy">' +
          titleFieldHtml(state.title, "", state.layoutId === GENERIC_LAYOUTS.EXPERTS ? "Our Experts" : "Experience & Expertise") +
          (state.layoutId === GENERIC_LAYOUTS.EXPERTS ? '<div class="wpe-kicker">&amp; Company co-owners</div>' : '') +
          blurbFieldHtml(state.blurb, "", "Page copy") +
        '</div>' +
      '</div>';
  }

  function genericProjectManagerHtml(state) {
    return '' +
      '<div class="wpe-proof">' +
        proofCommonHtml(false) +
        '<div class="wpe-pm-title">' + titleFieldHtml(state.title, "", "Project manager page title") + '</div>' +
        genericManagedPeopleNoteHtml("Project manager", "This card is populated from employee items added with HireHop's native listed-item picker. Use the action below to add or swap the person attached to this page.") +
      '</div>';
  }

  function genericDeptColumnsHtml(state) {
    if (shouldUseLabourDayFolders(state)) return genericLabourDeptColumnsHtml(state);

    var costPreview = genericCostPreviewHtml(state);

    return '' +
      '<div class="wpe-proof is-dept-columns">' +
        proofCommonHtml(false) +
        '<div class="wpe-dept-columns-grid">' +
          '<div class="wpe-dept-columns-copy">' +
            '<div class="wpe-kicker">' + esc(state.sectionTitle || "Section") + '</div>' +
            titleFieldHtml(state.title, "", "Dept title") +
            blurbFieldHtml(state.blurb, "", "Short intro for this three-column page") +
          '</div>' +
          '<div class="wpe-dept-columns-table">' + costPreview + '</div>' +
          '<div class="wpe-dept-columns-note"><b>No-image layout</b><span>This option tells the proposal renderer to use a three-column page instead of the half-image table layout.</span></div>' +
        '</div>' +
      '</div>';
  }

  function genericLabourDeptColumnsHtml(state) {
    return '' +
      '<div class="wpe-proof is-dept-columns">' +
        proofCommonHtml(false) +
        '<div class="wpe-labour-columns-shell">' +
          '<div class="wpe-labour-columns-copy">' +
            '<div class="wpe-kicker">' + esc(state.sectionTitle || "Section") + '</div>' +
            titleFieldHtml(state.title, "", "Dept title") +
            blurbFieldHtml(state.blurb, "", "Short intro above the day columns") +
          '</div>' +
          genericLabourDayCardsHtml(state, true) +
        '</div>' +
      '</div>';
  }

  function genericLabourDayCardsHtml(state, asColumns) {
    var days = getVisibleLabourDays(state);
    var cards = [];

    for (var i = 0; i < days.length; i++) {
      cards.push(genericLabourDayCardHtml(days[i], i));
    }

    return '<div class="wpe-labour-days' + (asColumns ? ' is-columns' : '') + '">' + cards.join("") + '</div>';
  }

  function genericLabourDayCardHtml(day, index) {
    day = normaliseLabourDay(day);
    var count = Math.max(day.itemCount, day.itemIds.length, (day.itemRefs || []).length);
    var countLabel = count === 1 ? "1 item" : String(count) + " items";
    var preview = formatLabourDayItemPreview(day);
    var placeholder = getDefaultLabourDayTitle(index);
    var canDelete = isMeaningfulLabourDay(day);

    return '' +
      '<div class="wpe-labour-day' + (isMeaningfulLabourDay(day) ? '' : ' is-empty') + '" data-labour-day-uid="' + attr(day.uid) + '" data-labour-day-id="' + attr(day.id) + '" data-labour-day-index="' + index + '">' +
        '<div class="wpe-labour-day-head"><span class="wpe-small-label">Day ' + esc(String(index + 1)) + '</span><span class="wpe-labour-day-count">' + esc(countLabel) + '</span></div>' +
        '<input class="wpe-field" type="text" data-labour-day-field="title" value="' + attr(day.title) + '" placeholder="' + attr(placeholder) + '">' +
        '<textarea class="wpe-field" data-labour-day-field="intro" placeholder="Optional short note above the crew list.">' + esc(day.intro) + '</textarea>' +
        '<div class="wpe-labour-day-items' + (count ? '' : ' is-empty') + '">' + esc(preview) + '</div>' +
        '<div class="wpe-labour-day-actions">' +
          '<button type="button" class="wpe-mini-btn" data-weo-action="save-labour-day" data-labour-day-index="' + index + '">Save</button>' +
          '<button type="button" class="wpe-mini-btn is-danger" data-weo-action="delete-labour-day" data-labour-day-index="' + index + '"' + (canDelete ? '' : ' disabled') + '>Delete</button>' +
        '</div>' +
      '</div>';
  }

  function formatLabourDayItemPreview(day) {
    day = normaliseLabourDay(day);
    if (day.itemNames.length) return day.itemNames.join(" · ");
    if (Math.max(day.itemCount, day.itemIds.length)) return "Crew resource items are saved in this folder.";
    return "No crew resource items added yet.";
  }

  function genericTeamHtml(state) {
    return '' +
      '<div class="wpe-proof">' +
        proofCommonHtml(false) +
        '<div class="wpe-team-title">' + titleFieldHtml(state.title, "", "Team page title") + '</div>' +
        genericManagedPeopleNoteHtml("Specialist team", "Team members are curated from employee inventory items selected through HireHop's native listed-item picker. This editor keeps the page title here, while the people themselves stay managed in HireHop.") +
      '</div>';
  }

  function genericManagedPeopleNoteHtml(title, text) {
    return '' +
      '<div class="wpe-native-items-note">' +
        '<b>' + esc(title) + ' is managed from native HireHop items</b>' +
        '<p>' + esc(text) + '</p>' +
        '<p>When you need to curate the people shown here, use the listed-item picker rather than typing names, roles, biographies or image URLs into this editor.</p>' +
      '</div>';
  }

  function genericPersonCardHtml(person, index) {
    person = normaliseGenericRow(person);
    return '' +
      '<div class="wpe-person-card" data-generic-row-uid="' + attr(person.uid) + '" data-row-id="' + attr(person.id) + '" data-row-kind="person" data-row-index="' + index + '">' +
        imagePreviewHtml(person.imageUrl, "wpe-avatar") +
        '<input class="wpe-field" data-generic-row-field="imageUrl" value="' + attr(person.imageUrl) + '" placeholder="Image URL">' +
        '<input class="wpe-field" data-generic-row-field="altName" value="' + attr(person.altName || person.additional) + '" placeholder="Role">' +
        '<input class="wpe-field" data-generic-row-field="name" value="' + attr(person.name) + '" placeholder="Name">' +
        '<textarea class="wpe-field" data-generic-row-field="technical" placeholder="Short bio">' + esc(person.technical) + '</textarea>' +
        '<div class="wpe-row-actions"><button type="button" class="wpe-mini-btn is-danger" data-weo-action="remove-generic-row" data-row-index="' + index + '">Remove</button></div>' +
      '</div>';
  }

  function genericCriticalPathHtml(state) {
    var rows = state.rows.slice(0, GENERIC_MAX_MILESTONES);
    if (!rows.length) rows = [blankGenericRow("milestone")];
    var cards = rows.map(function (row, index) { return genericMilestoneCardHtml(row, index); }).join("");

    return '' +
      '<div class="wpe-proof">' +
        proofCommonHtml(false) +
        '<div class="wpe-timeline-title">' +
          '<div class="wpe-kicker">' + esc(state.sectionTitle || "") + '</div>' +
          titleFieldHtml(state.title, "", "Critical Path") +
        '</div>' +
        '<div class="wpe-timeline">' + cards + '</div>' +
      '</div>';
  }

  function genericMilestoneCardHtml(row, index) {
    row = normaliseGenericRow(row);
    return '' +
      '<div class="wpe-milestone-card" data-generic-row-uid="' + attr(row.uid) + '" data-row-id="' + attr(row.id) + '" data-row-kind="milestone" data-row-index="' + index + '">' +
        '<input class="wpe-field" data-generic-row-field="name" value="' + attr(row.name) + '" placeholder="Date / milestone">' +
        '<textarea class="wpe-field" data-generic-row-field="additional" placeholder="Description">' + esc(row.additional) + '</textarea>' +
        '<div class="wpe-row-actions"><button type="button" class="wpe-mini-btn is-danger" data-weo-action="remove-generic-row" data-row-index="' + index + '">Remove</button></div>' +
      '</div>';
  }

  function genericThankYouHtml(state) {
    var isAlt = /alt/i.test(String(state.titleSuffix || ""));
    if (isAlt) {
      return '' +
        '<div class="wpe-proof is-dark wpe-on-image is-thank-alt">' +
          '<div class="wpe-full-image">' + imagePreviewHtml(state.technical) + '</div>' +
          technicalFieldHtml(state.technical, "Thank-you background image") +
          '<div class="wpe-thank-alt-title">' + titleFieldHtml(state.title, "", "Thank you") + '</div>' +
          '<div class="wpe-note-box wpe-thank-alt-note">' + blurbFieldHtml(state.blurb, "", "Optional footer note") + '</div>' +
          proofCommonHtml(true) +
        '</div>';
    }

    return '' +
      '<div class="wpe-proof is-dark wpe-on-image">' +
        '<div class="wpe-full-image">' + imagePreviewHtml(state.technical) + '</div>' +
        technicalFieldHtml(state.technical, "Thank-you background image") +
        '<div class="wpe-center-title">' + titleFieldHtml(state.title, "", "Thank you") + '</div>' +
        '<div class="wpe-note-box" style="background:rgba(13,18,38,.55);color:#fffdf9;border-color:rgba(255,255,255,.28);">' + blurbFieldHtml(state.blurb, "", "Optional footer note") + '</div>' +
        proofCommonHtml(true) +
      '</div>';
  }

  function genericFixedContentHtml(state, heading, note, dark) {
    return genericLockedPageHtml(state, heading, note, dark);
  }

  function genericLockedPageHtml(state, heading, note, dark) {
    return '' +
      '<div class="wpe-proof' + (dark ? ' is-dark wpe-on-image' : '') + '">' +
        '<div class="wpe-full-image">' + imagePreviewHtml(state.technical) + '</div>' +
        '<div class="wpe-locked-panel"' + (dark ? ' style="background:rgba(13,18,38,.62);color:#fffdf9;border-color:rgba(255,255,255,.28);"' : '') + '>' +
          '<b>' + esc(heading || state.title || "Locked page") + '</b>' +
          '<p>' + esc(note || "This renderer-controlled page is locked.") + '</p>' +
          '<p>Select another heading in the supplying list to edit a configurable proposal page.</p>' +
        '</div>' +
        proofCommonHtml(dark) +
      '</div>';
  }

  function genericDetailsContainerHtml(state) {
    return '' +
      '<div class="wpe-proof">' +
        proofCommonHtml(false) +
        '<div class="wpe-center-title"><div class="wpe-heading" style="font-size:clamp(34px,4.4vw,62px);line-height:.98;text-align:center;">DETAILS</div></div>' +
        '<div class="wpe-locked-panel">' +
          '<b>Details is a container</b>' +
          '<p>Do not rename this heading or add an image URL here. Select one of the nested headings inside Details to edit the actual front proposal pages.</p>' +
          '<p>The suffix selector above controls whether the first image-led nested page starts left or right.</p>' +
        '</div>' +
      '</div>';
  }

  function readGenericFormState(previous) {
    var prior = normaliseGenericState(previous || editor.current || {});
    var state = clone(prior);
    var $body = $("#" + CFG.bodyId);

    var $title = $body.find('[data-generic-field="title"]').first();
    var $blurb = $body.find('[data-generic-field="blurb"]').first();
    var $technical = $body.find('[data-generic-field="technical"]').first();
    var $renderType = $body.find('[data-generic-field="renderType"]').first();
    var $titleSuffix = $body.find('[data-generic-field="titleSuffix"]').first();
    var $deptLayout = $body.find('input[name="wpe-dept-layout"]:checked').first();
    var $hidden = $body.find('[data-generic-field="hidden"]').first();
    var $additionalOptions = $body.find('[data-generic-field="additionalOptions"]').first();
    var $cascadeAdditionalOptions = $body.find('[data-generic-field="cascadeAdditionalOptions"]').first();

    if ($title.length) state.title = titleForStorage($title.val());
    if ($blurb.length) state.blurb = String($blurb.val() || "");
    if ($technical.length) state.technical = $.trim(String($technical.val() || ""));
    if ($renderType.length) state.renderType = String($renderType.val() || state.renderType || "dept");
    if ($titleSuffix.length) state.titleSuffix = String($titleSuffix.val() || "");
    if ($deptLayout.length) state.deptLayout = normaliseLayout($deptLayout.val() || state.deptLayout);
    if ($hidden.length) state.hidden = !!$hidden.prop("checked");
    if ($additionalOptions.length) state.additionalOptions = !!$additionalOptions.prop("checked");
    if ($cascadeAdditionalOptions.length) state.cascadeAdditionalOptions = !!$cascadeAdditionalOptions.prop("checked");
    if (isFixedHeroState(state)) {
      state.title = "Hero";
      state.hidden = false;
    }
    if (!isOptionalItemsEligibleState(state)) state.additionalOptions = false;
    if (!isLabourDeptLayoutState(state)) state.deptLayout = LAYOUT_IMAGE;
    state.cascadeAdditionalOptions = false;

    if (state.layoutId === GENERIC_LAYOUTS.DETAILS_CONTAINER) {
      state.title = "Details";
      state.technical = prior.technical || "";
      state.blurb = prior.blurb || "";
      state.hidden = true;
      state.additionalOptions = false;
      state.cascadeAdditionalOptions = false;
    }

    if (shouldUseLabourDayFolders(state)) {
      var oldDays = indexLabourDaysByUid(prior.labourDays || []);
      var nextDays = [];
      $body.find(".wpe-labour-day[data-labour-day-uid]").each(function () {
        var $card = $(this);
        var uid = String($card.attr("data-labour-day-uid") || newUid("labourday"));
        var oldDay = oldDays[uid] || {};
        var dayIndex = toInt($card.attr("data-labour-day-index"), nextDays.length);
        var title = cleanHeadingTitle($card.find('[data-labour-day-field="title"]').first().val());
        var intro = String($card.find('[data-labour-day-field="intro"]').first().val() || "");
        var hasExistingContent = !!(oldDay && (oldDay.id || oldDay.itemCount || (oldDay.itemIds || []).length));
        if (!title && (hasExistingContent || $.trim(intro))) title = getDefaultLabourDayTitle(dayIndex);

        nextDays.push(normaliseLabourDay({
          uid: uid,
          id: String($card.attr("data-labour-day-id") || oldDay.id || ""),
          title: title,
          intro: intro,
          baseMemo: String(oldDay.baseMemo || ""),
          meta: oldDay.meta || null,
          nodeData: oldDay.nodeData || null,
          itemIds: oldDay.itemIds || [],
          itemCount: oldDay.itemCount || 0,
          itemNames: oldDay.itemNames || [],
          itemRefs: oldDay.itemRefs || []
        }));
      });
      state.labourDays = nextDays.slice(0, getLabourDayLimitForState(state));
      return normaliseGenericState(state);
    }

    var costingSupport = isGenericCostingSupportState(prior);
    var oldRowsSource = isCostingRowsLayout(prior.layoutId) && !costingSupport ? (prior.costingSummaryRows || []) : (prior.rows || []);
    var oldRows = indexGenericRowsByUid(oldRowsSource);
    var rows = [];
    $body.find("[data-generic-row-uid]").each(function () {
      var $card = $(this);
      var uid = String($card.attr("data-generic-row-uid") || newUid("genericrow"));
      var oldRow = oldRows[uid] || {};
      var kind = String($card.attr("data-row-kind") || oldRow.kind || "person");

      rows.push(normaliseGenericRow({
        uid: uid,
        id: String($card.attr("data-row-id") || oldRow.id || ""),
        kind: kind,
        name: String($card.find('[data-generic-row-field="name"]').first().val() || ""),
        altName: String($card.find('[data-generic-row-field="altName"]').first().val() || ""),
        additional: String($card.find('[data-generic-row-field="additional"]').first().val() || ""),
        technical: String($card.find('[data-generic-row-field="technical"]').first().val() || ""),
        imageUrl: $.trim(String($card.find('[data-generic-row-field="imageUrl"]').first().val() || "")),
        revenue: $.trim(String($card.find('[data-generic-row-field="revenue"]').first().val() || oldRow.revenue || "")),
        qty: String($card.find('[data-generic-row-field="qty"]').first().val() || oldRow.qty || ""),
        nodeData: oldRow.nodeData || null
      }));
    });

    if (shouldReadGenericRowsLayout(state.layoutId)) {
      if (isCostingRowsLayout(state.layoutId)) {
        if (isGenericCostingSupportState(state)) {
          state.rows = rows;
        } else {
          state.costingSummaryRows = rows;
          state.rows = [];
        }
      } else {
        state.rows = rows.length ? rows : [blankGenericRow(state.layoutId === GENERIC_LAYOUTS.CRITICAL_PATH ? "milestone" : "person")];
      }
    }

    return normaliseGenericState(state);
  }

  function indexGenericRowsByUid(rows) {
    var out = {};
    for (var i = 0; i < (rows || []).length; i++) {
      var row = rows[i];
      if (row && row.uid) out[row.uid] = row;
    }
    return out;
  }

  function runGenericEditorAction($btn) {
    var action = String($btn.attr("data-weo-action") || "");
    var rowIndex = toInt($btn.attr("data-row-index"), -1);
    var dayIndex = toInt($btn.attr("data-labour-day-index"), -1);
    var rowKind = String($btn.attr("data-row-kind") || "person");
    var state = readGenericFormState(editor.current);

    if (action === "navigate-prev") {
      navigateProposalEditor(-1);
      return;
    }

    if (action === "navigate-next") {
      navigateProposalEditor(1);
      return;
    }

    if (action === "open-section-dept") {
      var selectedDeptId = String($("#" + CFG.bodyId).find('[data-generic-field="sectionDeptTarget"]').val() || "");
      if (!selectedDeptId) {
        setStatus("Choose a child Dept page to open first.", "warning");
        return;
      }
      openOrCreateGenericDeptChildFromSection({ targetId: selectedDeptId });
      return;
    }

    if (action === "create-section-dept") {
      var newDeptTitle = $.trim(String($("#" + CFG.bodyId).find('[data-generic-field="newDeptTitle"]').val() || ""));
      if (!newDeptTitle) {
        setStatus("Add a new Dept title first.", "warning");
        return;
      }
      openOrCreateGenericDeptChildFromSection({ title: newDeptTitle });
      return;
    }

    if (action === "open-technical-summary-editor") {
      openTechnicalSummaryEditor(state);
      return;
    }

    if (action === "open-technical-use-picker") {
      openTechnicalUsePicker(state);
      return;
    }

    if (action === "open-native-managed-people") {
      openNativeManagedPeoplePicker(state);
      return;
    }

    if (action === "save-labour-day" && dayIndex >= 0) {
      saveLabourDayCard(state, dayIndex);
      return;
    }

    if (action === "delete-labour-day" && dayIndex >= 0) {
      deleteLabourDayCard(state, dayIndex);
      return;
    }

    if (action === "add-costing-revenue-row") {
      var costingRows = isGenericCostingSupportState(state) ? state.rows : state.costingSummaryRows;
      if (costingRows.length >= GENERIC_MAX_COST_LINES) {
        setStatus("This costing table can show up to " + GENERIC_MAX_COST_LINES + " client revenue lines.", "warning");
        return;
      }
      costingRows.push(blankGenericRow("costingRevenue"));
      if (isGenericCostingSupportState(state)) state.rows = costingRows;
      else state.costingSummaryRows = costingRows;
    }

    if (action === "add-generic-row") {
      var limit = state.layoutId === GENERIC_LAYOUTS.CRITICAL_PATH ? GENERIC_MAX_MILESTONES : GENERIC_MAX_PEOPLE;
      if (state.rows.length >= limit) {
        setStatus("This page can show up to " + limit + " editable cards.", "warning");
        return;
      }
      state.rows.push(blankGenericRow(rowKind));
    }

    if (action === "remove-generic-row") {
      if (isCostingRowsLayout(state.layoutId) && !isGenericCostingSupportState(state)) {
        if (rowIndex >= 0 && rowIndex < state.costingSummaryRows.length) state.costingSummaryRows.splice(rowIndex, 1);
      } else if (rowIndex >= 0 && rowIndex < state.rows.length) {
        state.rows.splice(rowIndex, 1);
        if (!state.rows.length && !isCostingRowsLayout(state.layoutId)) state.rows.push(blankGenericRow(state.layoutId === GENERIC_LAYOUTS.CRITICAL_PATH ? "milestone" : "person"));
      }
    }

    editor.current = normaliseGenericState(state);
    renderEditor(editor.current);
    setStatus("", "");
  }

  function hasGenericUnsavedEditorChanges() {
    if (!editor.original) return false;
    if (!$("#" + CFG.overlayId).is(":visible")) return false;
    var currentState = readGenericFormState(editor.current || editor.original || {});
    return genericStateSignature(currentState) !== genericStateSignature(editor.original || {});
  }

  function genericStateSignature(state) {
    state = normaliseGenericState(state || {});
    function serialiseRows(rows) {
      return (rows || []).map(function (row) {
        row = normaliseGenericRow(row);
        return {
          id: row.id,
          name: $.trim(row.name),
          altName: $.trim(row.altName),
          additional: $.trim(row.additional),
          technical: $.trim(row.technical),
          imageUrl: $.trim(row.imageUrl),
          revenue: $.trim(row.revenue)
        };
      });
    }
    function serialiseLabourDays(days) {
      return (days || []).map(function (day) {
        day = normaliseLabourDay(day);
        return {
          id: day.id,
          title: $.trim(day.title),
          intro: $.trim(day.intro),
          itemIds: normaliseIdList(day.itemIds || []),
          itemCount: Number(day.itemCount || 0) || 0
        };
      });
    }

    return JSON.stringify({
      layoutId: state.layoutId,
      deptLayout: isLabourDeptLayoutState(state) ? normaliseLayout(state.deptLayout) : "",
      renderType: state.renderType,
      title: $.trim(String(state.title || "")),
      titleSuffix: String(state.titleSuffix || ""),
      hidden: !!state.hidden,
      additionalOptions: !!state.additionalOptions,
      cascadeAdditionalOptions: !!state.cascadeAdditionalOptions,
      blurb: $.trim(String(state.blurb || "")),
      technical: $.trim(String(state.technical || "")),
      rows: serialiseRows(state.rows),
      labourDays: serialiseLabourDays(state.labourDays),
      costingSummaryRows: serialiseRows(state.costingSummaryRows),
      costingUseRows: serialiseRows(state.costingUseRows)
    });
  }

  function validateGenericState(state) {
    state = normaliseGenericState(state);
    if (isGenericLockedLayout(state.layoutId)) return "This page is locked by the renderer and cannot be edited here.";
    if (state.layoutId === GENERIC_LAYOUTS.DETAILS_CONTAINER && normalizeGenericMatchText(state.title) !== "details") return "The Details container must remain named Details.";
    if (!$.trim(state.title) && state.layoutId !== GENERIC_LAYOUTS.FPVISUAL) return "Add a page title.";
    if (isFixedHeroState(state) && normalizeGenericMatchText(state.title) !== "hero") return "The Hero page title is fixed and must stay named Hero.";

    if (state.layoutId === GENERIC_LAYOUTS.CRITICAL_PATH) {
      var activeMilestones = state.rows.filter(isMeaningfulGenericRow);
      if (!activeMilestones.length) return "Add at least one milestone.";
      for (var i = 0; i < activeMilestones.length; i++) {
        if (!$.trim(activeMilestones[i].name) || !$.trim(activeMilestones[i].additional)) return "Each milestone needs a date/name and description.";
      }
    }

    if (shouldUseLabourDayFolders(state)) {
      var labourDays = getLabourDaysForEditor(state);
      for (var l = 0; l < labourDays.length; l++) {
        var day = normaliseLabourDay(labourDays[l]);
        if (!isMeaningfulLabourDay(day)) continue;
        if (!$.trim(day.title)) return "Each active Labour day folder needs a heading.";
      }
      return "";
    }

    if (state.layoutId === GENERIC_LAYOUTS.DEPT_TABLE) {
      var costingRows = (isGenericCostingSupportState(state) ? state.rows : state.costingSummaryRows).filter(isMeaningfulGenericRow);
      for (var c = 0; c < costingRows.length; c++) {
        if (!$.trim(costingRows[c].name)) return "Each client revenue line needs a name.";
        if (!$.trim(costingRows[c].revenue)) return "Each client revenue line needs a revenue value.";
      }
    }

    return "";
  }

  function isMeaningfulGenericRow(row) {
    row = normaliseGenericRow(row);
    return !!(row.id || $.trim(row.name) || $.trim(row.altName) || $.trim(row.additional) || $.trim(row.technical) || $.trim(row.imageUrl) || $.trim(row.revenue));
  }

  async function persistGenericStateIfNeeded(options) {
    options = options || {};
    if (editor.saving) return { ok: false };

    var state = readGenericFormState(editor.current);
    var error = validateGenericState(state);
    if (error) {
      setStatus(error, "error");
      return { ok: false };
    }

    var tree = getTree();
    if (!tree || !editor.rootNode) {
      setStatus(options.missingNodeMessage || "Could not find the selected page before saving.", "error");
      return { ok: false };
    }

    var changed = genericStateSignature(state) !== genericStateSignature(editor.original || {});
    if (!changed) {
      editor.current = clone(state);
      if (options.rerender !== false) renderEditor(editor.current);
      if (options.successMessage) setStatus(options.successMessage, "success");
      if (options.refreshPreview !== false) refreshEditorPreviewForCurrentHeadingSoon();
      return { ok: true, changed: false, state: normaliseGenericState(state), tree: tree };
    }

    var jobId = getCurrentJobId();
    if (!jobId) {
      setStatus("Could not detect the current job ID.", "error");
      return { ok: false };
    }

    editor.saving = true;
    setBusy(true);
    setStatus(options.savingMessage || "Saving page...", "info");

    try {
      var saved = await applyGenericPageState(jobId, tree, editor.rootNode, state);
      editor.original = clone(saved);
      editor.current = clone(saved);
      if (options.rerender !== false) renderEditor(editor.current);
      if (options.successMessage) setStatus(options.successMessage, "success");
      if (options.refreshList) {
        refreshSupplyingList();
        setTimeout(refreshSupplyingList, 900);
      }
      if (options.refreshPreview !== false) refreshEditorPreviewForCurrentHeadingSoon();
      return { ok: true, changed: true, state: saved, tree: tree };
    } catch (err) {
      warn("Generic page save failed", err);
      setStatus(getErrorMessage(err, options.errorMessage || "Could not save changes."), "error");
      return { ok: false, error: err };
    } finally {
      editor.saving = false;
      setBusy(false);
    }
  }

  async function navigateGenericEditor(step) {
    return navigateProposalEditor(step);
  }

  async function navigateProposalEditor(step) {
    var nav = getEditorNavigationState();
    var target = step < 0 ? (nav && nav.prev) : (nav && nav.next);
    if (!target) {
      setStatus("No more proposal headings in that direction.", "warning");
      return;
    }

    if (editor.mode === MODE_GENERIC) {
      var genericState = normaliseGenericState(editor.current || {});
      if (!isGenericLockedLayout(genericState.layoutId)) {
        var persisted = await persistGenericStateIfNeeded({
          savingMessage: "Saving page before opening the next heading...",
          errorMessage: "Could not save changes before changing headings.",
          rerender: false,
          refreshList: true
        });
        if (!persisted.ok) return;
      }
    } else if (editor.mode === MODE_EVENT_OVERVIEW) {
      var overviewPersisted = await persistEventOverviewStateIfNeeded({
        savingMessage: "Saving Event Overview before opening the next heading...",
        errorMessage: "Could not save Event Overview before changing headings.",
        rerender: false,
        refreshList: true
      });
      if (!overviewPersisted.ok) return;
    }

    var opened = openEditorForHeadingDataId(getNodeDataId(target), {
      showOverlay: false,
      notice: "Opened " + getNodeTitle(target) + "."
    });
    if (!opened) {
      setStatus("Could not open that heading after saving. Refresh the supplying list and try again.", "warning");
      return;
    }

    attachEditorPreviewDockSoon();
  }

  async function openNativeManagedPeoplePicker() {
    var persisted = await persistGenericStateIfNeeded({
      savingMessage: "Saving page before opening HireHop's listed-item picker...",
      errorMessage: "Could not save the page before opening the listed-item picker.",
      rerender: true,
      refreshList: true,
      successMessage: "Saved."
    });
    if (!persisted.ok) return;

    var rootId = getNodeDataId(editor.rootNode);
    var tree = getTree();
    if (!rootId || !tree || !selectTreeHeadingByDataId(tree, rootId)) {
      setStatus("Select this page heading in the list, then use HireHop's native New button.", "warning");
      return;
    }

    setStatus("Opening HireHop's listed-item picker...", "info");
    hideEditorOverlayForNativePopup();
    setTimeout(function () { openNativeNewLineEditor({ preferListedItem: true }); }, 140);
  }

  async function saveLabourDayCard(state, dayIndex) {
    state = normaliseGenericState(state || editor.current || {});
    if (!shouldUseLabourDayFolders(state)) return;
    var day = getLabourDayAtIndex(state, dayIndex);
    var label = getLabourDayLabel(day, dayIndex);

    await persistGenericStateIfNeeded({
      savingMessage: "Saving " + label + "...",
      errorMessage: "Could not save " + label + ".",
      rerender: true,
      refreshList: true,
      successMessage: label + " saved."
    });
  }

  async function deleteLabourDayCard(state, dayIndex) {
    state = normaliseGenericState(state || editor.current || {});
    if (!shouldUseLabourDayFolders(state)) return;
    var days = getLabourDaysForEditor(state);
    if (dayIndex < 0 || dayIndex >= days.length) return;

    var day = normaliseLabourDay(days[dayIndex] || {});
    if (!isMeaningfulLabourDay(day)) {
      days[dayIndex] = blankLabourDay("");
      state.labourDays = days.slice(0, getLabourDayLimitForState(state));
      editor.current = normaliseGenericState(state);
      renderEditor(editor.current);
      setStatus("Cleared the empty day card.", "success");
      return;
    }

    var label = getLabourDayLabel(day, dayIndex);
    if (!window.confirm('Delete "' + label + '" and every crew item saved inside it?')) return;

    var rollbackState = clone(editor.current || state);
    days[dayIndex] = blankLabourDay("");
    state.labourDays = days.slice(0, getLabourDayLimitForState(state));
    editor.current = normaliseGenericState(state);
    renderEditor(editor.current);

    var persisted = await persistGenericStateIfNeeded({
      savingMessage: "Deleting " + label + "...",
      errorMessage: "Could not delete " + label + ".",
      rerender: true,
      refreshList: true,
      successMessage: label + " deleted."
    });

    if (!persisted.ok) {
      editor.current = normaliseGenericState(rollbackState);
      renderEditor(editor.current);
    }
  }

  async function saveGenericEditor() {
    await persistGenericStateIfNeeded({
      savingMessage: "Saving page...",
      successMessage: "Saved.",
      errorMessage: "Could not save changes.",
      rerender: true,
      refreshList: true
    });
  }

  async function applyGenericPageState(jobId, tree, rootNode, state) {
    var saved = normaliseGenericState(clone(state));
    if (saved.layoutId === GENERIC_LAYOUTS.DETAILS_CONTAINER) {
      saved.title = "Details";
      saved.hidden = true;
      saved.additionalOptions = false;
      saved.cascadeAdditionalOptions = false;
    }
    if (isFixedHeroState(saved)) {
      saved.title = "Hero";
      saved.hidden = false;
      saved.additionalOptions = false;
      saved.cascadeAdditionalOptions = false;
    }
    if (shouldUseLabourDayFolders(saved) && normaliseLayout(saved.deptLayout || LAYOUT_IMAGE) === LAYOUT_COLUMNS) {
      saved.technical = "";
    }

    var headingName = composeGenericStoredHeading(saved);
    var technicalMeta = buildGenericPageMeta(saved, saved.pageMeta);
    var technicalMemo = composeStoredPageMetaText(saved.technical || "", technicalMeta);

    setStatus("Saving heading...", "info");
    var updated = await saveHeadingItemDirect({
      jobId: jobId,
      id: saved.rootId || getNodeDataId(rootNode),
      parentId: saved.parentId || getParentHeadingDataId(tree, rootNode),
      rawName: headingName,
      allowPlainRawName: saved.renderType === "normal",
      renderType: saved.renderType,
      title: saved.title,
      desc: saved.blurb,
      memo: technicalMemo,
      flag: saved.flag,
      customFields: saved.customFields
    });
    saved.rootId = String(updated.id || saved.rootId || getNodeDataId(rootNode));
    saved.pageMeta = technicalMeta;

    if (isGenericManagedRowsLayout(saved.layoutId)) {
      saved.rows = await saveGenericManagedRows(jobId, saved);
    }

    if (shouldUseLabourDayFolders(saved)) {
      saved.labourDays = await saveLabourDayFolders(jobId, tree, rootNode, saved);
    } else if (isCostingRowsLayout(saved.layoutId)) {
      if (isGenericCostingSummaryState(saved)) {
        saved.rows = await saveCostingRevenueRows(jobId, saved);
      } else if (isGenericCostingSupportState(saved)) {
        saved.rows = [];
      } else {
        var summaryRowsToSave = (saved.costingSummaryRows || []).map(normaliseGenericRow).filter(isMeaningfulGenericRow);
        if (summaryRowsToSave.length || saved.costingTechnicalSummaryId || (saved.originalCostingSummaryIds || []).length) {
          var summaryFolderId = await ensureCostingSupportFolder(jobId, tree, rootNode, saved, COSTING_TECHNICAL_SUMMARY_TITLE, false);
          saved.costingTechnicalSummaryId = summaryFolderId;
          saved.costingSummaryRows = await saveCostingRevenueRowsToFolder(jobId, saved, summaryFolderId, summaryRowsToSave, saved.originalCostingSummaryIds);
          saved.originalCostingSummaryIds = saved.costingSummaryRows.map(function (row) { return row.id; }).filter(Boolean);
        }
        saved.rows = [];
      }
    }

    if (isOptionalItemsEligibleState(saved)) {
      await syncRelatedCostingAdditionalOptions(jobId, tree, rootNode, saved);
    }

    return normaliseGenericState(saved);
  }

  function composeGenericStoredHeading(state) {
    state = normaliseGenericState(state);
    var prefix = "";
    if (state.hidden) prefix += "// ";
    if (state.additionalOptions) prefix += "$ ";
    prefix += headingPrefixForRenderType(state.renderType);
    return prefix + titleForStorage(state.title) + String(state.titleSuffix || "");
  }

  async function saveLabourDayFolders(jobId, tree, rootNode, state) {
    var original = normaliseGenericState(editor.original || {});
    var originalById = indexById(original.labourDays || []);
    var nextDays = [];
    var daysToSave = getVisibleLabourDays(state);
    var keepIds = [];

    for (var i = 0; i < daysToSave.length; i++) {
      var day = normaliseLabourDay(daysToSave[i]);
      var originalDay = day.id ? originalById[day.id] : null;
      if (!isMeaningfulLabourDay(day)) {
        nextDays.push(day);
        continue;
      }

      if (!$.trim(day.title)) day.title = getDefaultLabourDayTitle(i);
      var dayMeta = buildLabourDayMeta(day, i, originalDay && originalDay.meta && originalDay.meta.updatedAt);
      var dayMemo = composeStoredPageMetaText(day.baseMemo || "", dayMeta);

      if (!day.id) {
        setStatus("Creating " + getDefaultLabourDayTitle(i).toLowerCase() + " folder...", "info");
        var created = await saveHeadingItemDirect({
          jobId: jobId,
          id: "",
          parentId: state.rootId || getNodeDataId(rootNode),
          rawName: day.title,
          allowPlainRawName: true,
          renderType: "normal",
          title: day.title,
          desc: day.intro,
          memo: dayMemo,
          flag: getSnapshotFlag(day.nodeData),
          customFields: getSnapshotCustomFields(day.nodeData)
        });
        day.id = String(created.id || "");
      } else if (labourDayNeedsSave(day, originalDay, dayMemo)) {
        setStatus("Saving " + day.title + " folder...", "info");
        dayMeta.updatedAt = formatLocalDateTime(new Date());
        dayMemo = composeStoredPageMetaText(day.baseMemo || "", dayMeta);
        await saveHeadingItemDirect({
          jobId: jobId,
          id: day.id,
          parentId: state.rootId || getNodeDataId(rootNode),
          rawName: day.title,
          allowPlainRawName: true,
          renderType: "normal",
          title: day.title,
          desc: day.intro,
          memo: dayMemo,
          flag: getSnapshotFlag(day.nodeData),
          customFields: getSnapshotCustomFields(day.nodeData)
        });
      }

      if (day.id) keepIds.push(day.id);
      day.meta = dayMeta;
      day.baseMemo = day.baseMemo || "";
      day.nodeData = extendSnapshot(day.nodeData, { ID: day.id, title: day.title, TITLE: day.title, DESCRIPTION: day.intro, TECHNICAL: dayMemo });
      nextDays.push(day);
    }

    var originalDays = getLabourDaysForEditor(original);
    for (var d = 0; d < originalDays.length; d++) {
      var oldDay = normaliseLabourDay(originalDays[d]);
      if (!oldDay.id || keepIds.indexOf(oldDay.id) !== -1) continue;
      await deleteLabourDayFolder(jobId, tree, oldDay, d);
    }

    return nextDays.slice(0, CFG.maxSchedules).map(normaliseLabourDay);
  }

  function buildLabourDayMeta(day, index, previousUpdatedAt) {
    return {
      editor: LABOUR_DAY_META_EDITOR,
      version: LABOUR_DAY_META_VERSION,
      slotKey: SLOT_KEYS[index] || SLOT_KEYS[0],
      columnIndex: index,
      updatedAt: previousUpdatedAt || formatLocalDateTime(new Date())
    };
  }

  function labourDayNeedsSave(day, originalDay, memo) {
    if (!originalDay) return true;
    return String(day.title || "") !== String(originalDay.title || "") ||
      String(day.intro || "") !== String(originalDay.intro || "") ||
      String(memo || "") !== composeStoredPageMetaText(originalDay.baseMemo || "", originalDay.meta || null);
  }

  function refreshLabourDayStateFromTree(tree, day, index) {
    day = normaliseLabourDay(day);
    if (!tree || !day.id) return day;
    var headingNode = findHeadingNodeByDataId(tree, day.id);
    return headingNode ? readLabourDayState(tree, headingNode, index) : day;
  }

  function groupLabourDayItemsByKind(day) {
    day = normaliseLabourDay(day);
    var refs = (day.itemRefs && day.itemRefs.length)
      ? day.itemRefs
      : (day.itemIds || []).map(function (id) {
          return { id: String(id || ""), kind: 3, name: "" };
        });
    var grouped = {};

    for (var i = 0; i < refs.length; i++) {
      var ref = refs[i] || {};
      var id = $.trim(String(ref.id || ""));
      if (!id) continue;
      var kind = Number(ref.kind == null ? 3 : ref.kind);
      if (!grouped[kind]) grouped[kind] = [];
      if (grouped[kind].indexOf(id) === -1) grouped[kind].push(id);
    }

    return grouped;
  }

  async function deleteLabourDayFolder(jobId, tree, day, index) {
    day = refreshLabourDayStateFromTree(tree, day, index);
    var label = getLabourDayLabel(day, index);
    var grouped = groupLabourDayItemsByKind(day);
    var kinds = Object.keys(grouped);

    for (var i = 0; i < kinds.length; i++) {
      var kind = Number(kinds[i]);
      var ids = grouped[kinds[i]] || [];
      if (!ids.length) continue;
      setStatus("Removing crew items from " + label + "...", "info");
      await deleteItemsDirect(ids, jobId, kind);
    }

    if (day.id) {
      setStatus("Removing " + label + " folder...", "info");
      await deleteItemsDirect([day.id], jobId, 0);
    }
  }

  async function saveCostingRevenueRows(jobId, state) {
    return saveCostingRevenueRowsToFolder(jobId, state, state.rootId, state.rows || [], state.originalManagedIds || []);
  }

  async function saveCostingRevenueRowsToFolder(jobId, state, folderId, rows, originalIds) {
    var rowsToSave = (rows || []).map(normaliseGenericRow).filter(isMeaningfulGenericRow);
    originalIds = normaliseIdList(originalIds || []);
    var keepIds = [];
    var savedRows = [];

    for (var i = 0; i < rowsToSave.length; i++) {
      var row = rowsToSave[i];
      if (!row.id || costingRevenueRowNeedsSave(row)) {
        setStatus("Saving client revenue line " + String(i + 1) + "...", "info");
        var result = await saveCostingRevenueItemDirect({
          jobId: jobId,
          parentId: folderId,
          row: row,
          sourceData: row.nodeData || {}
        });
        row.id = String(result.id || row.id || "");
        var revenue = normaliseMoneyForPayload(row.revenue || "");
        var expectedCost = getGenericDataField(row.nodeData || {}, ["VALUE", "value"]);
        var legacyExpectedCost = isLegacyRevenueStoredInExpectedCost(row.nodeData || {});
        row.nodeData = extendSnapshot(row.nodeData, {
          ID: row.id,
          title: row.name,
          TITLE: row.name,
          PRICE: revenue,
          UNIT_PRICE: revenue,
          TOTAL: revenue,
          VALUE: legacyExpectedCost ? "0" : (expectedCost || "0"),
          ADDITIONAL: row.additional || "",
          TECHNICAL: row.technical || ""
        });
      }
      if (row.id) keepIds.push(row.id);
      savedRows.push(row);
    }

    var deleteIds = [];
    for (var d = 0; d < originalIds.length; d++) {
      if (keepIds.indexOf(originalIds[d]) === -1) deleteIds.push(originalIds[d]);
    }
    if (deleteIds.length) {
      setStatus("Removing deleted client revenue lines...", "info");
      await deleteItemsDirect(deleteIds, jobId, 3);
    }

    return savedRows;
  }

  function costingRevenueRowNeedsSave(row) {
    row = normaliseGenericRow(row);
    var data = row.nodeData || {};
    if (!row.id) return true;
    return String(row.name || "") !== getGenericDataField(data, ["title", "TITLE", "name", "NAME"]) ||
      isLegacyRevenueStoredInExpectedCost(data) ||
      normaliseMoneyForPayload(row.revenue || "") !== normaliseMoneyForPayload(getGenericRevenueFieldValue(data)) ||
      String(row.additional || "") !== getGenericDataField(data, ["ADDITIONAL", "DESCRIPTION", "additional"]) ||
      String(row.technical || "") !== getGenericDataField(data, ["TECHNICAL", "technical"]);
  }

  async function saveCostingRevenueItemDirect(options) {
    if (!options || !options.jobId || !options.parentId) throw new Error("Missing costing revenue save details.");

    var row = normaliseGenericRow(options.row);
    var source = options.sourceData || {};
    var revenue = normaliseMoneyForPayload(row.revenue || "");
    var sourceExpectedCost = isLegacyRevenueStoredInExpectedCost(source)
      ? "0"
      : String(source.value == null ? (source.VALUE == null ? 0 : source.VALUE) : source.value);

    return postItemsSave({
      parent: String(options.parentId || "0"),
      flag: String(source.FLAG == null ? 0 : source.FLAG),
      priority_confirm: "0",
      custom_fields: normaliseCustomFields(source.CUSTOM_FIELDS),
      kind: "3",
      local: formatLocalDateTime(new Date()),
      id: String(row.id || source.ID || "0"),
      qty: "1",
      name: String(row.name || ""),
      list_id: String(source.LIST_ID || "0"),
      cust_add: String(row.additional || source.ADDITIONAL || ""),
      memo: String(row.technical || source.TECHNICAL || ""),
      price_type: String(source.PRICE_TYPE == null ? 0 : source.PRICE_TYPE),
      weight: String(source.weight == null ? (source.WEIGHT == null ? 0 : source.WEIGHT) : source.weight),
      vat_rate: String(source.VAT_RATE == null ? getDefaultVatRate() : source.VAT_RATE),
      value: sourceExpectedCost,
      acc_nominal: String(source.ACC_NOMINAL == null ? getDefaultNominalId(1) : source.ACC_NOMINAL),
      acc_nominal_po: String(source.ACC_NOMINAL_PO == null ? getDefaultNominalId(2) : source.ACC_NOMINAL_PO),
      cost_price: String(source.COST_PRICE == null ? 0 : source.COST_PRICE),
      no_scan: String(source.NO_SCAN == 1 ? 1 : 0),
      country_origin: String(source.COUNTRY_ORIGIN || ""),
      hs_code: String(source.HS_CODE || ""),
      category_id: String(source.CATEGORY_ID == null ? 0 : source.CATEGORY_ID),
      no_shortfall: String(source.NO_SHORTFALL == 1 ? 1 : 0),
      unit_price: revenue,
      price: revenue,
      job: String(options.jobId || ""),
      no_availability: "0",
      ignore: "0"
    }, row.id || source.ID);
  }

  function normaliseMoneyForPayload(value) {
    var text = String(value || "").trim();
    if (!text) return "0";
    var cleaned = text.replace(/[^0-9,.-]/g, "");
    var lastComma = cleaned.lastIndexOf(",");
    var lastDot = cleaned.lastIndexOf(".");
    if (lastComma !== -1 && lastDot !== -1) {
      cleaned = lastDot > lastComma ? cleaned.replace(/,/g, "") : cleaned.replace(/\./g, "").replace(/,/g, ".");
    } else if (lastComma !== -1) {
      cleaned = /,\d{1,2}$/.test(cleaned) ? cleaned.replace(/,/g, ".") : cleaned.replace(/,/g, "");
    }
    var n = parseFloat(cleaned);
    if (!Number.isFinite(n)) return "0";
    return String(Math.round(n * 100) / 100);
  }

  async function syncRelatedCostingAdditionalOptions(jobId, tree, rootNode, state) {
    state = normaliseGenericState(state || {});
    if (!isOptionalItemsEligibleState(state) || !tree || !rootNode) return;

    if (state.renderType === "section") {
      var descendants = getDescendantCostingDeptHeadingNodes(tree, rootNode);
      for (var i = 0; i < descendants.length; i++) {
        await updateHeadingAdditionalOptionIfNeeded(jobId, tree, descendants[i], !!state.additionalOptions, "Updating nested Dept Optional Items setting...");
      }
      return;
    }

    if (state.renderType !== "dept") return;

    var parentSection = getNearestCostingSectionNode(tree, rootNode);
    if (!parentSection) return;

    var enableSection = !!state.additionalOptions;
    if (!enableSection) {
      var siblingDepts = getSectionDeptChildPages(tree, parentSection).filter(function (child) {
        return isCostingDeptHeadingNode(tree, child);
      });
      for (var s = 0; s < siblingDepts.length; s++) {
        if (getNodeDataId(siblingDepts[s]) === state.rootId) continue;
        if (parseHeadingBaseMeta(getNodeRawTitle(siblingDepts[s])).additionalOptions) {
          enableSection = true;
          break;
        }
      }
    }

    await updateHeadingAdditionalOptionIfNeeded(jobId, tree, parentSection, enableSection, "Updating related Section Optional Items setting...");
  }

  function getDescendantCostingDeptHeadingNodes(tree, rootNode) {
    var out = [];
    function walk(node) {
      var children = getDirectChildHeadingNodes(tree, node);
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (isCostingDeptHeadingNode(tree, child)) out.push(child);
        walk(child);
      }
    }
    if (tree && rootNode) walk(rootNode);
    return out;
  }

  function getNearestCostingSectionNode(tree, node) {
    var current = getParentHeadingNode(tree, node);
    while (current) {
      var parsed = parseHeadingBaseMeta(getNodeRawTitle(current));
      if (parsed.renderType === "section" && resolveGenericLayoutId(tree, current, parsed.name || getNodeTitle(current), readGenericLayoutIdFromMeta(extractStoredPageMeta(getNodeTechnical(current)).meta)) === GENERIC_LAYOUTS.SECTION_COVER) {
        return current;
      }
      current = getParentHeadingNode(tree, current);
    }
    return null;
  }

  function isCostingDeptHeadingNode(tree, node) {
    if (!tree || !node || !node.data || Number(node.data.kind) !== 0) return false;
    var parsed = parseHeadingBaseMeta(getNodeRawTitle(node));
    if (parsed.renderType !== "dept") return false;
    var layoutId = resolveGenericLayoutId(tree, node, parsed.name || getNodeTitle(node), readGenericLayoutIdFromMeta(extractStoredPageMeta(getNodeTechnical(node)).meta));
    return layoutId === GENERIC_LAYOUTS.DEPT_TABLE;
  }

  async function updateHeadingAdditionalOptionIfNeeded(jobId, tree, node, enabled, statusMessage) {
    if (!tree || !node) return;
    var raw = getNodeRawTitle(node);
    var parsed = parseHeadingBaseMeta(raw);
    if (parsed.renderType !== "section" && parsed.renderType !== "dept") return;

    var nextRawName = composeRawHeadingWithAdditionalOption(parsed, !!enabled);
    if (normaliseWhitespace(nextRawName) === normaliseWhitespace(raw)) return;

    setStatus(statusMessage || "Updating Optional Items setting...", "info");
    await saveHeadingItemDirect({
      jobId: jobId,
      id: getNodeDataId(node),
      parentId: getParentHeadingDataId(tree, node),
      rawName: nextRawName,
      renderType: parsed.renderType,
      title: parsed.name,
      desc: getNodeDescription(node),
      memo: getNodeTechnical(node),
      flag: getNodeFlag(node),
      customFields: getNodeCustomFields(node)
    });
  }

  function composeRawHeadingWithAdditionalOption(parsed, enabled) {
    parsed = parsed || {};
    var prefix = "";
    if (parsed.hidden) prefix += "// ";
    if (enabled) prefix += "$ ";
    prefix += headingPrefixForRenderType(parsed.renderType);
    return prefix + titleForStorage(parsed.name || "");
  }

  async function ensureCostingSupportFolder(jobId, tree, rootNode, state, title, hidden) {
    state = normaliseGenericState(state || {});
    var isSummary = normalizeGenericMatchText(title) === normalizeGenericMatchText(COSTING_TECHNICAL_SUMMARY_TITLE);
    var isUse = normalizeGenericMatchText(title) === normalizeGenericMatchText(COSTING_TECHNICAL_USE_TITLE);
    var preferSibling = isGenericCostingSupportState(state);
    var existingId = isSummary ? state.costingTechnicalSummaryId : (isUse ? state.costingTechnicalUseId : "");
    var folderId = String(existingId || findSiblingOrChildHeadingDataId(tree, rootNode, title, preferSibling) || "");

    if (folderId) {
      await normaliseCostingSupportFolderHeading(jobId, tree, folderId, title, hidden);
      return folderId;
    }

    var parentId = preferSibling ? state.parentId : (state.rootId || getNodeDataId(rootNode));
    if (!parentId) throw new Error("Save this costing page first, then create the support folder.");

    setStatus("Creating " + (hidden ? "hidden // " : "") + title + " folder...", "info");
    var created = await saveHeadingItemDirect({
      jobId: jobId,
      id: "",
      parentId: parentId,
      rawName: (hidden ? "// " : "") + title,
      allowPlainRawName: true,
      renderType: "normal",
      title: title,
      desc: "",
      memo: "",
      flag: 0,
      customFields: ""
    });

    return String(created.id || "");
  }

  async function normaliseCostingSupportFolderHeading(jobId, tree, folderId, title, hidden) {
    var node = findHeadingNodeByDataId(tree, folderId);
    if (!node) return;

    var expectedRaw = (hidden ? "// " : "") + title;
    var raw = getNodeRawTitle(node);
    var parsed = parseHeadingBaseMeta(raw);
    var hasWrongRenderType = parsed.renderType !== "normal";
    var hasWrongVisibility = !!parsed.hidden !== !!hidden;
    var hasWrongTitle = normalizeGenericMatchText(parsed.name || getNodeTitle(node)) !== normalizeGenericMatchText(title);

    if (!hasWrongRenderType && !hasWrongVisibility && !hasWrongTitle && normaliseWhitespace(raw) === normaliseWhitespace(expectedRaw)) return;

    setStatus("Normalising " + title + " support folder...", "info");
    await saveHeadingItemDirect({
      jobId: jobId,
      id: folderId,
      parentId: getParentHeadingDataId(tree, node),
      rawName: expectedRaw,
      allowPlainRawName: true,
      renderType: "normal",
      title: title,
      desc: getNodeDescription(node),
      memo: getNodeTechnical(node),
      flag: getNodeFlag(node),
      customFields: getNodeCustomFields(node)
    });
  }

  function findHeadingNodeByDataId(tree, dataId) {
    if (!tree || !dataId) return null;
    var nodes = getAllHeadingNodes(tree);
    for (var i = 0; i < nodes.length; i++) {
      if (getNodeDataId(nodes[i]) === String(dataId)) return nodes[i];
    }
    return null;
  }

  async function openTechnicalSummaryEditor(state) {
    state = normaliseGenericState(state || editor.current || {});
    var jobId = getCurrentJobId();
    if (!jobId || !state.rootId) {
      setStatus("Save this costing page first, then create the Technical Summary folder.", "warning");
      return;
    }

    try {
      var folderId = await ensureCostingSupportFolder(jobId, getTree(), editor.rootNode, state, COSTING_TECHNICAL_SUMMARY_TITLE, false);
      state.costingTechnicalSummaryId = folderId;
      if (!state.costingSummaryRows.length && !isGenericCostingSupportState(state)) {
        state.costingSummaryRows.push(blankGenericRow("costingRevenue"));
      }
      if (isGenericCostingSummaryState(state) && !state.rows.length) {
        state.rows.push(blankGenericRow("costingRevenue"));
      }
      editor.current = normaliseGenericState(state);
      renderEditor(editor.current);
      refreshSupplyingList();
      setStatus("Technical Summary is ready. Add client-facing revenue lines below; the parent Dept page stays selected as the visual context.", "success");
    } catch (err) {
      warn("Could not create Technical Summary folder", err);
      setStatus(getErrorMessage(err, "Could not create the Technical Summary folder."), "error");
    }
  }

  async function openTechnicalUsePicker(state) {
    state = normaliseGenericState(state || editor.current || {});

    var persisted = await persistGenericStateIfNeeded({
      savingMessage: "Saving client revenue lines before opening HireHop's listed-item picker...",
      errorMessage: "Could not save the costing page before opening the listed-item picker.",
      rerender: true,
      refreshList: true,
      successMessage: "Saved. Preparing // Technical Use..."
    });
    if (!persisted.ok) return;

    state = normaliseGenericState(persisted.state || editor.current || state);

    var jobId = getCurrentJobId();
    if (!jobId || !state.rootId) {
      setStatus("Save this costing page first, then add listed internal items.", "warning");
      return;
    }

    var folderId = "";
    try {
      folderId = await ensureCostingSupportFolder(jobId, getTree(), editor.rootNode, state, COSTING_TECHNICAL_USE_TITLE, true);
      state.costingTechnicalUseId = folderId;
      if (editor.current) editor.current.costingTechnicalUseId = folderId;
      refreshSupplyingList();
    } catch (err) {
      warn("Could not create Technical Use folder", err);
      setStatus(getErrorMessage(err, "Could not create the hidden Technical Use folder."), "error");
      return;
    }

    setStatus("Opening native picker for // Technical Use...", "info");
    setTimeout(function () {
      var tree = getTree();
      var selected = selectTreeHeadingByDataId(tree, folderId);
      if (!selected) {
        setStatus("// Technical Use is ready. Select that hidden folder, then use the native New/list picker.", "warning");
        return;
      }
      // Hide the Wise modal before using HireHop's native picker. Otherwise the native popup can open behind this overlay.
      hideEditorOverlayForNativePopup();
      setTimeout(function () { openNativeNewLineEditor({ preferListedItem: true }); }, 120);
    }, 900);
  }

  function findSiblingOrChildHeadingDataId(tree, node, targetName, preferSibling) {
    if (!tree || !node) return "";
    var scopeNode = node;
    if (preferSibling) {
      var parent = getParentHeadingNode(tree, node);
      if (parent) scopeNode = parent;
    }
    return findChildHeadingDataIdByName(getDirectChildHeadingNodes(tree, scopeNode), targetName);
  }

  function selectTreeHeadingByDataId(tree, dataId) {
    if (!tree || !dataId) return false;
    var nodes = getAllHeadingNodes(tree);
    for (var i = 0; i < nodes.length; i++) {
      if (getNodeDataId(nodes[i]) !== String(dataId)) continue;
      try {
        if (typeof tree.deselect_all === "function") tree.deselect_all();
        if (typeof tree.open_node === "function") {
          var parentId = tree.get_parent(nodes[i]);
          if (parentId && parentId !== "#") tree.open_node(parentId);
        }
        if (typeof tree.select_node === "function") tree.select_node(nodes[i].id);
        editor.lastClickedNodeId = nodes[i].id;
        return true;
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  function findNativeNewButton() {
    var $scope = $("#items_tab > div:first-child");
    if (!$scope.length) return $();
    return $scope.find('button,a,[role="button"],input[type="button"],input[type="submit"]').filter(":visible").filter(function () {
      var $el = $(this);
      if ($el.closest("#" + CFG.overlayId).length) return false;
      if ($el.is("#" + CFG.buttonId) || $el.is("#" + CFG.nativeFallbackId)) return false;
      var text = $.trim($el.text() || $el.val() || $el.attr("title") || $el.attr("aria-label") || "");
      return /^new\b/i.test(text);
    }).first();
  }

  function openNativeNewLineEditor(options) {
    var opts = options || {};
    var $new = findNativeNewButton();
    if (!$new.length) {
      setStatus("Native HireHop New button could not be found. Select // Technical Use and use the native New/list picker.", "warning");
      return;
    }
    try {
      clickElementLikeUser($new.get(0));
      if (opts.preferListedItem) {
        setTimeout(function () { clickLikelyListedItemMenuOption(); }, 350);
        setTimeout(function () { clickLikelyListedItemMenuOption(); }, 900);
      }
    } catch (err) {
      warn("Native new item picker failed", err);
      setStatus("Could not open the native item picker.", "error");
    }
  }

  function clickElementLikeUser(el) {
    if (!el) return;
    var events = ["mousedown", "mouseup", "click"];
    for (var i = 0; i < events.length; i++) {
      try {
        el.dispatchEvent(new MouseEvent(events[i], { bubbles: true, cancelable: true, view: window }));
      } catch (e) {}
    }
    try { el.click(); } catch (e2) {}
  }

  function clickLikelyListedItemMenuOption() {
    var selector = 'button,a,[role="button"],li,div,span';
    var $candidate = $(document.body).find(selector).filter(":visible").filter(function () {
      var $el = $(this);
      if ($el.closest("#" + CFG.overlayId).length) return false;
      if ($el.closest("#items_tab").length && !$el.closest(".ui-menu,.ui-dialog,.popup,.modal,.dropdown,.context-menu").length) return false;
      var text = $.trim($el.text() || $el.attr("title") || $el.attr("aria-label") || "");
      if (!text || text.length > 80) return false;
      return /^(?:item|list item|listed item|stock item|equipment|package|add item|add listed item)$/i.test(text);
    }).first();

    if ($candidate.length) {
      clickElementLikeUser($candidate.get(0));
      return true;
    }
    return false;
  }

  async function saveGenericManagedRows(jobId, state) {
    var rowsToSave = (state.rows || []).map(normaliseGenericRow).filter(isMeaningfulGenericRow);
    var originalIds = normaliseIdList(state.originalManagedIds || []);
    var keepIds = [];
    var savedRows = [];

    for (var i = 0; i < rowsToSave.length; i++) {
      var row = rowsToSave[i];
      if (!row.id || genericRowNeedsSave(row)) {
        setStatus("Saving " + genericRowLabel(state.layoutId, i) + "...", "info");
        var result = await saveGenericCustomItemDirect({
          jobId: jobId,
          parentId: state.rootId,
          row: row,
          sourceData: row.nodeData || {}
        });
        row.id = String(result.id || row.id || "");
        row.nodeData = extendSnapshot(row.nodeData, {
          ID: row.id,
          title: row.name,
          TITLE: row.name,
          ADDITIONAL: row.additional || row.altName || "",
          TECHNICAL: row.technical || "",
          IMAGE_URL: row.imageUrl || ""
        });
      }
      if (row.id) keepIds.push(row.id);
      savedRows.push(row);
    }

    var deleteIds = [];
    for (var d = 0; d < originalIds.length; d++) {
      if (keepIds.indexOf(originalIds[d]) === -1) deleteIds.push(originalIds[d]);
    }
    if (deleteIds.length) {
      setStatus("Removing deleted cards...", "info");
      await deleteItemsDirect(deleteIds, jobId, 3);
    }

    if (!savedRows.length) savedRows.push(blankGenericRow(state.layoutId === GENERIC_LAYOUTS.CRITICAL_PATH ? "milestone" : "person"));
    return savedRows;
  }

  function genericRowLabel(layoutId, index) {
    if (layoutId === GENERIC_LAYOUTS.CRITICAL_PATH) return "milestone " + String(index + 1);
    return "person " + String(index + 1);
  }

  function genericRowNeedsSave(row) {
    row = normaliseGenericRow(row);
    var data = row.nodeData || {};
    if (!row.id) return true;
    return String(row.name || "") !== getGenericDataField(data, ["title", "TITLE", "name", "NAME"]) ||
      String(row.altName || "") !== getGenericDataField(data, ["ALT_NAME", "ALTERNATIVE", "ALTNAME", "alt_name", "altName"]) ||
      String(row.additional || "") !== getGenericDataField(data, ["ADDITIONAL", "DESCRIPTION", "additional"]) ||
      String(row.technical || "") !== getGenericDataField(data, ["TECHNICAL", "technical"]) ||
      String(row.imageUrl || "") !== getGenericDataField(data, ["IMAGE_URL", "image_url", "IMG_URL", "img_url"]);
  }

  async function saveGenericCustomItemDirect(options) {
    if (!options || !options.jobId || !options.parentId) throw new Error("Missing custom row save details.");

    var row = normaliseGenericRow(options.row);
    var source = options.sourceData || {};
    var additional = row.kind === "person" ? (row.altName || row.additional || source.ADDITIONAL || "") : (row.additional || source.ADDITIONAL || "");

    return postItemsSave({
      parent: String(options.parentId || "0"),
      flag: String(source.FLAG == null ? 0 : source.FLAG),
      priority_confirm: "0",
      custom_fields: normaliseCustomFields(source.CUSTOM_FIELDS),
      kind: "3",
      local: formatLocalDateTime(new Date()),
      id: String(row.id || source.ID || "0"),
      qty: String(row.qty || source.QTY || "1"),
      name: String(row.name || ""),
      alt_name: String(row.altName || source.ALT_NAME || source.ALTERNATIVE || ""),
      image_url: String(row.imageUrl || source.IMAGE_URL || source.image_url || ""),
      img_url: String(row.imageUrl || source.IMG_URL || source.img_url || ""),
      list_id: String(source.LIST_ID || "0"),
      cust_add: String(additional || ""),
      memo: String(row.technical || source.TECHNICAL || ""),
      price_type: String(source.PRICE_TYPE == null ? 0 : source.PRICE_TYPE),
      weight: String(source.weight == null ? (source.WEIGHT == null ? 0 : source.WEIGHT) : source.weight),
      vat_rate: String(source.VAT_RATE == null ? getDefaultVatRate() : source.VAT_RATE),
      value: String(source.value == null ? (source.VALUE == null ? 0 : source.VALUE) : source.value),
      acc_nominal: String(source.ACC_NOMINAL == null ? getDefaultNominalId(1) : source.ACC_NOMINAL),
      acc_nominal_po: String(source.ACC_NOMINAL_PO == null ? getDefaultNominalId(2) : source.ACC_NOMINAL_PO),
      cost_price: String(source.COST_PRICE == null ? 0 : source.COST_PRICE),
      no_scan: String(source.NO_SCAN == 1 ? 1 : 0),
      country_origin: String(source.COUNTRY_ORIGIN || ""),
      hs_code: String(source.HS_CODE || ""),
      category_id: String(source.CATEGORY_ID == null ? 0 : source.CATEGORY_ID),
      no_shortfall: String(source.NO_SHORTFALL == 1 ? 1 : 0),
      unit_price: "0",
      price: "0",
      job: String(options.jobId || ""),
      no_availability: "0",
      ignore: "0"
    }, row.id || source.ID);
  }

  window.__wiseProposalPageEditor = {
    open: openEditor,
    openNative: openNativeLineEditor,
    setDefaultEditEnabled: function (enabled) {
      CFG.defaultEditEnabled = !!enabled;
      maintainDefaultSupplyingListEditor();
    },
    refreshToolbar: function () {
      polishToolbarLine();
      updateToolbarCompression();
    },
    read: function () { return clone(editor.current); },
    version: CFG.version
  };

  window.__wiseEventOverviewEditor = window.__wiseProposalPageEditor;
})();
