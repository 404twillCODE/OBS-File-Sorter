# OBS File Sorter — native Windows application

This is the current desktop rebuild: a WPF interface with Overview, Folders,
Cleanup and Activity pages, a native app icon, and a hidden Python engine.
It preserves the processing routines from the original installed Python app.
The earlier Electron implementation remains at the repository root.

## Download and run

Open the repository's **Build Windows application** workflow under Actions.
Download `OBS-File-Sorter-Windows` from a successful run, extract the artifact
and its application ZIP, then run **OBS File Sorter.exe** from the extracted
folder. Keep the engine and runtime folders beside the executable.

Requires Windows x64 and the **.NET 8 Desktop Runtime**. Python is bundled;
you do not need a separate Python installation. On first launch, open Folders,
choose the source and destination folders, and save. Cleanup starts disabled.
An existing `%APPDATA%\OBS File Sorter\settings.json` is retained.

## Build

Install the .NET 8 SDK or a compatible newer SDK on Windows. From PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\windows\build.ps1
```

The script builds the WPF application, downloads checksum-verified CPython
3.13.17 x64 and keyboard 0.13.5, runs the isolated processing tests, and creates
`windows/out/OBS-File-Sorter-Windows.zip`. It does not install the application,
modify your shortcuts, start the sorter, or operate on your recordings.
The runtime ZIP retains Python's license; keyboard's wheel retains its license.

## Behavior

- F9 or F14 requests sorting after five seconds.
- Direct MP4 files in the source folder are routed by their names: backtrack
  to vertical clips, replay to horizontal clips, and other files to recordings.
- Date folders use file modification dates. Clip numbering follows the
  original Python app's entry-count-plus-one rule.
- Each date folder has `The Vault/Fortnite`, `The Vault/R.E.P.O`, and
  `The Vault/Random`. The engine copies saved MP4 files to the configured Vault
  destination and leaves existing destination files alone.
- Optional short-recording and old-date-folder cleanup retain the original
  rules. The original duration probe uses ffprobe when available; this build
  does not bundle ffprobe or replace the original fallback behavior.
- Minimize keeps the sorter running. Close exits the engine after any current
  file operation finishes. A second launch activates the existing window.

Settings and rotating logs are under `%APPDATA%\OBS File Sorter`. Personal
settings, logs, recordings and migration backups are not part of this upload.
This portable build does not automatically add a Windows Startup shortcut.

## Processing compatibility and tests

`engine/original_methods.marshal` contains nine recovered Python 3.13 code
objects from the original application. It requires Python 3.13; it is not a
cross-version source format. `original-methods.json` records their provenance
and the shipped file checksum. The adapter supplies status events, serialized
sort requests, atomic settings saves and interruptible background waits.

The tests compare each recovered method with the archived original module,
exercise routing, dates, numbering, Vault copies and scanning, both cleanup
rules, settings round trips, the five-second delay and backend communication.
All file operations in the tests use temporary folders.

To rerun against a built bundle:

```powershell
$env:OBS_SORTER_ROOT=(Resolve-Path .\windows\out\portable).Path
& .\windows\out\portable\runtime\python.exe .\windows\tests\test_sorter.py
```
