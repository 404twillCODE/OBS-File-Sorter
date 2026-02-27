import { app, BrowserWindow, ipcMain, dialog, Menu } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { spawn } from "child_process";
import chokidar from "chokidar";
import * as discord from "./discord";

/** Path to bundled ffprobe (from @ffprobe-installer/ffprobe), or "ffprobe" to use system PATH. */
function getFfprobePath(): string {
  try {
    let p = (require("@ffprobe-installer/ffprobe") as { path: string }).path;
    if (app.isPackaged && p.includes("app.asar")) {
      p = p.replace(/app\.asar/, "app.asar.unpacked");
    }
    return p;
  } catch {
    return "ffprobe";
  }
}

const CONFIG_NAME = "appConfig.json";
const MAX_GAME_FOLDER_LENGTH = 64;
const WINDOWS_RESERVED = new Set([
  "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
]);

function getConfigPath(): string {
  return path.join(app.getPath("userData"), CONFIG_NAME);
}

/** Windows-safe folder name: trim, replace illegal chars, collapse spaces/underscores, limit length, guard reserved names. */
export function sanitizeGameFolderName(name: string): string {
  let s = String(name).trim();
  s = s.replace(/[<>:"/\\|?*]/g, "_");
  s = s.replace(/_+/g, "_").replace(/\s+/g, " ").replace(/ +/g, "_").replace(/_+/g, "_");
  s = s.replace(/^_|_$/g, "");
  if (s.length > MAX_GAME_FOLDER_LENGTH) s = s.slice(0, MAX_GAME_FOLDER_LENGTH).replace(/_$/, "");
  if (!s) s = "Unknown";
  const upper = s.toUpperCase();
  if (WINDOWS_RESERVED.has(upper)) s = s + "_";
  return s || "Unknown";
}

export type DiscordDetectionMode = "auto" | "manualOverride";

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
  discordGameDetectionEnabled: boolean;
  unknownGameFolderName: string;
  sanitizeGameNames: boolean;
  discordDetectionMode: DiscordDetectionMode;
  manualGameName: string;
  recentGames: string[];
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
  discordGameDetectionEnabled: true,
  unknownGameFolderName: "Unknown",
  sanitizeGameNames: true,
  discordDetectionMode: "auto",
  manualGameName: "",
  recentGames: [],
};

function loadConfig(): AppConfig {
  try {
    const p = getConfigPath();
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf-8");
      const data = JSON.parse(raw) as Partial<AppConfig>;
      const merged = { ...defaultConfig, ...data };
      if (!Array.isArray(merged.recentGames)) merged.recentGames = [];
      if (merged.recentGames.length > 25) merged.recentGames = merged.recentGames.slice(0, 25);
      return merged;
    }
  } catch (_) {}
  return { ...defaultConfig };
}

const RECENT_GAMES_MAX = 25;

function pushRecentGame(config: AppConfig, gameName: string): void {
  if (!gameName || gameName === config.unknownGameFolderName) return;
  const list = [...(config.recentGames || [])];
  const idx = list.indexOf(gameName);
  if (idx >= 0) list.splice(idx, 1);
  list.unshift(gameName);
  if (list.length > RECENT_GAMES_MAX) list.length = RECENT_GAMES_MAX;
  config.recentGames = list;
  saveConfig(config);
}

