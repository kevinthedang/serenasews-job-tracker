(function () {
  "use strict";

  var STORAGE_KEY = "serena-dang-jobs-v1";
  var RUSH_FEE = 10;
  var DEFAULT_SERVICES = [
    "Pants & Jeans",
    "Suits & Pants",
    "Shirts & Blouses",
    "Dresses & Skirts",
    "Bridal & Formal Wear",
    "Home Textiles",
    "Repairs",
    "Other",
  ];

  var EDIT_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  var DELETE_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>';

  var usd = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });
  var dateFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  var monthFmt = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  });
  var monthShortFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
  });
  var percentFmt = new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  });

  var els = {
    form: document.getElementById("jobForm"),
    date: document.getElementById("date"),
    client: document.getElementById("client"),
    service: document.getElementById("service"),
    serviceOptions: document.getElementById("serviceOptions"),
    garments: document.getElementById("garments"),
    jobPrice: document.getElementById("jobPrice"),
    tips: document.getElementById("tips"),
    rush: document.getElementById("rush"),
    bridal: document.getElementById("bridal"),
    formTitle: document.getElementById("formTitle"),
    formHint: document.getElementById("formHint"),
    submitBtn: document.getElementById("submitBtn"),
    cancelEdit: document.getElementById("cancelEdit"),
    previewPrice: document.getElementById("previewPrice"),
    previewRush: document.getElementById("previewRush"),
    previewTip: document.getElementById("previewTip"),
    previewTotal: document.getElementById("previewTotal"),
    jobsTable: document.getElementById("jobsTable"),
    jobsBody: document.getElementById("jobsBody"),
    jobsFoot: document.getElementById("jobsFoot"),
    jobsSubtitle: document.getElementById("jobsSubtitle"),
    emptyState: document.getElementById("emptyState"),
    emptyTitle: document.getElementById("emptyTitle"),
    emptySub: document.getElementById("emptySub"),
    search: document.getElementById("search"),
    monthFilter: document.getElementById("monthFilter"),
    exportCsv: document.getElementById("exportCsv"),
    exportXlsx: document.getElementById("exportXlsx"),
    toast: document.getElementById("toast"),
    statRevenue: document.getElementById("statRevenue"),
    statJobs: document.getElementById("statJobs"),
    statGarments: document.getElementById("statGarments"),
    statBridal: document.getElementById("statBridal"),
    statsPeriod: document.getElementById("statsPeriod"),
    statsCaption: document.getElementById("statsCaption"),
    insightsPeriod: document.getElementById("insightsPeriod"),
    insightAvgTicket: document.getElementById("insightAvgTicket"),
    insightAvgTicketSub: document.getElementById("insightAvgTicketSub"),
    insightRush: document.getElementById("insightRush"),
    insightRushSub: document.getElementById("insightRushSub"),
    insightTipRate: document.getElementById("insightTipRate"),
    insightTipSub: document.getElementById("insightTipSub"),
    insightBridalShare: document.getElementById("insightBridalShare"),
    insightBridalSub: document.getElementById("insightBridalSub"),
    insightRepeat: document.getElementById("insightRepeat"),
    insightRepeatSub: document.getElementById("insightRepeatSub"),
    insightTrendTotal: document.getElementById("insightTrendTotal"),
    insightTrendBars: document.getElementById("insightTrendBars"),
    serviceChips: document.getElementById("serviceChips"),
  };

  var jobs = loadJobs();
  var editingId = null;
  var filters = { search: "", month: "all" };
  var statsPeriod = todayISO().slice(0, 7);
  var toastTimer = null;
  var storageWarned = false;

  init();

  function init() {
    els.date.value = todayISO();
    bindEvents();
    updatePreview();
    render();
  }

  function bindEvents() {
    els.form.addEventListener("submit", handleSubmit);
    els.cancelEdit.addEventListener("click", function () {
      resetForm();
      showToast("Edit cancelled");
    });

    els.jobPrice.addEventListener("input", updatePreview);
    els.tips.addEventListener("input", updatePreview);
    els.rush.addEventListener("change", updatePreview);
    els.client.addEventListener("input", function () {
      els.client.setCustomValidity("");
    });

    els.search.addEventListener("input", function () {
      filters.search = els.search.value.trim().toLowerCase();
      renderTable();
    });

    els.monthFilter.addEventListener("change", function () {
      filters.month = els.monthFilter.value;
      renderTable();
    });

    els.statsPeriod.addEventListener("change", function () {
      statsPeriod = els.statsPeriod.value;
      renderStatsPeriods();
      renderStats();
      renderInsights();
    });

    els.exportCsv.addEventListener("click", exportCsv);
    els.exportXlsx.addEventListener("click", exportXlsx);

    els.jobsBody.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-action]");
      if (!button) return;
      var job = jobs.find(function (item) {
        return item.id === button.getAttribute("data-id");
      });
      if (!job) return;

      if (button.getAttribute("data-action") === "edit") {
        startEdit(job);
      } else {
        deleteJob(job);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && editingId) {
        resetForm();
        showToast("Edit cancelled");
      }
    });
  }

  /* ---------- Saving & loading ---------- */

  function loadJobs() {
    var raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return [];
    }
    if (!raw) return [];

    try {
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeJob).filter(Boolean);
    } catch (error) {
      console.warn("Could not read saved jobs:", error);
      return [];
    }
  }

  function normalizeJob(job) {
    if (!job || typeof job !== "object") return null;

    var client = typeof job.client === "string" ? job.client.trim() : "";
    if (!client) return null;

    var date =
      typeof job.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(job.date)
        ? job.date
        : todayISO();

    return {
      id:
        typeof job.id === "string" && job.id.length
          ? job.id
          : makeId(),
      date: date,
      client: client,
      service:
        typeof job.service === "string" ? job.service.trim() : "",
      garments: Math.max(1, Math.round(Number(job.garments) || 1)),
      jobPrice: Math.max(0, money(job.jobPrice)),
      rush: Boolean(job.rush),
      tips: Math.max(0, money(job.tips)),
      bridal: Boolean(job.bridal),
      createdAt: Number(job.createdAt) || Date.now(),
      updatedAt: Number(job.updatedAt) || 0,
    };
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
      return true;
    } catch (error) {
      console.warn("Could not save jobs:", error);
      if (!storageWarned) {
        storageWarned = true;
        showToast("Browser storage is unavailable — export a spreadsheet to keep your data.");
      }
      return false;
    }
  }

  /* ---------- Form ---------- */

  function readForm() {
    return {
      date: els.date.value,
      client: els.client.value.trim(),
      service: els.service.value.trim(),
      garments: Math.max(1, parseInt(els.garments.value, 10) || 1),
      jobPrice: Math.max(0, money(parseFloat(els.jobPrice.value))),
      rush: els.rush.checked,
      tips: Math.max(0, money(parseFloat(els.tips.value))),
      bridal: els.bridal.checked,
    };
  }

  function handleSubmit(event) {
    event.preventDefault();
    els.client.setCustomValidity("");

    if (!els.form.checkValidity()) {
      els.form.reportValidity();
      return;
    }

    var data = readForm();
    if (!data.client) {
      els.client.setCustomValidity("Please enter a client name.");
      els.form.reportValidity();
      return;
    }

    var wasEditing = Boolean(editingId);

    if (editingId) {
      var index = jobs.findIndex(function (job) {
        return job.id === editingId;
      });
      if (index !== -1) {
        jobs[index] = Object.assign({}, jobs[index], data, {
          updatedAt: Date.now(),
        });
      }
    } else {
      jobs.push(
        Object.assign({}, data, {
          id: makeId(),
          createdAt: Date.now(),
          updatedAt: 0,
        })
      );
    }

    persist();
    resetForm();
    render();
    showToast(wasEditing ? "Job updated" : "Job saved");
  }

  function updatePreview() {
    var jobPrice = Math.max(0, money(parseFloat(els.jobPrice.value)));
    var tips = Math.max(0, money(parseFloat(els.tips.value)));
    var rush = els.rush.checked ? RUSH_FEE : 0;

    els.previewPrice.textContent = formatMoney(jobPrice);
    els.previewRush.textContent = formatMoney(rush);
    els.previewTip.textContent = formatMoney(tips);
    els.previewTotal.textContent = formatMoney(jobPrice + rush + tips);
  }

  function resetForm() {
    editingId = null;
    els.form.reset();
    els.date.value = todayISO();
    els.service.value = "";
    els.garments.value = "1";
    els.tips.value = "0.00";
    els.jobPrice.value = "";
    els.rush.checked = false;
    els.bridal.checked = false;
    els.client.setCustomValidity("");

    els.formTitle.textContent = "Log a job";
    els.formHint.textContent =
      "Fill in the details and the total is calculated for you.";
    els.submitBtn.textContent = "Save job";
    els.cancelEdit.classList.add("hidden");

    updatePreview();
  }

  function startEdit(job) {
    editingId = job.id;
    els.date.value = job.date;
    els.client.value = job.client;
    els.service.value = job.service || "";
    els.garments.value = String(job.garments);
    els.jobPrice.value = money(job.jobPrice).toFixed(2);
    els.tips.value = money(job.tips).toFixed(2);
    els.rush.checked = job.rush;
    els.bridal.checked = job.bridal;

    els.formTitle.textContent = "Edit job";
    els.formHint.textContent = "Update the details, then save your changes.";
    els.submitBtn.textContent = "Update job";
    els.cancelEdit.classList.remove("hidden");

    updatePreview();
    els.form.scrollIntoView({ behavior: "smooth", block: "start" });
    els.client.focus({ preventScroll: true });
    showToast("Editing job for " + job.client);
  }

  function deleteJob(job) {
    var confirmed = window.confirm(
      "Delete the job for " +
        job.client +
        " (" +
        formatDate(job.date) +
        ")?\n\nThis can't be undone."
    );
    if (!confirmed) return;

    jobs = jobs.filter(function (item) {
      return item.id !== job.id;
    });
    if (editingId === job.id) resetForm();

    persist();
    render();
    showToast("Job deleted");
  }

  /* ---------- Rendering ---------- */

  function render() {
    renderServiceOptions();
    renderStatsPeriods();
    renderStats();
    renderInsights();
    renderMonthOptions();
    renderTable();
  }

  function renderServiceOptions() {
    var seen = {};
    var values = [];

    function addService(value) {
      var label = String(value == null ? "" : value).trim();
      if (!label) return;
      var key = label.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      values.push(label);
    }

    DEFAULT_SERVICES.forEach(addService);
    jobs.forEach(function (job) {
      addService(job.service);
    });

    els.serviceOptions.replaceChildren();
    values.forEach(function (value) {
      var option = document.createElement("option");
      option.value = value;
      els.serviceOptions.appendChild(option);
    });
  }

  function renderStatsPeriods() {
    var currentMonth = todayISO().slice(0, 7);
    var months = [currentMonth];

    jobs.forEach(function (job) {
      var month = job.date.slice(0, 7);
      if (months.indexOf(month) === -1) months.push(month);
    });
    months.sort().reverse();

    if (statsPeriod !== "all" && months.indexOf(statsPeriod) === -1) {
      statsPeriod = currentMonth;
    }

    els.statsPeriod.replaceChildren();
    months.forEach(function (month) {
      var option = document.createElement("option");
      option.value = month;
      option.textContent = formatMonth(month);
      els.statsPeriod.appendChild(option);
    });

    var allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All time";
    els.statsPeriod.appendChild(allOption);

    els.statsPeriod.value = statsPeriod;
    els.statsCaption.textContent =
      statsPeriod === "all"
        ? "All-time totals"
        : formatMonth(statsPeriod) + " at a glance";
  }

  function jobsForPeriod(period) {
    if (period === "all") return jobs;
    return jobs.filter(function (job) {
      return job.date.slice(0, 7) === period;
    });
  }

  function renderStats() {
    var scope = jobsForPeriod(statsPeriod);

    var revenue = scope.reduce(function (sum, job) {
      return sum + jobTotal(job);
    }, 0);
    var garments = scope.reduce(function (sum, job) {
      return sum + job.garments;
    }, 0);
    var bridal = scope.filter(function (job) {
      return job.bridal;
    }).length;

    els.statRevenue.textContent = formatMoney(revenue);
    els.statJobs.textContent = String(scope.length);
    els.statGarments.textContent = String(garments);
    els.statBridal.textContent = String(bridal);
  }

  function renderInsights() {
    var scope = jobsForPeriod(statsPeriod);
    var jobCount = scope.length;
    var revenue = scope.reduce(function (sum, job) {
      return sum + jobTotal(job);
    }, 0);
    var tipsTotal = scope.reduce(function (sum, job) {
      return sum + money(job.tips);
    }, 0);
    var priceTotal = scope.reduce(function (sum, job) {
      return sum + money(job.jobPrice);
    }, 0);
    var bridalRevenue = scope.reduce(function (sum, job) {
      return job.bridal ? sum + jobTotal(job) : sum;
    }, 0);
    var rushCount = scope.filter(function (job) {
      return job.rush;
    }).length;
    var rushFees = rushCount * RUSH_FEE;

    els.insightsPeriod.textContent =
      (statsPeriod === "all" ? "All time" : formatMonth(statsPeriod)) +
      " · " +
      jobCount +
      (jobCount === 1 ? " job" : " jobs");

    els.insightAvgTicket.textContent = formatMoney(
      jobCount ? revenue / jobCount : 0
    );
    els.insightAvgTicketSub.textContent = jobCount
      ? jobCount + (jobCount === 1 ? " job" : " jobs")
      : "No jobs in this period";

    els.insightRush.textContent = String(rushCount);
    els.insightRushSub.textContent = jobCount
      ? formatMoney(rushFees) +
        " in fees · " +
        formatPercent(rushCount / jobCount) +
        " of jobs"
      : "No jobs in this period";

    els.insightTipRate.textContent = formatPercent(
      priceTotal > 0 ? tipsTotal / priceTotal : 0
    );
    els.insightTipSub.textContent = formatMoney(tipsTotal) + " in tips";

    els.insightBridalShare.textContent = formatPercent(
      revenue > 0 ? bridalRevenue / revenue : 0
    );
    els.insightBridalSub.textContent =
      formatMoney(bridalRevenue) + " bridal revenue";

    var clientCounts = {};
    jobs.forEach(function (job) {
      var key = job.client.toLowerCase();
      clientCounts[key] = (clientCounts[key] || 0) + 1;
    });
    var clientKeys = Object.keys(clientCounts);
    var uniqueClients = clientKeys.length;
    var repeatClients = clientKeys.filter(function (key) {
      return clientCounts[key] > 1;
    }).length;

    if (uniqueClients) {
      els.insightRepeat.textContent = formatPercent(
        repeatClients / uniqueClients
      );
      els.insightRepeatSub.textContent =
        repeatClients +
        " of " +
        uniqueClients +
        (uniqueClients === 1 ? " client" : " clients") +
        " · all time";
    } else {
      els.insightRepeat.textContent = "—";
      els.insightRepeatSub.textContent = "No clients yet";
    }

    renderTrend();
    renderServiceBreakdown(scope);
  }

  function renderTrend() {
    var endMonth =
      statsPeriod === "all" ? todayISO().slice(0, 7) : statsPeriod;
    var months = [];
    for (var i = 5; i >= 0; i--) {
      months.push(addMonths(endMonth, -i));
    }

    var sums = {};
    months.forEach(function (month) {
      sums[month] = 0;
    });
    jobs.forEach(function (job) {
      var month = job.date.slice(0, 7);
      if (Object.prototype.hasOwnProperty.call(sums, month)) {
        sums[month] += jobTotal(job);
      }
    });

    var max = 0;
    var total = 0;
    months.forEach(function (month) {
      max = Math.max(max, sums[month]);
      total += sums[month];
    });

    els.insightTrendTotal.textContent = formatMoney(total);
    els.insightTrendBars.replaceChildren();

    months.forEach(function (month) {
      var value = sums[month];
      var parts = month.split("-").map(Number);
      var label = monthShortFmt.format(new Date(parts[0], parts[1] - 1, 1));
      var height =
        max > 0 ? Math.max(2, Math.round((value / max) * 44)) : 2;

      var column = document.createElement("div");
      column.className = "trend-col";
      if (month === endMonth) column.classList.add("is-active");
      if (value === 0) column.classList.add("is-zero");
      column.title = formatMonth(month) + ": " + formatMoney(value);
      column.setAttribute("aria-label", column.title);

      var bar = document.createElement("div");
      bar.className = "trend-bar";
      bar.style.height = height + "px";

      var monthLabel = document.createElement("span");
      monthLabel.className = "trend-month";
      monthLabel.textContent = label;

      column.appendChild(bar);
      column.appendChild(monthLabel);
      els.insightTrendBars.appendChild(column);
    });
  }

  function renderServiceBreakdown(scope) {
    var groups = {};
    scope.forEach(function (job) {
      var name = job.service || "Uncategorized";
      if (!groups[name]) groups[name] = { name: name, revenue: 0, count: 0 };
      groups[name].revenue += jobTotal(job);
      groups[name].count += 1;
    });

    var entries = Object.keys(groups)
      .map(function (key) {
        return groups[key];
      })
      .sort(function (a, b) {
        return b.revenue - a.revenue || a.name.localeCompare(b.name);
      });

    var hasCategorized = scope.some(function (job) {
      return Boolean(job.service);
    });

    els.serviceChips.replaceChildren();

    if (!scope.length) {
      els.serviceChips.appendChild(
        createInsightsEmpty("No jobs in this period yet.")
      );
      return;
    }

    if (!hasCategorized) {
      els.serviceChips.appendChild(
        createInsightsEmpty(
          "Add a service category when logging a job to see this breakdown."
        )
      );
      return;
    }

    entries.forEach(function (entry) {
      var chip = document.createElement("span");
      chip.className = "service-chip";
      chip.title =
        entry.count +
        (entry.count === 1 ? " job" : " jobs") +
        " · " +
        formatMoney(entry.revenue);

      var name = document.createElement("span");
      name.className = "service-chip-name";
      name.textContent = entry.name;

      var amount = document.createElement("span");
      amount.className = "service-chip-amount";
      amount.textContent = formatMoney(entry.revenue);

      chip.appendChild(name);
      chip.appendChild(amount);
      els.serviceChips.appendChild(chip);
    });
  }

  function createInsightsEmpty(text) {
    var span = document.createElement("span");
    span.className = "insights-empty";
    span.textContent = text;
    return span;
  }

  function renderMonthOptions() {
    var months = [];
    jobs.forEach(function (job) {
      var month = job.date.slice(0, 7);
      if (months.indexOf(month) === -1) months.push(month);
    });
    months.sort().reverse();

    if (filters.month !== "all" && months.indexOf(filters.month) === -1) {
      filters.month = "all";
    }

    els.monthFilter.replaceChildren();

    var allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All time";
    els.monthFilter.appendChild(allOption);

    months.forEach(function (month) {
      var option = document.createElement("option");
      option.value = month;
      option.textContent = formatMonth(month);
      els.monthFilter.appendChild(option);
    });

    els.monthFilter.value = filters.month;
  }

  function renderTable() {
    var list = filteredJobs();

    if (jobs.length === 0) {
      els.jobsSubtitle.textContent = "No jobs logged yet.";
    } else if (list.length === 0) {
      els.jobsSubtitle.textContent = "No jobs match these filters.";
    } else {
      var total = list.reduce(function (sum, job) {
        return sum + jobTotal(job);
      }, 0);
      els.jobsSubtitle.textContent =
        list.length +
        (list.length === 1 ? " job · " : " jobs · ") +
        formatMoney(total) +
        " total" +
        (filters.month === "all" ? "" : " · " + formatMonth(filters.month));
    }

    els.jobsBody.replaceChildren();

    var fragment = document.createDocumentFragment();
    list.forEach(function (job) {
      fragment.appendChild(buildRow(job));
    });
    els.jobsBody.appendChild(fragment);

    buildFooter(list);

    var hasRows = list.length > 0;
    els.jobsTable.classList.toggle("hidden", !hasRows);
    els.emptyState.hidden = hasRows;

    if (!hasRows) {
      if (jobs.length === 0) {
        els.emptyTitle.textContent = "No jobs yet";
        els.emptySub.textContent = "Log your first job with the form.";
      } else {
        els.emptyTitle.textContent = "No matching jobs";
        els.emptySub.textContent =
          "Try a different client search or month.";
      }
    }
  }

  function filteredJobs() {
    return jobs
      .filter(function (job) {
        var matchesSearch =
          !filters.search || job.client.toLowerCase().indexOf(filters.search) !== -1;
        var matchesMonth =
          filters.month === "all" || job.date.slice(0, 7) === filters.month;
        return matchesSearch && matchesMonth;
      })
      .sort(function (a, b) {
        var byDate = b.date.localeCompare(a.date);
        return byDate !== 0 ? byDate : (b.createdAt || 0) - (a.createdAt || 0);
      });
  }

  function buildRow(job) {
    var row = document.createElement("tr");
    row.setAttribute("data-id", job.id);

    var dateCell = document.createElement("td");
    dateCell.className = "date-cell";
    var time = document.createElement("time");
    time.dateTime = job.date;
    time.textContent = formatDate(job.date);
    dateCell.appendChild(time);
    row.appendChild(dateCell);

    var clientCell = document.createElement("td");
    var clientWrap = document.createElement("div");
    clientWrap.className = "client-cell";
    var clientName = document.createElement("span");
    clientName.className = "client-name";
    clientName.textContent = job.client;
    clientWrap.appendChild(clientName);
    if (job.bridal) {
      var tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = "Bridal";
      clientWrap.appendChild(tag);
    }
    clientCell.appendChild(clientWrap);

    var meta = document.createElement("div");
    meta.className = "row-meta";
    var metaParts = [];
    if (job.service) metaParts.push(job.service);
    metaParts.push(
      job.garments + (job.garments === 1 ? " garment" : " garments"),
      "Job " + formatMoney(job.jobPrice)
    );
    if (job.rush) metaParts.push("Rush " + formatMoney(RUSH_FEE));
    if (job.tips > 0) metaParts.push("Tip " + formatMoney(job.tips));
    meta.textContent = metaParts.join(" · ");
    clientCell.appendChild(meta);

    row.appendChild(clientCell);

    var serviceCell = document.createElement("td");
    serviceCell.className = "service-cell";
    if (job.service) {
      serviceCell.textContent = job.service;
    } else {
      var serviceDash = document.createElement("span");
      serviceDash.className = "muted-dash";
      serviceDash.textContent = "—";
      serviceCell.appendChild(serviceDash);
    }
    row.appendChild(serviceCell);

    row.appendChild(numericCell(String(job.garments)));
    row.appendChild(numericCell(formatMoney(job.jobPrice)));

    var rushCell = numericCell("");
    if (job.rush) {
      rushCell.textContent = formatMoney(RUSH_FEE);
    } else {
      var rushDash = document.createElement("span");
      rushDash.className = "muted-dash";
      rushDash.textContent = "—";
      rushCell.appendChild(rushDash);
    }
    row.appendChild(rushCell);

    var tipCell = numericCell("");
    if (job.tips > 0) {
      tipCell.textContent = formatMoney(job.tips);
    } else {
      var tipDash = document.createElement("span");
      tipDash.className = "muted-dash";
      tipDash.textContent = "—";
      tipCell.appendChild(tipDash);
    }
    row.appendChild(tipCell);

    var totalCell = numericCell(formatMoney(jobTotal(job)));
    totalCell.classList.add("total-cell");
    row.appendChild(totalCell);

    var actionsCell = document.createElement("td");
    actionsCell.className = "actions-cell";
    actionsCell.appendChild(actionButton("edit", job, "Edit job", EDIT_ICON));
    actionsCell.appendChild(
      actionButton("delete", job, "Delete job", DELETE_ICON)
    );
    row.appendChild(actionsCell);

    return row;
  }

  function numericCell(text) {
    var cell = document.createElement("td");
    cell.className = "num";
    if (text) cell.textContent = text;
    return cell;
  }

  function actionButton(action, job, label, icon) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "icon-btn " + action;
    button.setAttribute("data-action", action);
    button.setAttribute("data-id", job.id);
    button.setAttribute("aria-label", label + " for " + job.client);
    button.title = label;
    button.innerHTML = icon;
    return button;
  }

  function buildFooter(list) {
    els.jobsFoot.replaceChildren();
    if (list.length === 0) return;

    var totals = list.reduce(
      function (acc, job) {
        acc.garments += job.garments;
        acc.jobPrice += money(job.jobPrice);
        acc.rush += job.rush ? RUSH_FEE : 0;
        acc.tips += money(job.tips);
        acc.total += jobTotal(job);
        return acc;
      },
      { garments: 0, jobPrice: 0, rush: 0, tips: 0, total: 0 }
    );

    var row = document.createElement("tr");

    var label = document.createElement("td");
    label.colSpan = 3;
    label.className = "foot-label";
    label.textContent =
      "Totals · " + list.length + (list.length === 1 ? " job" : " jobs");
    row.appendChild(label);

    row.appendChild(numericCell(String(totals.garments)));
    row.appendChild(numericCell(formatMoney(totals.jobPrice)));
    row.appendChild(numericCell(formatMoney(totals.rush)));
    row.appendChild(numericCell(formatMoney(totals.tips)));

    var totalCell = numericCell(formatMoney(totals.total));
    totalCell.classList.add("total-cell");
    row.appendChild(totalCell);

    row.appendChild(document.createElement("td"));
    els.jobsFoot.appendChild(row);
  }

  /* ---------- Export ---------- */

  function exportCsv() {
    if (jobs.length === 0) {
      showToast("There are no jobs to export yet.");
      return;
    }

    var list = sortedForExport();
    var lines = [
      [
        "Appointment Date",
        "Name",
        "# of Pieces",
        "Rush",
        "Price",
        "Tips",
        "Contains Bridal",
        "Total - Sale",
        "Service",
      ]
        .map(csvCell)
        .join(","),
    ];

    list.forEach(function (job) {
      lines.push(
        [
          job.date,
          job.client,
          job.garments,
          job.rush ? RUSH_FEE.toFixed(2) : "",
          money(job.jobPrice).toFixed(2),
          job.tips > 0 ? money(job.tips).toFixed(2) : "",
          job.bridal ? "Yes" : "",
          jobTotal(job).toFixed(2),
          job.service || "",
        ]
          .map(csvCell)
          .join(",")
      );
    });

    var csv = "\uFEFF" + lines.join("\r\n") + "\r\n";
    download(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      "serena-dang-jobs-" + todayISO() + ".csv"
    );
    showToast("CSV exported · " + list.length + (list.length === 1 ? " job" : " jobs"));
  }

  function exportXlsx() {
    if (jobs.length === 0) {
      showToast("There are no jobs to export yet.");
      return;
    }
    if (!window.SerenaXlsx) {
      showToast("Spreadsheet export is unavailable in this browser.");
      return;
    }

    var list = sortedForExport();
    var blob = window.SerenaXlsx.buildJobWorkbook(list);
    download(blob, "serena-dang-jobs-" + todayISO() + ".xlsx");
    showToast(
      "Spreadsheet exported · " + list.length + (list.length === 1 ? " job" : " jobs")
    );
  }

  function sortedForExport() {
    return jobs.slice().sort(function (a, b) {
      var byDate = a.date.localeCompare(b.date);
      return byDate !== 0 ? byDate : (a.createdAt || 0) - (b.createdAt || 0);
    });
  }

  function csvCell(value) {
    var text = String(value == null ? "" : value);
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 2000);
  }

  /* ---------- Helpers ---------- */

  function jobTotal(job) {
    return money(
      money(job.jobPrice) + (job.rush ? RUSH_FEE : 0) + money(job.tips)
    );
  }

  function money(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function formatMoney(value) {
    return usd.format(money(value));
  }

  function formatPercent(ratio) {
    return percentFmt.format(Number(ratio) || 0);
  }

  function formatDate(iso) {
    var parts = String(iso).split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return iso;
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    return isNaN(date.getTime()) ? iso : dateFmt.format(date);
  }

  function formatMonth(month) {
    var parts = String(month).split("-").map(Number);
    if (parts.length !== 2 || parts.some(isNaN)) return month;
    return monthFmt.format(new Date(parts[0], parts[1] - 1, 1));
  }

  function addMonths(month, delta) {
    var parts = String(month).split("-").map(Number);
    if (parts.length !== 2 || parts.some(isNaN)) return month;
    var date = new Date(parts[0], parts[1] - 1 + delta, 1);
    return (
      date.getFullYear() +
      "-" +
      String(date.getMonth() + 1).padStart(2, "0")
    );
  }

  function todayISO() {
    var now = new Date();
    var year = now.getFullYear();
    var month = String(now.getMonth() + 1).padStart(2, "0");
    var day = String(now.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function makeId() {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
    return (
      "job-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9)
    );
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.classList.remove("show");
    }, 2800);
  }
})();
