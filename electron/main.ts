import { app, BrowserWindow, ipcMain, dialog, Menu } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { spawn } from "child_process";
import chokidar from "chokidar";

const CONFIG_NAME = "appConfig.json";

function getConfigPath(): string {
  return path.join(app.getPath("userData"), CONFIG_NAME);
}

export interface AppConfig {
  source_folder: string;
  backtrack_folder: string;
  replay_folder: string;
  recording_folder: string;
  vault_destination_folder: string;
  auto_delete: boolean;
  delete_length_minutes: number;
  auto_delete_folders: boolean;
  delete_length_days: number;
  runOnStartup: boolean;
}

const defaultConfig: AppConfig = {
  source_folder: "",
  backtrack_folder: "",
  replay_folder: "",
  recording_folder: "",
  vault_destination_folder: "",
  auto_delete: false,
  delete_length_minutes: 5,
  auto_delete_folders: false,
  delete_length_days: 14,
  runOnStartup: false,
};

function loadConfig(): AppConfig {
  try {
    const p = getConfigPath();
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf-8");
      const data = JSON.parse(raw) as Partial<AppConfig>;
      return { ...defaultConfig, ...data };
    }
  } catch (_) {}
  return { ...defaultConfig };
}

function saveConfig(config: AppConfig): void {
  try {
    const p = getConfigPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(config, null, 2), "utf-8");
  } catch (e) {
    console.error("Save config error:", e);
  }
}

/**
 * Naming scheme: sequential with no gaps.
 * Option A: always use max+1 (never reuse numbers).
 * Scans destination for NNN.mp4 (padding=3), returns next available name.
 */
function getNextClipName(destinationDir: string, padding: number = 3): string {
  if (!fs.existsSync(destinationDir)) return String(1).padStart(padding, "0") + ".mp4";
  const files = fs.readdirSync(destinationDir);
  const ext = ".mp4";
  let max = 0;
  const re = new RegExp(`^(\\d{1,${padding}})\\.mp4$`, "i");
  for (const f of files) {
    const m = f.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  const next = max + 1;
  return String(next).padStart(padding, "0") + ext;
}

function getVideoLengthSeconds(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath,
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    proc.stdout?.on("data", (d) => { out += d; });
    proc.stderr?.on("data", () => {});
    proc.on("close", (code) => {
      if (code === 0 && out) {
        const n = parseFloat(out.trim());
        if (!Number.isNaN(n)) return resolve(n);
      }
      resolve(999999);
    });
    proc.on("error", () => resolve(999999));
    setTimeout(() => { proc.kill(); resolve(999999); }, 10000);
  });
}

function createVaultFolders(targetFolder: string): void {
  const vaultFolder = path.join(targetFolder, "The Vault");
  fs.mkdirSync(vaultFolder, { recursive: true });
  for (const sub of ["Fortnite", "R.E.P.O", "Random"]) {
    fs.mkdirSync(path.join(vaultFolder, sub), { recursive: true });
  }
}

