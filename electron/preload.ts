import { contextBridge, ipcRenderer } from "electron";

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

const api = {
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke("getConfig"),
  setConfig: (partial: Partial<AppConfig>): Promise<AppConfig> => ipcRenderer.invoke("setConfig", partial),
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke("selectFolder"),
  sortClips: (): Promise<{ ok: boolean; message: string; processed?: number; skipped?: number }> => ipcRenderer.invoke("sortClips"),
  listVaultFolders: (): Promise<string[]> => ipcRenderer.invoke("listVaultFolders"),
  onVaultChanged: (fn: () => void) => {
    ipcRenderer.on("vault-changed", () => fn());
  },
  windowMinimize: () => ipcRenderer.send("window-minimize"),
  windowClose: () => ipcRenderer.send("window-close"),
  setWindowSize: (width: number, height: number) =>
    ipcRenderer.send("set-window-size", { width, height }),
};

contextBridge.exposeInMainWorld("electronAPI", api);
