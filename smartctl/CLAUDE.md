# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This is a **data-analysis working directory**, not an application codebase. It holds raw NVMe SSD health data collected with `smartctl` from a fleet of storage servers, the script that collects it, and generated reports.

Contents:
- `nvme_smartctl.sh` — the data-collection script (runs on each storage host)
- `{Hostname}_{nvme_device}_smart.txt` — 143 raw smartctl dumps, one per NVMe namespace
- `NVMe_SMART_Status_Report.xlsx` — generated fleet-health report (3 sheets: per-drive summary, fleet overview, full details)

The fleet: 6 hosts (`zs-storage01`–`zs-storage06`), 143 NVMe drives total — 24 per host, except `zs-storage01` which has 23 (no `nvme18n1`). Do not assume 6×24=144. All drives are 3.2 TB.

## Data collection

`nvme_smartctl.sh` must run **as root** on a host with `smartmontools` installed. It enumerates `/dev/nvme*n1` and, for each device, writes one file containing `smartctl -a`, `smartctl -H`, and `smartctl -l error` output. Output goes to `OUTPUT_DIR` (hardcoded `/root/smartctl`), named `${HOSTNAME}_${device}_smart.txt`. The files here were gathered from the six hosts and collected into this directory for analysis.

## Raw file format

The filename is the **join key and the only source of the hostname** — file contents never contain the hostname. Always parse `{Hostname}_{nvme_device}_smart.txt` to recover those two fields.

Each file has four sections:
- header — `Device:` and collection `Date:`
- `--- SMART INFO (-a) ---` — the rich section; all analysis fields live here
- `--- HEALTH (-H) ---` — only the overall-health PASSED/FAILED line (redundant with `-a`)
- `--- ERROR LOG ---` — the error-log table (redundant with `-a`)

Fields are `Label:` followed by whitespace then a value. Sizes carry a human-readable form in brackets, e.g. `Data Units Written: 1,032,489,011 [528 TB]` — parse the bracket value.

Key fields, all in the `-a` section:
- `Model Number`, `Serial Number`, `Firmware Version`
- `Total NVM Capacity` — **fall back to `Namespace 1 Size/Capacity`** (SM1715 files omit `Total NVM Capacity`)
- `SMART overall-health self-assessment test result` — PASSED/FAILED
- `Critical Warning` (`0x00` = clean), `Temperature`, `Power On Hours`
- `Available Spare`, `Available Spare Threshold`, `Percentage Used`
- `Data Units Written` (TBW), `Data Units Read`
- `Media and Data Integrity Errors`, `Error Information Log Entries`

## Drive models present

`Model Number` is the Dell OEM name; the underlying vendor parts are:
- `Dell Express Flash NVMe P4610 3.2TB SFF` — Intel/Solidigm P4610 (×116)
- `Dell Express Flash NVMe SM1715 3.2TB SFF` — Samsung SM1715 (×12)
- `Dell Express Flash PM1725b 3.2TB SFF` — Samsung PM1725b (×12)
- `Dell Ent NVMe CM6 MU 3.2TB` — Kioxia CM6 Mixed-Use (×3)

## Analysis conventions

The XLSX report was built with these rules — keep them consistent across re-runs:
- **TBW** = the bracket value of `Data Units Written` (convert GB→TB; one lightly-used drive reports GB, not TB).
- **Write Endurance** = life remaining = `100% − Percentage Used` (the SMART wear gauge).
- **Disk Health** = the SMART overall-health self-assessment verbatim (PASSED/FAILED).
- **Summary** (Good / Warning / Not good) — derived from overall device status:
  - *Not good*: SMART FAILED, `Critical Warning` ≠ `0x00`, `Available Spare` ≤ its threshold, `Percentage Used` ≥ 100%, or media/data-integrity errors > 0.
  - *Warning*: SMART PASSED but `Available Spare` < 90% or `Percentage Used` ≥ 80%.
  - *Good*: otherwise.

### Data quirks that affect analysis

- **SM1715 wear is invisible in `Percentage Used`** — it stays at `0%` even on worn drives. Wear shows only in `Available Spare` (these drives sit at 68–82% vs. 99–100% on healthy peers). For SM1715, judge endurance from `Available Spare`, not `Percentage Used`.
- **CM6 MU drives report 52–54 `Error Information Log Entries`** with status `0xc004`. These are benign protocol-level entries, **not** media errors — do not treat them as failures. `Media and Data Integrity Errors` is the real signal, and it is `0` everywhere.

## Common commands

```bash
# count drives / list hosts
ls *_smart.txt | wc -l
ls *_smart.txt | sed -E 's/_nvme.*//' | sort -u

# inspect one drive
cat zs-storage01_nvme0n1_smart.txt

# pull one field across the whole fleet
grep -H -m1 "^Percentage Used:" *_smart.txt
grep -H -m1 "^Available Spare:" *_smart.txt

# re-collect on a host (root + smartmontools required)
bash nvme_smartctl.sh
```

The Overview sheet of the XLSX uses live formulas (`COUNTIF`/`SUM`); after editing the workbook, recalculate it with the `xlsx` skill's `scripts/recalc.py` and confirm zero formula errors before delivering.
