
const FOLDER_KEYS: { key: keyof AppConfig; label: string }[] = [
  { key: "source_folder", label: "Source folder" },
  { key: "backtrack_folder", label: "Backtrack folder" },
  { key: "replay_folder", label: "Replay folder" },
  { key: "recording_folder", label: "Recording folder" },
  { key: "vault_destination_folder", label: "Vault destination" },
];

let config: AppConfig = {} as AppConfig;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 250;

function getAPI() {
  if (!window.electronAPI) throw new Error("electronAPI not available");
  return window.electronAPI;
}

function showToast(message: string, type: "success" | "error" | "info" = "info") {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.className = `toast visible ${type}`;
  clearTimeout((el as unknown as { _t?: ReturnType<typeof setTimeout> })._t);
  (el as unknown as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(() => {
    el.classList.remove("visible");
  }, 3000);
}

function persistConfig(partial: Partial<AppConfig>) {
  Object.assign(config, partial);
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    saveTimeout = null;
    try {
      const api = getAPI();
      config = await api.setConfig(config);
    } catch (e) {
      showToast("Failed to save settings", "error");
    }
  }, DEBOUNCE_MS);
}

function renderFolderRows() {
  const container = document.getElementById("folderRows");
  if (!container) return;
  container.innerHTML = "";
  for (const { key, label } of FOLDER_KEYS) {
    const row = document.createElement("div");
    row.className = "folder-row";
    const id = key.replace(/_/g, "-");
    const inputId = `input-${id}`;
    row.innerHTML = `
      <label for="${inputId}">${label}</label>
      <div class="folder-input-wrap">
        <input type="text" id="${inputId}" value="${escapeHtml((config[key] as string) ?? "")}" placeholder="Select a folder" spellcheck="false" />
        <div class="path-actions">
          <button type="button" class="btn-path" title="Copy path" data-copy="${id}">&#128203;</button>
          <button type="button" class="btn-browse" data-browse="${key}">Browse</button>
        </div>
      </div>
    `;
    container.appendChild(row);
    const input = row.querySelector("input") as HTMLInputElement;
    const copyBtn = row.querySelector("[data-copy]") as HTMLButtonElement;
    const browseBtn = row.querySelector("[data-browse]") as HTMLButtonElement;
    input.addEventListener("input", () => {
      const val = input.value.trim();
      (config as Partial<AppConfig>)[key as keyof AppConfig] = val as never;
      persistConfig({ [key]: val });
    });
    copyBtn.addEventListener("click", () => {
      if (input.value) {
        navigator.clipboard.writeText(input.value);
        showToast("Path copied", "info");
      }
    });
    browseBtn.addEventListener("click", async () => {
      const folder = await getAPI().selectFolder();
      if (folder != null) {
        input.value = folder;
        (config as Partial<AppConfig>)[key as keyof AppConfig] = folder as never;
        persistConfig({ [key]: folder });
      }
    });
  }
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

const TITLE_BAR_HEIGHT = 40;
const PADDING_BOTTOM = 24;
const PADDING_X = 24;
const MIN_WIDTH = 420;
const MAX_WIDTH = 920;

let resizeScheduled: ReturnType<typeof setTimeout> | null = null;

function reportWindowSize(afterCollapse = false) {
  function measure() {
    const titlebar = document.getElementById("titlebar");
    const main = document.querySelector(".main");
    const app = document.getElementById("app");
    const width = Math.min(
      MAX_WIDTH,
      Math.max(MIN_WIDTH, (app?.scrollWidth ?? 0) + PADDING_X * 2)
    );
    const titlebarHeight = titlebar?.offsetHeight ?? TITLE_BAR_HEIGHT;
    let height: number;
    if (main) {
      const mainRect = main.getBoundingClientRect();
      const titlebarRect = titlebar?.getBoundingClientRect();
      const top = titlebarRect?.top ?? 0;
      const contentBottom = mainRect.bottom;
      height = Math.round(contentBottom - top + PADDING_BOTTOM);
    } else {
      height = titlebarHeight + (app?.offsetHeight ?? 0) + PADDING_BOTTOM;
    }
    if (height > 0 && width > 0) {
      getAPI().setWindowSize(width, height);
    }
  }
  if (resizeScheduled) {
    clearTimeout(resizeScheduled);
    resizeScheduled = null;
  }
  if (afterCollapse) {
    resizeScheduled = setTimeout(() => {
      resizeScheduled = null;
      requestAnimationFrame(() => {
        requestAnimationFrame(measure);
      });
    }, 150);
  } else {
    requestAnimationFrame(() => {
      requestAnimationFrame(measure);
    });
  }
}

function bindSettings() {
  const overlay = document.getElementById("settingsOverlay");
  const closeBtn = document.getElementById("settingsClose");
  const settingsBtn = document.getElementById("settingsBtn");
  const autoDelete = document.getElementById("autoDelete") as HTMLInputElement;
  const deleteLengthMinutes = document.getElementById("deleteLengthMinutes") as HTMLInputElement;
  const autoDeleteFolders = document.getElementById("autoDeleteFolders") as HTMLInputElement;
  const deleteLengthDays = document.getElementById("deleteLengthDays") as HTMLInputElement;

  const runOnStartup = document.getElementById("runOnStartup") as HTMLInputElement;
  function openSettings() {
    if (!overlay) return;
    autoDelete.checked = config.auto_delete;
    deleteLengthMinutes.value = String(config.delete_length_minutes);
    autoDeleteFolders.checked = config.auto_delete_folders;
    deleteLengthDays.value = String(config.delete_length_days);
    if (runOnStartup) runOnStartup.checked = config.runOnStartup;
    overlay.classList.remove("hidden");
  }

  function closeSettings() {
    overlay?.classList.add("hidden");
  }

  settingsBtn?.addEventListener("click", openSettings);
  closeBtn?.addEventListener("click", closeSettings);
  overlay?.addEventListener("click", (e) => { if (e.target === overlay) closeSettings(); });

  autoDelete?.addEventListener("change", () => {
    config.auto_delete = autoDelete.checked;
    persistConfig({ auto_delete: config.auto_delete });
  });
  deleteLengthMinutes?.addEventListener("input", () => {
    const n = parseInt(deleteLengthMinutes.value, 10);
    if (!Number.isNaN(n) && n >= 1) {
      config.delete_length_minutes = n;
      persistConfig({ delete_length_minutes: n });
    }
  });
  autoDeleteFolders?.addEventListener("change", () => {
    config.auto_delete_folders = autoDeleteFolders.checked;
    persistConfig({ auto_delete_folders: config.auto_delete_folders });
  });
  deleteLengthDays?.addEventListener("input", () => {
    const n = parseInt(deleteLengthDays.value, 10);
    if (!Number.isNaN(n) && n >= 1) {
      config.delete_length_days = n;
      persistConfig({ delete_length_days: n });
    }
  });
  runOnStartup?.addEventListener("change", () => {
    config.runOnStartup = runOnStartup.checked;
    persistConfig({ runOnStartup: config.runOnStartup });
  });
}

function init() {
  getAPI().getConfig().then((c: AppConfig) => {
    config = c;
    renderFolderRows();
    bindSettings();
    reportWindowSize();
    const setupBlock = document.querySelector(".setup-block");
    if (setupBlock instanceof HTMLDetailsElement) {
      setupBlock.addEventListener("toggle", () => {
        reportWindowSize(!setupBlock.open);
      });
    }
  }).catch((_e: unknown) => {
    document.getElementById("status")!.textContent = "Failed to load config.";
    showToast("Failed to load config", "error");
  });

  document.getElementById("btnMinimize")?.addEventListener("click", () => getAPI().windowMinimize());
  document.getElementById("btnClose")?.addEventListener("click", () => getAPI().windowClose());

  const sortBtn = document.getElementById("sortBtn");
  const statusEl = document.getElementById("status");
  sortBtn?.addEventListener("click", async () => {
    if (!statusEl) return;
    statusEl.textContent = "Sorting…";
    sortBtn.setAttribute("disabled", "true");
    try {
      const result = await getAPI().sortClips();
      statusEl.textContent = result.message;
      if (result.ok) {
        showToast(result.message, "success");
      } else {
        showToast(result.message, "error");
      }
    } catch (e) {
      statusEl.textContent = "Sort failed.";
      showToast("Sort failed", "error");
    } finally {
      sortBtn?.removeAttribute("disabled");
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
