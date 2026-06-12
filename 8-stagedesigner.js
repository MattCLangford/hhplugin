(function () {
  "use strict";

  var $ = window.jQuery;
  if (!$) return;

  var HIREHOP_MODULE_GLOBAL = "WiseProposalSectionBuilderHireHop";

  var CFG = {
    version: "2026-06-12.2",
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
    fasciaMode: "front+sides",
    legRule: "per-deck-corners"
  };

  var STOCK = {
    decks: [
      stockItem("deck-2x1", "5723", "2 x 1m LiteDeck Panel", 2, 1, 15, 108),
      stockItem("deck-2x0.5", "5722", "2 x 0.5m LiteDeck (Prolyte/GT Tour)", 2, 0.5, 9, 108),
      stockItem("deck-1x1", "5717", "1 x 1m LiteDeck Panel", 1, 1, 9, 108),
      stockItem("deck-1x0.5", "5716", "1 x 0.5m Deck Panel (Prolyte/GT Tour)", 1, 0.5, 6, 108),
      stockItem("deck-0.5x0.5", "5714", "0.5 x 0.5m Deck Panel (GT Tour)", 0.5, 0.5, 3, 108)
    ],
    legs: {
      200: stockItem("leg-200", "5728", "200mm Scaff Leg", 0, 0, 0.12, 108),
      270: stockItem("leg-270", "5729", "270mm Scaff Leg", 0, 0, 0.16, 108),
      300: stockItem("leg-300", "5730", "300mm Scaff Leg", 0, 0, 0.18, 108),
      400: stockItem("leg-400", "5731", "400mm Scaff Leg", 0, 0, 0.24, 108),
      600: stockItem("leg-600", "5732", "600mm Scaff Leg", 0, 0, 0.36, 108),
      800: stockItem("leg-800", "5733", "800mm Scaff Leg", 0, 0, 0.48, 108),
      1000: stockItem("leg-1000", "5725", "1000mm Scaff Leg", 0, 0, 0.6, 108),
      1200: stockItem("leg-1200", "5726", "1200mm Scaff Leg", 0, 0, 0.72, 108),
      1600: stockItem("leg-1600", "5727", "1600mm Scaff Leg", 0, 0, 0.96, 108)
    },
    adapter: stockItem("leg-adapter", "5751", "4 in 1 Leg Adapter (Leg Top)", 0, 0, 0.6, 108),
    stairsLow: stockItem("stairs-low", "5734", "Black Wooden Step Unit 400mm", 0, 0, 6, 108),
    stairsMid: stockItem("stairs-mid", "5736", "Litespace 600 - 1000mm Stairs/Tread", 0, 0, 27, 108),
    stairsHigh: stockItem("stairs-high", "5735", "Litespace 1000 - 1500mm Stairs/Tread", 0, 0, 30, 108)
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

    var kit = calculateStageKit(state.currentSpec);
    $("body").append(buildModalHtml(state.currentSpec, kit, state.target));
    bindModalEvents();
    updateDesigner();
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
    var spec = normaliseSpec(state.currentSpec || readSpecFromModal());
    state.currentSpec = spec;
    var kit = calculateStageKit(spec);

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
    var spec = normaliseSpec(state.currentSpec || readSpecFromModal());
    var kit = calculateStageKit(spec);

    state.saving = true;
    setBusy(true);
    setStatus("Saving stage kit...", "info");

    try {
      var parentId = target && target.parentId ? String(target.parentId) : "0";

      var savedHeading = await saveStageHeading(jobId, parentId, "", spec, kit);
      var stageFolderId = String(savedHeading.id || "");
      if (!stageFolderId) throw new Error("HireHop did not return the stage folder ID.");

      for (var i = 0; i < kit.lines.length; i++) {
        setStatus("Saving " + kit.lines[i].name + "...", "info");
        await saveStageLine(jobId, stageFolderId, kit.lines[i], spec);
      }

      setStatus("Stage kit saved. Refreshing the supplying list...", "success");
      refreshSupplyingList();
      setTimeout(refreshSupplyingList, 900);
      setTimeout(closeDesigner, 850);
    } catch (err) {
      warn("Stage kit save failed", err);
      setStatus(getErrorMessage(err, "Could not save the stage kit."), "error");
    } finally {
      state.saving = false;
      setBusy(false);
    }
  }

  function calculateStageKit(input) {
    var spec = normaliseSpec(input);
    var deckCounts = calculateDeckCounts(spec.width, spec.depth);
    var deckCount = 0;
    var lines = [];

    addDeckLine(lines, deckCounts, "deck-2x1");
    addDeckLine(lines, deckCounts, "deck-2x0.5");
    addDeckLine(lines, deckCounts, "deck-1x1");
    addDeckLine(lines, deckCounts, "deck-1x0.5");
    addDeckLine(lines, deckCounts, "deck-0.5x0.5");

    for (var i = 0; i < lines.length; i++) {
      if (lines[i].group === "Decks") deckCount += Number(lines[i].qty || 0);
    }

    var legCount = deckCount * 4;
    var legItem = STOCK.legs[spec.height] || STOCK.legs[600];
    addStockLine(lines, legItem, legCount, "Legs", "Stage height: " + spec.height + "mm. Rule: 4 legs per deck.");
    addStockLine(lines, STOCK.adapter, legCount, "Legs", "One leg top adapter per leg.");

    if (spec.treads > 0) {
      addStockLine(lines, getStairItemForHeight(spec.height), spec.treads, "Access", "User-specified stair units/treads.");
    }

    var consumables = calculateConsumables(spec);
    addCarpetConsumableLines(lines, spec, consumables);
    addCustomLine(lines, "Fascia felt - " + spec.fasciaColour + " (1.8m roll linear m)", consumables.feltLinearM, "Consumable placeholder. Includes fascia run, overlap allowance, and tread felt allowance.", "Consumables");

    return {
      spec: spec,
      lines: lines,
      deckCount: deckCount,
      legCount: legCount,
      carpetArea: consumables.topArea,
      carpetLinearM: consumables.carpetLinearM,
      fasciaRun: consumables.baseFasciaRun,
      feltLinearM: consumables.feltLinearM,
      consumables: consumables
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

  function addDeckLine(lines, counts, key) {
    var qty = Number(counts[key] || 0);
    if (qty <= 0) return;
    var item = findDeckItem(key);
    addStockLine(lines, item, qty, "Decks", item.width + "m x " + item.depth + "m deck coverage.");
  }

  function addStockLine(lines, item, qty, group, memo) {
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
      memo: composeLineMemo(memo || "", item)
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
      priceType: 0,
      memo: composeLineMemo(memo || "", null)
    });
  }

  function getStairItemForHeight(height) {
    height = Number(height || 0);
    if (height >= 1000) return STOCK.stairsHigh;
    if (height >= 600) return STOCK.stairsMid;
    return STOCK.stairsLow;
  }

  function calculateFasciaRun(spec) {
    if (CFG.fasciaMode === "front") return roundQuantity(spec.width);
    if (CFG.fasciaMode === "all") return roundQuantity((spec.width * 2) + (spec.depth * 2));
    return roundQuantity(spec.width + (spec.depth * 2));
  }

  function calculateConsumables(spec) {
    var overhang = Number(CFG.carpetOverhangM || 0);
    var coveredWidth = roundQuantity(spec.width + (overhang * 2));
    var coveredDepth = roundQuantity(spec.depth + (overhang * 2));
    var topArea = roundQuantity(coveredWidth * coveredDepth);
    var carpetRolls = calculateCarpetRolls(coveredDepth, coveredWidth);
    var stairCarpetLinearM = roundQuantity(spec.treads * CFG.stairCarpetLinearM);
    var baseFasciaRun = calculateFasciaRun(spec);
    var feltLinearM = roundQuantity(baseFasciaRun + CFG.feltOverlapAllowanceM + (spec.treads * CFG.stairFeltLinearM));

    return {
      overhang: overhang,
      coveredWidth: coveredWidth,
      coveredDepth: coveredDepth,
      topArea: topArea,
      carpetRolls: carpetRolls,
      stairCarpetLinearM: stairCarpetLinearM,
      carpetLinearM: roundQuantity(sumCarpetRollLinearM(carpetRolls) + stairCarpetLinearM),
      baseFasciaRun: baseFasciaRun,
      feltLinearM: feltLinearM
    };
  }

  function calculateCarpetRolls(coveredDepth, coveredWidth) {
    var remaining = roundQuantity(coveredDepth);
    var rolls = [];

    while (remaining > 0.01) {
      if (remaining > 4) {
        addCarpetRoll(rolls, 4, coveredWidth);
        remaining = roundQuantity(remaining - 4);
      } else if (remaining > 2) {
        addCarpetRoll(rolls, 4, coveredWidth);
        remaining = 0;
      } else {
        addCarpetRoll(rolls, 2, coveredWidth);
        remaining = 0;
      }
    }

    return rolls;
  }

  function addCarpetRoll(rolls, width, linearM) {
    for (var i = 0; i < rolls.length; i++) {
      if (Number(rolls[i].width || 0) === Number(width)) {
        rolls[i].linearM = roundQuantity(Number(rolls[i].linearM || 0) + Number(linearM || 0));
        return;
      }
    }
    rolls.push({ width: width, linearM: roundQuantity(linearM) });
  }

  function sumCarpetRollLinearM(rolls) {
    var total = 0;
    for (var i = 0; i < (rolls || []).length; i++) total += Number(rolls[i].linearM || 0);
    return roundQuantity(total);
  }

  function addCarpetConsumableLines(lines, spec, consumables) {
    for (var i = 0; i < consumables.carpetRolls.length; i++) {
      var roll = consumables.carpetRolls[i];
      addCustomLine(
        lines,
        "Carpet - " + spec.carpetColour + " (" + formatDimension(roll.width) + "m roll linear m)",
        roll.linearM,
        "Consumable placeholder. Stage top cover includes " + Math.round(consumables.overhang * 1000) + "mm overhang per edge.",
        "Consumables"
      );
    }

    if (consumables.stairCarpetLinearM > 0) {
      addCustomLine(
        lines,
        "Carpet - " + spec.carpetColour + " (tread allowance linear m)",
        consumables.stairCarpetLinearM,
        "Consumable placeholder. Allowance for covering stair/tread units.",
        "Consumables"
      );
    }
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
      desc: "Generated stage kit",
      memo: composeStageMetaText("", spec, kit),
      set_child_dates: "0",
      job: String(jobId || ""),
      no_availability: "0",
      ignore: "0"
    }, id);
  }

  async function saveStageLine(jobId, parentId, line, spec) {
    var unitPrice = line.kind === "stock" ? Number(line.price || 0) : 0;
    var totalPrice = line.kind === "stock" ? roundQuantity(unitPrice * Number(line.qty || 0)) : 0;
    var payload = {
      parent: String(parentId || "0"),
      flag: "0",
      priority_confirm: "0",
      custom_fields: "",
      kind: "3",
      local: formatLocalDateTime(new Date()),
      id: "0",
      qty: String(line.qty || 1),
      name: String(line.name || ""),
      list_id: String(line.listId || "0"),
      cust_add: line.kind === "custom" ? "Generated from stage spec: " + getStageSpecLabel(spec) : "",
      memo: String(line.memo || ""),
      price_type: String(line.priceType || 0),
      weight: "0",
      vat_rate: String(getDefaultVatRate()),
      value: "0",
      acc_nominal: String(getDefaultNominalId(1)),
      acc_nominal_po: String(getDefaultNominalId(2)),
      cost_price: "0",
      no_scan: "0",
      country_origin: "",
      hs_code: "",
      category_id: "0",
      no_shortfall: "0",
      unit_price: String(unitPrice),
      price: String(totalPrice),
      job: String(jobId || ""),
      no_availability: "0",
      ignore: "0"
    };

    return postItemsSave(payload, "");
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
        spec: parsed && parsed.spec ? parsed.spec : null
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
    return /^stage\s+-\s+/i.test(name) && technical.indexOf(CFG.marker) !== -1;
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
      treads: 1
    };
  }

  function normaliseSpec(spec) {
    spec = spec || {};
    var heights = getLegHeights();
    var height = Number(spec.height || 600);
    if (heights.indexOf(height) === -1) height = closestNumber(height, heights, 600);

    return {
      width: clamp(roundToIncrement(spec.width, CFG.deckIncrementM), 0.5, 40),
      depth: clamp(roundToIncrement(spec.depth, CFG.deckIncrementM), 0.5, 30),
      height: height,
      carpetColour: $.trim(String(spec.carpetColour || "Black")) || "Black",
      fasciaColour: $.trim(String(spec.fasciaColour || "Black")) || "Black",
      treads: clamp(Math.round(Number(spec.treads || 0)), 0, 20)
    };
  }

  function getStageFolderTitle(spec) {
    return "Stage - " + formatDimension(spec.width) + "m x " + formatDimension(spec.depth) + "m x " + String(spec.height) + "mm";
  }

  function getStageSpecLabel(spec) {
    return formatDimension(spec.width) + "m x " + formatDimension(spec.depth) + "m x " + String(spec.height) + "mm";
  }

  function composeStageMetaText(baseText, spec, kit) {
    var meta = {
      editor: CFG.marker,
      version: CFG.version,
      spec: normaliseSpec(spec),
      calculated: {
        deckCount: kit.deckCount,
        legCount: kit.legCount,
        carpetArea: kit.carpetArea,
        carpetLinearM: kit.carpetLinearM,
        fasciaRun: kit.fasciaRun,
        feltLinearM: kit.feltLinearM,
        legRule: CFG.legRule,
        fasciaMode: CFG.fasciaMode
      }
    };

    var parts = [];
    var base = $.trim(String(baseText || ""));
    if (base) parts.push(base);
    parts.push(CFG.metaStart + JSON.stringify(meta) + CFG.metaEnd);
    return parts.join("\n\n");
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

  function composeLineMemo(memo, stock) {
    var meta = {
      editor: CFG.marker,
      version: CFG.version,
      stockKey: stock && stock.key ? stock.key : "",
      stockId: stock && stock.id ? stock.id : ""
    };
    var parts = [];
    if ($.trim(String(memo || ""))) parts.push($.trim(String(memo || "")));
    parts.push(CFG.metaStart + JSON.stringify(meta) + CFG.metaEnd);
    return parts.join("\n\n");
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
        '<span>' + esc(formatDimension(kit.feltLinearM)) + ' m felt</span>' +
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

  function getLegHeightOptions() {
    var heights = getLegHeights();
    var out = [];
    for (var i = 0; i < heights.length; i++) {
      out.push({ value: String(heights[i]), label: String(heights[i]) });
    }
    return out;
  }

  function getLegHeights() {
    return [200, 270, 300, 400, 600, 800, 1000, 1200, 1600];
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

  function stockItem(key, id, name, width, depth, price, priceType) {
    return {
      key: key,
      id: String(id || ""),
      name: String(name || ""),
      width: Number(width || 0),
      depth: Number(depth || 0),
      price: Number(price || 0),
      priceType: Number(priceType || 0)
    };
  }

  function findDeckItem(key) {
    for (var i = 0; i < STOCK.decks.length; i++) {
      if (STOCK.decks[i].key === key) return STOCK.decks[i];
    }
    return null;
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
    describe: function () {
      return {
        version: CFG.version,
        role: "Simple staging spec designer that generates HireHop supplying-list stock rows from width, depth, height, carpet, fascia, and stair units.",
        assumptions: {
          deckIncrementM: CFG.deckIncrementM,
          legRule: CFG.legRule,
          fasciaMode: CFG.fasciaMode,
          carpetOverhangM: CFG.carpetOverhangM,
          stairCarpetLinearM: CFG.stairCarpetLinearM,
          feltOverlapAllowanceM: CFG.feltOverlapAllowanceM,
          stairFeltLinearM: CFG.stairFeltLinearM,
          consumables: "Carpet and fascia/felt are custom placeholder rows until stocked consumable IDs are available. Hire components are saved as listed stock rows using list_id."
        },
        stock: STOCK
      };
    }
  };
})();
