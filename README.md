# OBS File Sorter

Electron app to sort OBS recordings (backtrack, replay, regular) into date-based folders, with vault sync and optional auto-delete.

## Requirements (what you need on your computer)

- **Sorting clips (move/copy by date, vault sync)** — **Nothing extra.** The app uses normal file operations; no other software is required.

- **“Auto delete short files” (Settings)** — **FFmpeg.** The app uses `ffprobe` (part of [FFmpeg](https://ffmpeg.org/download.html)) to read video duration. If FFmpeg is not installed or not on your system PATH, the app still runs and sorts clips, but it will **not** auto-delete short clips (it keeps them all). To use auto-delete:
  1. Download FFmpeg for Windows from https://ffmpeg.org/download.html (e.g. the “essentials” build).
  2. Install it and add the `bin` folder (where `ffprobe.exe` lives) to your system PATH.

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
- **`npm run dist`** — Builds the app and creates a **Windows installer** in the `release/` folder. The installer is self-contained: end users do not need to install Node, npm, or anything else; they just run the installer and get the app. (Only the optional “Auto delete short files” feature needs FFmpeg on the target PC if they want to use it.)

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
