# OBS File Sorter

Electron app to sort OBS recordings (backtrack, replay, regular) into date-based folders, with vault sync and optional auto-delete.

## Requirements (what you need on your computer)

- **Sorting clips (move/copy by date, vault sync)** — **Nothing extra.** The app uses normal file operations; no other software is required.

- **“Auto delete short files” (Settings)** — The **installer includes ffprobe** (from [FFmpeg](https://ffmpeg.org/download.html)), so you don’t need to install FFmpeg separately. The app uses it to read video duration and delete clips shorter than your chosen threshold. If you run from source (`npm run start`) without the packaged app, the app will use a bundled ffprobe from the build; you can still add FFmpeg to your PATH if you prefer.

No other downloads (Node, Python, etc.) are needed to run the built app.

## Run the app

```bash
npm i
npm run dev
```

Or build then start:

```bash
npm run build
npm run start
```

- **`npm run dev`** — Builds the app and launches Electron (use during development).
- **`npm run build`** — Compiles TypeScript (main, preload, renderer) and copies HTML/CSS into `dist/`.
- **`npm run start`** — Runs the app (run after `npm run build`).
- **`npm run dist`** — Builds the app and creates a **Windows installer** in the `release/` folder. The installer is self-contained and includes ffprobe, so end users do not need to install Node, npm, or FFmpeg; they just run the installer and get the app (including “Auto delete short files”).

## Website

A landing page lives in **`/website`** (Next.js, Tailwind, same look as FocusedOnTom). It’s deployed to **GitHub Pages** via GitHub Actions when you push changes under `website/` or the workflow file. Enable Pages in the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**. The site will be at **https://404twillcode.github.io/OBS-File-Sorter/** and includes a **Download for Windows** link to the [latest release](https://github.com/404twillCODE/OBS-File-Sorter/releases/latest).

## Where is the old code?

The previous Python/Tkinter implementation is in **`/old/`**:

- `old/file.py` — Original app logic and UI
- `old/build.py` — PyInstaller build script
- `old/requirements.txt` — Python dependencies
- `old/obs_auto_sorter_config.json` — Example config from the old app

Nothing was deleted; everything was moved into `old/` for reference.

## Where config and logs are saved

- **Config** — Stored in the app’s user data folder:
  - **Windows:** `%APPDATA%\obs-file-sorter\appConfig.json`  
    (e.g. `C:\Users\<YourName>\AppData\Roaming\obs-file-sorter\appConfig.json`)
  - That’s where folder paths and all settings (auto-delete, etc.) are saved. You can back up or edit that file if needed.
- **Logs** — The app does **not** write any log files. Errors are only sent to the system console (e.g. when you run the app from a terminal). If you run the installed `.exe` by double-clicking, you won’t see a console.

## Config persistence

- Every change in the UI (folder paths, toggles, numbers) updates in-memory state and is **persisted after a short debounce (~250 ms)**.
- No “Save” button is required; closing and reopening the app keeps all settings.

## Vault watching

- The **vault destination** folder is watched with **chokidar** (depth 2: root + immediate children).
- When you add or remove folders in the vault root (e.g. in File Explorer), the app receives **`vault-changed`** over IPC and refreshes the “Vault folders” list in the UI.
- No restart needed.

## Naming scheme (no gaps)

- Clip names are **sequential with no gaps**: `001.mp4`, `002.mp4`, `003.mp4`, …
- **Option A (implemented):** Always use **max + 1** — we never reuse numbers, even if some were deleted.
- Implemented in a single place: **`getNextClipName(destinationDir, padding)`** in `electron/main.ts`. It scans the destination for `NNN.mp4`, finds the maximum number, and returns `(max + 1)` zero-padded with `.mp4`.