function syncVaultFiles(targetDateFolder: string, vaultDestination: string): void {
  const vaultFolder = path.join(targetDateFolder, "The Vault");
  if (!vaultDestination || !fs.existsSync(vaultDestination) || !fs.existsSync(vaultFolder)) return;
  const destVaultFolders: Record<string, string> = {
    Fortnite: path.join(vaultDestination, "Fortnite"),
    "R.E.P.O": path.join(vaultDestination, "R.E.P.O"),
    Random: path.join(vaultDestination, "Random"),
  };
  for (const folderPath of Object.values(destVaultFolders)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  for (const sub of ["Fortnite", "R.E.P.O", "Random"]) {
    const srcDir = path.join(vaultFolder, sub);
    const destDir = destVaultFolders[sub];
    if (!fs.existsSync(srcDir)) continue;
    for (const name of fs.readdirSync(srcDir)) {
      if (!name.toLowerCase().endsWith(".mp4")) continue;
      const srcFile = path.join(srcDir, name);
      const destFile = path.join(destDir, name);
      if (fs.statSync(srcFile).isFile() && !fs.existsSync(destFile)) {
        fs.copyFileSync(srcFile, destFile);
      }
    }
  }
}

let mainWindow: BrowserWindow | null = null;
let vaultWatcher: chokidar.FSWatcher | null = null;

function ensureVaultWatcher(vaultRoot: string | undefined) {
  if (vaultWatcher) {
    vaultWatcher.close();
    vaultWatcher = null;
  }
  if (!vaultRoot || !fs.existsSync(vaultRoot)) return;
  vaultWatcher = chokidar.watch(vaultRoot, { depth: 2, ignoreInitial: true });
  vaultWatcher.on("add", () => sendVaultChanged()).on("addDir", () => sendVaultChanged()).on("unlink", () => sendVaultChanged()).on("unlinkDir", () => sendVaultChanged());
}

function sendVaultChanged() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("vault-changed");
  }
}

function createWindow() {
  const iconPath = path.join(__dirname, "..", "icon.ico");
  mainWindow = new BrowserWindow({
    width: 760,
    height: 560,
    minWidth: 400,
    minHeight: 320,
    frame: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: "#040a12",
    show: false,
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
    if (vaultWatcher) {
      vaultWatcher.close();
      vaultWatcher = null;
    }
  });
  mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow?.show());
}

async function runAutoDeleteShortFiles(): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.auto_delete || !cfg.source_folder || !fs.existsSync(cfg.source_folder)) return;
  const limitSec = cfg.delete_length_minutes * 60;
  for (const name of fs.readdirSync(cfg.source_folder)) {
    if (!name.toLowerCase().endsWith(".mp4")) continue;
    if (name.toLowerCase().includes("backtrack") || name.toLowerCase().includes("replay")) continue;
    const filePath = path.join(cfg.source_folder, name);
    try {
      if (!fs.statSync(filePath).isFile()) continue;
      const len = await getVideoLengthSeconds(filePath);
      if (len <= limitSec) fs.unlinkSync(filePath);
    } catch (_) {}
  }
}

function runAutoDeleteOldFolders(): void {
  const cfg = loadConfig();
  if (!cfg.auto_delete_folders) return;
  const days = cfg.delete_length_days;
  const cutoff = Date.now() - days * 86400 * 1000;
  const baseFolders = [cfg.backtrack_folder, cfg.replay_folder, cfg.recording_folder].filter(Boolean);
  for (const base of baseFolders) {
    if (!fs.existsSync(base)) continue;
    for (const name of fs.readdirSync(base)) {
      const dirPath = path.join(base, name);
      if (!fs.statSync(dirPath).isDirectory()) continue;
      const match = /^\d{4}-\d{2}-\d{2}$/.exec(name);
      if (!match) continue;
      try {
        const mtime = fs.statSync(dirPath).mtimeMs;
        if (mtime < cutoff) fs.rmSync(dirPath, { recursive: true });
      } catch (_) {}
    }
  }
}

function applyRunOnStartup(openAtLogin: boolean): void {
  try {
    app.setLoginItemSettings({ openAtLogin });
  } catch (_) {}
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  const config = loadConfig();
  applyRunOnStartup(config.runOnStartup);
  if (config.vault_destination_folder) {
    ensureVaultWatcher(config.vault_destination_folder);
  }
  createWindow();
  setInterval(() => { runAutoDeleteShortFiles(); }, 60 * 1000);
  setInterval(() => { runAutoDeleteOldFolders(); }, 24 * 60 * 60 * 1000);
});

app.on("window-all-closed", () => app.quit());

ipcMain.handle("getConfig", (): AppConfig => {
  return loadConfig();
});

