# OBS File Sorter

The latest desktop version is the **native Windows application** in [`windows/`](windows/).
It has a cleaner WPF interface, Overview/Folders/Cleanup/Activity navigation,
a native app icon and a hidden processing engine that preserves the original
Python sorter's file handling.

## Get the new Windows version

Open [Build Windows application](https://github.com/404twillCODE/OBS-File-Sorter/actions/workflows/build-windows.yml),
select a successful run, and download the **OBS-File-Sorter-Windows** artifact.
Extract the artifact and application ZIP, then launch **OBS File Sorter.exe**.
Windows x64 and the .NET 8 Desktop Runtime are required; Python is included.

For source builds, tests, settings locations and behavior details, see the
[Windows application guide](windows/README.md). Your existing local settings,
logs, recording files and migration backups are not uploaded.

## Previous implementations

- The earlier Electron/TypeScript version remains in `electron/` and `src/`,
  with its original npm build scripts. See the [Electron guide](docs/electron.md).
- The original Python/Tkinter source remains in `old/`.
- The existing landing page remains in `website/`.

The native build is published as an Actions artifact. Earlier GitHub release
installers and the website's existing download link refer to older versions.
