/**
 * Core utilities for the Serena Dang Job Tracker.
 */

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const monthFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const monthShortFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
});

const percentFmt = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

const RUSH_FEE = 10;

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

function jobTotal(job) {
  return money(
    money(job.jobPrice) + (job.rush ? RUSH_FEE : 0) + money(job.tips)
  );
}

function csvCell(value) {
  var text = String(value == null ? "" : value);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

// Make them globally available in the browser
if (typeof window !== "undefined") {
  window.RUSH_FEE = RUSH_FEE;
  window.money = money;
  window.formatMoney = formatMoney;
  window.formatPercent = formatPercent;
  window.formatDate = formatDate;
  window.formatMonth = formatMonth;
  window.addMonths = addMonths;
  window.todayISO = todayISO;
  window.makeId = makeId;
  window.jobTotal = jobTotal;
  window.csvCell = csvCell;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    RUSH_FEE,
    money,
    formatMoney,
    formatPercent,
    formatDate,
    formatMonth,
    addMonths,
    todayISO,
    makeId,
    jobTotal,
    csvCell,
  };
}
