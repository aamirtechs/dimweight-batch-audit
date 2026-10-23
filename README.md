# DimWeight Batch Audit
Live page: https://aamirtechs.github.io/dimweight-batch-audit/

Upload your product or box CSV and find every SKU where dimensional weight, not actual weight, is what the carrier bills you for. Sellers, operators and developers currently do this by hand, one row or one request at a time, in spreadsheets and paid suites. This tool does the whole batch in the browser for free.

## Features
- CSV input: SKU, length, width, height and actual weight, with in/cm and lb/kg units per row or per file.
- Divisors 139, 166, 5000, 4000 or a custom divisor, with billable weight computed per row.
- Flags every row where dimensional weight beats actual weight, plus oversize cubic volume over 10,368 cubic inches.
- Exports an annotated CSV sorted by excess dimensional weight percent, so the worst boxes come first.

## How it works
Paste or upload your input, set the options, and run the tool. All processing happens locally in your browser using the shared logic in `src/logic.js`, and you can download the results as files. It runs entirely in the browser.

## Privacy
Runs 100% in your browser. Your files never leave this device, nothing is uploaded,
and there is no tracking.

## Development
Core logic lives in `src/logic.js` and is shared by the page and the tests.
Run the tests with `npm test`.

## License
MIT, Copyright 2026 Amir Hussain.
