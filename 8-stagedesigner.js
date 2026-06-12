(function () {
  "use strict";

  var $ = window.jQuery;
  if (!$) return;

  var HIREHOP_MODULE_GLOBAL = "WiseProposalSectionBuilderHireHop";

  var CFG = {
    version: "2026-06-12.14",
    buttonId: "wise-stage-designer-button",
    stylesId: "wise-stage-designer-styles",
    overlayId: "wise-stage-designer-overlay",
    modalId: "wise-stage-designer-modal",
    bodyId: "wise-stage-designer-body",
    statusId: "wise-stage-designer-status",
    saveId: "wise-stage-designer-save",
    closeId: "wise-stage-designer-close",
    metaStart: "[WiseStageDesigner]",
    metaEnd: "[/WiseStageDesigner]",
    marker: "wise-stage-designer",
    itemsSave: getHireHopEndpoint("itemsSave", "/php_functions/items_save.php"),
    itemsDelete: getHireHopEndpoint("itemsDelete", "/php_functions/items_delete.php"),
    itemsImport: getHireHopEndpoint("itemsImport", "/php_functions/items_import.php"),
    searchList: getHireHopEndpoint("searchList", "/php_functions/search_list.php"),
    availabilityList: getHireHopEndpoint("availabilityList", "/php_functions/availability_list.php"),
    hireStockList: getHireHopEndpoint("hireStockList", "/reports/hire_stock_list.php"),
    salesStockList: getHireHopEndpoint("salesStockList", "/modules/consumables/list.php"),
    itemsTab: getHireHopSelector("itemsTab", "#items_tab"),
    toolbarHost: getHireHopSelector("toolbarHost", "#items_tab > div:first-child"),
    tree: getHireHopSelector("tree", "#items_tab .jstree"),
    treeClicked: getHireHopSelector("treeClicked", "#items_tab .jstree-clicked"),
    treeSelectedFallback: getHireHopSelector("treeSelectedFallback", "#items_tab li.jstree-node.jstree-clicked, #items_tab li.jstree-selected, #items_tab li[aria-selected='true'], #items_tab a.jstree-anchor[aria-selected='true']"),
    writeThrottleMs: getHireHopNumberValue("timings", "writeThrottleMs", 1150),
    rateLimitRetryMs: getHireHopNumberValue("timings", "rateLimitRetryMs", 65000),
    saveMaxAttempts: getHireHopNumberValue("timings", "saveMaxAttempts", 2),
    deckIncrementM: 0.5,
    carpetOverhangM: 0.2,
    stairCarpetLinearM: 1.2,
    feltOverlapAllowanceM: 0.5,
    stairFeltLinearM: 1.5,
    imperialDeckIncrementFt: 2,
    imperialCarpetOverhangFt: 1,
    imperialCarpetDefaultRollWidthFt: 12,
    imperialStairCarpetLinearFt: 4,
    imperialFeltOverlapAllowanceFt: 2,
    imperialStairFeltLinearFt: 5,
    stagingCategoryName: "Staging",
    stagingCategoryId: "1043",
    stagingCategoryNames: ["Staging", "Unit 10 Stock"],
    stagingCategoryIds: ["1043", "505"],
    salesConsumablesCategoryName: "Unit 10 Consumables",
    salesConsumablesCategoryId: "1062",
    stockSearchTerms: ["Deck Panel", "LiteDeck", "Litedeck", "Deck Leg", "Scaff Leg", "Stairs/Tread", "Step Unit", "Tread Kit", "Facia", "Fascia", "Staging"],
    fasciaSidesDefault: 3,
    legRule: "per-deck-corners"
  };

  var stockState = {
    catalog: null,
    loading: null,
    error: "",
    diagnostics: []
  };

  var state = {
    ready: false,
    saving: false,
    lastWriteAt: 0,
    target: null,
    currentSpec: null
  };

  bootstrap();

  function bootstrap() {
    installStyles();
    maintainToolbarButton();
    setInterval(maintainToolbarButton, 1000);
  }

  function maintainToolbarButton() {
    var $host = findToolbarHost();
    if (!$host.length) return;

    var $button = $("#" + CFG.buttonId);
    if (!$button.length) {
      $button = $(
        '<button id="' + CFG.buttonId + '" type="button" role="button" ' +
          'class="items_func_btn ui-button ui-widget ui-state-default ui-corner-all ui-button-text-icon-primary" ' +
          'title="Open the simple stage kit designer.">' +
          '<span class="ui-button-icon-primary ui-icon ui-icon-calculator"></span>' +
          '<span class="ui-button-text">Stage Designer</span>' +
        '</button>'
      );
      $button.on("click", function (e) {
        e.preventDefault();
        openDesigner();
      });
    }

    applyNativeToolbarButtonTemplate($button, $host);
    placeToolbarButtonBeforeGear($button, $host);
  }

  function openDesigner() {
    $("#" + CFG.overlayId).remove();
    state.target = resolveStageTarget();
    state.currentSpec = state.target && state.target.spec ? normaliseSpec(state.target.spec) : defaultSpec();

    var kit = calculateStageKit(state.currentSpec, stockState.catalog);
    $("body").append(buildModalHtml(state.currentSpec, kit, state.target));
    bindModalEvents();
    updateDesigner();
    if (stockState.catalog) {
      syncHeightOptions(stockState.catalog);
      updateDesigner();
      return;
    }
    setStatus("Loading live staging stock...", "info");
    loadLiveStagingStock().then(function () {
      state.currentSpec = normaliseSpec(state.currentSpec || readSpecFromModal(), stockState.catalog);
      syncHeightOptions(stockState.catalog);
      updateDesigner();
      setStatus("", "");
    }).catch(function (err) {
      warn("Could not load live staging stock", err);
      updateDesigner();
      setStatus(getErrorMessage(err, "Could not load live staging stock."), "warning");
    });
  }

  function closeDesigner() {
    $("#" + CFG.overlayId).remove();
    state.target = null;
    state.currentSpec = null;
    state.saving = false;
  }

  function buildModalHtml(spec, kit, target) {
    return '' +
      '<div id="' + CFG.overlayId + '" class="wsd-overlay">' +
        '<div id="' + CFG.modalId + '" class="wsd-modal" role="dialog" aria-modal="true" aria-labelledby="wsd-title">' +
          '<div class="wsd-head">' +
            '<div>' +
              '<div id="wsd-title" class="wsd-title">Stage Designer</div>' +
              '<div class="wsd-subtitle">' + esc(getTargetSubtitle(target)) + '</div>' +
            '</div>' +
            '<button id="' + CFG.closeId + '" type="button" class="wsd-icon-btn" aria-label="Close">x</button>' +
          '</div>' +
          '<div id="' + CFG.bodyId + '" class="wsd-body">' +
            '<div class="wsd-visual-panel">' +
              '<div class="wsd-stage-wrap" data-wsd-preview></div>' +
              '<div class="wsd-kit-panel" data-wsd-kit>' + kitSummaryHtml(kit) + '</div>' +
            '</div>' +
            '<form class="wsd-controls" autocomplete="off">' +
              controlSelectHtml("unitSystem", "System", spec.unitSystem || "metric", getUnitSystemOptions(), "") +
              controlNumberHtml("width", "Width", spec.width, getLengthMin(spec), getLengthMax(spec), getLengthStep(spec), getLengthUnitLabel(spec)) +
              controlNumberHtml("depth", "Depth", spec.depth, getLengthMin(spec), getLengthMax(spec), getLengthStep(spec), getLengthUnitLabel(spec)) +
              controlSelectHtml("height", "Height", String(spec.height), getLegHeightOptions(stockState.catalog, spec.unitSystem), getHeightUnitSuffix(spec)) +
              controlTextHtml("carpetColour", "Carpet colour", spec.carpetColour || "Black") +
              controlTextHtml("fasciaColour", "Fascia colour", spec.fasciaColour || "Black") +
              controlSelectHtml("fasciaSides", "Fascia sides", String(spec.fasciaSides || CFG.fasciaSidesDefault), getFasciaSideOptions(), "") +
              controlNumberHtml("treads", "Stair units", spec.treads, 0, 20, 1, "") +
            '</form>' +
          '</div>' +
          '<div class="wsd-footer">' +
            '<div id="' + CFG.statusId + '" class="wsd-status"></div>' +
            '<div class="wsd-actions">' +
              '<button type="button" class="wsd-btn" data-wsd-close>Cancel</button>' +
              '<button id="' + CFG.saveId + '" type="button" class="wsd-btn wsd-btn-primary">Add stage kit</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function bindModalEvents() {
    var $overlay = $("#" + CFG.overlayId);

    $("#" + CFG.closeId + ",[data-wsd-close]").on("click", function (e) {
      e.preventDefault();
      if (!state.saving) closeDesigner();
    });

    $overlay.on("click", function (e) {
      if (e.target === this && !state.saving) closeDesigner();
    });

    $overlay.find("input,select").on("input change", function () {
      var previous = state.currentSpec || defaultSpec();
      var next = readSpecFromModal();
      if ($(this).attr("data-wsd-field") === "unitSystem" && previous.unitSystem !== next.unitSystem) {
        state.currentSpec = convertSpecUnit(previous, next.unitSystem, stockState.catalog);
        writeSpecToModal(state.currentSpec);
      } else {
        state.currentSpec = next;
      }
      updateDesigner();
    });

    $("#" + CFG.saveId).on("click", function (e) {
      e.preventDefault();
      saveStageKit();
    });

    $(document).off("keydown.wiseStageDesigner").on("keydown.wiseStageDesigner", function (e) {
      if (e.key === "Escape" && $("#" + CFG.overlayId).length && !state.saving) {
        closeDesigner();
      }
    });
  }

  function updateDesigner() {
    var spec = normaliseSpec(state.currentSpec || readSpecFromModal(), stockState.catalog);
    state.currentSpec = spec;
    syncUnitControls(spec, stockState.catalog);
    var kit = calculateStageKit(spec, stockState.catalog);

    var $overlay = $("#" + CFG.overlayId);
    $overlay.find("[data-wsd-preview]").html(stagePreviewHtml(spec, kit));
    $overlay.find("[data-wsd-kit]").html(kitSummaryHtml(kit));
    $overlay.find('[data-wsd-swatch="carpetColour"]').css("background", colourToCss(spec.carpetColour, "#111827"));
    $overlay.find('[data-wsd-swatch="fasciaColour"]').css("background", colourToCss(spec.fasciaColour, "#111827"));
  }

  function readSpecFromModal() {
    var $overlay = $("#" + CFG.overlayId);
    var unitSystem = normaliseUnitSystem($overlay.find('[data-wsd-field="unitSystem"]').val() || "metric");
    return {
      unitSystem: unitSystem,
      width: readNumberField($overlay, "width", 4),
      depth: readNumberField($overlay, "depth", 3),
      height: readNumberField($overlay, "height", unitSystem === "imperial" ? 24 : 600),
      carpetColour: $.trim(String($overlay.find('[data-wsd-field="carpetColour"]').val() || "Black")),
      fasciaColour: $.trim(String($overlay.find('[data-wsd-field="fasciaColour"]').val() || "Black")),
      fasciaSides: readNumberField($overlay, "fasciaSides", CFG.fasciaSidesDefault),
      treads: readNumberField($overlay, "treads", 1)
    };
  }

  async function saveStageKit() {
    if (state.saving) return;

    var jobId = getCurrentJobId();
    if (!jobId) {
      setStatus("Could not detect the current job ID.", "error");
      return;
    }

    var target = state.target || resolveStageTarget();
    var createdStageFolderId = "";

    state.saving = true;
    setBusy(true);
    setStatus(stockState.catalog ? "Saving stage kit..." : "Loading live staging stock...", "info");

    try {
      var catalog = stockState.catalog || await loadLiveStagingStock();
      var spec = normaliseSpec(state.currentSpec || readSpecFromModal(), catalog);
      var kit = calculateStageKit(spec, catalog);
      if (kit.missingRequired && kit.missingRequired.length) {
        throw new Error("Could not find live staging stock for: " + kit.missingRequired.join(", "));
      }

      setStatus("Saving stage kit...", "info");
      var parentId = target && target.parentId ? String(target.parentId) : "0";

      var savedHeading = await saveStageHeading(jobId, parentId, "", spec, kit);
      var stageFolderId = String(savedHeading.id || "");
      if (!stageFolderId) throw new Error("HireHop did not return the stage folder ID.");
      createdStageFolderId = stageFolderId;

      setStatus("Saving stage lines...", "info");
      await saveStageLines(jobId, stageFolderId, kit.lines);

      setStatus("Stage kit saved. Refreshing the supplying list...", "success");
      refreshSupplyingList();
      setTimeout(refreshSupplyingList, 900);
      setTimeout(closeDesigner, 850);
    } catch (err) {
      warn("Stage kit save failed", err);
      if (createdStageFolderId) {
        setStatus("Removing partial stage kit...", "warning");
        try {
          await deleteItemsDirect([createdStageFolderId], jobId, 0);
          refreshSupplyingList();
        } catch (deleteErr) {
          warn("Could not remove partial stage heading", deleteErr);
        }
      }
      setStatus(getErrorMessage(err, "Could not save the stage kit."), "error");
    } finally {
      state.saving = false;
      setBusy(false);
    }
  }

  function calculateStageKit(input, catalog) {
    catalog = normaliseCatalog(catalog);
    var spec = normaliseSpec(input, catalog);
    if (spec.unitSystem === "imperial") return calculateImperialStageKit(spec, catalog);
    return calculateMetricStageKit(spec, catalog);
  }

  function calculateMetricStageKit(spec, catalog) {
    var deckCounts = calculateDeckCounts(spec.width, spec.depth);
    var deckCount = 0;
    var lines = [];
    var missingRequired = [];
    var warnings = catalog.warnings ? catalog.warnings.slice() : [];

    addDeckLine(lines, deckCounts, "deck-2x1", catalog, missingRequired);
    addDeckLine(lines, deckCounts, "deck-2x0.5", catalog, missingRequired);
    addDeckLine(lines, deckCounts, "deck-1x1", catalog, missingRequired);
    addDeckLine(lines, deckCounts, "deck-1x0.5", catalog, missingRequired);
    addDeckLine(lines, deckCounts, "deck-0.5x0.5", catalog, missingRequired);

    for (var i = 0; i < lines.length; i++) {
      if (lines[i].group === "Decks") deckCount += Number(lines[i].qty || 0);
    }

    var legCount = deckCount * 4;
    var legItem = catalog.legs[String(spec.height)];
    if (legItem) addStockLine(lines, legItem, legCount, "Legs");
    else if (legCount > 0) missingRequired.push(String(spec.height) + "mm Scaff Leg");

    if (spec.treads > 0) {
      var stairItem = getStairItemForHeight(spec.height, catalog);
      if (stairItem) addStockLine(lines, stairItem, spec.treads, "Access");
      else missingRequired.push("stair/tread unit for " + String(spec.height) + "mm stage");
    }

    var consumables = calculateConsumables(spec);
    addCarpetConsumableLines(lines, spec, consumables);
    addFasciaBoardLines(lines, spec, consumables);
    addCustomLine(lines, getFasciaLineName(spec, consumables), consumables.feltLinearM, "", "Fascia");

    return {
      spec: spec,
      lines: lines,
      deckCount: deckCount,
      legCount: legCount,
      carpetArea: consumables.topArea,
      carpetLinearM: consumables.carpetLinearM,
      fasciaRun: consumables.baseFasciaRun,
      feltLinearM: consumables.feltLinearM,
      consumables: consumables,
      missingRequired: uniqueStrings(missingRequired),
      warnings: uniqueStrings(warnings)
    };
  }

  function calculateImperialStageKit(spec, catalog) {
    var lines = [];
    var missingRequired = [];
    var warnings = catalog.imperialWarnings ? catalog.imperialWarnings.slice() : [];
    var stockCounts = {};
    var deckPlan = calculateImperialDeckPlan(spec.width, spec.depth, catalog, missingRequired);

    addStockCountsToLines(lines, deckPlan.counts, "Decks");

    var legCount = deckPlan.deckCount * 4;
    var legItem = catalog.imperial.legs[String(spec.height)];
    if (legItem) addStockLine(lines, legItem, legCount, "Legs");
    else if (legCount > 0) missingRequired.push(formatImperialHeight(spec.height) + " deck leg");

    if (spec.treads > 0) {
      var stairItem = getImperialStairItemForHeight(spec.height, catalog);
      if (stairItem) addStockLine(lines, stairItem, spec.treads, "Access");
      else missingRequired.push("imperial tread kit for " + formatImperialHeight(spec.height) + " stage");
    }

    var consumables = calculateImperialConsumables(spec, catalog);
    addImperialCarpetLines(lines, spec, consumables, catalog, warnings);
    addImperialFasciaLines(stockCounts, spec, consumables, catalog, missingRequired);
    addStockCountsToLines(lines, stockCounts, "Fascia");
    addImperialFeltLine(lines, spec, consumables, catalog, warnings);

    return {
      spec: spec,
      lines: lines,
      deckCount: deckPlan.deckCount,
      legCount: legCount,
      carpetArea: consumables.topArea,
      carpetLinearM: consumables.carpetLinearFt,
      fasciaRun: consumables.baseFasciaRun,
      feltLinearM: consumables.feltLinearFt,
      consumables: consumables,
      missingRequired: uniqueStrings(missingRequired),
      warnings: uniqueStrings(warnings)
    };
  }

  function calculateImperialDeckPlan(widthFt, depthFt, catalog, missingRequired) {
    var counts = {};
    var deckCount = 0;
    var depthOptions = getImperialDeckDepthOptions(catalog);
    if (!depthOptions.length) {
      missingRequired.push("imperial LiteDeck panels");
      return { counts: counts, deckCount: 0 };
    }

    var rowDepths = planImperialSegments(depthFt, depthOptions);
    for (var r = 0; r < rowDepths.length; r++) {
      var rowDepth = rowDepths[r];
      var widthOptions = getImperialDeckWidthOptions(catalog, rowDepth);
      if (!widthOptions.length) {
        missingRequired.push("imperial LiteDeck panel with " + formatDimension(rowDepth) + "ft side");
        continue;
      }

      var rowWidths = planImperialSegments(widthFt, widthOptions);
      for (var w = 0; w < rowWidths.length; w++) {
        var deckItem = findImperialDeckItem(catalog, rowWidths[w], rowDepth);
        if (!deckItem) {
          missingRequired.push("imperial LiteDeck " + formatDimension(rowWidths[w]) + "ft x " + formatDimension(rowDepth) + "ft");
          continue;
        }
        addStockCount(counts, deckItem, 1);
        deckCount += 1;
      }
    }

    return { counts: counts, deckCount: deckCount };
  }

  function calculateImperialConsumables(spec, catalog) {
    var overhang = Number(CFG.imperialCarpetOverhangFt || 0);
    var coveredWidth = roundQuantity(spec.width + (overhang * 2));
    var coveredDepth = roundQuantity(spec.depth + (overhang * 2));
    var topArea = roundQuantity(coveredWidth * coveredDepth);
    var carpetRolls = calculateImperialCarpetRolls(spec, catalog);
    var stairCarpetLinearFt = roundQuantity(spec.treads * CFG.imperialStairCarpetLinearFt);
    var fasciaBoardRuns = getFasciaBoardRuns(spec);
    var baseFasciaRun = calculateFasciaRun(spec);
    var stairFeltLinearFt = roundQuantity(spec.treads * CFG.imperialStairFeltLinearFt);
    var feltLinearFt = roundQuantity(baseFasciaRun + CFG.imperialFeltOverlapAllowanceFt + stairFeltLinearFt);

    return {
      overhang: overhang,
      coveredWidth: coveredWidth,
      coveredDepth: coveredDepth,
      topArea: topArea,
      carpetRolls: carpetRolls,
      stairCarpetLinearFt: stairCarpetLinearFt,
      carpetLinearFt: roundQuantity(sumCarpetRollLinearM(carpetRolls) + stairCarpetLinearFt),
      fasciaBoardRuns: fasciaBoardRuns,
      baseFasciaRun: baseFasciaRun,
      feltOverlapAllowanceFt: CFG.imperialFeltOverlapAllowanceFt,
      stairFeltLinearFt: stairFeltLinearFt,
      feltLinearFt: feltLinearFt
    };
  }

  function calculateImperialCarpetRolls(spec, catalog) {
    var widths = getImperialCarpetRollWidths(catalog, spec.carpetColour);
    if (!widths.length) widths = [CFG.imperialCarpetDefaultRollWidthFt];

    var alongWidth = buildCarpetPlanWithWidths(spec.width, spec.depth, CFG.imperialCarpetOverhangFt, widths, "width");
    var alongDepth = buildCarpetPlanWithWidths(spec.depth, spec.width, CFG.imperialCarpetOverhangFt, widths, "depth");
    return chooseCarpetPlan(alongWidth, alongDepth).rolls;
  }

  function buildCarpetPlanWithWidths(lengthFt, coverFt, overhangFt, widths, orientation) {
    var cutLength = roundUpWholeMetre(Number(lengthFt || 0) + (Number(overhangFt || 0) * 2));
    var selectedWidths = planImperialSegments(coverFt, widths);
    var rolls = [];

    for (var i = 0; i < selectedWidths.length; i++) {
      addCarpetRoll(rolls, selectedWidths[i], cutLength, orientation);
    }

    return {
      orientation: orientation,
      rolls: rolls,
      pieceCount: countCarpetPieces(rolls),
      linearM: sumCarpetRollLinearM(rolls),
      wasteM: roundQuantity(sumCarpetRollWidths(rolls) - Number(coverFt || 0))
    };
  }

  function addImperialCarpetLines(lines, spec, consumables, catalog, warnings) {
    var stockCounts = {};
    for (var i = 0; i < consumables.carpetRolls.length; i++) {
      var roll = consumables.carpetRolls[i];
      var carpetItem = findImperialSoftGood(catalog.imperial.carpets, spec.carpetColour, roll.width);
      if (carpetItem) addStockCount(stockCounts, carpetItem, getImperialSoftGoodLineQty(carpetItem, roll.linearM));
      else {
        addCustomLine(lines, "Carpet - " + spec.carpetColour + " " + formatDimension(roll.width) + "ft wide x " + formatDimension(roll.lengthM) + "ft long (stage top)", roll.count, "", "Consumables");
        warnings.push("No live imperial carpet stock matched " + spec.carpetColour + " / " + formatDimension(roll.width) + "ft; added a custom carpet row.");
      }
    }

    if (consumables.stairCarpetLinearFt > 0) {
      var treadCarpet = findImperialSoftGood(catalog.imperial.carpets, spec.carpetColour, 0);
      if (treadCarpet) addStockCount(stockCounts, treadCarpet, getImperialSoftGoodLineQty(treadCarpet, consumables.stairCarpetLinearFt));
      else addCustomLine(lines, "Carpet - " + spec.carpetColour + " (tread allowance linear ft)", consumables.stairCarpetLinearFt, "", "Consumables");
    }

    addStockCountsToLines(lines, stockCounts, "Consumables");
  }

  function addImperialFasciaLines(stockCounts, spec, consumables, catalog, missingRequired) {
    var fasciaItems = catalog.imperial.fasciaByHeight[String(spec.height)] || [];
    if (!fasciaItems.length) {
      missingRequired.push(formatImperialHeight(spec.height) + " imperial Facia");
      return;
    }

    for (var i = 0; i < consumables.fasciaBoardRuns.length; i++) {
      var run = consumables.fasciaBoardRuns[i];
      var lengths = planImperialSegments(run.length, getImperialFasciaLengths(fasciaItems));
      for (var j = 0; j < lengths.length; j++) {
        var fasciaItem = findImperialFasciaItem(fasciaItems, lengths[j]);
        if (fasciaItem) addStockCount(stockCounts, fasciaItem, 1);
        else missingRequired.push(formatImperialHeight(spec.height) + " x " + formatDimension(lengths[j]) + "ft Facia");
      }
    }
  }

  function addImperialFeltLine(lines, spec, consumables, catalog, warnings) {
    var feltItem = findImperialSoftGood(catalog.imperial.felts, spec.fasciaColour, 0);
    if (feltItem) {
      addStockLine(lines, feltItem, getImperialSoftGoodLineQty(feltItem, consumables.feltLinearFt), "Fascia");
      return;
    }

    addCustomLine(lines, getImperialFeltLineName(spec, consumables), consumables.feltLinearFt, "", "Fascia");
    warnings.push("No live imperial felt stock matched " + spec.fasciaColour + "; added a custom felt row.");
  }

  function getImperialSoftGoodLineQty(item, linearFt) {
    if (item && item.stockType === "sales") return roundUpLinearMetresFromFeet(linearFt);
    return Math.ceil(Number(linearFt || 0) - 0.0001);
  }

  function getImperialFeltLineName(spec, consumables) {
    return "Fascia felt - " + spec.fasciaColour +
      " (" + String(spec.fasciaSides) + " sides: " +
      formatDimension(consumables.baseFasciaRun) + "ft run + " +
      formatDimension(consumables.feltOverlapAllowanceFt) + "ft overlap + " +
      formatDimension(consumables.stairFeltLinearFt) + "ft treads = " +
      formatDimension(consumables.feltLinearFt) + "ft linear ft)";
  }

  function calculateDeckCounts(width, depth) {
    var counts = {};
    var fullRows = Math.floor(depth);
    var halfRow = roundTenths(depth - fullRows) >= 0.5;

    for (var r = 0; r < fullRows; r++) {
      addFullDepthRow(counts, width);
    }
    if (halfRow) addHalfDepthRow(counts, width);

    return counts;
  }

  function addFullDepthRow(counts, width) {
    var remaining = roundTenths(width);
    addCount(counts, "deck-2x1", Math.floor(remaining / 2));
    remaining = roundTenths(remaining % 2);
    if (remaining >= 1) {
      addCount(counts, "deck-1x1", 1);
      remaining = roundTenths(remaining - 1);
    }
    if (remaining >= 0.5) addCount(counts, "deck-1x0.5", 1);
  }

  function addHalfDepthRow(counts, width) {
    var remaining = roundTenths(width);
    addCount(counts, "deck-2x0.5", Math.floor(remaining / 2));
    remaining = roundTenths(remaining % 2);
    if (remaining >= 1) {
      addCount(counts, "deck-1x0.5", 1);
      remaining = roundTenths(remaining - 1);
    }
    if (remaining >= 0.5) addCount(counts, "deck-0.5x0.5", 1);
  }

  function addDeckLine(lines, counts, key, catalog, missingRequired) {
    var qty = Number(counts[key] || 0);
    if (qty <= 0) return;
    var item = findDeckItem(key, catalog);
    if (!item) {
      missingRequired.push(describeDeckKey(key));
      return;
    }
    addStockLine(lines, item, qty, "Decks");
  }

  function addStockLine(lines, item, qty, group) {
    qty = roundQuantity(qty);
    if (!item || qty <= 0) return;
    lines.push({
      kind: item.stockType === "sales" ? "sales" : "stock",
      group: group || "Stock",
      listId: String(item.id || ""),
      stockKey: item.key,
      name: item.name,
      qty: qty,
      price: item.price,
      priceType: item.priceType,
      categoryId: item.categoryId
    });
  }

  function addCustomLine(lines, name, qty, memo, group) {
    qty = roundQuantity(qty);
    if (!name || qty <= 0) return;
    lines.push({
      kind: "custom",
      group: group || "Custom",
      listId: "0",
      name: name,
      qty: qty,
      price: 0,
      priceType: 0
    });
  }

  function addStockCount(counts, item, qty) {
    qty = roundQuantity(qty);
    if (!item || qty <= 0) return;
    var key = String(item.id || item.key || item.name || "");
    if (!key) return;
    if (!counts[key]) counts[key] = { item: item, qty: 0 };
    counts[key].qty = roundQuantity(Number(counts[key].qty || 0) + qty);
  }

  function addStockCountsToLines(lines, counts, group) {
    var keys = Object.keys(counts || {});
    keys.sort(function (a, b) {
      return String(counts[a].item.name || "").localeCompare(String(counts[b].item.name || ""));
    });
    for (var i = 0; i < keys.length; i++) {
      addStockLine(lines, counts[keys[i]].item, counts[keys[i]].qty, group);
    }
  }

  function planImperialSegments(lengthFt, sizes) {
    var scale = 100;
    var target = Math.max(1, Math.ceil(Number(lengthFt || 0) * scale - 0.0001));
    var cleanSizes = uniqueNumbers(sizes).filter(function (size) { return size > 0; }).sort(function (a, b) { return b - a; });
    if (!cleanSizes.length) return [];

    var sizeUnits = cleanSizes.map(function (size) { return Math.max(1, Math.round(Number(size || 0) * scale)); });
    var maxSize = sizeUnits[0];
    var max = target + maxSize;
    var dp = [{ total: 0, count: 0, segments: [] }];

    for (var current = 0; current <= max; current++) {
      if (!dp[current]) continue;
      for (var i = 0; i < cleanSizes.length; i++) {
        var next = current + sizeUnits[i];
        if (next > max) continue;
        var candidate = {
          total: next,
          count: dp[current].count + 1,
          segments: dp[current].segments.concat([cleanSizes[i]])
        };
        if (!dp[next] || isBetterSegmentPlan(candidate, dp[next], target)) dp[next] = candidate;
      }
    }

    var best = null;
    for (var total = target; total <= max; total++) {
      if (!dp[total]) continue;
      if (!best || isBetterSegmentPlan(dp[total], best, target)) best = dp[total];
    }

    return best ? best.segments : [];
  }

  function isBetterSegmentPlan(candidate, current, target) {
    var candidateWaste = Math.max(0, Number(candidate.total || 0) - target);
    var currentWaste = Math.max(0, Number(current.total || 0) - target);
    if (candidateWaste !== currentWaste) return candidateWaste < currentWaste;
    if (candidate.count !== current.count) return candidate.count < current.count;
    return largestSegment(candidate.segments) > largestSegment(current.segments);
  }

  function largestSegment(segments) {
    var largest = 0;
    for (var i = 0; i < (segments || []).length; i++) largest = Math.max(largest, Number(segments[i] || 0));
    return largest;
  }

  function getStairItemForHeight(height, catalog) {
    catalog = normaliseCatalog(catalog);
    height = Number(height || 0);
    var best = null;
    var bestScore = Infinity;

    for (var i = 0; i < catalog.stairs.length; i++) {
      var stair = catalog.stairs[i];
      var min = Number(stair.minHeight || 0);
      var max = Number(stair.maxHeight || min || 0);
      var score = 0;
      if (min && max && height >= min && height <= max) score = 0;
      else if (height < min) score = min - height;
      else score = height - max;

      if (score < bestScore) {
        best = stair;
        bestScore = score;
      }
    }

    return best;
  }

  function calculateFasciaRun(spec) {
    var runs = getFasciaBoardRuns(spec);
    var total = 0;
    for (var i = 0; i < runs.length; i++) total += Number(runs[i].length || 0);
    return roundQuantity(total);
  }

  function getFasciaBoardRuns(spec) {
    spec = spec || {};
    var runs = [
      { label: "front", length: Number(spec.width || 0) },
      { label: "left return", length: Number(spec.depth || 0) },
      { label: "right return", length: Number(spec.depth || 0) }
    ];
    if (Number(spec.fasciaSides || CFG.fasciaSidesDefault) >= 4) {
      runs.push({ label: "rear", length: Number(spec.width || 0) });
    }
    return runs;
  }

  function calculateConsumables(spec) {
    var overhang = Number(CFG.carpetOverhangM || 0);
    var coveredWidth = roundQuantity(spec.width + (overhang * 2));
    var coveredDepth = roundQuantity(spec.depth + (overhang * 2));
    var topArea = roundQuantity(coveredWidth * coveredDepth);
    var carpetRolls = calculateCarpetRolls(spec.width, spec.depth, overhang);
    var stairCarpetLinearM = roundQuantity(spec.treads * CFG.stairCarpetLinearM);
    var fasciaBoardRuns = getFasciaBoardRuns(spec);
    var baseFasciaRun = calculateFasciaRun(spec);
    var fasciaBoardCount = calculateFasciaBoardCount(fasciaBoardRuns);
    var stairFeltLinearM = roundQuantity(spec.treads * CFG.stairFeltLinearM);
    var feltLinearM = roundQuantity(baseFasciaRun + CFG.feltOverlapAllowanceM + stairFeltLinearM);

    return {
      overhang: overhang,
      coveredWidth: coveredWidth,
      coveredDepth: coveredDepth,
      topArea: topArea,
      carpetRolls: carpetRolls,
      stairCarpetLinearM: stairCarpetLinearM,
      carpetLinearM: roundQuantity(sumCarpetRollLinearM(carpetRolls) + stairCarpetLinearM),
      fasciaBoardRuns: fasciaBoardRuns,
      fasciaBoardCount: fasciaBoardCount,
      baseFasciaRun: baseFasciaRun,
      feltOverlapAllowanceM: CFG.feltOverlapAllowanceM,
      stairFeltLinearM: stairFeltLinearM,
      feltLinearM: feltLinearM
    };
  }

  function getFasciaLineName(spec, consumables) {
    return "Fascia felt - " + spec.fasciaColour +
      " (" + String(spec.fasciaSides) + " sides: " +
      formatDimension(consumables.baseFasciaRun) + "m run + " +
      formatDimension(consumables.feltOverlapAllowanceM) + "m overlap + " +
      formatDimension(consumables.stairFeltLinearM) + "m treads = " +
      formatDimension(consumables.feltLinearM) + "m linear m)";
  }

  function calculateCarpetRolls(stageWidth, stageDepth, overhang) {
    var alongWidth = buildCarpetPlan(stageWidth, stageDepth, overhang, "width");
    var alongDepth = buildCarpetPlan(stageDepth, stageWidth, overhang, "depth");
    return chooseCarpetPlan(alongWidth, alongDepth).rolls;
  }

  function buildCarpetPlan(lengthM, coverM, overhang, orientation) {
    var cutLength = roundUpWholeMetre(Number(lengthM || 0) + (Number(overhang || 0) * 2));
    var widths = resolveCarpetWidths(coverM);
    var rolls = [];

    for (var i = 0; i < widths.length; i++) {
      addCarpetRoll(rolls, widths[i], cutLength, orientation);
    }

    return {
      orientation: orientation,
      rolls: rolls,
      pieceCount: countCarpetPieces(rolls),
      linearM: sumCarpetRollLinearM(rolls),
      wasteM: roundQuantity(sumCarpetRollWidths(rolls) - Number(coverM || 0))
    };
  }

  function chooseCarpetPlan(a, b) {
    if (Number(a.linearM || 0) !== Number(b.linearM || 0)) return Number(a.linearM || 0) < Number(b.linearM || 0) ? a : b;
    if (Number(a.pieceCount || 0) !== Number(b.pieceCount || 0)) return Number(a.pieceCount || 0) < Number(b.pieceCount || 0) ? a : b;
    if (Number(a.wasteM || 0) !== Number(b.wasteM || 0)) return Number(a.wasteM || 0) < Number(b.wasteM || 0) ? a : b;
    return a;
  }

  function resolveCarpetWidths(coverM) {
    var remaining = roundQuantity(coverM);
    var widths = [];

    while (remaining > 0.01) {
      if (remaining > 4) {
        widths.push(4);
        remaining = roundQuantity(remaining - 4);
      } else if (remaining > 2) {
        widths.push(4);
        remaining = 0;
      } else {
        widths.push(2);
        remaining = 0;
      }
    }

    return widths;
  }

  function addCarpetRoll(rolls, width, lengthM, orientation) {
    for (var i = 0; i < rolls.length; i++) {
      if (Number(rolls[i].width || 0) === Number(width) && Number(rolls[i].lengthM || 0) === Number(lengthM)) {
        rolls[i].count += 1;
        rolls[i].linearM = roundQuantity(Number(rolls[i].linearM || 0) + Number(lengthM || 0));
        return;
      }
    }
    rolls.push({
      width: width,
      lengthM: roundQuantity(lengthM),
      count: 1,
      linearM: roundQuantity(lengthM),
      orientation: orientation
    });
  }

  function countCarpetPieces(rolls) {
    var total = 0;
    for (var i = 0; i < (rolls || []).length; i++) total += Number(rolls[i].count || 0);
    return total;
  }

  function sumCarpetRollWidths(rolls) {
    var total = 0;
    for (var i = 0; i < (rolls || []).length; i++) total += Number(rolls[i].width || 0) * Number(rolls[i].count || 0);
    return roundQuantity(total);
  }

  function sumCarpetRollLinearM(rolls) {
    var total = 0;
    for (var i = 0; i < (rolls || []).length; i++) total += Number(rolls[i].linearM || 0);
    return roundQuantity(total);
  }

  function calculateFasciaBoardCount(runs) {
    var total = 0;
    for (var i = 0; i < (runs || []).length; i++) total += Math.ceil(Number(runs[i].length || 0));
    return total;
  }

  function addCarpetConsumableLines(lines, spec, consumables) {
    for (var i = 0; i < consumables.carpetRolls.length; i++) {
      var roll = consumables.carpetRolls[i];
      addCustomLine(
        lines,
        "Carpet - " + spec.carpetColour + " " + formatDimension(roll.width) + "m wide x " + formatDimension(roll.lengthM) + "m long (stage top)",
        roll.count,
        "",
        "Consumables"
      );
    }

    if (consumables.stairCarpetLinearM > 0) {
      addCustomLine(
        lines,
        "Carpet - " + spec.carpetColour + " (tread allowance linear m)",
        consumables.stairCarpetLinearM,
        "",
        "Consumables"
      );
    }
  }

  function addFasciaBoardLines(lines, spec, consumables) {
    var runs = consumables.fasciaBoardRuns || [];
    for (var i = 0; i < runs.length; i++) {
      var run = runs[i];
      var qty = Math.ceil(Number(run.length || 0));
      addCustomLine(
        lines,
        "Fascia board - " + run.label + " " + formatDimension(run.length) + "m run (" + String(spec.height) + "mm high x 1m sections)",
        qty,
        "",
        "Fascia"
      );
    }
  }

  async function loadLiveStagingStock(options) {
    options = options || {};
    if (!options.force && stockState.catalog) return stockState.catalog;
    if (!options.force && stockState.loading) return stockState.loading;

    stockState.error = "";
    stockState.diagnostics = [];
    stockState.loading = (async function () {
      var candidates = [];
      appendStockCandidates(candidates, readWindowStockCandidates());
      appendStockCandidates(candidates, await fetchHireStockListCandidates());
      appendStockCandidates(candidates, await fetchSalesStockCandidates());
      appendStockCandidates(candidates, await fetchAvailabilityListCandidates(""));

      var catalog = buildLiveStockCatalog(candidates);
      if (catalogNeedsFallbackSearch(catalog)) {
        var fallbackTerms = getMissingStockSearchTerms(catalog);
        for (var i = 0; i < fallbackTerms.length; i++) {
          appendStockCandidates(candidates, await fetchSearchListCandidates(fallbackTerms[i]));
        }
        catalog = buildLiveStockCatalog(candidates);
      }

      if (!catalog.items.length) {
        throw new Error("No live staging stock could be found.");
      }

      stockState.catalog = catalog;
      return catalog;
    })();

    try {
      return await stockState.loading;
    } catch (err) {
      stockState.error = getErrorMessage(err, "Could not load live staging stock.");
      throw err;
    } finally {
      stockState.loading = null;
    }
  }

  function readWindowStockCandidates() {
    var out = [];
    var keys = ["hirestock", "hire_stock", "stock_items", "stockItems", "stock", "resources", "items"];
    for (var i = 0; i < keys.length; i++) {
      appendStockCandidates(out, normaliseCandidateList(window[keys[i]], "window." + keys[i]));
    }
    return out;
  }

  async function fetchSearchListCandidates(term) {
    var out = [];
    var urls = buildSearchListUrls(term);

    for (var i = 0; i < urls.length; i++) {
      try {
        var response = await fetch(urls[i].url, {
          method: "GET",
          credentials: "same-origin",
          headers: { "Accept": "application/json, text/javascript, */*; q=0.01" }
        });
        if (!response.ok) {
          rememberStockDiagnostic(urls[i].label, response.status, "");
          continue;
        }
        var text = await response.text();
        var json = tryParseJson(text);
        if (!json) {
          rememberStockDiagnostic(urls[i].label, response.status, text);
          continue;
        }
        appendStockCandidates(out, normaliseCandidateList(json, "search:" + term));
      } catch (err) {
        rememberStockDiagnostic(urls[i].label, "error", getErrorMessage(err, "Search failed."));
        warn("Live stock search failed for " + term, err);
      }
    }

    return out;
  }

  async function fetchAvailabilityListCandidates(term) {
    var out = [];
    var urls = buildAvailabilityListUrls(term);

    for (var i = 0; i < urls.length; i++) {
      try {
        var response = await fetch(urls[i].url, {
          method: "GET",
          credentials: "same-origin",
          headers: { "Accept": "application/json, text/javascript, */*; q=0.01" }
        });
        if (!response.ok) {
          rememberStockDiagnostic(urls[i].label, response.status, "");
          continue;
        }
        var text = await response.text();
        var json = tryParseJson(text);
        if (!json) {
          rememberStockDiagnostic(urls[i].label, response.status, text);
          continue;
        }
        appendStockCandidates(out, normaliseCandidateList(json, "availability:" + term));
      } catch (err) {
        rememberStockDiagnostic(urls[i].label, "error", getErrorMessage(err, "Availability search failed."));
        warn("Availability stock search failed for " + term, err);
      }
    }

    return out;
  }

  async function fetchHireStockListCandidates() {
    var out = [];
    var urls = buildHireStockListUrls();

    for (var i = 0; i < urls.length; i++) {
      try {
        var response = await fetch(urls[i].url, {
          method: "GET",
          credentials: "same-origin",
          headers: { "Accept": "application/json, text/javascript, */*; q=0.01" }
        });
        if (!response.ok) {
          rememberStockDiagnostic(urls[i].label, response.status, "");
          continue;
        }
        var text = await response.text();
        var json = tryParseJson(text);
        if (!json) {
          rememberStockDiagnostic(urls[i].label, response.status, text);
          continue;
        }
        appendStockCandidates(out, normaliseCandidateList(json, "hire-stock-list"));
      } catch (err) {
        rememberStockDiagnostic(urls[i].label, "error", getErrorMessage(err, "Hire stock list failed."));
        warn("Hire stock list failed", err);
      }
    }

    return out;
  }

  async function fetchSalesStockCandidates() {
    var out = [];
    var urls = buildSalesStockListUrls();

    for (var i = 0; i < urls.length; i++) {
      try {
        var response = await fetch(urls[i].url, {
          method: "GET",
          credentials: "same-origin",
          headers: { "Accept": "application/json, text/javascript, */*; q=0.01" }
        });
        if (!response.ok) {
          rememberStockDiagnostic(urls[i].label, response.status, "");
          continue;
        }
        var text = await response.text();
        var json = tryParseJson(text);
        if (!json) {
          rememberStockDiagnostic(urls[i].label, response.status, text);
          continue;
        }
        appendStockCandidates(out, normaliseCandidateList(json, "sales-stock-list"));
      } catch (err) {
        rememberStockDiagnostic(urls[i].label, "error", getErrorMessage(err, "Sales stock list failed."));
        warn("Sales stock list failed", err);
      }
    }

    return out;
  }

  function buildAvailabilityListUrls(term) {
    var base = CFG.availabilityList || "/php_functions/availability_list.php";
    var common = {
      head: 0,
      date: formatLocalDateTime(new Date()),
      date_range: 14,
      local: formatLocalDateTime(new Date()),
      tz: getTimezone(),
      page: 1,
      rows: 100,
      title: term || "",
      depots: "",
      show_hidden: 0,
      shortages: 0,
      late: 0,
      virtual: 1,
      version: 2
    };
    var out = [];
    var ids = getStockCategoryIds();

    for (var i = 0; i < ids.length; i++) {
      var catId = Number(ids[i]) || ids[i];
      var cats = [catId];
      out.push(endpointRequest(base, extendObject(common, { cats: JSON.stringify(cats) }), "availability cats-json " + ids[i] + " " + term));
      out.push(endpointRequest(base, extendObject(common, { cat: ids[i] }), "availability cat " + ids[i] + " " + term));
    }

    return out;
  }

  function buildSearchListUrls(term) {
    var base = CFG.searchList || "/php_functions/search_list.php";
    var out = [];
    var ids = getStockCategoryIds();

    for (var i = 0; i < ids.length; i++) {
      out.push(endpointRequest(base, { q: term, stock: 1, category_id: ids[i] }, "search q " + ids[i] + " " + term));
    }

    return out;
  }

  function buildHireStockListUrls() {
    var base = CFG.hireStockList || "/reports/hire_stock_list.php";
    var out = [];
    var ids = getStockCategoryIds();
    for (var i = 0; i < ids.length; i++) {
      out.push(endpointRequest(base, { cat: ids[i], depot: 0, local: formatLocalDateTime(new Date()), tz: getTimezone() }, "hire-stock-list cat " + ids[i]));
    }
    out.push(endpointRequest(base, { cat: 0, depot: 0, local: formatLocalDateTime(new Date()), tz: getTimezone() }, "hire-stock-list all"));
    return out;
  }

  function buildSalesStockListUrls() {
    var base = CFG.salesStockList || "/modules/consumables/list.php";
    var catId = Number(CFG.salesConsumablesCategoryId) || String(CFG.salesConsumablesCategoryId || "");
    var params = {
      head: 0,
      cats: JSON.stringify([catId]),
      page: 1,
      rows: 200,
      del: 0,
      local: formatLocalDateTime(new Date()),
      tz: getTimezone()
    };
    return [endpointRequest(base, params, "sales-stock-list cat " + String(CFG.salesConsumablesCategoryId || ""))];
  }

  function endpointRequest(base, params, label) {
    return {
      label: label || base,
      url: base + (base.indexOf("?") === -1 ? "?" : "&") + $.param(params || {})
    };
  }

  function getStockCategoryIds() {
    var ids = (CFG.stagingCategoryIds || [CFG.stagingCategoryId]).slice();
    if (ids.indexOf(String(CFG.stagingCategoryId)) === -1) ids.unshift(String(CFG.stagingCategoryId));
    return uniqueStrings(ids);
  }

  function getStockCategoryNames() {
    var names = (CFG.stagingCategoryNames || [CFG.stagingCategoryName]).slice();
    if (names.indexOf(String(CFG.stagingCategoryName)) === -1) names.unshift(String(CFG.stagingCategoryName));
    return uniqueStrings(names);
  }

  function getAllowedStockCategoryIds() {
    var ids = getStockCategoryIds();
    if (CFG.salesConsumablesCategoryId) ids.push(String(CFG.salesConsumablesCategoryId));
    return uniqueStrings(ids);
  }

  function getAllowedStockCategoryNames() {
    var names = getStockCategoryNames();
    if (CFG.salesConsumablesCategoryName) names.push(String(CFG.salesConsumablesCategoryName));
    return uniqueStrings(names);
  }

  function normaliseCandidateList(value, source) {
    var raw = [];
    collectCandidateObjects(value, raw, 0);

    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var item = normaliseStockRecord(raw[i], source);
      if (item && isUsableStagingRecord(item)) out.push(item);
    }
    return out;
  }

  function collectCandidateObjects(value, out, depth) {
    if (depth > 5 || value == null) return;
    if (Array.isArray(value)) {
      if (looksLikeStockArrayRow(value)) out.push({ cell: value });
      for (var i = 0; i < value.length; i++) collectCandidateObjects(value[i], out, depth + 1);
      return;
    }
    if (typeof value !== "object") return;

    if ((getFirstField(value, ["stock_id", "STOCK_ID", "ID", "id", "LIST_ID", "list_id", "value"]) && getFirstField(value, ["TITLE", "title", "NAME", "name", "label", "text"])) ||
        value.cell || value.cells || value.rowData) {
      out.push(value);
    }

    var keys = ["items", "rows", "data", "results", "list", "aaData", "children", "rowData", "cell", "cells"];
    for (var k = 0; k < keys.length; k++) {
      if (value[keys[k]] != null) collectCandidateObjects(value[keys[k]], out, depth + 1);
    }
  }

  function normaliseStockRecord(raw, source) {
    if (!raw || typeof raw !== "object") return null;
    raw = unwrapStockRecord(raw);

    var id = cleanStockId(getFirstField(raw, ["stock_id", "STOCK_ID", "ID", "id", "LIST_ID", "list_id", "item_id", "value"]));
    var name = cleanStockName(getFirstField(raw, ["TITLE", "title", "NAME", "name", "label", "text"]));
    var altName = cleanStockName(getFirstField(raw, ["ALT_NAME", "alt_name", "altName", "ALT_TITLE", "alt_title", "altTitle", "subtitle"]));
    var description = cleanStockName(getFirstField(raw, ["DESCRIPTION", "description", "DESC", "desc"]));
    var memo = cleanStockName(getFirstField(raw, ["MEMO", "memo", "NOTE", "note"]));
    if (!id && raw.__rowText) id = cleanStockId(extractStockIdFromText(raw.__rowText));
    if (!name && raw.__rowText) name = extractStockNameFromText(raw.__rowText);
    if (!id || !name) return null;

    return {
      id: String(id),
      name: name,
      altName: altName,
      description: description,
      memo: memo,
      category: readStockCategoryName(raw),
      categoryId: readStockCategoryId(raw),
      breadcrumbs: readStockBreadcrumbs(raw),
      status: cleanStockName(getFirstField(raw, ["STATUS", "status"])),
      price: parseStockPrice(raw),
      priceType: parseStockPriceType(raw),
      eventBuilderVisible: readEventBuilderVisible(raw),
      stockType: normaliseStockType(raw, source),
      source: source || ""
    };
  }

  function unwrapStockRecord(raw) {
    if (raw.rowData && typeof raw.rowData === "object") return unwrapStockRecord(raw.rowData);
    if (raw.cells && typeof raw.cells === "object" && !Array.isArray(raw.cells)) {
      return extendObject(raw.cells, raw);
    }
    if (raw.cell || raw.cells) {
      var cells = raw.cell || raw.cells;
      if (Array.isArray(cells)) {
        var text = cells.map(function (cell) { return cleanStockName(cell); }).join(" ");
        return extendObject({
          __rowText: text,
          ID: raw.id,
          TITLE: findBestStockNameInArray(cells)
        }, raw);
      }
    }
    return raw;
  }

  function looksLikeStockArrayRow(row) {
    if (!row || !row.length) return false;
    var text = cleanStockName(row.join(" "));
    return looksLikeUsableStageStockName(text) && !!extractStockIdFromText(text);
  }

  function isUsableStagingRecord(item) {
    if (!item || !item.name) return false;
    if (!isActiveStockStatus(item.status)) return false;

    var categoryText = normaliseMatchText([item.category, item.breadcrumbs].join(" "));
    var hasCategory = !!(item.category || item.breadcrumbs || item.categoryId);
    var categoryMatches = false;
    var names = getAllowedStockCategoryNames();
    var ids = getAllowedStockCategoryIds();
    for (var n = 0; n < names.length; n++) {
      if (categoryText.indexOf(normaliseMatchText(names[n])) !== -1) categoryMatches = true;
    }
    for (var c = 0; c < ids.length; c++) {
      if (String(item.categoryId || "") === String(ids[c])) categoryMatches = true;
    }
    if (hasCategory && !categoryMatches) return false;

    return looksLikeUsableStageStockName(item.name);
  }

  function isActiveStockStatus(status) {
    if (status == null || status === "") return true;
    var text = normaliseMatchText(status);
    if (!text) return true;
    if (text === "0" || text === "active") return true;
    return /active/.test(text) && !/inactive|deleted|hidden|archived/.test(text);
  }

  function looksLikeUsableStageStockName(name) {
    var text = normaliseMatchText(name);
    return /deck|litedeck|scaff leg|deck leg|stairs|tread|step unit|fas?cia|carpet|felt|roll|cloth|fabric|velour|serge|baize|floor/.test(text);
  }

  function buildLiveStockCatalog(candidates) {
    var catalog = emptyCatalog();
    var seen = {};

    for (var i = 0; i < (candidates || []).length; i++) {
      var item = candidates[i];
      if (!item || !item.id || !item.name) continue;
      var key = item.id + "|" + normaliseMatchText(item.name);
      if (seen[key]) continue;
      seen[key] = true;
      catalog.items.push(item);
      addCatalogDeck(catalog, item);
      addCatalogLeg(catalog, item);
      addCatalogStair(catalog, item);
      addCatalogImperialDeck(catalog, item);
      addCatalogImperialLeg(catalog, item);
      addCatalogImperialStair(catalog, item);
      addCatalogImperialFascia(catalog, item);
      addCatalogImperialSoftGood(catalog, item);
    }

    addCatalogWarnings(catalog);
    return catalog;
  }

  function catalogNeedsFallbackSearch(catalog) {
    catalog = normaliseCatalog(catalog);
    return !catalog.items.length ||
      !Object.keys(catalog.decksByKey || {}).length ||
      !Object.keys(catalog.legs || {}).length ||
      !catalog.stairs.length ||
      !catalog.imperial.decks.length ||
      !Object.keys(catalog.imperial.legs || {}).length ||
      !catalog.imperial.stairs.length ||
      !Object.keys(catalog.imperial.fasciaByHeight || {}).length;
  }

  function getMissingStockSearchTerms(catalog) {
    catalog = normaliseCatalog(catalog);
    var terms = [];
    if (!Object.keys(catalog.decksByKey || {}).length) terms.push("LiteDeck", "Deck Panel");
    if (!Object.keys(catalog.legs || {}).length) terms.push("Scaff Leg");
    if (!catalog.stairs.length) terms.push("Stairs/Tread", "Step Unit");
    if (!catalog.imperial.decks.length) terms.push("Litedeck");
    if (!Object.keys(catalog.imperial.legs || {}).length) terms.push("Deck Leg");
    if (!catalog.imperial.stairs.length) terms.push("Tread Kit");
    if (!Object.keys(catalog.imperial.fasciaByHeight || {}).length) terms.push("Facia", "Fascia");
    return uniqueStrings(terms).slice(0, 14);
  }

  function addCatalogDeck(catalog, item) {
    var text = normaliseMatchText(item.name);
    if (!/(deck|litedeck)/.test(text)) return;
    if (/handrail|triangle|quarter|circle/.test(text)) return;

    var match = item.name.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*m?/i);
    if (!match) return;

    var a = roundQuantity(match[1]);
    var b = roundQuantity(match[2]);
    if (!isHalfMetreIncrement(a) || !isHalfMetreIncrement(b)) return;

    maybeSetDeckKey(catalog, item, "deck-2x1", a, b, 2, 1);
    maybeSetDeckKey(catalog, item, "deck-2x0.5", a, b, 2, 0.5);
    maybeSetDeckKey(catalog, item, "deck-1x1", a, b, 1, 1);
    maybeSetDeckKey(catalog, item, "deck-1x0.5", a, b, 1, 0.5);
    maybeSetDeckKey(catalog, item, "deck-0.5x0.5", a, b, 0.5, 0.5);
  }

  function maybeSetDeckKey(catalog, item, key, a, b, width, depth) {
    if (!dimensionsMatch(a, b, width, depth)) return;
    var deck = cloneStockItem(item);
    deck.key = key;
    deck.width = width;
    deck.depth = depth;
    catalog.decksByKey[key] = chooseBetterStockItem(catalog.decksByKey[key], deck);
  }

  function addCatalogLeg(catalog, item) {
    var match = item.name.match(/(\d{3,4})\s*mm\s+scaff\s+leg/i);
    if (!match) return;
    var height = String(Number(match[1]));
    var leg = cloneStockItem(item);
    leg.key = "leg-" + height;
    leg.height = Number(height);
    catalog.legs[height] = chooseBetterStockItem(catalog.legs[height], leg);
  }

  function addCatalogStair(catalog, item) {
    var text = normaliseMatchText(item.name);
    if (!/stairs|tread|step unit/.test(text)) return;

    var stair = cloneStockItem(item);
    var range = item.name.match(/(\d{3,4})\s*-\s*(\d{3,4})\s*mm/i);
    var single = item.name.match(/(\d{3,4})\s*mm/i);
    stair.key = "stair-" + String(item.id || catalog.stairs.length);
    stair.minHeight = range ? Number(range[1]) : (single ? Math.max(0, Number(single[1]) - 200) : 0);
    stair.maxHeight = range ? Number(range[2]) : (single ? Number(single[1]) : 9999);
    catalog.stairs.push(stair);
  }

  function addCatalogImperialDeck(catalog, item) {
    var text = normaliseMatchText(item.name + " " + (item.altName || ""));
    if (!/litedeck|stage deck/.test(text)) return;
    if (/handrail|triangle|quarter|circle|brace|coupler/.test(text)) return;

    var dims = parseImperialRectangle(item.name);
    if (!dims || dims.widthFt <= 0 || dims.depthFt <= 0) return;

    var deck = cloneStockItem(item);
    deck.key = "imperial-deck-" + formatDimension(dims.widthFt) + "x" + formatDimension(dims.depthFt);
    deck.widthFt = dims.widthFt;
    deck.depthFt = dims.depthFt;
    deck.unitSystem = "imperial";
    catalog.imperial.decks.push(deck);
  }

  function addCatalogImperialLeg(catalog, item) {
    var text = normaliseMatchText(item.name + " " + (item.altName || ""));
    if (!/deck leg|screw jack/.test(text)) return;
    if (/tread/.test(text)) return;

    var height = parseImperialLegHeight(item.name);
    if (!height) return;

    var leg = cloneStockItem(item);
    leg.key = "imperial-leg-" + String(height);
    leg.height = height;
    leg.heightIn = height;
    leg.unitSystem = "imperial";
    catalog.imperial.legs[String(height)] = chooseBetterStockItem(catalog.imperial.legs[String(height)], leg);
  }

  function addCatalogImperialStair(catalog, item) {
    var text = normaliseMatchText(item.name + " " + (item.altName || ""));
    if (!/tread|step/.test(text)) return;
    if (/fas?cia|scaff leg/.test(text)) return;

    var stair = cloneStockItem(item);
    stair.key = "imperial-stair-" + String(item.id || catalog.imperial.stairs.length);
    stair.minHeight = 0;
    stair.maxHeight = 9999;
    if (/single|one step|1 step/.test(text)) stair.maxHeight = 12;
    else if (/two|2 step/.test(text)) stair.maxHeight = 24;

    var upTo = item.name.match(/up\s+to\s+(\d+)\s*ft/i);
    if (upTo) stair.maxHeight = Number(upTo[1]) * 12;

    catalog.imperial.stairs.push(stair);
  }

  function addCatalogImperialFascia(catalog, item) {
    var text = normaliseMatchText(item.name);
    if (!/fas?cia/.test(text)) return;

    var dims = parseImperialRectangle(item.name);
    if (!dims || dims.heightIn <= 0 || dims.lengthFt <= 0) return;

    var fascia = cloneStockItem(item);
    fascia.key = "imperial-fascia-" + String(dims.heightIn) + "x" + formatDimension(dims.lengthFt);
    fascia.height = dims.heightIn;
    fascia.heightIn = dims.heightIn;
    fascia.lengthFt = dims.lengthFt;
    fascia.unitSystem = "imperial";

    var key = String(dims.heightIn);
    if (!catalog.imperial.fasciaByHeight[key]) catalog.imperial.fasciaByHeight[key] = [];
    catalog.imperial.fasciaByHeight[key].push(fascia);
  }

  function addCatalogImperialSoftGood(catalog, item) {
    if (item.stockType !== "sales") return;

    var text = normaliseMatchText([item.name, item.altName, item.description, item.memo].join(" "));
    if (looksLikeNonConsumableSoftGood(text)) return;

    var isFelt = /felt/.test(text);
    var isCarpet = /carpet|floor covering|floorcovering|floor cover/.test(text) && !isFelt;
    if (!isCarpet && !isFelt) return;

    var softGood = cloneStockItem(item);
    softGood.key = (isCarpet ? "imperial-carpet-" : "imperial-felt-") + String(item.id || "");
    softGood.colour = inferColourFromName(text);
    softGood.widthFt = parseImperialRollWidth([item.name, item.altName, item.description, item.memo].join(" "));
    softGood.unitSystem = "imperial";

    if (isCarpet) catalog.imperial.carpets.push(softGood);
    if (isFelt) catalog.imperial.felts.push(softGood);
  }

  function looksLikeNonConsumableSoftGood(text) {
    text = normaliseMatchText(text);
    return /set panel|panel|deck|litedeck|flat|handrail|triangle|brace|coupler|leg|tread|step|fas?cia|dj booth|hide|frame|plinth|weight|dolly|box/.test(text);
  }

  function parseImperialRectangle(name) {
    var match = String(name || "").match(/(\d+(?:\.\d+)?\s*ft\s*\d*(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:in|["']))\s*x\s*(\d+(?:\.\d+)?\s*ft\s*\d*(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:in|["']))/i);
    if (!match) return null;

    var first = match[1];
    var second = match[2];
    var firstHeight = parseImperialHeightToken(first);
    var firstLength = parseImperialLengthToken(first);
    var secondLength = parseImperialLengthToken(second);

    if (/fas?cia/i.test(String(name || ""))) {
      return {
        heightIn: firstHeight,
        lengthFt: secondLength,
        widthFt: 0,
        depthFt: 0
      };
    }

    return {
      widthFt: firstLength,
      depthFt: secondLength,
      heightIn: 0,
      lengthFt: 0
    };
  }

  function parseImperialLegHeight(name) {
    var text = String(name || "");
    var quoted = text.match(/(\d+(?:\.\d+)?)\s*"/);
    if (quoted) return roundQuantity(Number(quoted[1]));

    var inches = text.match(/(\d+(?:\.\d+)?)\s*in\b/i);
    if (inches) return roundQuantity(Number(inches[1]));

    var feet = text.match(/(\d+(?:\.\d+)?)\s*ft\b/i);
    if (feet) return roundQuantity(Number(feet[1]) * 12);

    return 0;
  }

  function parseImperialHeightToken(token) {
    token = $.trim(String(token || "").toLowerCase());
    var ftIn = token.match(/(\d+(?:\.\d+)?)\s*ft\s*(\d+(?:\.\d+)?)?/);
    if (ftIn) return roundQuantity((Number(ftIn[1]) * 12) + Number(ftIn[2] || 0));

    var inches = token.match(/(\d+(?:\.\d+)?)\s*(?:in|")/);
    if (inches) return roundQuantity(Number(inches[1]));

    var quoteFeet = token.match(/(\d+(?:\.\d+)?)\s*'/);
    if (quoteFeet) return roundQuantity(Number(quoteFeet[1]) * 12);

    return 0;
  }

  function parseImperialLengthToken(token) {
    token = $.trim(String(token || "").toLowerCase());
    var feet = token.match(/(\d+(?:\.\d+)?)\s*(?:ft|')/);
    if (feet) return roundQuantity(Number(feet[1]));

    var inches = token.match(/(\d+(?:\.\d+)?)\s*(?:in|")/);
    if (inches) return roundQuantity(Number(inches[1]) / 12);

    return 0;
  }

  function parseImperialRollWidth(name) {
    var text = String(name || "");
    var width = text.match(/(\d+(?:\.\d+)?)\s*(?:ft|')\s*(?:wide|roll|carpet|felt)/i);
    if (width) return roundQuantity(Number(width[1]));
    var metres = text.match(/(\d+(?:\.\d+)?)\s*m\s*(?:wide|roll|carpet|felt|\))/i);
    if (metres) return metresToFeet(Number(metres[1]));
    var centimetres = text.match(/(\d+(?:\.\d+)?)\s*cm\s*(?:wide|roll|carpet|felt|\)|\()/i);
    if (centimetres) return centimetresToFeet(Number(centimetres[1]));
    return 0;
  }

  function inferColourFromName(name) {
    var text = normaliseMatchText(name);
    if (text.indexOf("anthracite") !== -1) return "grey";
    if (text.indexOf("dark grey") !== -1 || text.indexOf("light grey") !== -1) return "grey";
    if (text.indexOf("off white") !== -1) return "white";
    if (text.indexOf("navy blue") !== -1) return "blue";
    if (text.indexOf("bright red") !== -1) return "red";
    var colours = ["black", "burgundy", "grey", "gray", "white", "blue", "red", "green", "purple", "pink", "yellow", "orange"];
    for (var i = 0; i < colours.length; i++) {
      if (text.indexOf(colours[i]) !== -1) return colours[i] === "gray" ? "grey" : colours[i];
    }
    return "";
  }

  function getImperialDeckDepthOptions(catalog) {
    var out = [];
    for (var i = 0; i < catalog.imperial.decks.length; i++) {
      out.push(catalog.imperial.decks[i].widthFt);
      out.push(catalog.imperial.decks[i].depthFt);
    }
    return uniqueNumbers(out);
  }

  function getImperialDeckWidthOptions(catalog, rowDepth) {
    var out = [];
    for (var i = 0; i < catalog.imperial.decks.length; i++) {
      var deck = catalog.imperial.decks[i];
      if (dimensionsClose(deck.depthFt, rowDepth)) out.push(deck.widthFt);
      if (dimensionsClose(deck.widthFt, rowDepth)) out.push(deck.depthFt);
    }
    return uniqueNumbers(out);
  }

  function findImperialDeckItem(catalog, widthFt, depthFt) {
    var best = null;
    for (var i = 0; i < catalog.imperial.decks.length; i++) {
      var deck = catalog.imperial.decks[i];
      if (!dimensionsMatchImperial(deck.widthFt, deck.depthFt, widthFt, depthFt)) continue;
      best = chooseBetterStockItem(best, deck);
    }
    return best;
  }

  function getImperialStairItemForHeight(height, catalog) {
    var best = null;
    var bestMax = Infinity;
    for (var i = 0; i < catalog.imperial.stairs.length; i++) {
      var stair = catalog.imperial.stairs[i];
      if (Number(stair.maxHeight || 9999) < Number(height || 0)) continue;
      if (Number(stair.maxHeight || 9999) < bestMax) {
        best = stair;
        bestMax = Number(stair.maxHeight || 9999);
      }
    }
    return best || catalog.imperial.stairs[0] || null;
  }

  function getImperialFasciaLengths(items) {
    var out = [];
    for (var i = 0; i < (items || []).length; i++) out.push(items[i].lengthFt);
    return uniqueNumbers(out);
  }

  function findImperialFasciaItem(items, lengthFt) {
    var best = null;
    for (var i = 0; i < (items || []).length; i++) {
      if (!dimensionsClose(items[i].lengthFt, lengthFt)) continue;
      best = chooseBetterStockItem(best, items[i]);
    }
    return best;
  }

  function getImperialCarpetRollWidths(catalog, colour) {
    var out = [];
    for (var i = 0; i < catalog.imperial.carpets.length; i++) {
      var item = catalog.imperial.carpets[i];
      if (!colourMatches(item.colour, colour)) continue;
      if (item.widthFt > 0) out.push(item.widthFt);
    }
    return uniqueNumbers(out);
  }

  function findImperialSoftGood(items, colour, widthFt) {
    var best = null;
    var bestScore = Infinity;
    for (var i = 0; i < (items || []).length; i++) {
      var item = items[i];
      if (item.stockType !== "sales") continue;
      if (looksLikeNonConsumableSoftGood([item.name, item.altName, item.description, item.memo].join(" "))) continue;
      var score = scoreSoftGood(item, colour, widthFt);
      if (score >= bestScore) continue;
      best = item;
      bestScore = score;
    }
    return best;
  }

  function scoreSoftGood(item, colour, widthFt) {
    var score = 0;
    var requestedColour = normaliseColourName(colour);
    if (requestedColour && item.colour && item.colour !== requestedColour) return Infinity;
    if (requestedColour && item.colour === requestedColour) score -= 5;
    else if (requestedColour && !item.colour) score += 2;

    if (Number(widthFt || 0) > 0) {
      if (item.widthFt > 0) score += Math.abs(Number(item.widthFt || 0) - Number(widthFt || 0));
      else score += 3;
    }

    if (item.eventBuilderVisible) score -= 1;
    if (item.price > 0) score += item.price / 1000;
    return score;
  }

  function normaliseColourName(colour) {
    var text = normaliseMatchText(colour);
    if (text === "gray") return "grey";
    if (text === "anthracite" || text === "dark grey" || text === "light grey") return "grey";
    if (text === "off white") return "white";
    if (text === "navy blue") return "blue";
    if (text === "bright red") return "red";
    return text;
  }

  function colourMatches(itemColour, requestedColour) {
    var requested = normaliseColourName(requestedColour);
    var item = normaliseColourName(itemColour);
    return !requested || !item || item === requested;
  }

  function dimensionsClose(a, b) {
    return Math.abs(Number(a || 0) - Number(b || 0)) < 0.001;
  }

  function dimensionsMatchImperial(a, b, width, depth) {
    return (dimensionsClose(a, width) && dimensionsClose(b, depth)) ||
      (dimensionsClose(a, depth) && dimensionsClose(b, width));
  }

  function addCatalogWarnings(catalog) {
    var requiredDecks = ["deck-2x1", "deck-2x0.5", "deck-1x1", "deck-1x0.5", "deck-0.5x0.5"];
    for (var i = 0; i < requiredDecks.length; i++) {
      if (!catalog.decksByKey[requiredDecks[i]]) catalog.warnings.push("Missing " + describeDeckKey(requiredDecks[i]) + " in live staging stock.");
    }
    if (!Object.keys(catalog.legs).length) catalog.warnings.push("Missing live scaff leg stock.");
    if (!catalog.stairs.length) catalog.warnings.push("Missing live stair/tread stock.");

    if (!catalog.imperial.decks.length) catalog.imperialWarnings.push("Missing live imperial LiteDeck stock.");
    if (!Object.keys(catalog.imperial.legs).length) catalog.imperialWarnings.push("Missing live imperial deck leg stock.");
    if (!catalog.imperial.stairs.length) catalog.imperialWarnings.push("Missing live imperial tread kit stock.");
    if (!Object.keys(catalog.imperial.fasciaByHeight).length) catalog.imperialWarnings.push("Missing live imperial Facia stock.");
  }

  async function saveStageHeading(jobId, parentId, id, spec, kit) {
    return postItemsSave({
      parent: String(parentId || "0"),
      flag: "0",
      priority_confirm: "0",
      custom_fields: "",
      kind: "0",
      local: formatLocalDateTime(new Date()),
      id: String(id || "0"),
      name: getStageFolderTitle(spec),
      desc: "",
      memo: "",
      set_child_dates: "0",
      job: String(jobId || ""),
      no_availability: "0",
      ignore: "0"
    }, id);
  }

  async function saveStageLines(jobId, parentId, lines) {
    var rows = [];
    for (var i = 0; i < (lines || []).length; i++) {
      var row = lineToImportRow(lines[i]);
      if (row) rows.push(row);
    }
    if (!rows.length) return { items: [] };

    var payload = {
      job_id: String(jobId || ""),
      archive_id: "0",
      sibling_id: "0",
      sibling_kind: "0",
      parent_id: String(parentId || "0"),
      local: formatLocalDateTime(new Date()),
      tz: getTimezone(),
      rows: JSON.stringify(rows),
      no_availability: "0"
    };

    return postItemsImport(payload, rows);
  }

  function lineToImportRow(line) {
    if (!line) return null;
    var qty = roundQuantity(line.qty || 1);
    if (qty <= 0) return null;

    if (line.kind === "stock") {
      return {
        STOCK_ID: String(line.listId || ""),
        QTY: qty
      };
    }

    if (line.kind === "sales") {
      return {
        SALES_ID: String(line.listId || ""),
        QTY: qty
      };
    }

    return {
      TITLE: String(line.name || ""),
      QTY: qty,
      UNIT_PRICE: 0,
      PRICE: 0,
      NO_SHORTFALL: 1,
      MEMO: "",
      NOTE: ""
    };
  }

  async function postItemsSave(payload, fallbackId) {
    var attempts = 0;

    while (attempts < CFG.saveMaxAttempts) {
      attempts += 1;
      await throttleWrite();

      var response = await fetch(CFG.itemsSave, {
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

  async function postItemsImport(payload, rows) {
    var attempts = 0;

    while (attempts < CFG.saveMaxAttempts) {
      attempts += 1;
      await throttleWrite();

      var response = await fetch(CFG.itemsImport, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
        body: $.param(payload || {})
      });

      var text = await response.text();
      var json = tryParseJson(text);

      if (!response.ok) throw new Error("items_import failed with status " + response.status);
      if (isRateLimitResponse(json) && attempts < CFG.saveMaxAttempts) {
        await waitForRateLimit();
        continue;
      }
      if (isBareErrorCode(json, text)) throw new Error(readServerMessage(json != null ? json : text, "HireHop returned an error while importing stage lines."));
      if (json && typeof json.error !== "undefined") {
        throw new Error(readServerMessage(json.error, "HireHop returned an error while importing stage lines.") + " First row: " + summariseImportRow(rows && rows[0]));
      }
      if (json && typeof json.warning !== "undefined") {
        throw new Error(readServerMessage(json.warning, "HireHop returned a warning while importing stage lines.") + " First row: " + summariseImportRow(rows && rows[0]));
      }

      if (!json) throw new Error("HireHop did not return JSON while importing stage lines. Response: " + String(text || "").substr(0, 160));
      return json;
    }

    throw new Error("HireHop rate limit hit. Wait a minute and save again.");
  }

  async function deleteItemsDirect(ids, jobId, kind) {
    var idList = normaliseIdList(ids);
    if (!idList.length) return;

    var prefix = getTreeNodePrefixForKind(kind);
    var prefixed = idList.map(function (id) { return prefix + id; });
    var payload = {
      ids: prefixed.join(","),
      job: String(jobId || ""),
      no_availability: "0"
    };
    var attempts = 0;

    while (attempts < CFG.saveMaxAttempts) {
      attempts += 1;
      await throttleWrite();

      var response = await fetch(CFG.itemsDelete, {
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
      if (json && typeof json.error !== "undefined") throw new Error(readServerMessage(json.error, "HireHop returned an error while removing the partial stage."));
      return;
    }
  }

  function resolveStageTarget() {
    var tree = getTree();
    var selected = getSelectedTreeNode(tree);
    var headingNode = null;

    if (selected && selected.data && Number(selected.data.kind) === 0) headingNode = selected;
    else headingNode = getParentHeadingNode(tree, selected);

    if (headingNode && isGeneratedStageNode(headingNode)) {
      var parsed = extractStageMeta(getNodeTechnical(headingNode));
      var parent = getParentHeadingNode(tree, headingNode);
      return {
        mode: "create",
        sourceStageFolderId: getNodeDataId(headingNode),
        stageNode: null,
        stageFolderId: "",
        parentId: getParentHeadingDataId(tree, headingNode),
        parentTitle: getNodeTitle(parent) || "selected parent",
        spec: parsed && parsed.spec ? parsed.spec : parseSpecFromStageTitle(getNodeTitle(headingNode))
      };
    }

    return {
      mode: "create",
      stageNode: null,
      stageFolderId: "",
      parentId: headingNode ? getNodeDataId(headingNode) : "0",
      parentTitle: headingNode ? getNodeTitle(headingNode) : "top level",
      spec: null
    };
  }

  function isGeneratedStageNode(node) {
    if (!node || !node.data) return false;
    var technical = getNodeTechnical(node);
    if (technical.indexOf(CFG.metaStart) !== -1 && technical.indexOf(CFG.marker) !== -1) return true;
    var name = getNodeTitle(node);
    return /^stage\s+-\s+/i.test(name);
  }

  function getTargetSubtitle(target) {
    if (!target) return "Creates a generated stage kit in the supplying list.";
    if (target.sourceStageFolderId) return "Creates another generated stage folder beside the selected stage.";
    return "Creates a generated stage folder under " + (target.parentTitle || "the selected heading") + ".";
  }

  function defaultSpec() {
    return {
      unitSystem: "metric",
      width: 4,
      depth: 3,
      height: 600,
      carpetColour: "Black",
      fasciaColour: "Black",
      fasciaSides: CFG.fasciaSidesDefault,
      treads: 1
    };
  }

  function parseSpecFromStageTitle(title) {
    var raw = String(title || "");
    var match = raw.match(/stage\s+-\s*(\d+(?:\.\d+)?)ft\s*x\s*(\d+(?:\.\d+)?)ft\s*@\s*(.+?)\s+(.+?)\s*\/\s*(.+?)\s*-\s*(\d+)\s*treads?/i);
    if (match) {
      return {
        unitSystem: "imperial",
        width: Number(match[1]),
        depth: Number(match[2]),
        height: parseImperialHeightToken(match[3]),
        carpetColour: $.trim(match[4]) || "Black",
        fasciaColour: $.trim(match[5]) || "Black",
        fasciaSides: CFG.fasciaSidesDefault,
        treads: Number(match[6])
      };
    }

    match = raw.match(/stage\s+-\s*(\d+(?:\.\d+)?)m?\s*x\s*(\d+(?:\.\d+)?)m?\s*@\s*(\d{3,4})mm\s+(.+?)\s*\/\s*(.+?)\s*-\s*(\d+)\s*treads?/i);
    if (match) {
      return {
        unitSystem: "metric",
        width: Number(match[1]),
        depth: Number(match[2]),
        height: Number(match[3]),
        carpetColour: $.trim(match[4]) || "Black",
        fasciaColour: $.trim(match[5]) || "Black",
        fasciaSides: CFG.fasciaSidesDefault,
        treads: Number(match[6])
      };
    }

    match = raw.match(/stage\s+-\s*(\d+(?:\.\d+)?)m?\s*x\s*(\d+(?:\.\d+)?)m?\s*x\s*(\d{3,4})mm/i);
    if (!match) return null;
    return {
      unitSystem: "metric",
      width: Number(match[1]),
      depth: Number(match[2]),
      height: Number(match[3]),
      carpetColour: "Black",
      fasciaColour: "Black",
      fasciaSides: CFG.fasciaSidesDefault,
      treads: 1
    };
  }

  function normaliseSpec(spec, catalog) {
    spec = spec || {};
    var unitSystem = normaliseUnitSystem(spec.unitSystem);
    var heights = getLegHeights(catalog, unitSystem);
    var fallbackHeight = unitSystem === "imperial" ? 24 : 600;
    var height = Number(spec.height || fallbackHeight);
    if (heights.indexOf(height) === -1) height = closestNumber(height, heights, fallbackHeight);

    return {
      unitSystem: unitSystem,
      width: clamp(roundToIncrement(spec.width, getLengthStep({ unitSystem: unitSystem })), getLengthMin({ unitSystem: unitSystem }), getLengthMax({ unitSystem: unitSystem })),
      depth: clamp(roundToIncrement(spec.depth, getLengthStep({ unitSystem: unitSystem })), getLengthMin({ unitSystem: unitSystem }), getLengthMax({ unitSystem: unitSystem })),
      height: height,
      carpetColour: $.trim(String(spec.carpetColour || "Black")) || "Black",
      fasciaColour: $.trim(String(spec.fasciaColour || "Black")) || "Black",
      fasciaSides: Number(spec.fasciaSides) >= 4 ? 4 : 3,
      treads: clamp(Math.round(Number(spec.treads || 0)), 0, 20)
    };
  }

  function getStageFolderTitle(spec) {
    if (spec.unitSystem === "imperial") {
      return "Stage - " + formatDimension(spec.width) + "ft x " + formatDimension(spec.depth) + "ft @ " +
        formatImperialHeight(spec.height) + " " + spec.carpetColour + " / " + spec.fasciaColour + " - " +
        String(spec.treads) + " " + (Number(spec.treads) === 1 ? "tread" : "treads");
    }

    return "Stage - " + formatDimension(spec.width) + "m x " + formatDimension(spec.depth) + "m @ " +
      String(spec.height) + "mm " + spec.carpetColour + " / " + spec.fasciaColour + " - " +
      String(spec.treads) + " " + (Number(spec.treads) === 1 ? "tread" : "treads");
  }

  function getStageSpecLabel(spec) {
    if (spec.unitSystem === "imperial") {
      return formatDimension(spec.width) + "ft x " + formatDimension(spec.depth) + "ft x " + formatImperialHeight(spec.height);
    }
    return formatDimension(spec.width) + "m x " + formatDimension(spec.depth) + "m x " + String(spec.height) + "mm";
  }

  function extractStageMeta(text) {
    var raw = String(text || "");
    var start = raw.indexOf(CFG.metaStart);
    var end = start === -1 ? -1 : raw.indexOf(CFG.metaEnd, start + CFG.metaStart.length);
    if (start === -1 || end === -1) return null;
    try {
      return JSON.parse(raw.slice(start + CFG.metaStart.length, end));
    } catch (e) {
      return null;
    }
  }

  function stagePreviewHtml(spec, kit) {
    var unitLabel = getLengthUnitLabel(spec);
    var cols = Math.max(1, Math.round(spec.width / getLengthStep(spec)));
    var rows = Math.max(1, Math.round(spec.depth / getLengthStep(spec)));
    var cellCount = Math.min(cols * rows, 800);
    var cells = [];
    for (var i = 0; i < cellCount; i++) cells.push('<span></span>');

    var carpet = colourToCss(spec.carpetColour, "#1f2937");
    var fascia = colourToCss(spec.fasciaColour, "#111827");
    var aspect = Math.max(1, spec.width) + " / " + Math.max(1, spec.depth);
    var stairHtml = "";

    for (var t = 0; t < spec.treads; t++) {
      stairHtml += '<span></span>';
    }

    return '' +
      '<div class="wsd-stage-title">' + esc(getStageSpecLabel(spec)) + '</div>' +
      '<div class="wsd-stage-top" style="grid-template-columns:repeat(' + cols + ',1fr);aspect-ratio:' + aspect + ';background:' + escAttr(carpet) + ';">' + cells.join("") + '</div>' +
      '<div class="wsd-stage-face" style="background:' + escAttr(fascia) + ';height:' + getPreviewFaceHeight(spec.height) + 'px;"></div>' +
      '<div class="wsd-stage-access' + (spec.treads ? '' : ' is-empty') + '">' + stairHtml + '</div>' +
      '<div class="wsd-stage-metrics">' +
        '<span>' + esc(String(kit.deckCount)) + ' decks</span>' +
        '<span>' + esc(String(kit.legCount)) + ' legs</span>' +
        '<span>' + esc(formatDimension(kit.carpetLinearM)) + ' ' + esc(unitLabel) + ' carpet</span>' +
        '<span>' + esc(String(spec.fasciaSides)) + ' sides / ' + esc(formatDimension(kit.feltLinearM)) + ' ' + esc(unitLabel) + ' felt</span>' +
      '</div>';
  }

  function kitSummaryHtml(kit) {
    var grouped = {};
    var order = [];

    for (var i = 0; i < kit.lines.length; i++) {
      var line = kit.lines[i];
      var group = line.group || "Items";
      if (!grouped[group]) {
        grouped[group] = [];
        order.push(group);
      }
      grouped[group].push(line);
    }

    var html = '<div class="wsd-kit-title">Generated kit</div>';
    if (kit.missingRequired && kit.missingRequired.length) {
      html += '<div class="wsd-kit-group"><div class="wsd-kit-group-title">Missing live stock</div>';
      for (var m = 0; m < kit.missingRequired.length; m++) {
        html += '<div class="wsd-kit-row"><strong>!</strong><span>' + esc(kit.missingRequired[m]) + '</span></div>';
      }
      html += '</div>';
    }
    if (kit.warnings && kit.warnings.length) {
      html += '<div class="wsd-kit-group"><div class="wsd-kit-group-title">Live stock notes</div>';
      for (var w = 0; w < kit.warnings.length; w++) {
        html += '<div class="wsd-kit-row"><strong>-</strong><span>' + esc(kit.warnings[w]) + '</span></div>';
      }
      html += '</div>';
    }
    for (var g = 0; g < order.length; g++) {
      var groupName = order[g];
      html += '<div class="wsd-kit-group"><div class="wsd-kit-group-title">' + esc(groupName) + '</div>';
      for (var j = 0; j < grouped[groupName].length; j++) {
        var item = grouped[groupName][j];
        html += '<div class="wsd-kit-row"><strong>' + esc(formatDimension(item.qty)) + '</strong><span>' + esc(item.name) + '</span></div>';
      }
      html += '</div>';
    }
    return html;
  }

  function controlNumberHtml(field, label, value, min, max, step, suffix) {
    return '' +
      '<label class="wsd-field">' +
        '<span>' + esc(label) + '</span>' +
        '<div class="wsd-input-wrap">' +
          '<input data-wsd-field="' + escAttr(field) + '" type="number" value="' + escAttr(formatDimension(value)) + '" min="' + escAttr(min) + '" max="' + escAttr(max) + '" step="' + escAttr(step) + '">' +
          (suffix ? '<em data-wsd-suffix-for="' + escAttr(field) + '">' + esc(suffix) + '</em>' : '') +
        '</div>' +
      '</label>';
  }

  function controlTextHtml(field, label, value) {
    return '' +
      '<label class="wsd-field">' +
        '<span>' + esc(label) + '</span>' +
        '<div class="wsd-input-wrap">' +
          '<input data-wsd-field="' + escAttr(field) + '" type="text" value="' + escAttr(value) + '">' +
          '<i data-wsd-swatch="' + escAttr(field) + '"></i>' +
        '</div>' +
      '</label>';
  }

  function controlSelectHtml(field, label, value, options, suffix) {
    var html = '<label class="wsd-field"><span>' + esc(label) + '</span><div class="wsd-input-wrap"><select data-wsd-field="' + escAttr(field) + '">';
    for (var i = 0; i < options.length; i++) {
      html += '<option value="' + escAttr(options[i].value) + '"' + (String(options[i].value) === String(value) ? ' selected' : '') + '>' + esc(options[i].label) + '</option>';
    }
    html += '</select>' + (suffix || field === "height" ? '<em data-wsd-suffix-for="' + escAttr(field) + '">' + esc(suffix || "") + '</em>' : '') + '</div></label>';
    return html;
  }

  function getUnitSystemOptions() {
    return [
      { value: "metric", label: "Metric" },
      { value: "imperial", label: "Imperial" }
    ];
  }

  function getLegHeightOptions(catalog, unitSystem) {
    var heights = getLegHeights(catalog, unitSystem);
    var out = [];
    for (var i = 0; i < heights.length; i++) {
      out.push({
        value: String(heights[i]),
        label: normaliseUnitSystem(unitSystem) === "imperial" ? formatImperialHeight(heights[i]) : String(heights[i])
      });
    }
    return out;
  }

  function getFasciaSideOptions() {
    return [
      { value: "3", label: "3 sides" },
      { value: "4", label: "4 sides" }
    ];
  }

  function getLegHeights(catalog, unitSystem) {
    catalog = normaliseCatalog(catalog);
    if (normaliseUnitSystem(unitSystem) === "imperial") {
      var imperialLive = Object.keys(catalog.imperial.legs || {}).map(function (value) { return Number(value); }).filter(function (value) { return isFinite(value) && value > 0; }).sort(function (a, b) { return a - b; });
      return imperialLive.length ? imperialLive : [8, 12, 18, 24, 36];
    }
    var live = Object.keys(catalog.legs || {}).map(function (value) { return Number(value); }).filter(function (value) { return isFinite(value) && value > 0; }).sort(function (a, b) { return a - b; });
    return live.length ? live : [200, 270, 300, 400, 600, 800, 1000, 1200, 1600];
  }

  function syncHeightOptions(catalog) {
    var $select = $("#" + CFG.overlayId).find('[data-wsd-field="height"]').first();
    if (!$select.length) return;

    var current = state.currentSpec && state.currentSpec.height ? String(state.currentSpec.height) : String($select.val() || "");
    var unitSystem = state.currentSpec && state.currentSpec.unitSystem ? state.currentSpec.unitSystem : "metric";
    var options = getLegHeightOptions(catalog, unitSystem);
    var html = "";
    var found = false;
    for (var i = 0; i < options.length; i++) {
      if (String(options[i].value) === current) found = true;
      html += '<option value="' + escAttr(options[i].value) + '">' + esc(options[i].label) + '</option>';
    }
    $select.html(html);
    if (found) $select.val(current);
    else if (options.length) $select.val(String(options[0].value));
  }

  function syncUnitControls(spec, catalog) {
    var $overlay = $("#" + CFG.overlayId);
    if (!$overlay.length) return;

    $overlay.find('[data-wsd-field="unitSystem"]').val(spec.unitSystem);
    $overlay.find('[data-wsd-field="width"],[data-wsd-field="depth"]').attr({
      min: getLengthMin(spec),
      max: getLengthMax(spec),
      step: getLengthStep(spec)
    });
    $overlay.find('[data-wsd-suffix-for="width"],[data-wsd-suffix-for="depth"]').text(getLengthUnitLabel(spec));
    $overlay.find('[data-wsd-suffix-for="height"]').text(getHeightUnitSuffix(spec));
    syncHeightOptions(catalog);
  }

  function writeSpecToModal(spec) {
    var $overlay = $("#" + CFG.overlayId);
    if (!$overlay.length) return;

    spec = normaliseSpec(spec, stockState.catalog);
    $overlay.find('[data-wsd-field="unitSystem"]').val(spec.unitSystem);
    $overlay.find('[data-wsd-field="width"]').val(formatDimension(spec.width));
    $overlay.find('[data-wsd-field="depth"]').val(formatDimension(spec.depth));
    $overlay.find('[data-wsd-field="height"]').val(String(spec.height));
    $overlay.find('[data-wsd-field="carpetColour"]').val(spec.carpetColour);
    $overlay.find('[data-wsd-field="fasciaColour"]').val(spec.fasciaColour);
    $overlay.find('[data-wsd-field="fasciaSides"]').val(String(spec.fasciaSides));
    $overlay.find('[data-wsd-field="treads"]').val(String(spec.treads));
    syncUnitControls(spec, stockState.catalog);
  }

  function convertSpecUnit(spec, nextUnitSystem, catalog) {
    spec = normaliseSpec(spec || defaultSpec(), catalog);
    nextUnitSystem = normaliseUnitSystem(nextUnitSystem);
    if (spec.unitSystem === nextUnitSystem) return spec;

    if (nextUnitSystem === "imperial") {
      return normaliseSpec(extendObject(spec, {
        unitSystem: "imperial",
        width: spec.width * 3.28084,
        depth: spec.depth * 3.28084,
        height: spec.height / 25.4
      }), catalog);
    }

    return normaliseSpec(extendObject(spec, {
      unitSystem: "metric",
      width: spec.width * 0.3048,
      depth: spec.depth * 0.3048,
      height: spec.height * 25.4
    }), catalog);
  }

  function normaliseUnitSystem(value) {
    return String(value || "").toLowerCase() === "imperial" ? "imperial" : "metric";
  }

  function getLengthStep(spec) {
    return normaliseUnitSystem(spec && spec.unitSystem) === "imperial" ? CFG.imperialDeckIncrementFt : CFG.deckIncrementM;
  }

  function getLengthMin(spec) {
    return normaliseUnitSystem(spec && spec.unitSystem) === "imperial" ? 2 : 0.5;
  }

  function getLengthMax(spec) {
    return normaliseUnitSystem(spec && spec.unitSystem) === "imperial" ? 80 : 40;
  }

  function getLengthUnitLabel(spec) {
    return normaliseUnitSystem(spec && spec.unitSystem) === "imperial" ? "ft" : "m";
  }

  function getHeightUnitSuffix(spec) {
    return normaliseUnitSystem(spec && spec.unitSystem) === "imperial" ? "" : "mm";
  }

  function setBusy(isBusy) {
    $("#" + CFG.bodyId).find("input,select,button").prop("disabled", !!isBusy);
    $("#" + CFG.closeId + ",[data-wsd-close]").prop("disabled", !!isBusy);
    $("#" + CFG.saveId).prop("disabled", !!isBusy).text(isBusy ? "Saving..." : "Add stage kit");
  }

  function setStatus(message, tone) {
    var $status = $("#" + CFG.statusId);
    $status.removeClass("is-error is-success is-warning is-info").text(message || "");
    if (tone) $status.addClass("is-" + tone);
  }

  function refreshSupplyingList() {
    var selector = 'button,a,[role="button"],input[type="button"],input[type="submit"]';
    var scopes = [$(CFG.toolbarHost).get(0), $(CFG.itemsTab).get(0), document.body];

    for (var i = 0; i < scopes.length; i++) {
      if (!scopes[i]) continue;
      var $match = $(scopes[i]).find(selector).filter(":visible").filter(function () {
        if ($(this).closest("#" + CFG.overlayId).length) return false;
        var text = $.trim($(this).text() || $(this).val() || $(this).attr("title") || $(this).attr("aria-label") || "");
        return /^refresh\b/i.test(text);
      }).first();
      if ($match.length) {
        $match.get(0).click();
        return;
      }
    }
  }

  function getTree() {
    var $trees = $(CFG.tree);
    for (var i = 0; i < $trees.length; i++) {
      try {
        var tree = $($trees[i]).jstree(true);
        if (tree) return tree;
      } catch (e) {}
    }
    return null;
  }

  function getSelectedTreeNode(tree) {
    var nodes = [];
    var seen = {};

    if (tree && typeof tree.get_selected === "function") {
      var selected = tree.get_selected(true) || [];
      for (var i = 0; i < selected.length; i++) addTreeNode(selected[i], nodes, seen);
    }

    collectTreeNodesFromDom(tree, $(CFG.treeClicked), nodes, seen);

    if (!nodes.length) {
      collectTreeNodesFromDom(tree, $(CFG.treeSelectedFallback), nodes, seen);
    }

    return nodes.length ? nodes[0] : null;
  }

  function collectTreeNodesFromDom(tree, $elements, out, seen) {
    if (!tree || !$elements || !$elements.length) return;

    $elements.each(function () {
      var $li = $(this).is("li.jstree-node") ? $(this) : $(this).closest("li.jstree-node");
      if (!$li.length) return;
      try {
        addTreeNode(tree.get_node($.trim(String($li.attr("id") || ""))), out, seen);
      } catch (e) {}
    });
  }

  function addTreeNode(node, out, seen) {
    if (!node || !node.id || seen[node.id]) return;
    seen[node.id] = true;
    out.push(node);
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

  function getParentHeadingNode(tree, node) {
    if (!tree || !node) return null;
    var parentId = "";
    try { parentId = tree.get_parent(node); } catch (e) { parentId = ""; }
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

  function getNodeTitle(node) {
    if (!node) return "";
    var raw = "";
    if (node.data) raw = node.data.title != null ? node.data.title : (node.data.TITLE != null ? node.data.TITLE : node.data.name);
    if (!$.trim(String(raw || "")) && node.text != null) raw = node.text;
    return normaliseWhitespace(parseHeadingName(raw));
  }

  function getNodeTechnical(node) {
    if (!node || !node.data) return "";
    return String(node.data.TECHNICAL || node.data.technical || node.data.MEMO || node.data.memo || "");
  }

  function getNodeDataId(node) {
    if (!node || !node.data) return "";
    return String(node.data.ID || node.data.id || "");
  }

  function parseHeadingName(value) {
    var raw = $.trim(String(value || ""));
    raw = raw.replace(/^\/\/\s*/i, "").replace(/^\$\s*/i, "");
    raw = raw.replace(/^(section|dept)\s*:\s*/i, "");
    return raw;
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

  function findToolbarHost() {
    var $preview = $("#wise-doc-preview-toggle");
    if ($preview.length && $preview.parent().length) return $preview.parent();

    var $edit = findToolbarActionButton(/^edit\b/i);
    if ($edit.length && $edit.parent().length) return $edit.parent();

    var $new = findToolbarActionButton(/^new\b/i);
    if ($new.length && $new.parent().length) return $new.parent();

    return $(CFG.toolbarHost);
  }

  function findToolbarActionButton(pattern) {
    var $scope = $(CFG.toolbarHost);
    if (!$scope.length) return $();
    return $scope.find('button,a,[role="button"],input[type="button"],input[type="submit"]').filter(":visible").filter(function () {
      var text = $.trim($(this).text() || $(this).val() || $(this).attr("title") || $(this).attr("aria-label") || "");
      return pattern.test(text);
    }).first();
  }

  function applyNativeToolbarButtonTemplate($button, $host) {
    if (!$button || !$button.length) return;
    var template = getNativeToolbarButtonTemplate($host);
    if (template.className) $button.attr("class", template.className);
    if (template.style) $button.attr("style", template.style);
    else $button.removeAttr("style");
  }

  function getNativeToolbarButtonTemplate($host) {
    $host = $host && $host.length ? $host : findToolbarHost();
    if (!$host.length) return { className: "", style: "" };

    var $sample = $host.find("button,a,[role='button'],input[type='button'],input[type='submit']").filter(":visible").filter(function () {
      var $el = $(this);
      if ($el.is("#" + CFG.buttonId + ",#wise-doc-preview-toggle,#wise-proposal-view-toggle,#wise-proposal-page-editor-button,#wise-native-line-editor-button")) return false;
      if ($el.attr("data-wise-native-edit") === "1") return false;
      if ($el.hasClass("fixed_width")) return false;
      var text = $.trim(String($el.text() || $el.val() || $el.attr("title") || $el.attr("aria-label") || ""));
      return !!text;
    }).first();

    return {
      className: $sample.attr("class") || "",
      style: $sample.attr("style") || ""
    };
  }

  function placeToolbarButtonBeforeGear($button, $host) {
    if (!$button || !$button.length || !$host || !$host.length) return;

    var $gear = $host.children("button.fixed_width,.fixed_width").filter(":visible").last();
    if ($gear.length) {
      if (!$button.next().is($gear)) $button.insertBefore($gear);
      return;
    }

    if (!$button.parent().is($host)) $host.append($button);
  }

  function installStyles() {
    if ($("#" + CFG.stylesId).length) return;

    var css = [
      "#" + CFG.overlayId + "{position:fixed;inset:0;z-index:100150;background:rgba(15,23,42,.48);display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box;}",
      "#" + CFG.modalId + "{width:min(1040px,100%);max-height:min(780px,calc(100vh - 36px));background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 22px 60px rgba(15,23,42,.28);display:flex;flex-direction:column;overflow:hidden;color:#243244;font-family:Arial,Helvetica,sans-serif;}",
      "#" + CFG.modalId + " .wsd-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:13px 15px 11px;background:#fff;border-bottom:1px solid #d9e2ec;}",
      "#" + CFG.modalId + " .wsd-title{font-size:18px;font-weight:800;line-height:1.2;color:#111827;}",
      "#" + CFG.modalId + " .wsd-subtitle{font-size:12px;color:#526071;margin-top:3px;}",
      "#" + CFG.modalId + " .wsd-icon-btn{width:32px;height:30px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#344054;font-size:16px;line-height:1;cursor:pointer;}",
      "#" + CFG.modalId + " .wsd-body{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:12px;padding:12px;min-height:0;overflow:auto;}",
      "#" + CFG.modalId + " .wsd-visual-panel{min-width:0;display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:12px;align-items:start;}",
      "#" + CFG.modalId + " .wsd-stage-wrap{background:#fff;border:1px solid #dbe3ec;border-radius:8px;padding:14px;min-height:314px;}",
      "#" + CFG.modalId + " .wsd-stage-title{font-size:13px;font-weight:800;color:#1f2937;margin-bottom:10px;}",
      "#" + CFG.modalId + " .wsd-stage-top{display:grid;width:100%;max-height:330px;min-height:120px;border:1px solid rgba(17,24,39,.25);box-shadow:0 12px 24px rgba(15,23,42,.12);overflow:hidden;}",
      "#" + CFG.modalId + " .wsd-stage-top span{min-width:8px;min-height:8px;border-right:1px solid rgba(255,255,255,.34);border-bottom:1px solid rgba(255,255,255,.34);box-sizing:border-box;}",
      "#" + CFG.modalId + " .wsd-stage-face{width:100%;border:1px solid rgba(17,24,39,.25);border-top:0;box-shadow:0 8px 18px rgba(15,23,42,.16);}",
      "#" + CFG.modalId + " .wsd-stage-access{height:50px;display:flex;align-items:flex-start;justify-content:center;gap:4px;padding-top:7px;}",
      "#" + CFG.modalId + " .wsd-stage-access span{width:42px;height:14px;background:#111827;border:1px solid rgba(255,255,255,.2);border-radius:3px;box-shadow:0 4px 7px rgba(15,23,42,.18);}",
      "#" + CFG.modalId + " .wsd-stage-access.is-empty{display:none;}",
      "#" + CFG.modalId + " .wsd-stage-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:12px;}",
      "#" + CFG.modalId + " .wsd-stage-metrics span{border:1px solid #dbe3ec;background:#f8fafc;border-radius:6px;padding:6px 7px;font-size:11px;font-weight:700;text-align:center;color:#344054;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
      "#" + CFG.modalId + " .wsd-kit-panel{background:#fff;border:1px solid #dbe3ec;border-radius:8px;padding:10px;max-height:420px;overflow:auto;}",
      "#" + CFG.modalId + " .wsd-kit-title{font-size:13px;font-weight:800;margin-bottom:8px;color:#111827;}",
      "#" + CFG.modalId + " .wsd-kit-group{border-top:1px solid #edf1f5;padding-top:7px;margin-top:7px;}",
      "#" + CFG.modalId + " .wsd-kit-group:first-of-type{border-top:0;padding-top:0;margin-top:0;}",
      "#" + CFG.modalId + " .wsd-kit-group-title{font-size:10px;text-transform:uppercase;font-weight:800;color:#667085;margin-bottom:5px;}",
      "#" + CFG.modalId + " .wsd-kit-row{display:grid;grid-template-columns:38px minmax(0,1fr);gap:7px;align-items:start;font-size:12px;line-height:1.25;padding:4px 0;color:#253244;}",
      "#" + CFG.modalId + " .wsd-kit-row strong{font-size:12px;color:#111827;text-align:right;}",
      "#" + CFG.modalId + " .wsd-controls{display:flex;flex-direction:column;gap:9px;background:#fff;border:1px solid #dbe3ec;border-radius:8px;padding:10px;}",
      "#" + CFG.modalId + " .wsd-field{display:block;}",
      "#" + CFG.modalId + " .wsd-field>span{display:block;font-size:11px;font-weight:800;text-transform:uppercase;color:#526071;margin-bottom:4px;}",
      "#" + CFG.modalId + " .wsd-input-wrap{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:6px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;padding:0 8px;min-height:34px;}",
      "#" + CFG.modalId + " .wsd-input-wrap input,#" + CFG.modalId + " .wsd-input-wrap select{width:100%;border:0;background:transparent;outline:0;height:32px;font-size:14px;color:#111827;min-width:0;}",
      "#" + CFG.modalId + " .wsd-input-wrap em{font-style:normal;font-size:12px;color:#667085;}",
      "#" + CFG.modalId + " .wsd-input-wrap i{width:18px;height:18px;border-radius:4px;border:1px solid rgba(17,24,39,.2);background:#111827;}",
      "#" + CFG.modalId + " .wsd-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;background:#fff;border-top:1px solid #d9e2ec;}",
      "#" + CFG.modalId + " .wsd-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;}",
      "#" + CFG.modalId + " .wsd-btn{height:32px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#243244;padding:0 12px;font-weight:700;cursor:pointer;}",
      "#" + CFG.modalId + " .wsd-btn-primary{border-color:#175cd3;background:#175cd3;color:#fff;}",
      "#" + CFG.modalId + " .wsd-status{min-height:17px;font-size:12px;color:#526071;}",
      "#" + CFG.modalId + " .wsd-status.is-error{color:#b42318;font-weight:700;}",
      "#" + CFG.modalId + " .wsd-status.is-success{color:#067647;font-weight:700;}",
      "#" + CFG.modalId + " .wsd-status.is-warning{color:#9a3412;font-weight:700;}",
      "#" + CFG.modalId + " .wsd-status.is-info{color:#175cd3;font-weight:700;}",
      "@media(max-width:980px){#" + CFG.modalId + " .wsd-body{grid-template-columns:1fr;}#" + CFG.modalId + " .wsd-visual-panel{grid-template-columns:1fr;}#" + CFG.modalId + " .wsd-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));}#" + CFG.modalId + " .wsd-stage-metrics{grid-template-columns:repeat(2,minmax(0,1fr));}}",
      "@media(max-width:620px){#" + CFG.overlayId + "{padding:0;}#" + CFG.modalId + "{max-height:100vh;border-radius:0;border-left:0;border-right:0;}#" + CFG.modalId + " .wsd-controls{grid-template-columns:1fr;}#" + CFG.modalId + " .wsd-footer{flex-direction:column;align-items:stretch;}#" + CFG.modalId + " .wsd-actions{justify-content:stretch;}#" + CFG.modalId + " .wsd-btn{flex:1 1 0;}}"
    ].join("");

    $("<style id='" + CFG.stylesId + "'></style>").text(css).appendTo("head");
  }

  function emptyCatalog() {
    return {
      items: [],
      decksByKey: {},
      legs: {},
      stairs: [],
      warnings: [],
      imperialWarnings: [],
      imperial: {
        decks: [],
        legs: {},
        stairs: [],
        fasciaByHeight: {},
        carpets: [],
        felts: []
      }
    };
  }

  function normaliseCatalog(catalog) {
    if (!catalog || typeof catalog !== "object") return emptyCatalog();
    catalog.items = Array.isArray(catalog.items) ? catalog.items : [];
    catalog.decksByKey = catalog.decksByKey || {};
    catalog.legs = catalog.legs || {};
    catalog.stairs = Array.isArray(catalog.stairs) ? catalog.stairs : [];
    catalog.warnings = Array.isArray(catalog.warnings) ? catalog.warnings : [];
    catalog.imperialWarnings = Array.isArray(catalog.imperialWarnings) ? catalog.imperialWarnings : [];
    catalog.imperial = catalog.imperial || {};
    catalog.imperial.decks = Array.isArray(catalog.imperial.decks) ? catalog.imperial.decks : [];
    catalog.imperial.legs = catalog.imperial.legs || {};
    catalog.imperial.stairs = Array.isArray(catalog.imperial.stairs) ? catalog.imperial.stairs : [];
    catalog.imperial.fasciaByHeight = catalog.imperial.fasciaByHeight || {};
    catalog.imperial.carpets = Array.isArray(catalog.imperial.carpets) ? catalog.imperial.carpets : [];
    catalog.imperial.felts = Array.isArray(catalog.imperial.felts) ? catalog.imperial.felts : [];
    return catalog;
  }

  function appendStockCandidates(out, items) {
    for (var i = 0; i < (items || []).length; i++) {
      if (items[i]) out.push(items[i]);
    }
  }

  function rememberStockDiagnostic(endpoint, status, details) {
    stockState.diagnostics.push({
      endpoint: String(endpoint || ""),
      status: String(status || ""),
      details: String(details || "").substr(0, 220)
    });
    if (stockState.diagnostics.length > 30) stockState.diagnostics.shift();
  }

  function cloneStockItem(item) {
    return {
      key: item.key || "",
      id: String(item.id || ""),
      name: String(item.name || ""),
      altName: String(item.altName || ""),
      description: String(item.description || ""),
      memo: String(item.memo || ""),
      width: Number(item.width || 0),
      depth: Number(item.depth || 0),
      widthFt: Number(item.widthFt || 0),
      depthFt: Number(item.depthFt || 0),
      lengthFt: Number(item.lengthFt || 0),
      heightIn: Number(item.heightIn || 0),
      height: Number(item.height || 0),
      minHeight: Number(item.minHeight || 0),
      maxHeight: Number(item.maxHeight || 0),
      price: Number(item.price || 0),
      priceType: Number(item.priceType || 0),
      categoryId: String(item.categoryId || ""),
      stockType: String(item.stockType || "hire"),
      colour: String(item.colour || ""),
      unitSystem: String(item.unitSystem || ""),
      eventBuilderVisible: item.eventBuilderVisible === true
    };
  }

  function findDeckItem(key, catalog) {
    catalog = normaliseCatalog(catalog);
    return catalog.decksByKey[key] || null;
  }

  function chooseBetterStockItem(current, candidate) {
    if (!current) return candidate;
    if (candidate.eventBuilderVisible && !current.eventBuilderVisible) return candidate;
    if (!candidate.eventBuilderVisible && current.eventBuilderVisible) return current;
    if (candidate.price > 0 && (current.price <= 0 || candidate.price < current.price)) return candidate;
    return current;
  }

  function getFirstField(object, keys) {
    if (!object || typeof object !== "object") return "";
    for (var i = 0; i < keys.length; i++) {
      var value = object[keys[i]];
      if (value != null && value !== "") return value;
    }
    return "";
  }

  function cleanStockName(value) {
    return $.trim(String(value == null ? "" : value)
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, " "));
  }

  function findBestStockNameInArray(cells) {
    var best = "";
    for (var i = 0; i < (cells || []).length; i++) {
      var text = cleanStockName(cells[i]);
      if (!looksLikeUsableStageStockName(text)) continue;
      if (!best || text.length > best.length) best = text;
    }
    return best;
  }

  function extractStockIdFromText(value) {
    var text = String(value == null ? "" : value);
    var labelled = text.match(/(?:stock[_\s-]*id|list[_\s-]*id|id)[^0-9]{0,8}(\d{3,})/i);
    if (labelled) return labelled[1];
    var prefixed = text.match(/(?:^|[^a-z0-9])(?:b|stock|list|item)[_:-]?(\d{3,})(?:[^0-9]|$)/i);
    if (prefixed) return prefixed[1];
    return "";
  }

  function extractStockNameFromText(value) {
    var text = cleanStockName(value);
    var candidates = text.split(/\s{2,}|\|/);
    for (var i = 0; i < candidates.length; i++) {
      if (looksLikeUsableStageStockName(candidates[i])) return cleanStockName(candidates[i]);
    }
    return looksLikeUsableStageStockName(text) ? text : "";
  }

  function readStockCategoryName(raw) {
    var direct = cleanStockName(getFirstField(raw, ["CATEGORY", "category", "category_name", "categoryName"]));
    if (direct) return direct;
    var crumbs = getFirstField(raw, ["crumbs", "CRUMBS", "breadcrumbs", "BREADCRUMBS"]);
    var parsed = parseStockCrumbs(crumbs);
    return parsed.names.join(" > ");
  }

  function readStockCategoryId(raw) {
    var direct = String(getFirstField(raw, ["CATEGORY_ID", "category_id", "categoryId"]) || "");
    if (direct) return direct;
    var crumbs = getFirstField(raw, ["crumbs", "CRUMBS", "breadcrumbs", "BREADCRUMBS"]);
    var parsed = parseStockCrumbs(crumbs);
    return parsed.ids.length ? String(parsed.ids[parsed.ids.length - 1]) : "";
  }

  function readStockBreadcrumbs(raw) {
    var direct = cleanStockName(getFirstField(raw, ["BREADCRUMBS", "breadcrumbs", "path", "category_path"]));
    if (direct) return direct;
    var crumbs = getFirstField(raw, ["crumbs", "CRUMBS"]);
    return parseStockCrumbs(crumbs).names.join(" > ");
  }

  function parseStockCrumbs(value) {
    var names = [];
    var ids = [];
    if (typeof value === "string") {
      var json = tryParseJson(value);
      if (json) return parseStockCrumbs(json);
      var parts = value.split(/>|►|\//);
      for (var p = 0; p < parts.length; p++) {
        var name = cleanStockName(parts[p]);
        if (name) names.push(name);
      }
      return { names: names, ids: ids };
    }
    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i++) {
        var crumb = value[i];
        if (crumb && typeof crumb === "object") {
          var id = getFirstField(crumb, ["ID", "id", "CATEGORY_ID", "category_id"]);
          var label = cleanStockName(getFirstField(crumb, ["NAME", "name", "TITLE", "title"]));
          if (id !== "") ids.push(String(id));
          if (label) names.push(label);
        } else {
          var text = cleanStockName(crumb);
          if (text) names.push(text);
        }
      }
    }
    return { names: names, ids: ids };
  }

  function cleanStockId(value) {
    var text = $.trim(String(value == null ? "" : value));
    if (!text) return "";
    var exact = text.match(/^(?:list|stock|item|l|s|b)?[_:-]?(\d+)$/i);
    if (exact) return exact[1];
    var numeric = text.match(/(?:^|[^0-9])(\d{3,})(?:[^0-9]|$)/);
    return numeric ? numeric[1] : text;
  }

  function parseStockPrice(raw) {
    var direct = getFirstField(raw, ["PRICE_1", "price_1", "PRICE", "price", "UNIT_PRICE", "unit_price"]);
    if (direct !== "") return Number(String(direct).replace(/[^0-9.-]/g, "")) || 0;

    var prices = getFirstField(raw, ["PRICES", "prices"]);
    if (prices && typeof prices === "string") {
      try {
        var json = JSON.parse(prices);
        if (json && json._1 && json._1.PRICE != null) return Number(json._1.PRICE) || 0;
      } catch (e) {}
    } else if (prices && typeof prices === "object" && prices._1 && prices._1.PRICE != null) {
      return Number(prices._1.PRICE) || 0;
    }

    return 0;
  }

  function parseStockPriceType(raw) {
    var direct = getFirstField(raw, ["PRICE_TYPE_1_ID", "price_type_1_id", "PRICE_TYPE_ID", "price_type_id", "PRICE_TYPE", "price_type"]);
    var directText = String(direct == null ? "" : direct).replace(/[^0-9.-]/g, "");
    var directNumber = Number(directText);
    if (directText && isFinite(directNumber)) return directNumber || 0;

    var prices = getFirstField(raw, ["PRICES", "prices"]);
    if (prices && typeof prices === "string") {
      try {
        var json = JSON.parse(prices);
        if (json && json._1 && json._1.TYPE != null) return Number(json._1.TYPE) || 0;
      } catch (e) {}
    } else if (prices && typeof prices === "object" && prices._1 && prices._1.TYPE != null) {
      return Number(prices._1.TYPE) || 0;
    }

    return 0;
  }

  function readEventBuilderVisible(raw) {
    var customFields = getFirstField(raw, ["CUSTOM_FIELDS", "custom_fields", "customFields"]);
    if (!customFields) return false;
    try {
      var json = typeof customFields === "string" ? JSON.parse(customFields) : customFields;
      var field = json && (json.EventBuilderVisible || json.eventBuilderVisible);
      return !!(field && String(field.value != null ? field.value : field).toLowerCase() === "1");
    } catch (e) {
      return /EventBuilderVisible/i.test(String(customFields)) && /"1"|:1/.test(String(customFields));
    }
  }

  function normaliseStockType(raw, source) {
    var sourceText = normaliseMatchText(source);
    if (/sales|consumable/.test(sourceText)) return "sales";
    if (getFirstField(raw, ["SALES_ID", "sales_id", "salesId"])) return "sales";
    return "hire";
  }

  function normaliseMatchText(value) {
    return $.trim(String(value || "").toLowerCase().replace(/[^a-z0-9.]+/g, " "));
  }

  function isHalfMetreIncrement(value) {
    var doubled = Number(value || 0) * 2;
    return Math.abs(doubled - Math.round(doubled)) < 0.001;
  }

  function dimensionsMatch(a, b, width, depth) {
    return (Math.abs(a - width) < 0.001 && Math.abs(b - depth) < 0.001) ||
      (Math.abs(a - depth) < 0.001 && Math.abs(b - width) < 0.001);
  }

  function describeDeckKey(key) {
    var match = String(key || "").match(/deck-(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)/);
    if (match) return match[1] + " x " + match[2] + "m deck";
    return String(key || "deck");
  }

  function uniqueStrings(items) {
    var out = [];
    var seen = {};
    for (var i = 0; i < (items || []).length; i++) {
      var value = $.trim(String(items[i] || ""));
      if (!value || seen[value]) continue;
      seen[value] = true;
      out.push(value);
    }
    return out;
  }

  function uniqueNumbers(items) {
    var out = [];
    var seen = {};
    for (var i = 0; i < (items || []).length; i++) {
      var value = roundQuantity(items[i]);
      if (!isFinite(value) || value <= 0 || seen[String(value)]) continue;
      seen[String(value)] = true;
      out.push(value);
    }
    return out;
  }

  function normaliseIdList(ids) {
    if (ids == null) return [];
    var raw = Array.isArray(ids) ? ids : String(ids).split(",");
    var out = [];
    var seen = {};
    for (var i = 0; i < raw.length; i++) {
      var id = $.trim(String(raw[i] || "").replace(/^[a-z]+/i, ""));
      if (!id || seen[id]) continue;
      seen[id] = true;
      out.push(id);
    }
    return out;
  }

  function getTreeNodePrefixForKind(kind) {
    var prefixes = getHireHopModuleSection("kindPrefixes") || { 0: "a", 1: "b", 2: "c", 3: "d", 4: "e", 5: "f", 6: "g" };
    return prefixes[String(Number(kind))] || "";
  }

  function extendObject(base) {
    var out = {};
    for (var i = 0; i < arguments.length; i++) {
      var object = arguments[i];
      if (!object || typeof object !== "object") continue;
      for (var key in object) {
        if (Object.prototype.hasOwnProperty.call(object, key) && object[key] != null && object[key] !== "") {
          out[key] = object[key];
        }
      }
    }
    return out;
  }

  function getTimezone() {
    try {
      if (window.Intl && Intl.DateTimeFormat) {
        var options = Intl.DateTimeFormat().resolvedOptions();
        if (options && options.timeZone) return options.timeZone;
      }
    } catch (e) {}
    return "";
  }

  function addCount(counts, key, amount) {
    amount = Number(amount || 0);
    if (amount <= 0) return;
    counts[key] = Number(counts[key] || 0) + amount;
  }

  function readNumberField($scope, field, fallback) {
    var value = Number($scope.find('[data-wsd-field="' + field + '"]').val());
    return isFinite(value) ? value : fallback;
  }

  function roundToIncrement(value, increment) {
    value = Number(value || 0);
    increment = Number(increment || 1);
    return Math.round(value / increment) * increment;
  }

  function roundTenths(value) {
    return Math.round(Number(value || 0) * 10) / 10;
  }

  function roundQuantity(value) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  function roundUpWholeMetre(value) {
    value = Number(value || 0);
    return Math.max(1, Math.ceil(value - 0.0001));
  }

  function feetToMetres(value) {
    return roundQuantity(Number(value || 0) * 0.3048);
  }

  function metresToFeet(value) {
    return roundQuantity(Number(value || 0) / 0.3048);
  }

  function centimetresToFeet(value) {
    return metresToFeet(Number(value || 0) / 100);
  }

  function roundUpLinearMetresFromFeet(value) {
    return roundUpWholeMetre(Number(value || 0) * 0.3048);
  }

  function clamp(value, min, max) {
    value = Number(value || 0);
    return Math.max(min, Math.min(max, value));
  }

  function closestNumber(value, values, fallback) {
    var best = fallback;
    var bestDiff = Infinity;
    for (var i = 0; i < values.length; i++) {
      var diff = Math.abs(Number(values[i]) - Number(value));
      if (diff < bestDiff) {
        best = values[i];
        bestDiff = diff;
      }
    }
    return best;
  }

  function formatDimension(value) {
    var n = roundQuantity(value);
    return String(n).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  }

  function formatImperialHeight(value) {
    var inches = Math.round(Number(value || 0));
    var feet = Math.floor(inches / 12);
    var remainder = inches % 12;
    if (feet > 0 && remainder > 0) return String(feet) + "ft" + String(remainder);
    if (feet > 0) return String(feet) + "ft";
    return String(inches) + "in";
  }

  function getPreviewFaceHeight(height) {
    return Math.max(24, Math.min(90, Math.round(Number(height || 0) / 20)));
  }

  function colourToCss(value, fallback) {
    var text = $.trim(String(value || "")).toLowerCase();
    var named = {
      black: "#111827",
      grey: "#6b7280",
      gray: "#6b7280",
      silver: "#9ca3af",
      white: "#f8fafc",
      blue: "#2563eb",
      red: "#b42318",
      green: "#15803d",
      purple: "#7c3aed",
      pink: "#db2777",
      yellow: "#eab308",
      orange: "#ea580c"
    };
    if (named[text]) return named[text];
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(text)) return text;
    return fallback || "#111827";
  }

  async function throttleWrite() {
    var now = Date.now();
    var wait = Math.max(0, CFG.writeThrottleMs - (now - state.lastWriteAt));
    if (wait > 0) await delay(wait);
    state.lastWriteAt = Date.now();
  }

  async function waitForRateLimit() {
    setStatus("HireHop rate limit reached. Waiting, then retrying...", "warning");
    await delay(CFG.rateLimitRetryMs);
  }

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function tryParseJson(text) {
    try { return JSON.parse(text); } catch (e) { return null; }
  }

  function getSavedItemId(json) {
    if (!json || !json.items || !json.items.length) return "";
    var item = json.items[0] || {};
    return String(item.ID || item.id || "");
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
    if ($.trim(String(value)) === "3") return "HireHop returned error 3: missing parameters.";
    return String(value);
  }

  function isBareErrorCode(json, text) {
    var value = json != null ? json : $.trim(String(text || ""));
    return $.trim(String(value)) === "3" || isRateLimitCode(value);
  }

  function summariseImportRow(row) {
    if (!row) return "(none)";
    if (row.STOCK_ID) return "STOCK_ID " + row.STOCK_ID + ", QTY " + row.QTY;
    if (row.SALES_ID) return "SALES_ID " + row.SALES_ID + ", QTY " + row.QTY;
    return "TITLE " + row.TITLE + ", QTY " + row.QTY;
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
      if (!item || item.ID == null) continue;
      if (!first) first = item.ID;
      if (type && String(item.TYPE || item.type || "") === String(type)) return item.ID;
    }
    return first || 0;
  }

  function getExternalHireHopModule() {
    var module = window[HIREHOP_MODULE_GLOBAL];
    return module && typeof module === "object" ? module : null;
  }

  function getHireHopModuleSection(name) {
    var module = getExternalHireHopModule();
    var section = module && module[name];
    return section && typeof section === "object" ? section : null;
  }

  function getHireHopEndpoint(key, fallback) {
    var endpoints = getHireHopModuleSection("endpoints");
    return endpoints && endpoints[key] ? endpoints[key] : fallback;
  }

  function getHireHopSelector(key, fallback) {
    var selectors = getHireHopModuleSection("selectors");
    return selectors && selectors[key] ? selectors[key] : fallback;
  }

  function getHireHopNumberValue(sectionName, key, fallback) {
    var section = getHireHopModuleSection(sectionName);
    var value = section && section[key];
    var number = Number(value);
    return isFinite(number) && number > 0 ? number : fallback;
  }

  function getErrorMessage(err, fallback) {
    return err && err.message ? err.message : fallback;
  }

  function normaliseWhitespace(value) {
    return $.trim(String(value || "").replace(/\s+/g, " "));
  }

  function formatLocalDateTime(date) {
    function pad(n) { return n < 10 ? "0" + n : String(n); }
    return date.getFullYear() + "-" +
      pad(date.getMonth() + 1) + "-" +
      pad(date.getDate()) + " " +
      pad(date.getHours()) + ":" +
      pad(date.getMinutes()) + ":" +
      pad(date.getSeconds());
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escAttr(value) {
    return esc(value);
  }

  function warn(message, err) {
    if (window.console && console.warn) console.warn("[WiseStageDesigner] " + message, err || "");
  }

  window.__wiseStageDesigner = {
    open: openDesigner,
    calculate: calculateStageKit,
    reloadStock: function () {
      return loadLiveStagingStock({ force: true });
    },
    getStockCatalog: function () {
      return stockState.catalog;
    },
    describe: function () {
      return {
        version: CFG.version,
        role: "Simple metric/imperial staging spec designer that caches live HireHop stock and generates supplying-list rows from width, depth, height, carpet, fascia sides, fascia colour, and stair units.",
        assumptions: {
          deckIncrementM: CFG.deckIncrementM,
          imperialDeckIncrementFt: CFG.imperialDeckIncrementFt,
          legRule: CFG.legRule,
          fasciaSidesDefault: CFG.fasciaSidesDefault,
          carpetOverhangM: CFG.carpetOverhangM,
          stairCarpetLinearM: CFG.stairCarpetLinearM,
          feltOverlapAllowanceM: CFG.feltOverlapAllowanceM,
          stairFeltLinearM: CFG.stairFeltLinearM,
          imperialCarpetOverhangFt: CFG.imperialCarpetOverhangFt,
          imperialStairCarpetLinearFt: CFG.imperialStairCarpetLinearFt,
          imperialFeltOverlapAllowanceFt: CFG.imperialFeltOverlapAllowanceFt,
          imperialStairFeltLinearFt: CFG.imperialStairFeltLinearFt,
          consumables: "Metric carpet and fascia/felt remain custom rows. Imperial carpet and felt use live sales stock rows when matching HireHop consumables are found; imperial Facia and hardware use hire stock."
        },
        liveStock: {
          endpoints: {
            availabilityList: CFG.availabilityList,
            searchList: CFG.searchList,
            hireStockList: CFG.hireStockList,
            salesStockList: CFG.salesStockList,
            itemsImport: CFG.itemsImport
          },
          categories: getStockCategoryNames(),
          categoryIds: getStockCategoryIds(),
          salesConsumablesCategory: CFG.salesConsumablesCategoryName,
          salesConsumablesCategoryId: CFG.salesConsumablesCategoryId,
          searchTerms: CFG.stockSearchTerms.slice(),
          loadedItems: stockState.catalog ? stockState.catalog.items.length : 0,
          error: stockState.error || "",
          diagnostics: stockState.diagnostics.slice()
        },
        stockCatalog: stockState.catalog
      };
    }
  };
})();
