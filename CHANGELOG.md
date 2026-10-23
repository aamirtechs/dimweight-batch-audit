# Changelog

## 1.0.0 - 2026-10-23

- CSV input: SKU, length, width, height and actual weight, with in/cm and lb/kg units per row or per file.
- Divisors 139, 166, 5000, 4000 or a custom divisor, with billable weight computed per row.
- Flags every row where dimensional weight beats actual weight, plus oversize cubic volume over 10,368 cubic inches.
- Exports an annotated CSV sorted by excess dimensional weight percent, so the worst boxes come first.
