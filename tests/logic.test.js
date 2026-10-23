"use strict";
const test = require("node:test");
const assert = require("node:assert");
const L = require("../src/logic.js");

test("unit conversion in/cm and lb/kg", () => {
  assert.strictEqual(Math.round(L.convertLength(10, "in", "cm") * 100) / 100, 25.4);
  assert.strictEqual(Math.round(L.convertLength(25.4, "cm", "in") * 100) / 100, 10);
  assert.strictEqual(Math.round(L.convertWeight(1, "kg", "lb") * 1000) / 1000, 2.205);
  assert.strictEqual(Math.round(L.convertWeight(2.2046226218, "lb", "kg") * 100) / 100, 1);
});

test("DIM weight with divisor 139 imperial", () => {
  // 20 x 16 x 12 in = 3840 cubic in / 139 = 27.625 lb
  const d = L.dimWeightLb(20, 16, 12, "in", 139);
  assert.ok(Math.abs(d - 27.6259) < 0.01, "got " + d);
});

test("DIM weight with divisor 166", () => {
  const d = L.dimWeightLb(12, 12, 12, "in", 166);
  assert.ok(Math.abs(d - 10.4096) < 0.01, "got " + d);
});

test("DIM weight with metric divisor 5000 from cm", () => {
  // 50 x 40 x 30 cm = 60000 cm3 / 5000 = 12 kg = 26.455 lb
  const d = L.dimWeightLb(50, 40, 30, "cm", 5000);
  assert.ok(Math.abs(d - 26.4555) < 0.01, "got " + d);
  const d4000 = L.dimWeightLb(50, 40, 30, "cm", 4000);
  assert.ok(Math.abs(d4000 - 33.0693) < 0.01, "got " + d4000);
});

test("custom divisor is honoured", () => {
  const d = L.dimWeightLb(10, 10, 10, "in", 200);
  assert.strictEqual(d, 5);
});

test("billable weight and excess percent when DIM wins", () => {
  const r = L.auditRow({ sku: "BOX-1", length: 20, width: 16, height: 12, weight: 5, lengthUnit: "in", weightUnit: "lb" }, { divisor: 139 });
  assert.strictEqual(r.dimBilled, true);
  assert.strictEqual(r.billableWeight, 28);
  assert.strictEqual(r.excessPercent, 452.52);
  assert.strictEqual(r.oversize, false);
});

test("actual weight wins for dense items and oversize flag fires", () => {
  const r = L.auditRow({ sku: "DENSE-1", length: 30, width: 24, height: 20, weight: 120, lengthUnit: "in", weightUnit: "lb" }, { divisor: 139 });
  assert.strictEqual(r.dimBilled, false);
  assert.strictEqual(r.excessPercent, 0);
  assert.strictEqual(r.oversize, true); // 14400 cubic in > 10368
  assert.strictEqual(r.billableWeight, 120); // actual 120 beats dim 103.59
});

test("auditCSV parses rows, converts kg and sorts by excess", () => {
  const csv = "sku,length,width,height,weight,length_unit,weight_unit\nA-1,20,16,12,5,in,lb\nB-2,10,10,10,20,in,lb\nC-3,50,40,30,2,cm,kg";
  const out = L.auditCSV(csv, { divisor: 139 });
  assert.strictEqual(out.results.length, 3);
  // C-3 in cm/kg has the highest excess (about 497%), then A-1 (452%), then dense B-2.
  assert.strictEqual(out.results[0].sku, "C-3");
  assert.strictEqual(out.results[1].sku, "A-1");
  assert.strictEqual(out.results[2].sku, "B-2");
  assert.ok(out.results[0].excessPercent > out.results[1].excessPercent);
  const annotated = L.buildAnnotatedCSV(out.results);
  assert.ok(annotated.indexOf("excess_percent") !== -1);
  assert.ok(annotated.indexOf("A-1") !== -1);
});
