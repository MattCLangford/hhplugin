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
    version: "2026-07-20.2",
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
    pendingSave: null,
    activeDialog: null,
    projectedRows: 0
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
        if (mutations[i].type === "childList") {
          scheduleRefresh(CFG.refreshDelayMs);
          return;
        }
      }
    });
    state.observer.observe(document.body || root, { childList: true, subtree: true });
  }

  /* --------------------------- Supplying grid --------------------------- */

  function projectSupplyingGrid() {
    var $wrapper = $("#items_tab .jstree-grid-wrapper").first();
    var tree = getTree();
    if (!$wrapper.length || !tree) return;

    var columns = {
      unit: findGridColumn($wrapper, "unit", ["unit price", "unit cost"]),
      cos: findGridColumn($wrapper, "cos", ["total", "cos"]),
      markup: findGridColumn($wrapper, "markup", ["discount/markup", "discount / markup", "markup"]),
      revenue: findGridColumn($wrapper, "revenue", ["flag", "revenue"])
    };

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

  function findGridColumn($wrapper, key, labels) {
    var $marked = $wrapper.find('.jstree-grid-column[data-wise-commercial-column="' + key + '"]').first();
    if ($marked.length) {
      return { key: key, $column: $marked, $header: $marked.children(".jstree-grid-header").first() };
    }

    var wanted = labels.map(normaliseText);
    var $header = $wrapper.find(".jstree-grid-header-cell").filter(function () {
      return wanted.indexOf(normaliseText($(this).text())) !== -1;
    }).first();
    var $column = $header.closest(".jstree-grid-column");
    if ($column.length) {
      $column.attr("data-wise-commercial-column", key);
      rememberOriginalGridColumn($wrapper, $column, $header);
    }
    return { key: key, $column: $column, $header: $header };
  }

  function rememberOriginalGridColumn($wrapper, $column, $header) {
    if ($column.attr("data-wise-commercial-original-index") == null) {
      $column.attr("data-wise-commercial-original-index", String($wrapper.children(".jstree-grid-column").index($column)));
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
    var $value = $cell.children("span").first();
    if (!$value.length) $value = $("<span></span>").appendTo($cell);
    var next = value || "—";
    if ($value.text() !== next) $value.text(next);
    $cell.attr("title", next === "—" ? "No proposal value set" : next);
  }

  function getTree() {
    try { return $(CFG.tree).first().jstree(true) || null; } catch (err) { return null; }
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
    return kind === 1 || kind === 2;
  }

  /* ---------------------------- Native dialog --------------------------- */

  function enhanceOpenItemDialog() {
    var $dialog = findOpenItemDialog();
    if (!$dialog.length) {
      state.activeDialog = null;
      return;
    }
    if ($dialog.find("." + CFG.panelClass).length) {
      state.activeDialog = $dialog.get(0);
      return;
    }

    var node = resolveDialogNode($dialog);
    if (node && !isInventoryLine(node)) return;
    var commercial = readCommercialFields(node || { data: {} });
    commercial.cos = readLineCos($dialog, node);
    var $panel = $(commercialPanelHtml(commercial));
    insertCommercialPanel($dialog, $panel);
    bindCommercialCalculations($panel);
    initialiseCommercialCalculations($panel);
    renameDialogTotalAsCos($dialog);
    state.activeDialog = $dialog.get(0);
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
    var selectors = [
      "input[data-field='TOTAL']", "input[data-field='total']",
      "input[name='total']", "input[name='price']", "input.total_cell"
    ];
    for (var s = 0; s < selectors.length; s++) {
      var $input = $dialog.find(selectors[s]).first();
      if (!$input.length) continue;
      var inputMoney = normaliseMoneyInput($input.val());
      if (inputMoney != null && inputMoney !== "") return inputMoney;
    }

    var nodeId = node && node.id ? String(node.id) : "";
    if (nodeId) {
      var $gridValue = $('#items_tab .jstree-grid-column[data-wise-commercial-column="cos"] .jstree-grid-cell').filter(function () {
        return String($(this).attr("data-jstreegrid") || "") === nodeId;
      }).first().children("span").first();
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

  function bindCommercialCalculations($panel) {
    $panel.on("input.wiseSupplyingCommercial", ".wise-commercial-input", function () {
      var field = String($(this).attr("data-wise-commercial-field") || "");
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

  function initialiseCommercialCalculations($panel) {
    var revenue = $.trim(String($panel.find('[data-wise-commercial-field="Revenue"]').val() || ""));
    var markup = $.trim(String($panel.find('[data-wise-commercial-field="Markup"]').val() || ""));
    if (markup && !revenue) syncCommercialCalculations($panel, CFG.markupField, false);
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
    $panel.find("[data-wise-commercial-calculation]").text(message);
    $panel.toggleClass("has-error", !!isError);
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
    document.addEventListener("click", function (event) {
      if (!isProposalCreationDepot()) return;
      var target = closestActionElement(event.target);
      if (!target) return;
      var $dialog = $(target).closest(".ui-dialog,[role='dialog']");
      if (!$dialog.length || !$dialog.find("." + CFG.panelClass).length) return;
      var action = normaliseText(buttonText(target));
      if (action === "cancel" || action === "close") {
        state.pendingSave = null;
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

  function preparePendingSave($dialog) {
    var $panel = $dialog.find("." + CFG.panelClass).first();
    var lastEdited = String($panel.attr("data-wise-commercial-last-edited") || "");
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
    var customFields = parseCustomFieldBag(node && node.data ? (node.data.CUSTOM_FIELDS || node.data.custom_fields || node.data.customFields) : "");
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
      var target = names[i].toLowerCase();
      var keys = Object.keys(source);
      var found = false;
      for (var j = 0; j < keys.length; j++) {
        if (String(keys[j]).replace(/^[_~]+/, "").toLowerCase() !== target) continue;
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
    var logical = String(match[1] || "").replace(/^[_~]+/, "").toLowerCase();
    return logical === CFG.revenueField.toLowerCase() || logical === CFG.markupField.toLowerCase();
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
  }

  /* ------------------------- Custom-field codec ------------------------- */

  function readCommercialFields(node) {
    var data = node && node.data ? node.data : {};
    var bag = parseCustomFieldBag(data.CUSTOM_FIELDS || data.custom_fields || data.customFields);
    return {
      revenue: readCustomField(bag, data, CFG.revenueField),
      markup: readCustomField(bag, data, CFG.markupField)
    };
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
    var target = String(logicalName || "").replace(/^[_~]+/, "").toLowerCase();
    var sources = [bag || {}, data || {}];
    for (var s = 0; s < sources.length; s++) {
      var keys = Object.keys(sources[s]);
      for (var i = 0; i < keys.length; i++) {
        if (String(keys[i]).replace(/^[_~]+/, "").toLowerCase() !== target) continue;
        var value = sources[s][keys[i]];
        if ($.isPlainObject(value) && Object.prototype.hasOwnProperty.call(value, "value")) value = value.value;
        return value == null ? "" : value;
      }
    }
    return "";
  }

  function setCustomField(bag, logicalName, value) {
    var target = String(logicalName || "").toLowerCase();
    var keys = Object.keys(bag || {});
    var key = logicalName;
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i]).replace(/^[_~]+/, "").toLowerCase() === target) {
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
    $("." + CFG.panelClass).remove();
    $("[data-wise-commercial-original-label]").each(function () {
      var $label = $(this);
      var separator = $label.children(".jstree-grid-separator").detach();
      $label.text($label.attr("data-wise-commercial-original-label") || "");
      if (separator.length) $label.append(separator);
      $label.removeAttr("data-wise-commercial-original-label title");
    });
    var $wrapper = $("#items_tab .jstree-grid-wrapper").first();
    var $columns = $wrapper.children(".jstree-grid-column[data-wise-commercial-original-index]");
    $columns.sort(function (a, b) {
      return Number($(a).attr("data-wise-commercial-original-index")) - Number($(b).attr("data-wise-commercial-original-index"));
    }).appendTo($wrapper);
    $columns
      .removeClass("wise-supplying-commercial-hidden-column")
      .removeAttr("data-wise-commercial-column data-wise-commercial-original-index");
    var tree = getTree();
    if (tree && typeof tree.redraw === "function") {
      try { tree.redraw(true); } catch (err) {}
    }
    state.pendingSave = null;
    state.activeDialog = null;
    state.projectedRows = 0;
  }

  function installStyles() {
    if (document.getElementById(CFG.styleId)) return;
    var css = [
      "#items_tab .jstree-grid-column.wise-supplying-commercial-hidden-column{display:none!important;}",
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

  window.__wiseSupplyingCommercial = {
    version: CFG.version,
    refresh: function () { scheduleRefresh(0); },
    calculateRevenue: calculateRevenue,
    calculateMarkup: calculateMarkup,
    describe: function () {
      return {
        version: CFG.version,
        depotAllowed: isProposalCreationDepot(),
        supplyingListFound: !!document.getElementById("items_tab"),
        projectedInventoryRows: state.projectedRows,
        itemEditorEnhanced: !!$("." + CFG.panelClass).length,
        fields: { revenue: CFG.revenueField, markup: CFG.markupField },
        saveBridge: typeof $.ajaxPrefilter === "function" ? "ajax-prefilter-and-form-fields" : "form-fields"
      };
    }
  };
})();