/** Resolve the game subfolder name for Clips/Backtrack routing (only used when detection is on). */
function getEffectiveGameFolderName(cfg: AppConfig): string {
  let raw: string;
  if (cfg.discordDetectionMode === "manualOverride" && cfg.manualGameName.trim()) {
    raw = cfg.manualGameName.trim();
  } else {
    const status = discord.getStatus();
    raw = status.game ?? cfg.unknownGameFolderName;
  }
  if (!raw) raw = cfg.unknownGameFolderName;
  return cfg.sanitizeGameNames ? sanitizeGameFolderName(raw) : raw.replace(/[<>:"/\\|?*]/g, "_").trim() || "Unknown";
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
    const ffprobe = getFfprobePath();
    const proc = spawn(ffprobe, [
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

function getVaultFolderName(vaultDestination?: string): string {
  if (!vaultDestination) return "The Vault";
  const base = path.basename(vaultDestination);
  return base || "The Vault";
}

function getVaultSubfolders(vaultDestination?: string): string[] {
  if (!vaultDestination || !fs.existsSync(vaultDestination)) return [];
  try {
    return fs
      .readdirSync(vaultDestination, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}

function createVaultFolders(targetFolder: string, vaultDestination?: string): void {
  const vaultFolderName = getVaultFolderName(vaultDestination);
  const vaultFolder = path.join(targetFolder, vaultFolderName);
  fs.mkdirSync(vaultFolder, { recursive: true });
  const subfolders = getVaultSubfolders(vaultDestination);
  for (const sub of subfolders) {
    fs.mkdirSync(path.join(vaultFolder, sub), { recursive: true });
  }
}

function syncVaultFiles(targetDateFolder: string, vaultDestination: string): void {
  if (!vaultDestination || !fs.existsSync(vaultDestination)) return;
  const vaultFolderName = getVaultFolderName(vaultDestination);
  const vaultFolder = path.join(targetDateFolder, vaultFolderName);
  if (!fs.existsSync(vaultFolder)) return;
  const subfolders = getVaultSubfolders(vaultDestination);
  for (const sub of subfolders) {
    const srcDir = path.join(vaultFolder, sub);
    const destDir = path.join(vaultDestination, sub);
    fs.mkdirSync(destDir, { recursive: true });
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
  let unsubDiscord: (() => void) | null = null;
  mainWindow.on("closed", () => {
    if (unsubDiscord) unsubDiscord();
    unsubDiscord = null;
    mainWindow = null;
    if (vaultWatcher) {
      vaultWatcher.close();
      vaultWatcher = null;
    }
  });
  mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    unsubDiscord = discord.onStatusChange((status) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("discord-game-changed", status);
      }
    });
  });
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
  discord.startPolling();
  createWindow();
  setInterval(() => { runAutoDeleteShortFiles(); }, 60 * 1000);
  setInterval(() => { runAutoDeleteOldFolders(); }, 24 * 60 * 60 * 1000);
});

app.on("before-quit", () => {
  discord.stopPolling();
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

ipcMain.handle("discord-getStatus", (): { connected: boolean; game: string | null } => discord.getStatus());
ipcMain.handle("discord-refresh", (): void => { discord.refresh(); });

ipcMain.handle("sortClips", async (): Promise<{ ok: boolean; message: string; processed?: number; skipped?: number }> => {
  const config = loadConfig();
  const { source_folder, backtrack_folder, replay_folder, recording_folder, vault_destination_folder, auto_delete, delete_length_minutes } = config;
  if (!source_folder) {
    return { ok: false, message: "Please set a source folder." };
  }
  const hasBacktrack = !!backtrack_folder;
  const hasReplay = !!replay_folder;
  const hasRecording = !!recording_folder;
  if (!hasBacktrack && !hasReplay && !hasRecording) {
    return {
      ok: false,
      message: "Please set at least one destination folder (backtrack, replay, or recording).",
    };
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
  let usedGameForRecent: string | null = null;

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
    let targetRoot: string | null = null;
    let useGameSubfolder = false;
    if (isBacktrack) {
      if (backtrack_folder) {
        targetRoot = backtrack_folder;
        useGameSubfolder = config.discordGameDetectionEnabled;
      }
    } else if (isReplay) {
      if (replay_folder) {
        targetRoot = replay_folder;
        useGameSubfolder = config.discordGameDetectionEnabled;
      }
    } else {
      if (recording_folder) targetRoot = recording_folder;
    }
    if (!targetRoot) {
      skipped++;
      continue;
    }
    const currentGame = useGameSubfolder ? getEffectiveGameFolderName(config) : null;
    if (useGameSubfolder && currentGame) {
      targetRoot = path.join(targetRoot, currentGame);
      if (currentGame !== config.unknownGameFolderName) usedGameForRecent = currentGame;
    }
    const targetFolder = path.join(targetRoot, dateFolder);
    if (process.env.NODE_ENV !== "production" && (isBacktrack || isReplay)) {
      console.log("[sortClips] usingGameFolder=" + (currentGame ?? "(none)") + " finalDir=" + targetFolder);
    }
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
  if (processed > 0 && usedGameForRecent) {
    pushRecentGame(config, usedGameForRecent);
  }
  for (const dateFolder of createdDateFolders) {
    createVaultFolders(dateFolder, vault_destination_folder);
    if (vault_destination_folder) syncVaultFiles(dateFolder, vault_destination_folder);
  }
  return {
    ok: true,
    message: `Done: ${processed} sorted, ${skipped} skipped.`,
    processed,
    skipped,
  };
});