ipcMain.handle("setConfig", (_event, partial: Partial<AppConfig>): AppConfig => {
  const current = loadConfig();
  const next = { ...current, ...partial };
  saveConfig(next);
  if (partial.vault_destination_folder !== undefined) {
    ensureVaultWatcher(next.vault_destination_folder || undefined);
  }
  if (partial.runOnStartup !== undefined) {
    applyRunOnStartup(next.runOnStartup);
  }
  return next;
});

ipcMain.handle("selectFolder", async (): Promise<string | null> => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openDirectory"],
  });
  if (canceled || !filePaths.length) return null;
  return filePaths[0];
});

ipcMain.on("window-minimize", () => mainWindow?.minimize());
ipcMain.on("window-close", () => mainWindow?.close());
ipcMain.on("set-window-size", (_event, { width, height }: { width: number; height: number }) => {
  if (mainWindow && !mainWindow.isDestroyed() && width > 0 && height > 0) {
    mainWindow.setSize(Math.round(width), Math.round(height));
  }
});

ipcMain.handle("listVaultFolders", (): string[] => {
  const config = loadConfig();
  const vaultRoot = config.vault_destination_folder;
  if (!vaultRoot || !fs.existsSync(vaultRoot)) return [];
  try {
    return fs.readdirSync(vaultRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
});

ipcMain.handle("sortClips", async (): Promise<{ ok: boolean; message: string; processed?: number; skipped?: number }> => {
  const config = loadConfig();
  const { source_folder, backtrack_folder, replay_folder, recording_folder, vault_destination_folder, auto_delete, delete_length_minutes } = config;
  if (!source_folder || !backtrack_folder || !replay_folder || !recording_folder) {
    return { ok: false, message: "Please set all required folders." };
  }
  if (!fs.existsSync(source_folder)) {
    return { ok: false, message: "Source folder does not exist." };
  }
  let files: string[];
  try {
    files = fs.readdirSync(source_folder).filter((f) => f.toLowerCase().endsWith(".mp4"));
  } catch (e) {
    return { ok: false, message: "Could not read source folder." };
  }
  if (files.length === 0) {
    return { ok: true, message: "No .mp4 files to process.", processed: 0, skipped: 0 };
  }
  const deleteLengthSeconds = delete_length_minutes * 60;
  const createdDateFolders: string[] = [];
  let processed = 0;
  let skipped = 0;
  const dateFmt = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  for (const filename of files) {
    const filePath = path.join(source_folder, filename);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch {
      skipped++;
      continue;
    }
    const mtime = stat.mtimeMs;
    const dateFolder = dateFmt(mtime);
    const isBacktrack = filename.toLowerCase().includes("backtrack");
    const isReplay = filename.toLowerCase().includes("replay");
    let targetFolder: string;
    if (isBacktrack) targetFolder = path.join(backtrack_folder, dateFolder);
    else if (isReplay) targetFolder = path.join(replay_folder, dateFolder);
    else targetFolder = path.join(recording_folder, dateFolder);
    fs.mkdirSync(targetFolder, { recursive: true });
    if (!createdDateFolders.includes(targetFolder)) createdDateFolders.push(targetFolder);
    if (auto_delete && !isBacktrack && !isReplay) {
      const len = await getVideoLengthSeconds(filePath);
      if (len <= deleteLengthSeconds) {
        try {
          fs.unlinkSync(filePath);
        } catch (_) {}
        skipped++;
        continue;
      }
    }
    const newName = getNextClipName(targetFolder, 3);
    const targetPath = path.join(targetFolder, newName);
    try {
      fs.renameSync(filePath, targetPath);
      processed++;
    } catch (_) {
      try {
        fs.copyFileSync(filePath, targetPath);
        fs.unlinkSync(filePath);
        processed++;
      } catch (_) {
        skipped++;
      }
    }
  }
  for (const dateFolder of createdDateFolders) {
    createVaultFolders(dateFolder);
    if (vault_destination_folder) syncVaultFiles(dateFolder, vault_destination_folder);
  }
  return {
    ok: true,
    message: `Done: ${processed} sorted, ${skipped} skipped.`,
    processed,
    skipped,
  };
});
