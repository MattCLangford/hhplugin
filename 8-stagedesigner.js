(function () {
  "use strict";

  var $ = window.jQuery;
  if (!$) return;

  var HIREHOP_MODULE_GLOBAL = "WiseProposalSectionBuilderHireHop";

  var CFG = {
    version: "2026-06-12.11",
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
    stagingCategoryName: "Staging",
    stagingCategoryId: "1043",
    stockSearchTerms: ["Deck Panel", "LiteDeck", "Scaff Leg", "Stairs/Tread", "Step Unit", "Staging"],
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
              controlNumberHtml("width", "Width", spec.width, 0.5, 40, 0.5, "m") +
              controlNumberHtml("depth", "Depth", spec.depth, 0.5, 30, 0.5, "m") +
              controlSelectHtml("height", "Height", String(spec.height), getLegHeightOptions(), "mm") +
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
      state.currentSpec = readSpecFromModal();
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
    var kit = calculateStageKit(spec, stockState.catalog);

    var $overlay = $("#" + CFG.overlayId);
    $overlay.find("[data-wsd-preview]").html(stagePreviewHtml(spec, kit));
    $overlay.find("[data-wsd-kit]").html(kitSummaryHtml(kit));
    $overlay.find('[data-wsd-swatch="carpetColour"]').css("background", colourToCss(spec.carpetColour, "#111827"));
    $overlay.find('[data-wsd-swatch="fasciaColour"]').css("background", colourToCss(spec.fasciaColour, "#111827"));
  }

  function readSpecFromModal() {
    var $overlay = $("#" + CFG.overlayId);
    return {
      width: readNumberField($overlay, "width", 4),
      depth: readNumberField($overlay, "depth", 3),
      height: readNumberField($overlay, "height", 600),
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
      kind: "stock",
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

      for (var i = 0; i < CFG.stockSearchTerms.length; i++) {
        var term = CFG.stockSearchTerms[i];
        var termCandidates = await fetchAvailabilityListCandidates(term);
        if (!termCandidates.length) termCandidates = await fetchSearchListCandidates(term);
        appendStockCandidates(candidates, termCandidates);
      }

      if (!candidates.length) appendStockCandidates(candidates, await fetchHireStockListCandidates());

      var catalog = buildLiveStockCatalog(candidates);
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

  function buildAvailabilityListUrls(term) {
    var base = CFG.availabilityList || "/php_functions/availability_list.php";
    var catId = Number(CFG.stagingCategoryId) || CFG.stagingCategoryId;
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
    var cats = [catId];

    return [
      endpointRequest(base, extendObject(common, { head: CFG.stagingCategoryId, cats: "" }), "availability head " + term),
      endpointRequest(base, extendObject(common, { cats: JSON.stringify(cats) }), "availability cats-json " + term),
      endpointRequest(base, extendObject(common, { cats: CFG.stagingCategoryId }), "availability cats-id " + term),
      endpointRequest(base, extendObject(common, { cat: CFG.stagingCategoryId }), "availability cat " + term),
      endpointRequest(base, extendObject(common, { headings_sel: CFG.stagingCategoryId }), "availability heading " + term)
    ];
  }

  function buildSearchListUrls(term) {
    var base = CFG.searchList || "/php_functions/search_list.php";
    return [
      endpointRequest(base, { term: term, stock: 1, category: CFG.stagingCategoryName }, "search term " + term),
      endpointRequest(base, { q: term, stock: 1, category_id: CFG.stagingCategoryId }, "search q " + term),
      endpointRequest(base, { search: term, stock: 1, cat: CFG.stagingCategoryId }, "search generic " + term)
    ];
  }

  function buildHireStockListUrls() {
    var base = CFG.hireStockList || "/reports/hire_stock_list.php";
    return [
      endpointRequest(base, { cat: CFG.stagingCategoryId, depot: 0, local: formatLocalDateTime(new Date()), tz: getTimezone() }, "hire-stock-list cat"),
      endpointRequest(base, { cat: 0, depot: 0, local: formatLocalDateTime(new Date()), tz: getTimezone() }, "hire-stock-list all")
    ];
  }

  function endpointRequest(base, params, label) {
    return {
      label: label || base,
      url: base + (base.indexOf("?") === -1 ? "?" : "&") + $.param(params || {})
    };
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
    if (!id && raw.__rowText) id = cleanStockId(extractStockIdFromText(raw.__rowText));
    if (!name && raw.__rowText) name = extractStockNameFromText(raw.__rowText);
    if (!id || !name) return null;

    return {
      id: String(id),
      name: name,
      category: readStockCategoryName(raw),
      categoryId: readStockCategoryId(raw),
      breadcrumbs: readStockBreadcrumbs(raw),
      status: cleanStockName(getFirstField(raw, ["STATUS", "status"])),
      price: parseStockPrice(raw),
      priceType: parseStockPriceType(raw),
      eventBuilderVisible: readEventBuilderVisible(raw),
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
    if (item.status && !/active/i.test(item.status)) return false;

    var categoryText = normaliseMatchText([item.category, item.breadcrumbs].join(" "));
    var hasCategory = !!(item.category || item.breadcrumbs || item.categoryId);
    var categoryMatches = categoryText.indexOf(normaliseMatchText(CFG.stagingCategoryName)) !== -1 || String(item.categoryId || "") === String(CFG.stagingCategoryId);
    if (hasCategory && !categoryMatches) return false;

    return looksLikeUsableStageStockName(item.name);
  }

  function looksLikeUsableStageStockName(name) {
    var text = normaliseMatchText(name);
    return /deck|litedeck|scaff leg|stairs|tread|step unit/.test(text);
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
    }

    addCatalogWarnings(catalog);
    return catalog;
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

  function addCatalogWarnings(catalog) {
    var requiredDecks = ["deck-2x1", "deck-2x0.5", "deck-1x1", "deck-1x0.5", "deck-0.5x0.5"];
    for (var i = 0; i < requiredDecks.length; i++) {
      if (!catalog.decksByKey[requiredDecks[i]]) catalog.warnings.push("Missing " + describeDeckKey(requiredDecks[i]) + " in live staging stock.");
    }
    if (!Object.keys(catalog.legs).length) catalog.warnings.push("Missing live scaff leg stock.");
    if (!catalog.stairs.length) catalog.warnings.push("Missing live stair/tread stock.");
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
    var match = raw.match(/stage\s+-\s*(\d+(?:\.\d+)?)m?\s*x\s*(\d+(?:\.\d+)?)m?\s*@\s*(\d{3,4})mm\s+(.+?)\s*\/\s*(.+?)\s*-\s*(\d+)\s*treads?/i);
    if (match) {
      return {
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
    var heights = getLegHeights(catalog);
    var height = Number(spec.height || 600);
    if (heights.indexOf(height) === -1) height = closestNumber(height, heights, 600);

    return {
      width: clamp(roundToIncrement(spec.width, CFG.deckIncrementM), 0.5, 40),
      depth: clamp(roundToIncrement(spec.depth, CFG.deckIncrementM), 0.5, 30),
      height: height,
      carpetColour: $.trim(String(spec.carpetColour || "Black")) || "Black",
      fasciaColour: $.trim(String(spec.fasciaColour || "Black")) || "Black",
      fasciaSides: Number(spec.fasciaSides) >= 4 ? 4 : 3,
      treads: clamp(Math.round(Number(spec.treads || 0)), 0, 20)
    };
  }

  function getStageFolderTitle(spec) {
    return "Stage - " + formatDimension(spec.width) + "m x " + formatDimension(spec.depth) + "m @ " +
      String(spec.height) + "mm " + spec.carpetColour + " / " + spec.fasciaColour + " - " +
      String(spec.treads) + " " + (Number(spec.treads) === 1 ? "tread" : "treads");
  }

  function getStageSpecLabel(spec) {
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
    var cols = Math.max(1, Math.round(spec.width / CFG.deckIncrementM));
    var rows = Math.max(1, Math.round(spec.depth / CFG.deckIncrementM));
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
        '<span>' + esc(formatDimension(kit.carpetLinearM)) + ' m carpet</span>' +
        '<span>' + esc(String(spec.fasciaSides)) + ' sides / ' + esc(formatDimension(kit.feltLinearM)) + ' m felt</span>' +
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
          (suffix ? '<em>' + esc(suffix) + '</em>' : '') +
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
    html += '</select>' + (suffix ? '<em>' + esc(suffix) + '</em>' : '') + '</div></label>';
    return html;
  }

  function getLegHeightOptions(catalog) {
    var heights = getLegHeights(catalog);
    var out = [];
    for (var i = 0; i < heights.length; i++) {
      out.push({ value: String(heights[i]), label: String(heights[i]) });
    }
    return out;
  }

  function getFasciaSideOptions() {
    return [
      { value: "3", label: "3 sides" },
      { value: "4", label: "4 sides" }
    ];
  }

  function getLegHeights(catalog) {
    catalog = normaliseCatalog(catalog);
    var live = Object.keys(catalog.legs || {}).map(function (value) { return Number(value); }).filter(function (value) { return isFinite(value) && value > 0; }).sort(function (a, b) { return a - b; });
    return live.length ? live : [200, 270, 300, 400, 600, 800, 1000, 1200, 1600];
  }

  function syncHeightOptions(catalog) {
    var $select = $("#" + CFG.overlayId).find('[data-wsd-field="height"]').first();
    if (!$select.length) return;

    var current = state.currentSpec && state.currentSpec.height ? String(state.currentSpec.height) : String($select.val() || "");
    var options = getLegHeightOptions(catalog);
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
      warnings: []
    };
  }

  function normaliseCatalog(catalog) {
    if (!catalog || typeof catalog !== "object") return emptyCatalog();
    catalog.items = Array.isArray(catalog.items) ? catalog.items : [];
    catalog.decksByKey = catalog.decksByKey || {};
    catalog.legs = catalog.legs || {};
    catalog.stairs = Array.isArray(catalog.stairs) ? catalog.stairs : [];
    catalog.warnings = Array.isArray(catalog.warnings) ? catalog.warnings : [];
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
      width: Number(item.width || 0),
      depth: Number(item.depth || 0),
      height: Number(item.height || 0),
      minHeight: Number(item.minHeight || 0),
      maxHeight: Number(item.maxHeight || 0),
      price: Number(item.price || 0),
      priceType: Number(item.priceType || 0),
      categoryId: String(item.categoryId || ""),
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
        role: "Simple staging spec designer that caches live Staging-category HireHop stock and generates supplying-list rows from width, depth, height, carpet, fascia sides, fascia colour, and stair units.",
        assumptions: {
          deckIncrementM: CFG.deckIncrementM,
          legRule: CFG.legRule,
          fasciaSidesDefault: CFG.fasciaSidesDefault,
          carpetOverhangM: CFG.carpetOverhangM,
          stairCarpetLinearM: CFG.stairCarpetLinearM,
          feltOverlapAllowanceM: CFG.feltOverlapAllowanceM,
          stairFeltLinearM: CFG.stairFeltLinearM,
          consumables: "Carpet and fascia/felt are custom placeholder rows until stocked consumable IDs are available. Hire components are saved as listed stock rows using list_id."
        },
        liveStock: {
          endpoints: {
            availabilityList: CFG.availabilityList,
            searchList: CFG.searchList,
            hireStockList: CFG.hireStockList,
            itemsImport: CFG.itemsImport
          },
          category: CFG.stagingCategoryName,
          categoryId: CFG.stagingCategoryId,
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
