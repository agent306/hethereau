# Hethereau — Zero-Install Neverness to Everness Pull Tracker

A Paimon.moe-style, local-first pull tracker for **Neverness to Everness (NTE)** paired with a **zero-install Windows `pktmon` PowerShell importer**.

## Features
- **Zero-Install PC Capture (`public/import-nte.ps1`):** Uses Windows' built-in `pktmon.exe` (Windows 10 2004+ / Windows 11) + inline C# PCAPNG & bit-shifted Unreal UDP decoder. Zero `.exe` downloads, zero third-party drivers (`Npcap`/`WinDivert`), zero memory injection.
- **Universal Format Support:** Imports zero-install `pktmon` JSON, `Anong0u0/NTE_Gacha_Exporter` (v2.1), `Golumpa/nte-exporter` (v1), and manual pulls.
- **Accurate NTE Scarborough Fair Pity Engine:**
  - **Limited Board:** 90 hard pity, 70 Board Modification soft pity, 100% featured S-Class (no 50/50).
  - **Standard Board:** 90 hard pity.
  - **Arc Research (Fork Lottery):** 60 S-Class / 80 featured guarantee with carryover.
  - **Mystery Box:** Single pulls.
  - Automatically excludes Monopoly `Points Gift` and `Slumberland` bonus rewards from pity math while keeping them visible in history.
- **100% Local-First:** Stored in browser IndexedDB with multi-profile support and JSON backup/restore.

## Quick Start
Live site: https://hethereau.pages.dev/

Local development:
```powershell
pnpm install
pnpm dev
```
Go to **Zero-Install Import** (`/import`), copy the 1-line PowerShell command, run it, flip through your in-game F3 pull history pages, press Enter (or `F9` with `-AutoPage`), and paste (`Ctrl+V`).

## Tests & Deploy
```powershell
pnpm test            # Pity engine & JSON format tests (Vitest)
pnpm test:importer   # Synthetic bit-shifted PCAPNG end-to-end test for import-nte.ps1
pnpm build           # Production static build
pnpm deploy          # Build & deploy to Cloudflare Pages (https://hethereau.pages.dev)
```

## Credits
Real item, character, arc, and banner catalog files in `public/data/` are sourced from MIT-licensed community resources: `Anong0u0/NTE_Gacha_Exporter` and `Waifus-Grace/NTE_Assets`.
