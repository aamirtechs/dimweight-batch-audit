"use strict";
// DimWeight Batch Audit: core logic (pure functions, no DOM).

function parseCSV(text) {
  const rows = [];
  let row = [], cur = "", inQ = false;
  const s = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else { inQ = false; } }
      else { cur += c; }
    } else if (c === '"') { inQ = true; }
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c === "\r") { /* skip */ }
    else { cur += c; }
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  const clean = rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ""; }); });
  if (!clean.length) { return { headers: [], rows: [] }; }
  const headers = clean[0].map(function (h) { return String(h).trim(); });
  const out = clean.slice(1).map(function (r) {
    const o = {};
    headers.forEach(function (h, idx) { o[h] = r[idx] !== undefined ? String(r[idx]).trim() : ""; });
    return o;
  });
  return { headers: headers, rows: out };
}

function csvEscape(v) {
  const s = String(v === null || v === undefined ? "" : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCSV(headers, rows) {
  return [headers.join(",")].concat(rows.map(function (r) {
    return headers.map(function (h) { return csvEscape(r[h]); }).join(",");
  })).join("\n");
}
function findColumn(headers, candidates) {
  const low = headers.map(function (h) { return h.toLowerCase(); });
  for (const c of candidates) { const i = low.indexOf(c); if (i >= 0) { return headers[i]; } }
  for (const c of candidates) { const i = low.findIndex(function (h) { return h.indexOf(c) !== -1; }); if (i >= 0) { return headers[i]; } }
  return null;
}

var CM_PER_IN = 2.54;
var LB_PER_KG = 2.2046226218;
var OVERSIZE_CUBIC_IN = 10368;

function convertLength(value, from, to) {
  const v = Number(value) || 0;
  if (from === to) { return v; }
  if (from === "cm" && to === "in") { return v / CM_PER_IN; }
  if (from === "in" && to === "cm") { return v * CM_PER_IN; }
  return v;
}
function convertWeight(value, from, to) {
  const v = Number(value) || 0;
  if (from === to) { return v; }
  if (from === "kg" && to === "lb") { return v * LB_PER_KG; }
  if (from === "lb" && to === "kg") { return v / LB_PER_KG; }
  return v;
}
function isMetricDivisor(divisor) { return Number(divisor) >= 1000; }

// Dimensional weight in pounds. Metric divisors (5000, 4000) take cm and return kg internally.
function dimWeightLb(l, w, h, lengthUnit, divisor) {
  const d = Number(divisor) || 139;
  if (isMetricDivisor(d)) {
    const volCm = convertLength(l, lengthUnit, "cm") * convertLength(w, lengthUnit, "cm") * convertLength(h, lengthUnit, "cm");
    return convertWeight(volCm / d, "kg", "lb");
  }
  const volIn = convertLength(l, lengthUnit, "in") * convertLength(w, lengthUnit, "in") * convertLength(h, lengthUnit, "in");
  return volIn / d;
}
function round2(n) { return Math.round(n * 100) / 100; }

function auditRow(input, options) {
  const opts = options || {};
  const divisor = Number(opts.divisor) || 139;
  const lengthUnit = input.lengthUnit || opts.lengthUnit || "in";
  const weightUnit = input.weightUnit || opts.weightUnit || "lb";
  const l = Number(input.length) || 0, w = Number(input.width) || 0, h = Number(input.height) || 0;
  const volumeIn = convertLength(l, lengthUnit, "in") * convertLength(w, lengthUnit, "in") * convertLength(h, lengthUnit, "in");
  const dimLb = dimWeightLb(l, w, h, lengthUnit, divisor);
  const actualLb = convertWeight(Number(input.weight) || 0, weightUnit, "lb");
  // Report weights in the unit belonging to the divisor family.
  const metric = isMetricDivisor(divisor);
  const outUnit = metric ? "kg" : "lb";
  const dim = metric ? convertWeight(dimLb, "lb", "kg") : dimLb;
  const actual = metric ? convertWeight(actualLb, "lb", "kg") : actualLb;
  const billable = Math.ceil(Math.max(dim, actual));
  const dimBilled = dim > actual;
  const excessPercent = dimBilled && actual > 0 ? round2(((dim - actual) / actual) * 100) : 0;
  return {
    sku: input.sku || "",
    volumeCubicIn: round2(volumeIn),
    dimWeight: round2(dim),
    actualWeight: round2(actual),
    weightUnit: outUnit,
    billableWeight: billable,
    dimBilled: dimBilled,
    excessPercent: excessPercent,
    oversize: volumeIn > OVERSIZE_CUBIC_IN
  };
}

function auditCSV(text, options) {
  const parsed = parseCSV(text);
  const headers = parsed.headers;
  const cols = {
    sku: findColumn(headers, ["sku", "item", "product", "name"]),
    length: findColumn(headers, ["length", "l"]),
    width: findColumn(headers, ["width", "w"]),
    height: findColumn(headers, ["height", "h"]),
    weight: findColumn(headers, ["actual weight", "weight", "wt"]),
    lengthUnit: findColumn(headers, ["length_unit", "length unit", "dim_unit", "unit"]),
    weightUnit: findColumn(headers, ["weight_unit", "weight unit"])
  };
  const results = parsed.rows.map(function (r) {
    return auditRow({
      sku: cols.sku ? r[cols.sku] : "",
      length: cols.length ? r[cols.length] : 0,
      width: cols.width ? r[cols.width] : 0,
      height: cols.height ? r[cols.height] : 0,
      weight: cols.weight ? r[cols.weight] : 0,
      lengthUnit: cols.lengthUnit ? String(r[cols.lengthUnit]).toLowerCase() : undefined,
      weightUnit: cols.weightUnit ? String(r[cols.weightUnit]).toLowerCase() : undefined
    }, options);
  });
  results.sort(function (a, b) { return b.excessPercent - a.excessPercent; });
  return { columns: cols, results: results };
}

function buildAnnotatedCSV(results) {
  const headers = ["sku", "volume_cubic_in", "dim_weight", "actual_weight", "weight_unit", "billable_weight", "dim_billed", "excess_percent", "oversize"];
  const rows = results.map(function (r) {
    return { sku: r.sku, volume_cubic_in: r.volumeCubicIn, dim_weight: r.dimWeight, actual_weight: r.actualWeight, weight_unit: r.weightUnit, billable_weight: r.billableWeight, dim_billed: r.dimBilled ? "yes" : "no", excess_percent: r.excessPercent, oversize: r.oversize ? "yes" : "no" };
  });
  return toCSV(headers, rows);
}

const api = { parseCSV, toCSV, findColumn, convertLength, convertWeight, isMetricDivisor, dimWeightLb, auditRow, auditCSV, buildAnnotatedCSV, OVERSIZE_CUBIC_IN };
if (typeof module !== "undefined" && module.exports) { module.exports = api; }
if (typeof window !== "undefined") { window.DimWeightBatchAudit = api; }
