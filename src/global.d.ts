interface AppConfig {
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

interface Window {
  electronAPI: {
    getConfig: () => Promise<AppConfig>;
    setConfig: (partial: Partial<AppConfig>) => Promise<AppConfig>;
    selectFolder: () => Promise<string | null>;
    sortClips: () => Promise<{ ok: boolean; message: string; processed?: number; skipped?: number }>;
    listVaultFolders: () => Promise<string[]>;
    onVaultChanged: (fn: () => void) => void;
    windowMinimize: () => void;
    windowClose: () => void;
    setWindowSize: (width: number, height: number) => void;
  };
}
