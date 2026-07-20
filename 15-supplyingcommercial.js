/* ===========================================================================
 * Wise Supplying Commercial Fields
 * ---------------------------------------------------------------------------
 * Proposal Creation depot only.
 *
 * - Adds line-level Revenue and Markup custom-field inputs to HireHop's native
 *   hire/sales item editor without replacing the native save workflow.
 * - Uses HireHop's native line Total as CoS, then shows Markup and Revenue.
 * - Calculates either Revenue from Markup or whole-number Markup from Revenue.
 * - Projects Revenue/Markup from each supplying-line CUSTOM_FIELDS payload.
 * - Keeps legacy Unit Price/Discount/Flag/Total values intact in HireHop.
 * ======================================================================== */
(function () {
  "use strict";

  if (window.__wiseSupplyingCommercialLoaded) return;
  window.__wiseSupplyingCommercialLoaded = true;

  var $ = window.jQuery;
  if (!$) return;

  var CFG = {
    version: "2026-07-20.9",
    styleId: "wise-supplying-commercial-styles",
    panelClass: "wise-line-commercial-editor",
    tree: getHireHopSelector("tree", "#items_tab .jstree"),
    itemsSaveEndpoint: getHireHopEndpoint("itemsSave", "/php_functions/items_save.php"),
    revenueField: "Revenue",
    markupField: "Markup",
    refreshDelayMs: 60,
    recoveryIntervalMs: 1200,
    recoveryChecks: 18,
    pendingSaveLifetimeMs: 10000
  };

  var USER_DEPOT_KEYS = [
    "DEPOT_ID", "depot_id", "DEFAULT_DEPOT_ID", "default_depot_id",
    "BRANCH_ID", "branch_id", "WAREHOUSE_ID", "warehouse_id",
    "DEPOT", "depot", "DEPOT_NAME", "depot_name",
    "DEFAULT_DEPOT", "default_depot", "WAREHOUSE", "warehouse"
  ];
  var KNOWN_PROPOSAL_CREATION_DEPOT_ID = "14";
  var state = {
    timer: null,
    observer: null,
    observedRoot: null,
    recoveryTimer: null,
    recoveryCount: 0,
    cosWatchTimer: null,
    cosWatchDialog: null,
    pendingSave: null,
    activeDialog: null,
    activeItemKey: "",
    lastSelectedNodeId: "",
    projectedRows: 0,
    gridFound: false,
    projectedColumns: []
  };

  boot();

  function boot() {
    installStyles();
    installAjaxSaveBridge();
    installNativeSaveCapture();
    bindEvents();
    scheduleRefresh(0);

    state.recoveryTimer = setInterval(function () {
      state.recoveryCount += 1;
      scheduleRefresh(0);
      if (state.recoveryCount >= CFG.recoveryChecks) {
        clearInterval(state.recoveryTimer);
        state.recoveryTimer = null;
      }
    }, CFG.recoveryIntervalMs);
  }

  function bindEvents() {
    $(window).on("load.wiseSupplyingCommercial focus.wiseSupplyingCommercial", function () {
      scheduleRefresh(CFG.refreshDelayMs);
    });

    $(document)
      .on("ajaxComplete.wiseSupplyingCommercial", function () {
        scheduleRefresh(CFG.refreshDelayMs);
      })
      .on("dialogopen.wiseSupplyingCommercial", ".ui-dialog-content", function () {
        scheduleRefresh(0);
      })
      .on("dialogclose.wiseSupplyingCommercial", ".ui-dialog-content", function () {
        $(this).closest(".ui-dialog,[role='dialog']").find("." + CFG.panelClass).remove();
        stopCosWatcher();
        state.activeDialog = null;
        state.activeItemKey = "";
      })
      .on("select_node.jstree.wiseSupplyingCommercial changed.jstree.wiseSupplyingCommercial", CFG.tree, function (event, data) {
        var node = data && data.node;
        if (node && isInventoryLine(node)) state.lastSelectedNodeId = String(node.id || "");
      })
      .on(
        "ready.jstree.wiseSupplyingCommercial refresh.jstree.wiseSupplyingCommercial " +
        "redraw.jstree.wiseSupplyingCommercial load_node.jstree.wiseSupplyingCommercial " +
        "open_node.jstree.wiseSupplyingCommercial",
        CFG.tree,
        function () { scheduleRefresh(CFG.refreshDelayMs); }
      );
  }

  function scheduleRefresh(delay) {
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(function () {
      state.timer = null;
      refresh();
    }, Math.max(0, Number(delay) || 0));
  }

  function refresh() {
    var root = document.getElementById("items_tab");
    maintainObserver(root);

    if (!root || !isProposalCreationDepot()) {
      removeEnhancements();
      return;
    }

    $(document.body).addClass("wise-supplying-commercial-active");
    projectSupplyingGrid();
    enhanceOpenItemDialog();
  }

  function maintainObserver(root) {
    if (state.observedRoot === root) return;
    if (state.observer) state.observer.disconnect();
    state.observer = null;
    state.observedRoot = root || null;
    if (!root || !window.MutationObserver) return;

    state.observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].type === "childList" || mutations[i].type === "attributes") {
          scheduleRefresh(CFG.refreshDelayMs);
          return;
        }
      }
    });
    state.observer.observe(document.body || root, {
      childList: true,
      attributes: true,
      attributeFilter: ["style", "class", "aria-hidden"],
      subtree: true
    });
  }

  /* --------------------------- Supplying grid --------------------------- */

  function projectSupplyingGrid() {
    var tree = getTree();
    var $nativeHeaderTable = getNativeSupplyingHeaderTable();
    if ($nativeHeaderTable.length) {
      state.gridFound = true;
      projectNativeSupplyingGrid(tree, $nativeHeaderTable);
      return;
    }

    var $wrapper = getGridWrapper(tree);
    state.gridFound = !!$wrapper.length;
    if (!$wrapper.length) return;

    var columns = {
      unit: findGridColumn($wrapper, tree, "unit", ["unit price", "unit cost"]),
      cos: findGridColumn($wrapper, tree, "cos", ["total", "cos"]),
      markup: findGridColumn($wrapper, tree, "markup", ["discount/markup", "discount / markup", "markup"]),
      revenue: findGridColumn($wrapper, tree, "revenue", ["flag", "revenue"])
    };
    applyNativeCommercialColumnFallback($wrapper, tree, columns);
    state.projectedColumns = Object.keys(columns).filter(function (key) {
      return columns[key] && columns[key].$column && columns[key].$column.length;
    });

    renameGridHeader(columns.cos, "CoS");
    renameGridHeader(columns.markup, "Markup");
    renameGridHeader(columns.revenue, "Revenue");
    if (columns.unit.$column && columns.unit.$column.length) {
      columns.unit.$column.addClass("wise-supplying-commercial-hidden-column");
    }
    reorderCommercialColumns($wrapper, columns);

    var nodes = getAllTreeNodes(tree);
    var projected = 0;
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!isInventoryLine(node)) {
        setGridCellValue(columns.markup, node.id, "—");
        setGridCellValue(columns.revenue, node.id, "—");
        continue;
      }
      var commercial = readCommercialFields(node);
      setGridCellValue(columns.markup, node.id, formatMarkup(commercial.markup));
      setGridCellValue(columns.revenue, node.id, formatSterling(commercial.revenue));
      projected += 1;
    }
    state.projectedRows = projected;
  }

  function getNativeSupplyingHeaderTable() {
    return $("#items_tab table.supplying_list_heads").filter(function () {
      var text = normaliseText($(this).text());
      var alreadyMapped = $(this).find("[data-wise-commercial-column='cos']").length > 0;
      return text.indexOf("unit price") !== -1 && (text.indexOf("total") !== -1 || text.indexOf("cos") !== -1 || alreadyMapped);
    }).first();
  }

  function projectNativeSupplyingGrid(tree, $headerTable) {
    var $headerRow = $headerTable.find("tr").first();
    var $headers = $headerRow.children("th,td");
    if (!$headers.length) return;

    rememberNativeCellOrder($headers);
    var columns = {
      unit: findNativeSupplyingHeader($headers, "unit", "UNIT_PRICE", ["unit price", "unit cost"]),
      cos: findNativeSupplyingHeader($headers, "cos", "TOTAL", ["total", "cos"]),
      markup: findNativeSupplyingHeader($headers, "markup", "DISCOUNT", ["discount", "discount/markup", "discount / markup", "markup"]),
      revenue: findNativeSupplyingHeader($headers, "revenue", "FLAG", ["flag", "revenue"])
    };

    var complete = Object.keys(columns).every(function (key) {
      return columns[key] && columns[key].$header && columns[key].$header.length;
    });
    if (!complete) {
      state.projectedColumns = Object.keys(columns).filter(function (key) {
        return columns[key] && columns[key].$header && columns[key].$header.length;
      });
      return;
    }

    var $rowTables = $("#items_tab table.cust_node");
    markNativeSupplyingBodyCells($rowTables, $headers.length, columns);
    renameNativeSupplyingHeader(columns.cos, "CoS");
    renameNativeSupplyingHeader(columns.markup, "Markup");
    renameNativeSupplyingHeader(columns.revenue, "Revenue");
    columns.unit.$header.addClass("wise-supplying-commercial-hidden-column");
    $rowTables.find("[data-wise-commercial-column='unit']").addClass("wise-supplying-commercial-hidden-column");
    reorderNativeSupplyingColumns($headerRow, $rowTables, columns);

    var nodes = getAllTreeNodes(tree);
    var projected = 0;
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!isInventoryLine(node)) {
        setNativeSupplyingCellValue(node, "markup", "—");
        setNativeSupplyingCellValue(node, "revenue", "—");
        continue;
      }
      var commercial = readCommercialFields(node);
      setNativeSupplyingCellValue(node, "markup", formatMarkup(commercial.markup));
      setNativeSupplyingCellValue(node, "revenue", formatSterling(commercial.revenue));
      projected += 1;
    }
    state.projectedRows = projected;
    state.projectedColumns = ["unit", "cos", "markup", "revenue"];
  }

  function findNativeSupplyingHeader($headers, key, classSuffix, labels) {
    var $header = $headers.filter('[data-wise-commercial-column="' + key + '"]').first();
    if (!$header.length) $header = $headers.filter(".column_" + classSuffix).first();
    if (!$header.length) {
      var wanted = labels.map(normaliseText);
      $header = $headers.filter(function () {
        return wanted.indexOf(readNativeSupplyingHeaderLabel($(this))) !== -1;
      }).first();
    }
    if (!$header.length) return { key: key, $header: $() };
    $header.attr("data-wise-commercial-column", key);
    return {
      key: key,
      classSuffix: classSuffix,
      originalIndex: Number($header.attr("data-wise-native-original-index")),
      $header: $header,
      $label: getNativeSupplyingHeaderLabelElement($header)
    };
  }

  function getNativeSupplyingHeaderLabelElement($header) {
    var $label = $header.children("div").first();
    return $label.length ? $label : $header;
  }

  function readNativeSupplyingHeaderLabel($header) {
    return normaliseText(getNativeSupplyingHeaderLabelElement($header).text());
  }

  function renameNativeSupplyingHeader(column, label) {
    if (!column || !column.$label || !column.$label.length) return;
    var $label = column.$label;
    if ($label.attr("data-wise-commercial-original-label") == null) {
      $label.attr("data-wise-commercial-original-label", $.trim($label.text()));
    }
    if ($.trim($label.text()) !== label) $label.text(label);
  }

  function rememberNativeCellOrder($cells) {
    $cells.each(function (index) {
      var $cell = $(this);
      if ($cell.attr("data-wise-native-original-index") == null) {
        $cell.attr("data-wise-native-original-index", String(index));
      }
    });
  }

  function markNativeSupplyingBodyCells($tables, headerCount, columns) {
    $tables.each(function () {
      var $row = $(this).find("tr").first();
      var $cells = $row.children("td,th");
      if (!$cells.length) return;
      rememberNativeCellOrder($cells);
      var offset = Math.max(0, $cells.length - headerCount);

      Object.keys(columns).forEach(function (key) {
        var column = columns[key];
        if (!column || !column.$header || !column.$header.length) return;
        var $cell = findNativeSupplyingBodyCell($cells, key, column.classSuffix, column.originalIndex, offset);
        if ($cell.length) $cell.attr("data-wise-commercial-column", key);
      });
    });
  }

  function findNativeSupplyingBodyCell($cells, key, classSuffix, headerIndex, offset) {
    var $existing = $cells.filter('[data-wise-commercial-column="' + key + '"]').first();
    if ($existing.length) return $existing;
    var suffix = String(classSuffix || "");
    var lower = suffix.toLowerCase();
    var selectors = [
      ".column_" + suffix,
      "." + lower + "_cell",
      "[data-column='" + suffix + "']",
      "[data-field='" + suffix + "']"
    ];
    for (var i = 0; i < selectors.length; i++) {
      var $matched = $cells.filter(selectors[i]).first();
      if ($matched.length) return $matched;
    }
    var bodyIndex = Number(headerIndex) + offset;
    return bodyIndex >= 0 && bodyIndex < $cells.length ? $cells.eq(bodyIndex) : $();
  }

  function reorderNativeSupplyingColumns($headerRow, $tables, columns) {
    var $nameHeader = $headerRow.children("th,td").filter(".name_cell").first();
    if (!$nameHeader.length) $nameHeader = $headerRow.children("th,td").first();
    placeColumnAfter(columns.cos.$header, $nameHeader);
    placeColumnAfter(columns.markup.$header, columns.cos.$header);
    placeColumnAfter(columns.revenue.$header, columns.markup.$header);

    $tables.each(function () {
      var $row = $(this).find("tr").first();
      var $cells = $row.children("td,th");
      var $item = $cells.filter(".name_cell,.item_cell.node_desc").last();
      if (!$item.length) {
        var offset = Math.max(0, $cells.length - $headerRow.children("th,td").length);
        $item = $cells.eq(offset);
      }
      var $cos = $cells.filter("[data-wise-commercial-column='cos']").first();
      var $markup = $cells.filter("[data-wise-commercial-column='markup']").first();
      var $revenue = $cells.filter("[data-wise-commercial-column='revenue']").first();
      placeColumnAfter($cos, $item);
      placeColumnAfter($markup, $cos);
      placeColumnAfter($revenue, $markup);
    });
  }

  function setNativeSupplyingCellValue(node, key, value) {
    if (!node || !node.id) return;
    var element = document.getElementById(String(node.id));
    if (!element) return;
    var $cell = $(element).find("table.cust_node tr").first().children("td,th")
      .filter('[data-wise-commercial-column="' + key + '"]').first();
    if (!$cell.length) return;
    if ($cell.data("wiseCommercialOriginalHtml") == null) {
      $cell.data("wiseCommercialOriginalHtml", $cell.html());
    }
    var next = value || "—";
    var $value = $cell.find(".wise-commercial-projected-value").first();
    if (!$value.length) {
      var $host = $cell.children("div").first();
      if ($host.length) {
        $host.empty();
        $value = $("<span class='wise-commercial-projected-value'></span>").appendTo($host);
      } else {
        $cell.empty();
        $value = $("<span class='wise-commercial-projected-value'></span>").appendTo($cell);
      }
    }
    if ($value.text() !== next) $value.text(next);
    $cell.attr("title", next === "—" ? "No proposal value set" : next);
  }

  function reorderCommercialColumns($wrapper, columns) {
    var $treeColumn = $wrapper.find(".jstree-grid-column-0").first();
    if (!$treeColumn.length) $treeColumn = $wrapper.find(".jstree-grid-column").first();
    placeColumnAfter(columns.cos && columns.cos.$column, $treeColumn);
    placeColumnAfter(columns.markup && columns.markup.$column, columns.cos && columns.cos.$column);
    placeColumnAfter(columns.revenue && columns.revenue.$column, columns.markup && columns.markup.$column);
  }

  function placeColumnAfter($column, $anchor) {
    if (!$column || !$column.length || !$anchor || !$anchor.length || $column.get(0) === $anchor.get(0)) return;
    if ($column.prev().get(0) === $anchor.get(0)) return;
    $column.insertAfter($anchor);
  }

  function findGridColumn($wrapper, tree, key, labels) {
    var $marked = $wrapper.find('.jstree-grid-column[data-wise-commercial-column="' + key + '"]').first();
    if ($marked.length) {
      return { key: key, $column: $marked, $header: getGridColumnHeader($marked) };
    }

    var wanted = labels.map(normaliseText);
    var $header = getGridHeaders($wrapper).filter(function () {
      return wanted.indexOf(readGridHeaderLabel($(this))) !== -1;
    }).first();
    if (!$header.length) {
      var configured = getConfiguredGridColumns(tree);
      for (var i = 0; i < configured.length; i++) {
        if (wanted.indexOf(normaliseText(configured[i] && configured[i].header)) === -1) continue;
        $header = getGridColumnHeader(findGridColumnByIndex($wrapper, i));
        break;
      }
    }
    var $column = $header.closest(".jstree-grid-column");
    if ($column.length) {
      $column.attr("data-wise-commercial-column", key);
      rememberOriginalGridColumn($wrapper, $column, $header);
    }
    return { key: key, $column: $column, $header: $header };
  }

  function applyNativeCommercialColumnFallback($wrapper, tree, columns) {
    var configured = getConfiguredGridColumns(tree);
    var rendered = getGridColumns($wrapper);
    var labels = configured.length
      ? configured.map(function (column) { return normaliseText(column && column.header); })
      : rendered.map(function () { return readGridHeaderLabel(getGridColumnHeader($(this))); }).get();
    var indices = {
      unit: findLabelIndex(labels, ["unit price", "unit cost"]),
      markup: findLabelIndex(labels, ["discount/markup", "discount / markup", "markup"]),
      revenue: findLabelIndex(labels, ["flag", "revenue"]),
      cos: findLabelIndex(labels, ["total", "cos"])
    };

    // HireHop's native supplying grid is Quantity & Item, Unit price,
    // Discount/Markup, Flag, Total. Only use fixed positions after confirming
    // that exact native commercial signature.
    if (indices.unit < 0 || indices.markup < 0 || indices.revenue < 0 || indices.cos < 0) {
      var signature = labels.join("|");
      if (labels.length >= 5 &&
          signature.indexOf("unit price") !== -1 &&
          signature.indexOf("discount") !== -1 &&
          signature.indexOf("flag") !== -1 &&
          signature.indexOf("total") !== -1) {
        indices = { unit: 1, markup: 2, revenue: 3, cos: 4 };
      }
    }

    Object.keys(indices).forEach(function (key) {
      if (columns[key] && columns[key].$column && columns[key].$column.length) return;
      var index = indices[key];
      if (index < 0) return;
      var $column = findGridColumnByIndex($wrapper, index);
      if (!$column.length && rendered.length > index) $column = rendered.eq(index);
      if (!$column.length) return;
      var $header = getGridColumnHeader($column);
      $column.attr("data-wise-commercial-column", key);
      rememberOriginalGridColumn($wrapper, $column, $header);
      columns[key] = { key: key, $column: $column, $header: $header };
    });
  }

  function getConfiguredGridColumns(tree) {
    var candidates = [
      tree && tree.settings && tree.settings.grid && tree.settings.grid.columns,
      tree && tree._gridSettings && tree._gridSettings.columns,
      tree && tree._gridSettings && tree._gridSettings.cols
    ];
    for (var i = 0; i < candidates.length; i++) {
      if (Array.isArray(candidates[i])) return candidates[i];
    }
    return [];
  }

  function getGridColumns($wrapper) {
    return $wrapper.find(".jstree-grid-column").filter(function () {
      return $(this).closest(".jstree-grid-wrapper").get(0) === $wrapper.get(0);
    });
  }

  function getGridHeaders($wrapper) {
    var $headers = $wrapper.find(".jstree-grid-header-cell,.jstree-grid-header").filter(function () {
      return $(this).closest(".jstree-grid-wrapper").get(0) === $wrapper.get(0);
    });
    return $headers.filter(function () {
      return !$(this).parents(".jstree-grid-header-cell,.jstree-grid-header").length;
    });
  }

  function getGridColumnHeader($column) {
    if (!$column || !$column.length) return $();
    var $header = $column.children(".jstree-grid-header-cell,.jstree-grid-header").first();
    return $header.length ? $header : $column.find(".jstree-grid-header-cell,.jstree-grid-header").first();
  }

  function findGridColumnByIndex($wrapper, index) {
    return $wrapper.find(".jstree-grid-column-" + index).filter(function () {
      return $(this).closest(".jstree-grid-wrapper").get(0) === $wrapper.get(0);
    }).first();
  }

  function readGridHeaderLabel($header) {
    if (!$header || !$header.length) return "";
    return normaliseText($header.clone().children(".jstree-grid-separator").remove().end().text());
  }

  function findLabelIndex(labels, wanted) {
    var normalised = wanted.map(normaliseText);
    for (var i = 0; i < labels.length; i++) {
      if (normalised.indexOf(normaliseText(labels[i])) !== -1) return i;
    }
    return -1;
  }

  function rememberOriginalGridColumn($wrapper, $column, $header) {
    var $host = $column.parent();
    if ($column.attr("data-wise-commercial-original-index") == null) {
      $column.attr("data-wise-commercial-original-index", String($host.children(".jstree-grid-column").index($column)));
    }
    if ($header.length && $header.attr("data-wise-commercial-original-label") == null) {
      $header.attr("data-wise-commercial-original-label", $.trim($header.clone().children().remove().end().text()));
    }
  }

  function renameGridHeader(column, label) {
    if (!column || !column.$header || !column.$header.length) return;
    if ($.trim(column.$header.clone().children().remove().end().text()) === label) return;
    var separator = column.$header.children(".jstree-grid-separator").detach();
    column.$header.text(label);
    if (separator.length) column.$header.append(separator);
  }

  function setGridCellValue(column, nodeId, value) {
    if (!column || !column.$column || !column.$column.length || !nodeId) return;
    var $cell = column.$column.find(".jstree-grid-cell").filter(function () {
      return String($(this).attr("data-jstreegrid") || "") === String(nodeId);
    }).first();
    if (!$cell.length) return;
    var next = value || "—";
    var $value = $cell.children(".wise-commercial-projected-value").first();
    if (!$value.length) {
      $cell.empty();
      $value = $("<span class='wise-commercial-projected-value'></span>").appendTo($cell);
    }
    if ($value.text() !== next) $value.text(next);
    $cell.attr("title", next === "—" ? "No proposal value set" : next);
  }

  function getTree() {
    var $candidates = $(CFG.tree)
      .add($("#items_tab").filter(".jstree"))
      .add($("#items_tab").find(".jstree"))
      .add($(".jstree-grid-wrapper .jstree"));
    var fallback = null;
    for (var i = 0; i < $candidates.length; i++) {
      try {
        var tree = $($candidates[i]).jstree(true);
        if (!tree) continue;
        if (!fallback) fallback = tree;
        if (treeLooksLikeSupplyingGrid(tree)) return tree;
      } catch (err) {}
    }
    return fallback;
  }

  function treeLooksLikeSupplyingGrid(tree) {
    var columns = tree && tree.settings && tree.settings.grid && tree.settings.grid.columns;
    if (!Array.isArray(columns)) return false;
    var labels = columns.map(function (column) { return normaliseText(column && column.header); });
    return labels.indexOf("unit price") !== -1 && labels.indexOf("total") !== -1;
  }

  function getGridWrapper(tree) {
    var $wrapper = tree && tree.gridWrapper ? $(tree.gridWrapper).first() : $();
    if ($wrapper.length) return $wrapper;
    var $tree = tree && tree.element ? $(tree.element).first() : $(CFG.tree).first();
    $wrapper = $tree.closest(".jstree-grid-wrapper").first();
    if ($wrapper.length) return $wrapper;
    $wrapper = $tree.parent().closest(".jstree-grid-wrapper").first();
    if ($wrapper.length) return $wrapper;
    $wrapper = $("#items_tab .jstree-grid-wrapper").filter(function () {
      var text = normaliseText(getGridHeaders($(this)).text());
      return text.indexOf("unit price") !== -1 && text.indexOf("total") !== -1;
    }).first();
    if ($wrapper.length) return $wrapper;
    $wrapper = $("#items_tab .jstree-grid-midwrapper").closest(".jstree-grid-wrapper").first();
    if ($wrapper.length) return $wrapper;
    return $("#items_tab .jstree-grid-wrapper").first();
  }

  function getAllTreeNodes(tree) {
    var nodes = [];
    var seen = {};
    try {
      var flat = tree.get_json("#", { flat: true }) || [];
      for (var i = 0; i < flat.length; i++) {
        var node = tree.get_node(flat[i].id);
        if (!node || !node.id || seen[node.id]) continue;
        seen[node.id] = true;
        nodes.push(node);
      }
    } catch (err) {}
    return nodes;
  }

  function isInventoryLine(node) {
    if (!node || !node.data) return false;
    var kind = node.data.kind;
    if (kind == null) kind = node.data.KIND;
    kind = Number(kind);
    if (kind === 1 || kind === 2) return true;
    return /^[bc](?:_|-)?\d+/i.test(String(node.id || ""));
  }

  /* ---------------------------- Native dialog --------------------------- */

  function enhanceOpenItemDialog() {
    var $dialog = findOpenItemDialog();
    if (!$dialog.length) {
      $("." + CFG.panelClass).remove();
      stopCosWatcher();
      state.activeDialog = null;
      state.activeItemKey = "";
      return;
    }
    if ($dialog.find("." + CFG.panelClass).length) {
      var $existingPanel = $dialog.find("." + CFG.panelClass).first();
      hydrateCommercialPanel($dialog, $existingPanel);
      bindNativeCosRecalculation($dialog, $existingPanel);
      startCosWatcher($dialog, $existingPanel);
      state.activeDialog = $dialog.get(0);
      return;
    }

    var node = resolveDialogNode($dialog);
    if (node && !isInventoryLine(node)) return;
    var commercial = readCommercialFields(node || { data: {} });
    commercial.cos = readLineCos($dialog, node);
    var $panel = $(commercialPanelHtml(commercial));
    var itemKey = getDialogItemKey($dialog, node);
    $panel.attr("data-wise-commercial-item-key", itemKey);
    insertCommercialPanel($dialog, $panel);
    bindCommercialCalculations($panel);
    bindNativeCosRecalculation($dialog, $panel);
    startCosWatcher($dialog, $panel);
    initialiseCommercialCalculations($panel);
    renameDialogTotalAsCos($dialog);
    state.activeDialog = $dialog.get(0);
    state.activeItemKey = itemKey;
  }

  function hydrateCommercialPanel($dialog, $panel) {
    var node = resolveDialogNode($dialog);
    var itemKey = getDialogItemKey($dialog, node);
    var previousKey = String($panel.attr("data-wise-commercial-item-key") || "");
    var itemChanged = !!(itemKey && previousKey && itemKey !== previousKey);
    if (itemChanged) {
      $panel.removeAttr("data-wise-commercial-dirty data-wise-commercial-last-edited");
      $panel.find(".wise-commercial-input").val("").removeAttr("aria-invalid");
    }
    if (itemKey) $panel.attr("data-wise-commercial-item-key", itemKey);
    state.activeItemKey = itemKey || previousKey;
    if ($panel.attr("data-wise-commercial-dirty") === "1") return;

    var commercial = readCommercialFields(node || { data: {} });
    var cos = readLineCos($dialog, node);
    if (cos != null && cos !== "") $panel.attr("data-wise-commercial-cos", rawMoney(cos));
    if (itemChanged || !$panel.attr("data-wise-commercial-last-observed-cos")) {
      $panel.attr("data-wise-commercial-last-observed-cos", rawMoney(cos));
    }
    var $revenue = $panel.find('[data-wise-commercial-field="Revenue"]').first();
    var $markup = $panel.find('[data-wise-commercial-field="Markup"]').first();
    $revenue.val(rawMoney(commercial.revenue));
    $markup.val(rawMarkup(commercial.markup));
    setCalculationStatus($panel, "CoS: " + formatSterling(cos) + " · live supplying-line values", false);
    initialiseCommercialCalculations($panel);
  }

  function getDialogItemKey($dialog, node) {
    var dataId = readDialogItemId($dialog);
    if (dataId) return "item:" + dataId;
    if (node && node.id) return "node:" + String(node.id);
    return "";
  }

  function findOpenItemDialog() {
    var $titles = $("body").find("div,span,b,strong").filter(function () {
      var text = normaliseText($(this).text());
      return /^edit\s+(?:hire|sales?|service|stock)\s+item$/.test(text);
    });

    for (var i = $titles.length - 1; i >= 0; i--) {
      var $title = $($titles[i]);
      if (!$title.is(":visible")) continue;
      var $dialog = $title.closest(".ui-dialog,[role='dialog']").first();
      if (!$dialog.length) $dialog = findDialogAncestor($title);
      if ($dialog.length && $dialog.is(":visible") && hasNativeSaveButton($dialog)) return $dialog;
    }
    return $();
  }

  function findDialogAncestor($start) {
    var $current = $start;
    for (var i = 0; i < 7 && $current.length; i++) {
      var text = normaliseText($current.text());
      if (text.indexOf("unit price") !== -1 && text.indexOf("save") !== -1 && text.indexOf("cancel") !== -1) return $current;
      $current = $current.parent();
    }
    return $();
  }

  function hasNativeSaveButton($dialog) {
    return $dialog.find("button,input[type='button'],input[type='submit'],a").filter(function () {
      return normaliseText(buttonText(this)) === "save";
    }).length > 0;
  }

  function resolveDialogNode($dialog) {
    var tree = getTree();
    if (!tree) return null;
    var id = readDialogItemId($dialog);
    if (id) {
      var byDataId = findNodeByDataId(tree, id);
      if (byDataId) return byDataId;
    }

    try {
      var selected = tree.get_selected(true) || [];
      for (var i = 0; i < selected.length; i++) {
        if (isInventoryLine(selected[i])) return selected[i];
      }
    } catch (err) {}

    if (state.lastSelectedNodeId) {
      try {
        var remembered = tree.get_node(state.lastSelectedNodeId);
        if (remembered && isInventoryLine(remembered)) return remembered;
      } catch (rememberedError) {}
    }

    var $clicked = $("#items_tab .jstree-clicked").first().closest("li.jstree-node");
    if ($clicked.length) {
      try { return tree.get_node(String($clicked.attr("id") || "")); } catch (err2) {}
    }
    return null;
  }

  function readDialogItemId($dialog) {
    var selectors = [
      "input[name='id']", "input[name='ID']", "input[name='item_id']",
      "input[data-field='ID']", "[data-item-id]"
    ];
    for (var i = 0; i < selectors.length; i++) {
      var $field = $dialog.find(selectors[i]).first();
      if (!$field.length) continue;
      var value = $field.attr("data-item-id") || $field.val() || "";
      if (/^\d+$/.test(String(value))) return String(value);
    }
    return "";
  }

  function findNodeByDataId(tree, dataId) {
    var nodes = getAllTreeNodes(tree);
    for (var i = 0; i < nodes.length; i++) {
      var value = nodes[i] && nodes[i].data ? (nodes[i].data.ID || nodes[i].data.id || "") : "";
      if (String(value) === String(dataId)) return nodes[i];
    }
    return null;
  }

  function commercialPanelHtml(commercial) {
    var cosLabel = commercial.cos === "" ? "CoS unavailable" : "CoS: " + formatSterling(commercial.cos);
    return '' +
      '<section class="' + CFG.panelClass + '" aria-label="Proposal commercial fields" data-wise-commercial-cos="' + escapeAttr(rawMoney(commercial.cos)) + '">' +
        '<div class="wise-line-commercial-heading">' +
          '<b>Proposal commercial fields</b>' +
          '<span data-wise-commercial-calculation>' + escapeAttr(cosLabel) + ' · edit either field</span>' +
        '</div>' +
        '<label><span>Markup</span><span class="wise-commercial-input-wrap">' +
          '<input type="text" inputmode="numeric" autocomplete="off" class="data_cell wise-commercial-input" ' +
            'data-wise-commercial-field="Markup" data-field="Markup" name="custom_fields[Markup]" value="' + escapeAttr(rawMarkup(commercial.markup)) + '">' +
          '<em>%</em></span></label>' +
        '<label><span>Revenue</span><span class="wise-commercial-input-wrap">' +
          '<em>£</em><input type="text" inputmode="decimal" autocomplete="off" class="data_cell wise-commercial-input" ' +
            'data-wise-commercial-field="Revenue" data-field="Revenue" name="custom_fields[Revenue]" value="' + escapeAttr(rawMoney(commercial.revenue)) + '">' +
        '</span></label>' +
      '</section>';
  }

  function readLineCos($dialog, node) {
    var $labelledCos = findDialogCosInput($dialog);
    if ($labelledCos.length) {
      var labelledMoney = normaliseMoneyInput($labelledCos.val());
      if (labelledMoney != null && labelledMoney !== "") return labelledMoney;
    }

    var selectors = [
      "input[data-field='TOTAL']", "input[data-field='total']",
      "input[name='total']", "input[name='line_total']", "input[name='total_price']", "input.total_cell"
    ];
    for (var s = 0; s < selectors.length; s++) {
      var $input = $dialog.find(selectors[s]).first();
      if (!$input.length) continue;
      var inputMoney = normaliseMoneyInput($input.val());
      if (inputMoney != null && inputMoney !== "") return inputMoney;
    }

    var nodeId = node && node.id ? String(node.id) : "";
    if (nodeId) {
      var $gridValue = getGridWrapper(getTree()).find('.jstree-grid-column[data-wise-commercial-column="cos"] .jstree-grid-cell').filter(function () {
        return String($(this).attr("data-jstreegrid") || "") === nodeId;
      }).first();
      var gridMoney = $gridValue.length ? normaliseMoneyInput($gridValue.text()) : null;
      if (gridMoney != null && gridMoney !== "") return gridMoney;
    }

    var data = node && node.data ? node.data : {};
    var keys = ["TOTAL", "total", "PRICE", "price"];
    for (var i = 0; i < keys.length; i++) {
      if (data[keys[i]] == null) continue;
      var nodeMoney = normaliseMoneyInput(data[keys[i]]);
      if (nodeMoney != null && nodeMoney !== "") return nodeMoney;
    }

    return "";
  }

  function findDialogCosInput($dialog) {
    var $label = findSmallestExactText($dialog, ["cos", "total"]);
    if (!$label.length) return $();

    var labelFor = String($label.attr("for") || "");
    if (labelFor) {
      var $associated = $dialog.find("#" + escapeSelectorValue(labelFor)).first();
      if (isUsableCosInput($associated)) return $associated;
    }

    var labelRect = elementRect($label.get(0));
    var best = null;
    var bestScore = Infinity;
    $dialog.find("input").each(function () {
      var $input = $(this);
      if (!isUsableCosInput($input)) return;
      var inputRect = elementRect(this);
      if (!labelRect || !inputRect) return;
      var score = scoreCosInputPosition(labelRect, inputRect);
      if (score < bestScore) {
        bestScore = score;
        best = this;
      }
    });
    return best ? $(best) : $();
  }

  function findDialogQtyInput($dialog) {
    var $label = findSmallestExactText($dialog, ["qty", "quantity"]);
    if (!$label.length) return $();
    var labelRect = elementRect($label.get(0));
    var best = null;
    var bestScore = Infinity;
    $dialog.find("input").each(function () {
      var $input = $(this);
      if (!isUsableCosInput($input)) return;
      var inputRect = elementRect(this);
      if (!labelRect || !inputRect) return;
      var score = scoreCosInputPosition(labelRect, inputRect);
      if (score < bestScore) {
        bestScore = score;
        best = this;
      }
    });
    return best ? $(best) : $();
  }

  function isUsableCosInput($input) {
    if (!$input || !$input.length || !$input.is(":visible") || $input.is(":disabled")) return false;
    if ($input.closest("." + CFG.panelClass).length) return false;
    var type = normaliseText($input.attr("type") || "text");
    return ["hidden", "button", "submit", "checkbox", "radio"].indexOf(type) === -1;
  }

  function elementRect(element) {
    if (!element || typeof element.getBoundingClientRect !== "function") return null;
    var rect = element.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return null;
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      centerX: rect.left + (rect.width / 2),
      centerY: rect.top + (rect.height / 2)
    };
  }

  function scoreCosInputPosition(labelRect, inputRect) {
    var horizontal = Math.abs(inputRect.centerX - labelRect.centerX);
    var vertical = inputRect.top - labelRect.bottom;
    var score = (horizontal * 3) + Math.abs(vertical - 8);
    if (vertical < -35) score += 1000;
    if (vertical > 100) score += 1000 + (vertical * 4);
    return score;
  }

  function escapeSelectorValue(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
    return String(value || "").replace(/([ #;&,.+*~':"!^$\[\]()=>|/@])/g, "\\$1");
  }

  function bindCommercialCalculations($panel) {
    $panel.on("input.wiseSupplyingCommercial", ".wise-commercial-input", function () {
      var field = String($(this).attr("data-wise-commercial-field") || "");
      $panel.attr("data-wise-commercial-dirty", "1");
      $panel.attr("data-wise-commercial-last-edited", field);
      $panel.removeClass("has-error");
      $(this).removeAttr("aria-invalid");
      syncCommercialCalculations($panel, field, false);
    });

    $panel.on("blur.wiseSupplyingCommercial", ".wise-commercial-input", function () {
      var field = String($(this).attr("data-wise-commercial-field") || "");
      var value = field === CFG.revenueField ? normaliseMoneyInput($(this).val()) : normaliseIntegerInput($(this).val());
      if (value != null) $(this).val(value);
    });
  }

  function bindNativeCosRecalculation($dialog, $panel) {
    var selectors = [
      "input[name='qty']", "input[name='QTY']", "input[data-field='QTY']", "input[data-field='qty']",
      "input.qty_cell", "input[class*='qty']", "input[id*='qty']", "input[id*='QTY']"
    ].join(",");
    var $qtyInputs = $dialog.find(selectors);
    var $qtyLabel = findSmallestExactText($dialog, ["qty", "quantity"]);
    if ($qtyLabel.length) {
      var $row = $qtyLabel.closest("tr");
      if ($row.length) $qtyInputs = $qtyInputs.add($row.find("input").filter(":enabled").first());
    }
    $qtyInputs = $qtyInputs.add(findDialogQtyInput($dialog)).add(findDialogCosInput($dialog));
    $qtyInputs.addClass("wise-commercial-native-qty");

    if ($dialog.attr("data-wise-commercial-cos-bound") === "1") return;
    $dialog.attr("data-wise-commercial-cos-bound", "1");

    $dialog.on("input.wiseSupplyingCommercialQty change.wiseSupplyingCommercialQty", selectors + ",.wise-commercial-native-qty", function () {
      var $currentPanel = $dialog.find("." + CFG.panelClass).first();
      if ($currentPanel.length) scheduleQuantityRecalculation($dialog, $currentPanel);
    });
  }

  function scheduleQuantityRecalculation($dialog, $panel) {
    $panel.attr("data-wise-commercial-dirty", "1");
    $panel.attr("data-wise-commercial-last-edited", CFG.markupField);
    [0, 60, 180].forEach(function (delay) {
      setTimeout(function () {
        if (!$panel.closest("html").length || !$dialog.is(":visible")) return;
        syncCommercialCalculations($panel, CFG.markupField, false);
      }, delay);
    });
  }

  function startCosWatcher($dialog, $panel) {
    var dialogElement = $dialog.get(0);
    if (state.cosWatchTimer && state.cosWatchDialog === dialogElement) return;
    stopCosWatcher();
    state.cosWatchDialog = dialogElement;
    var initialCos = rawMoney(readLineCos($dialog, resolveDialogNode($dialog)));
    $panel.attr("data-wise-commercial-last-observed-cos", initialCos);
    state.cosWatchTimer = setInterval(function () {
      if (!$dialog.is(":visible")) {
        stopCosWatcher();
        return;
      }
      var $currentPanel = $dialog.find("." + CFG.panelClass).first();
      if (!$currentPanel.length) {
        stopCosWatcher();
        return;
      }
      var currentCos = rawMoney(readLineCos($dialog, resolveDialogNode($dialog)));
      var previousCos = String($currentPanel.attr("data-wise-commercial-last-observed-cos") || "");
      if (!currentCos || currentCos === previousCos) return;
      $currentPanel.attr("data-wise-commercial-last-observed-cos", currentCos);
      $currentPanel.attr("data-wise-commercial-dirty", "1");
      $currentPanel.attr("data-wise-commercial-last-edited", CFG.markupField);
      syncCommercialCalculations($currentPanel, CFG.markupField, false);
    }, 150);
  }

  function stopCosWatcher() {
    if (state.cosWatchTimer) clearInterval(state.cosWatchTimer);
    state.cosWatchTimer = null;
    state.cosWatchDialog = null;
  }

  function initialiseCommercialCalculations($panel) {
    var revenue = $.trim(String($panel.find('[data-wise-commercial-field="Revenue"]').val() || ""));
    var markup = $.trim(String($panel.find('[data-wise-commercial-field="Markup"]').val() || ""));
    if (markup) syncCommercialCalculations($panel, CFG.markupField, false);
    else if (revenue && !markup) syncCommercialCalculations($panel, CFG.revenueField, false);
  }

  function syncCommercialCalculations($panel, sourceField, forSave) {
    refreshPanelCos($panel);
    var cos = Number($panel.attr("data-wise-commercial-cos"));
    var hasCos = isFinite(cos) && $.trim(String($panel.attr("data-wise-commercial-cos") || "")) !== "";
    var $revenue = $panel.find('[data-wise-commercial-field="Revenue"]').first();
    var $markup = $panel.find('[data-wise-commercial-field="Markup"]').first();

    if (!hasCos) {
      setCalculationStatus($panel, "CoS unavailable · values can be saved but not calculated", true);
      return !forSave;
    }

    if (sourceField === CFG.markupField) {
      var markup = normaliseIntegerInput($markup.val());
      if (markup == null || markup === "") {
        setCalculationStatus($panel, "CoS: " + formatSterling(cos) + " · enter a whole-number markup", markup == null);
        return markup !== null || !forSave;
      }
      var calculatedRevenue = calculateRevenue(cos, markup);
      $revenue.val(calculatedRevenue.toFixed(2)).removeAttr("aria-invalid");
      setCalculationStatus($panel, "CoS " + formatSterling(cos) + " + " + markup + "% = " + formatSterling(calculatedRevenue), false);
      return true;
    }

    if (sourceField === CFG.revenueField) {
      var revenue = normaliseMoneyInput($revenue.val());
      if (revenue == null || revenue === "") {
        setCalculationStatus($panel, "CoS: " + formatSterling(cos) + " · enter a revenue value", revenue == null);
        return revenue !== null || !forSave;
      }
      if (cos === 0) {
        setCalculationStatus($panel, "Markup cannot be calculated while CoS is zero", true);
        return !forSave;
      }
      var calculatedMarkup = calculateMarkup(cos, revenue);
      $markup.val(String(calculatedMarkup)).removeAttr("aria-invalid");
      setCalculationStatus($panel, formatSterling(revenue) + " revenue = " + calculatedMarkup + "% markup on " + formatSterling(cos), false);
      return true;
    }
    return true;
  }

  function refreshPanelCos($panel) {
    var $dialog = $panel.closest(".ui-dialog,[role='dialog']").first();
    if (!$dialog.length) return;
    var current = readLineCos($dialog, resolveDialogNode($dialog));
    if (current != null && current !== "") $panel.attr("data-wise-commercial-cos", rawMoney(current));
  }

  function calculateRevenue(cos, markup) {
    return Number(cos) * (1 + (Number(markup) / 100));
  }

  function calculateMarkup(cos, revenue) {
    if (Number(cos) === 0) return null;
    return Math.round(((Number(revenue) / Number(cos)) - 1) * 100);
  }

  function setCalculationStatus($panel, message, isError) {
    var $status = $panel.find("[data-wise-commercial-calculation]");
    if ($status.text() !== message) $status.text(message);
    if ($panel.hasClass("has-error") !== !!isError) $panel.toggleClass("has-error", !!isError);
  }

  function insertCommercialPanel($dialog, $panel) {
    var $content = $dialog.find(".ui-dialog-content").first();
    if (!$content.length) $content = $dialog;
    var $priceLabel = findSmallestExactText($content, ["unit price", "unit cost", "total", "cos"]);
    var $table = $priceLabel.closest("table").first();

    if ($table.length && $content.is("table")) {
      var columns = Math.max(1, $table.find("tr").first().children("td,th").length);
      $("<tr class='wise-line-commercial-row'><td colspan='" + columns + "'></td></tr>")
        .find("td").append($panel).end().appendTo($table);
    } else if ($table.length) {
      $panel.insertAfter($table);
    } else {
      $content.prepend($panel);
    }
  }

  function renameDialogTotalAsCos($dialog) {
    var $label = findSmallestExactText($dialog, ["total"]);
    if (!$label.length) return;
    if ($label.attr("data-wise-commercial-original-label") == null) {
      $label.attr("data-wise-commercial-original-label", $.trim($label.text()));
    }
    $label.text("CoS").attr("title", "Cost of Sales");
  }

  function findSmallestExactText($scope, labels) {
    var wanted = labels.map(normaliseText);
    var $matches = $scope.find("label,th,td,div,span,b,strong").filter(function () {
      return wanted.indexOf(normaliseText($(this).text())) !== -1;
    });
    var best = null;
    var bestLength = Infinity;
    $matches.each(function () {
      var length = $(this).find("*").length;
      if (length < bestLength) {
        best = this;
        bestLength = length;
      }
    });
    return best ? $(best) : $();
  }

  /* ------------------------------ Save bridge --------------------------- */

  function installNativeSaveCapture() {
    document.addEventListener("pointerdown", function (event) {
      if (!isProposalCreationDepot()) return;
      rememberSupplyingNodeFromTarget(event.target);
    }, true);

    document.addEventListener("click", function (event) {
      if (!isProposalCreationDepot()) return;
      var target = closestActionElement(event.target);
      if (!target) return;
      var $dialog = $(target).closest(".ui-dialog,[role='dialog']");
      if (!$dialog.length || !$dialog.find("." + CFG.panelClass).length) return;
      var action = normaliseText(buttonText(target));
      if (action === "cancel" || action === "close") {
        state.pendingSave = null;
        setTimeout(function () { scheduleRefresh(0); }, 0);
        return;
      }
      if (action !== "save") return;
      if (!preparePendingSave($dialog)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);

    document.addEventListener("submit", function (event) {
      if (!isProposalCreationDepot()) return;
      var $dialog = $(event.target).closest(".ui-dialog,[role='dialog']");
      if (!$dialog.length || !$dialog.find("." + CFG.panelClass).length) return;
      if (!preparePendingSave($dialog)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  function rememberSupplyingNodeFromTarget(target) {
    var $target = $(target && target.nodeType === 1 ? target : (target && target.parentElement));
    if (!$target.length) return;
    var nodeId = String($target.closest("[data-jstreegrid]").attr("data-jstreegrid") || "");
    if (!nodeId) nodeId = String($target.closest("li.jstree-node").attr("id") || "");
    if (!nodeId) return;
    var tree = getTree();
    try {
      var node = tree && tree.get_node(nodeId);
      if (node && isInventoryLine(node)) state.lastSelectedNodeId = String(node.id || nodeId);
    } catch (err) {}
  }

  function preparePendingSave($dialog) {
    var $panel = $dialog.find("." + CFG.panelClass).first();
    var lastEdited = String($panel.attr("data-wise-commercial-last-edited") || "");
    var previousCos = rawMoney($panel.attr("data-wise-commercial-cos"));
    var currentCos = rawMoney(readLineCos($dialog, resolveDialogNode($dialog)));
    var currentMarkup = $.trim(String($panel.find('[data-wise-commercial-field="Markup"]').val() || ""));
    if (!lastEdited && currentMarkup && currentCos !== previousCos) lastEdited = CFG.markupField;
    if (!lastEdited) {
      var hasRevenue = $.trim(String($panel.find('[data-wise-commercial-field="Revenue"]').val() || ""));
      var hasMarkup = $.trim(String($panel.find('[data-wise-commercial-field="Markup"]').val() || ""));
      if (hasMarkup && !hasRevenue) lastEdited = CFG.markupField;
      else if (hasRevenue && !hasMarkup) lastEdited = CFG.revenueField;
    }
    if (lastEdited && !syncCommercialCalculations($panel, lastEdited, true)) {
      showValidationError($dialog, lastEdited === CFG.revenueField ? "Markup cannot be calculated because CoS is zero or unavailable." : "Revenue could not be calculated from the supplied markup.", lastEdited);
      return false;
    }
    var revenueText = String($dialog.find('[data-wise-commercial-field="Revenue"]').val() || "");
    var markupText = String($dialog.find('[data-wise-commercial-field="Markup"]').val() || "");
    var revenue = normaliseMoneyInput(revenueText);
    var markup = normaliseIntegerInput(markupText);

    if (revenue == null) {
      showValidationError($dialog, "Revenue must be a valid money value.", "Revenue");
      return false;
    }
    if (markup == null) {
      showValidationError($dialog, "Markup must be a whole number.", "Markup");
      return false;
    }

    var node = resolveDialogNode($dialog);
    var customFields = collectNodeCustomFields(node);
    setCustomField(customFields, CFG.revenueField, revenue);
    setCustomField(customFields, CFG.markupField, markup);
    var nativeHelperUsed = stageHireHopCustomFields(revenue, markup);
    state.pendingSave = {
      nodeId: node && node.id ? String(node.id) : "",
      dataId: node && node.data ? String(node.data.ID || node.data.id || readDialogItemId($dialog) || "") : readDialogItemId($dialog),
      revenue: revenue,
      markup: markup,
      customFields: customFields,
      nativeHelperUsed: nativeHelperUsed,
      requestAttached: false,
      preparedAt: Date.now()
    };
    var prepared = state.pendingSave;
    setTimeout(function () {
      if (state.pendingSave === prepared && pendingSaveExpired(prepared)) state.pendingSave = null;
    }, CFG.pendingSaveLifetimeMs + 50);
    return true;
  }

  function stageHireHopCustomFields(revenue, markup) {
    if (typeof window._save_custom_field_value !== "function") return false;
    try {
      window._save_custom_field_value(CFG.revenueField, revenue);
      window._save_custom_field_value(CFG.markupField, markup);
      return true;
    } catch (err) {
      return false;
    }
  }

  function showValidationError($dialog, message, field) {
    var $input = $dialog.find('[data-wise-commercial-field="' + field + '"]').first();
    $dialog.find("." + CFG.panelClass).addClass("has-error");
    $input.attr("aria-invalid", "true").focus();
    if (window.alert) window.alert(message);
  }

  function installAjaxSaveBridge() {
    if (typeof $.ajaxPrefilter === "function") {
      $.ajaxPrefilter(function (options) {
        var pending = state.pendingSave;
        if (!pending || !isItemsSaveUrl(options && options.url)) return;
        if (pendingSaveExpired(pending)) {
          state.pendingSave = null;
          return;
        }
        if (pending.dataId && !requestMatchesItem(options.data, pending.dataId)) return;
        options.data = appendCustomFieldsToRequest(options.data, pending);
        pending.requestAttached = true;
      });
    }

    $(document).on("ajaxSuccess.wiseSupplyingCommercial", function (event, xhr, settings) {
      var pending = state.pendingSave;
      if (!pending || !isItemsSaveUrl(settings && settings.url)) return;
      if (!pending.requestAttached || !requestMatchesItem(settings && settings.data, pending.dataId)) return;
      if (ajaxResponseHasError(xhr)) {
        state.pendingSave = null;
        scheduleRefresh(CFG.refreshDelayMs);
        return;
      }
      applyPendingSaveToTree(pending);
      state.pendingSave = null;
      scheduleRefresh(0);
      setTimeout(function () { scheduleRefresh(0); }, 500);
    });

    $(document).on("ajaxError.wiseSupplyingCommercial", function (event, xhr, settings) {
      if (state.pendingSave && state.pendingSave.requestAttached && isItemsSaveUrl(settings && settings.url)) state.pendingSave = null;
    });
  }

  function pendingSaveExpired(pending) {
    return !pending || !pending.preparedAt || (Date.now() - pending.preparedAt) > CFG.pendingSaveLifetimeMs;
  }

  function ajaxResponseHasError(xhr) {
    var response = xhr && xhr.responseJSON;
    if (!response && xhr && typeof xhr.responseText === "string") {
      try { response = JSON.parse(xhr.responseText); } catch (err) { response = null; }
    }
    return !!(response && (response.error != null || response.warning != null));
  }

  function appendCustomFieldsToRequest(data, pending) {
    if (isFormDataLike(data)) {
      var scalar = data.get("custom_fields");
      var parsedFormBag = tryParseCustomFieldBag(scalar);
      if (scalar != null && parsedFormBag.valid) {
        data.set("custom_fields", JSON.stringify(mergePendingCommercialFields(parsedFormBag.bag, pending)));
        return data;
      }
      var keysToDelete = [];
      data.forEach(function (value, key) {
        if (isCommercialRequestField(key)) keysToDelete.push(key);
      });
      for (var f = 0; f < keysToDelete.length; f++) data.delete(keysToDelete[f]);
      data.set("custom_fields[" + CFG.revenueField + "]", pending.revenue);
      data.set("custom_fields[" + CFG.markupField + "]", pending.markup);
      return data;
    }

    if ($.isPlainObject(data)) {
      if ($.isPlainObject(data.custom_fields)) {
        data.custom_fields = mergePendingCommercialFields(data.custom_fields, pending);
        return data;
      }
      if (typeof data.custom_fields === "string") {
        var parsed = tryParseCustomFieldBag(data.custom_fields);
        if (parsed.valid) {
          data.custom_fields = JSON.stringify(mergePendingCommercialFields(parsed.bag, pending));
          return data;
        }
        delete data.custom_fields;
      }
      var hasBracketFields = false;
      Object.keys(data).forEach(function (key) {
        if (/^custom_fields\[/.test(key)) hasBracketFields = true;
        if (isCommercialRequestField(key)) delete data[key];
      });
      if (hasBracketFields) {
        data["custom_fields[" + CFG.revenueField + "]"] = pending.revenue;
        data["custom_fields[" + CFG.markupField + "]"] = pending.markup;
      } else {
        data.custom_fields = mergePendingCommercialFields(pending.customFields, pending);
      }
      return data;
    }

    var parts = String(data || "").split("&");
    var scalarIndex = -1;
    var scalarBag = null;
    var scalarIsBag = false;
    for (var i = 0; i < parts.length; i++) {
      var decodedKey = decodeRequestKey(parts[i]);
      if (decodedKey !== "custom_fields") continue;
      scalarIndex = i;
      var scalarValue = parts[i].indexOf("=") === -1 ? "" : parts[i].slice(parts[i].indexOf("=") + 1);
      try { scalarValue = decodeURIComponent(scalarValue.replace(/\+/g, " ")); } catch (err) {}
      var parsedScalar = tryParseCustomFieldBag(scalarValue);
      scalarBag = parsedScalar.bag;
      scalarIsBag = parsedScalar.valid;
      break;
    }

    if (scalarIndex !== -1) {
      if (scalarIsBag) {
        parts[scalarIndex] = encodeURIComponent("custom_fields") + "=" + encodeURIComponent(JSON.stringify(mergePendingCommercialFields(scalarBag, pending)));
        return parts.filter(Boolean).join("&");
      }
      parts.splice(scalarIndex, 1);
    }

    parts = parts.filter(function (part) {
      if (!part) return false;
      return !isCommercialRequestField(decodeRequestKey(part));
    });
    var fields = $.param({ custom_fields: commercialOnlyBag(pending) });
    if (fields) parts.push(fields);
    return parts.join("&");
  }

  function isFormDataLike(value) {
    return !!value && typeof value.get === "function" && typeof value.set === "function" &&
      typeof value.delete === "function" && typeof value.forEach === "function";
  }

  function mergePendingCommercialFields(existing, pending) {
    var bag = $.extend(true, {}, existing || pending.customFields || {});
    setCustomField(bag, CFG.revenueField, pending.revenue);
    setCustomField(bag, CFG.markupField, pending.markup);
    return bag;
  }

  function commercialOnlyBag(pending) {
    var source = pending.customFields || {};
    var bag = {};
    var names = [CFG.revenueField, CFG.markupField];
    for (var i = 0; i < names.length; i++) {
      var target = normaliseCustomFieldName(names[i]);
      var keys = Object.keys(source);
      var found = false;
      for (var j = 0; j < keys.length; j++) {
        if (normaliseCustomFieldName(keys[j]) !== target) continue;
        bag[keys[j]] = cloneCustomFieldValue(source[keys[j]]);
        found = true;
        break;
      }
      if (!found) bag[names[i]] = names[i] === CFG.revenueField ? pending.revenue : pending.markup;
    }
    return bag;
  }

  function decodeRequestKey(part) {
    var key = String(part || "").split("=", 1)[0] || "";
    try { return decodeURIComponent(key.replace(/\+/g, " ")); } catch (err) { return key; }
  }

  function isCommercialRequestField(key) {
    var match = String(key || "").match(/^custom_fields\[([^\]]+)\]/i);
    if (!match) return false;
    var logical = normaliseCustomFieldName(match[1]);
    return logical === normaliseCustomFieldName(CFG.revenueField) || logical === normaliseCustomFieldName(CFG.markupField);
  }

  function requestMatchesItem(data, dataId) {
    if (!dataId) return true;
    if ($.isPlainObject(data)) {
      var id = data.id || data.ID || data.item_id || "";
      return !id || String(id) === String(dataId);
    }
    var match = String(data || "").match(/(?:^|&)(?:id|ID|item_id)=([^&]*)/);
    return !match || decodeURIComponent(match[1] || "") === String(dataId);
  }

  function applyPendingSaveToTree(pending) {
    var tree = getTree();
    if (!tree) return;
    var node = pending.nodeId ? tree.get_node(pending.nodeId) : findNodeByDataId(tree, pending.dataId);
    if (!node || !node.data) return;
    var bag = parseCustomFieldBag(node.data.CUSTOM_FIELDS || node.data.custom_fields || node.data.customFields);
    setCustomField(bag, CFG.revenueField, pending.revenue);
    setCustomField(bag, CFG.markupField, pending.markup);
    node.data.CUSTOM_FIELDS = bag;
    setDirectCustomField(node.data, CFG.revenueField, pending.revenue);
    setDirectCustomField(node.data, CFG.markupField, pending.markup);
    if (node.original && node.original.data) {
      setDirectCustomField(node.original.data, CFG.revenueField, pending.revenue);
      setDirectCustomField(node.original.data, CFG.markupField, pending.markup);
    }
  }

  /* ------------------------- Custom-field codec ------------------------- */

  function readCommercialFields(node) {
    var sources = getNodeDataSources(node);
    var bag = {};
    for (var i = 0; i < sources.length; i++) {
      var parsed = parseCustomFieldBag(sources[i].CUSTOM_FIELDS || sources[i].custom_fields || sources[i].customFields);
      bag = $.extend(true, bag, parsed);
    }
    return {
      revenue: readCustomField(bag, sources, CFG.revenueField),
      markup: readCustomField(bag, sources, CFG.markupField)
    };
  }

  function collectNodeCustomFields(node) {
    var sources = getNodeDataSources(node);
    var bag = {};
    for (var i = 0; i < sources.length; i++) {
      var parsed = parseCustomFieldBag(sources[i].CUSTOM_FIELDS || sources[i].custom_fields || sources[i].customFields);
      bag = $.extend(true, bag, parsed);
    }
    return bag;
  }

  function getNodeDataSources(node) {
    var sources = [];
    function add(source) {
      if (!source || typeof source !== "object" || sources.indexOf(source) !== -1) return;
      sources.push(source);
    }
    add(node && node.data);
    add(node && node.original && node.original.data);
    add(node && node.original);
    add(node);
    return sources.length ? sources : [{}];
  }

  function parseCustomFieldBag(value) {
    return tryParseCustomFieldBag(value).bag;
  }

  function tryParseCustomFieldBag(value) {
    if ($.isPlainObject(value)) return { valid: true, bag: $.extend(true, {}, value) };
    if (typeof value !== "string") return { valid: false, bag: {} };
    if (!$.trim(value)) return { valid: true, bag: {} };
    try {
      var parsed = JSON.parse(value);
      return $.isPlainObject(parsed) ? { valid: true, bag: parsed } : { valid: false, bag: {} };
    } catch (err) {
      return { valid: false, bag: {} };
    }
  }

  function cloneCustomFieldValue(value) {
    if ($.isPlainObject(value)) return $.extend(true, {}, value);
    if (Array.isArray(value)) return $.extend(true, [], value);
    return value;
  }

  function readCustomField(bag, data, logicalName) {
    var target = normaliseCustomFieldName(logicalName);
    var sources = [bag || {}].concat(Array.isArray(data) ? data : [data || {}]);
    for (var s = 0; s < sources.length; s++) {
      var keys = Object.keys(sources[s]);
      for (var i = 0; i < keys.length; i++) {
        if (normaliseCustomFieldName(keys[i]) !== target) continue;
        var value = sources[s][keys[i]];
        if ($.isPlainObject(value) && Object.prototype.hasOwnProperty.call(value, "value")) value = value.value;
        return value == null ? "" : value;
      }
    }
    return "";
  }

  function setCustomField(bag, logicalName, value) {
    var target = normaliseCustomFieldName(logicalName);
    var keys = Object.keys(bag || {});
    var key = logicalName;
    for (var i = 0; i < keys.length; i++) {
      if (normaliseCustomFieldName(keys[i]) === target) {
        key = keys[i];
        break;
      }
    }
    var existing = bag[key];
    if ($.isPlainObject(existing) && Object.prototype.hasOwnProperty.call(existing, "value")) {
      existing = $.extend(true, {}, existing);
      existing.value = value;
      bag[key] = existing;
    } else {
      bag[key] = value;
    }
  }

  function setDirectCustomField(data, logicalName, value) {
    if (!data || typeof data !== "object") return;
    var target = normaliseCustomFieldName(logicalName);
    var keys = Object.keys(data);
    var matched = false;
    for (var i = 0; i < keys.length; i++) {
      if (normaliseCustomFieldName(keys[i]) !== target) continue;
      var existing = data[keys[i]];
      if ($.isPlainObject(existing) && Object.prototype.hasOwnProperty.call(existing, "value")) {
        existing = $.extend(true, {}, existing);
        existing.value = value;
        data[keys[i]] = existing;
      } else {
        data[keys[i]] = value;
      }
      matched = true;
    }
    if (!matched) data["items:_" + logicalName] = value;
  }

  function normaliseCustomFieldName(value) {
    var text = $.trim(String(value == null ? "" : value));
    var colon = text.lastIndexOf(":");
    if (colon !== -1) text = text.slice(colon + 1);
    return text.replace(/^[_~]+/, "").toLowerCase();
  }

  /* ------------------------------ Formatting ---------------------------- */

  function normaliseMoneyInput(value) {
    var text = $.trim(String(value == null ? "" : value));
    if (!text) return "";
    var cleaned = text.replace(/[£$€\s,]/g, "");
    if (!/^-?(?:\d+|\d*\.\d+)$/.test(cleaned)) return null;
    var number = Number(cleaned);
    if (!isFinite(number)) return null;
    return number.toFixed(2);
  }

  function normaliseIntegerInput(value) {
    var text = $.trim(String(value == null ? "" : value)).replace(/%$/, "").trim();
    if (!text) return "";
    if (!/^-?\d+$/.test(text)) return null;
    return String(parseInt(text, 10));
  }

  function rawMoney(value) {
    var normalised = normaliseMoneyInput(value);
    return normalised == null ? "" : normalised;
  }

  function rawMarkup(value) {
    var normalised = normaliseIntegerInput(value);
    return normalised == null ? "" : normalised;
  }

  function formatSterling(value) {
    var raw = rawMoney(value);
    if (!raw) return "—";
    var number = Number(raw);
    try {
      return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 }).format(number);
    } catch (err) {
      return "£" + number.toFixed(2);
    }
  }

  function formatMarkup(value) {
    var raw = rawMarkup(value);
    return raw === "" ? "—" : raw + "%";
  }

  /* ------------------------------- Cleanup ------------------------------ */

  function removeEnhancements() {
    stopCosWatcher();
    $("." + CFG.panelClass).remove();
    $("[data-wise-commercial-original-label]").each(function () {
      var $label = $(this);
      var separator = $label.children(".jstree-grid-separator").detach();
      $label.text($label.attr("data-wise-commercial-original-label") || "");
      if (separator.length) $label.append(separator);
      $label.removeAttr("data-wise-commercial-original-label title");
    });
    restoreNativeSupplyingGrid();
    var tree = getTree();
    var $wrapper = getGridWrapper(tree);
    var $columns = $wrapper.find(".jstree-grid-column[data-wise-commercial-original-index]");
    $columns.sort(function (a, b) {
      return Number($(a).attr("data-wise-commercial-original-index")) - Number($(b).attr("data-wise-commercial-original-index"));
    }).appendTo($columns.first().parent());
    $columns
      .removeClass("wise-supplying-commercial-hidden-column")
      .removeAttr("data-wise-commercial-column data-wise-commercial-original-index");
    if (tree && typeof tree.redraw === "function") {
      try { tree.redraw(true); } catch (err) {}
    }
    state.pendingSave = null;
    $(document.body).removeClass("wise-supplying-commercial-active");
    state.activeDialog = null;
    state.projectedRows = 0;
    state.gridFound = false;
    state.projectedColumns = [];
  }

  function restoreNativeSupplyingGrid() {
    $("#items_tab table.cust_node [data-wise-commercial-column]").each(function () {
      var $cell = $(this);
      var originalHtml = $cell.data("wiseCommercialOriginalHtml");
      if (originalHtml != null) $cell.html(originalHtml);
      $cell.removeData("wiseCommercialOriginalHtml");
    });

    $("#items_tab table.supplying_list_heads tr,#items_tab table.cust_node tr").each(function () {
      var $row = $(this);
      var $cells = $row.children("th[data-wise-native-original-index],td[data-wise-native-original-index]");
      if (!$cells.length) return;
      $cells.sort(function (a, b) {
        return Number($(a).attr("data-wise-native-original-index")) - Number($(b).attr("data-wise-native-original-index"));
      }).appendTo($row);
    });

    $("#items_tab [data-wise-native-original-index]")
      .removeClass("wise-supplying-commercial-hidden-column")
      .removeAttr("data-wise-commercial-column data-wise-native-original-index title");
  }

  function installStyles() {
    if (document.getElementById(CFG.styleId)) return;
    var css = [
      ".wise-supplying-commercial-active .jstree-grid-column.wise-supplying-commercial-hidden-column,.wise-supplying-commercial-active .jstree-grid-column[data-wise-commercial-column='unit']{display:none!important;}",
      ".wise-supplying-commercial-active table.supplying_list_heads [data-wise-commercial-column='unit'],.wise-supplying-commercial-active table.cust_node [data-wise-commercial-column='unit'],.wise-supplying-commercial-active table.supplying_list_heads .wise-supplying-commercial-hidden-column,.wise-supplying-commercial-active table.cust_node .wise-supplying-commercial-hidden-column{display:none!important;}",
      ".wise-supplying-commercial-active table.supplying_list_heads [data-wise-commercial-column='markup'],.wise-supplying-commercial-active table.supplying_list_heads [data-wise-commercial-column='revenue'],.wise-supplying-commercial-active table.cust_node [data-wise-commercial-column='markup'],.wise-supplying-commercial-active table.cust_node [data-wise-commercial-column='revenue']{text-align:right;}",
      "." + CFG.panelClass + "{display:grid;grid-template-columns:minmax(190px,1fr) minmax(150px,.55fr) minmax(180px,.7fr);align-items:end;gap:12px;margin:12px 0;padding:12px 14px;border:1px solid #ccd8e5;border-left:4px solid #d4b455;border-radius:8px;background:linear-gradient(135deg,#fffdf8 0%,#f4f7fa 100%);box-sizing:border-box;}",
      "." + CFG.panelClass + ".has-error{border-color:#b42318;}",
      ".wise-line-commercial-heading{display:flex;flex-direction:column;gap:2px;align-self:center;}",
      ".wise-line-commercial-heading b{color:#17212b;font-size:13px;}",
      ".wise-line-commercial-heading span{color:#667085;font-size:10px;}",
      "." + CFG.panelClass + " label{display:grid;gap:4px;color:#344054;font-size:11px;font-weight:700;}",
      ".wise-commercial-input-wrap{display:flex;align-items:center;gap:5px;height:30px;padding:0 8px;border:1px solid #aebdca;border-radius:4px;background:#fff;box-sizing:border-box;}",
      ".wise-commercial-input-wrap:focus-within{border-color:#4b8dcc;box-shadow:0 0 0 2px rgba(75,141,204,.14);}",
      ".wise-commercial-input-wrap em{color:#667085;font-size:12px;font-style:normal;}",
      ".wise-commercial-input{min-width:0;width:100%;height:26px!important;padding:0!important;border:0!important;outline:0!important;background:transparent!important;text-align:right;font:inherit!important;color:#17212b!important;box-shadow:none!important;}",
      "@media(max-width:760px){." + CFG.panelClass + "{grid-template-columns:1fr 1fr;}.wise-line-commercial-heading{grid-column:1/-1;}}"
    ].join("");
    $("head").append('<style id="' + CFG.styleId + '">' + css + "</style>");
  }

  /* ------------------------------- Helpers ------------------------------ */

  function closestActionElement(target) {
    if (!target) return null;
    var element = target.nodeType === 1 ? target : target.parentElement;
    if (!element) return null;
    if ($(element).is("button,input[type='button'],input[type='submit'],a")) return element;
    return $(element).closest("button,input[type='button'],input[type='submit'],a").get(0) || null;
  }

  function buttonText(element) {
    if (!element) return "";
    return element.value || element.textContent || $(element).attr("aria-label") || $(element).attr("title") || "";
  }

  function isItemsSaveUrl(url) {
    var value = String(url || "").toLowerCase();
    var endpoint = String(CFG.itemsSaveEndpoint || "").toLowerCase().split("?")[0];
    return value.indexOf(endpoint) !== -1 || /(?:^|\/)items_save\.php(?:[?#]|$)/i.test(value);
  }

  function normaliseText(value) {
    return $.trim(String(value == null ? "" : value)).replace(/\s+/g, " ").toLowerCase();
  }

  function escapeAttr(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function getHireHopSelector(key, fallback) {
    var shared = window.WiseProposalSectionBuilderHireHop;
    var value = shared && shared.selectors && shared.selectors[key];
    return value ? String(value) : fallback;
  }

  function getHireHopEndpoint(key, fallback) {
    var shared = window.WiseProposalSectionBuilderHireHop;
    var value = shared && shared.endpoints && shared.endpoints[key];
    return value ? String(value) : fallback;
  }

  function isProposalCreationDepot() {
    var shared = window.WiseProposalSectionBuilderHireHop;
    if (!shared || !shared.depot) return false;
    try {
      var raw = readCurrentUserDepotValue();
      if (raw == null || raw === "") return false;
      var rawId = shared.depot.normaliseId ? shared.depot.normaliseId(raw) : "";
      var allowedId = (typeof shared.depot.resolveId === "function" && shared.depot.resolveId("Proposal Creation")) || KNOWN_PROPOSAL_CREATION_DEPOT_ID;
      if (rawId && allowedId && rawId === allowedId) return true;
      var rawText = shared.depot.normaliseText ? shared.depot.normaliseText(raw) : String(raw).trim().toLowerCase();
      return rawText === "proposal creation";
    } catch (err) {
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

  function inspectCommercialContext() {
    var tree = getTree();
    var $wrapper = getGridWrapper(tree);
    var $nativeHeaderTable = getNativeSupplyingHeaderTable();
    var $nativeHeaders = $nativeHeaderTable.find("tr").first().children("th,td");
    var node = null;
    try {
      var selected = tree && tree.get_selected ? (tree.get_selected(true) || []) : [];
      node = selected.length ? selected[0] : null;
    } catch (err) {}
    var sources = getNodeDataSources(node);
    var matchingKeys = [];
    for (var i = 0; i < sources.length; i++) {
      Object.keys(sources[i]).forEach(function (key) {
        var name = normaliseCustomFieldName(key);
        if ((name === "revenue" || name === "markup") && matchingKeys.indexOf(key) === -1) matchingKeys.push(key);
      });
    }
    return {
      depotAllowed: isProposalCreationDepot(),
      treeFound: !!tree,
      gridFound: !!($nativeHeaderTable.length || $wrapper.length),
      gridMode: $nativeHeaderTable.length ? "hirehop-native-tables" : ($wrapper.length ? "jstree-grid" : "not-found"),
      gridHeaders: $nativeHeaderTable.length
        ? $nativeHeaders.map(function () { return $.trim($(this).text()); }).get()
        : getGridHeaders($wrapper).map(function () { return $.trim($(this).text()); }).get(),
      renderedGridColumns: $nativeHeaderTable.length ? $nativeHeaders.length : getGridColumns($wrapper).length,
      configuredGridHeaders: getConfiguredGridColumns(tree).map(function (column) {
        return $.trim(String(column && column.header || ""));
      }),
      selectedNodeId: node && node.id ? String(node.id) : "",
      selectedKind: node && node.data ? (node.data.kind == null ? node.data.KIND : node.data.kind) : null,
      matchingKeys: matchingKeys,
      commercial: readCommercialFields(node || { data: {} })
    };
  }

  window.__wiseSupplyingCommercial = {
    version: CFG.version,
    refresh: function () { scheduleRefresh(0); },
    calculateRevenue: calculateRevenue,
    calculateMarkup: calculateMarkup,
    inspect: inspectCommercialContext,
    describe: function () {
      return {
        version: CFG.version,
        depotAllowed: isProposalCreationDepot(),
        supplyingListFound: !!document.getElementById("items_tab"),
        projectedInventoryRows: state.projectedRows,
        gridFound: state.gridFound,
        projectedColumns: state.projectedColumns.slice(),
        itemEditorEnhanced: !!$("." + CFG.panelClass).length,
        fields: { revenue: CFG.revenueField, markup: CFG.markupField },
        saveBridge: typeof $.ajaxPrefilter === "function" ? "ajax-prefilter-and-form-fields" : "form-fields"
      };
    }
  };
})();
