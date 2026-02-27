import { contextBridge, ipcRenderer } from "electron";

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

export interface DiscordStatus {
  connected: boolean;
  game: string | null;
}

const api = {
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke("getConfig"),
  setConfig: (partial: Partial<AppConfig>): Promise<AppConfig> => ipcRenderer.invoke("setConfig", partial),
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke("selectFolder"),
  sortClips: (): Promise<{ ok: boolean; message: string; processed?: number; skipped?: number }> => ipcRenderer.invoke("sortClips"),
  listVaultFolders: (): Promise<string[]> => ipcRenderer.invoke("listVaultFolders"),
  onVaultChanged: (fn: () => void) => {
    ipcRenderer.on("vault-changed", () => fn());
  },
  discord: {
    getStatus: (): Promise<DiscordStatus> => ipcRenderer.invoke("discord-getStatus"),
    refresh: (): Promise<void> => ipcRenderer.invoke("discord-refresh"),
    onGameChanged: (fn: (status: DiscordStatus) => void) => {
      const handler = (_: unknown, status: DiscordStatus) => fn(status);
      ipcRenderer.on("discord-game-changed", handler);
      return () => ipcRenderer.removeListener("discord-game-changed", handler);
    },
  },
  windowMinimize: () => ipcRenderer.send("window-minimize"),
  windowClose: () => ipcRenderer.send("window-close"),
  setWindowSize: (width: number, height: number) =>
    ipcRenderer.send("set-window-size", { width, height }),
};

contextBridge.exposeInMainWorld("electronAPI", api);
