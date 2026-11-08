# Serena Dang Tailoring & Alterations — Utility

A small, local job tracker for the tailoring business. Log each job in a form,
see the running history and monthly totals, and export everything to a
spreadsheet.

Everything runs in the browser. There is no server, build step, account, or
internet connection required.

## Run it

Open `index.html` in Chrome, Edge, Firefox, or Safari.

Optionally, serve it locally:

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

For Raspberry Pi or home-network hosting, see [deployment.md](deployment.md).

## What it tracks

| Field | Notes | Spreadsheet column |
| --- | --- | --- |
| Date | Defaults to today | Appointment Date |
| Client name | Required | Name |
| Service category | Optional; pick a suggestion or type your own | Service |
| # of garments | Whole number, minimum 1 | # of Pieces |
| Job price | Price of the work, before rush or tip | Price |
| Rush fee | Checkbox that adds a flat **$10** | Rush |
| Tips | Optional, defaults to $0 | Tips |
| Bridal | Checkbox used to mark bridal jobs | Contains Bridal |
| Total | Calculated automatically: job price + rush fee + tips | Total - Sale |

Service category suggestions come from the business's pricing sections:
**Pants & Jeans**, **Shirts & Blouses**, **Dresses & Skirts**,
**Bridal & Formal Wear**, **Home Textiles**, and **Repairs**, plus **Other**.
Previously used categories are suggested too.

The spreadsheet export follows the columns and date format of `Template.xlsx`:
real Excel dates, `Yes`/blank for bridal, and blank rush/tips cells when the value
is zero. `Service` is added as a final column so the category is preserved. The
sample rows in the template are not imported.

## Features

- Save, edit, and delete jobs
- Live total as you type
- Headline stats for a selectable period: revenue, jobs, garments, and bridal
  jobs (pick any month or **All time**)
- **Business insights** for the selected period:
  - Average ticket
  - Rush jobs and rush-fee revenue
  - Tip rate (tips as a share of job price)
  - Bridal share of revenue
  - Repeat clients (all-time)
  - Six-month revenue trend ending at the selected month
  - Top services ranked by revenue
- Search by client and filter by month
- Running totals for the visible jobs
- **Export spreadsheet (.xlsx)** — formatted Excel workbook with a totals row
- **Export CSV** — opens in Excel, Google Sheets, Numbers, etc.
- Exports include all saved jobs, regardless of the current search or month filter
- Responsive layout (job history becomes compact cards on phones) and
  print-friendly history

## Data & backups

Entries are stored in the browser's `localStorage`, so they stay on that
computer and browser between visits. Clearing browser data will remove them.

Use **Export spreadsheet** or **Export CSV** to keep a permanent backup. Export
files are named like `serena-dang-jobs-2026-11-07.xlsx`.

## Files

- `index.html` — page structure and form
- `styles.css` — styling and responsive layout
- `app.js` — saving, editing, filtering, stats/insights, and CSV export
- `xlsx.js` — dependency-free `.xlsx` writer
