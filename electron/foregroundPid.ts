/**
 * Tracks the "last external foreground PID" without blocking the event loop.
 * Accept rule: pid > 0, pid !== process.pid, and (if discord cache has entries) pid not in discord cache.
 * Only exclude process.pid (Electron main); do not clear lastKnownExternalPid when fg is unknown.
 */

import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const FOREGROUND_POLL_MS = 2500;
const FP_SNAPSHOT_MS = 10_000;

const isFpDebug = process.env.DISCORD_DEBUG === "1";

let lastExternalPid: number | null = null;
let lastKnownExternalPid: number | null = null;
let lastRawPidForSnapshot: number | null = null;
let cachedDiscordPids: number[] = [];
let pollTimer: ReturnType<typeof setInterval> | null = null;
let snapshotTimer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;

/** Only log when rawForegroundPid or decision changes. */
let lastLoggedPid: number | null = null;
let lastLoggedDecision: "accepted" | "rejected" | null = null;
let lastLoggedReason: string | null = null;

/** Cheap cached PID -> process name. */
let processNameCache: Map<number, string> = new Map();
const CACHE_MAX = 50;

function getProcessNameAsync(pid: number): Promise<string> {
  const cached = processNameCache.get(pid);
  if (cached !== undefined) return Promise.resolve(cached);
  if (os.platform() !== "win32") return Promise.resolve("?");
  return execAsync(
    `powershell -NoProfile -Command "(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).ProcessName"`,
    { encoding: "utf-8", windowsHide: true, timeout: 800 }
  )
    .then(({ stdout }) => {
      const name = (stdout && stdout.trim()) || "?";
      if (processNameCache.size >= CACHE_MAX) {
        const first = processNameCache.keys().next().value;
        if (first !== undefined) processNameCache.delete(first);
      }
      processNameCache.set(pid, name);
      return name;
    })
    .catch(() => {
      processNameCache.set(pid, "?");
      return "?";
    });
}

/** Last raw stdout from foreground script (for [FP raw] log when pid changes). */
let lastRawStdout: string | null = null;
let lastRawPidLogged: number | null = null;

/** Get PID of the foreground window (Win32). Returns only a number or null. */
function getForegroundPidWindows(): Promise<{ pid: number | null; stdout: string }> {
  if (os.platform() !== "win32") return Promise.resolve({ pid: null, stdout: "" });
  const tmpFile = path.join(os.tmpdir(), `obs-fg-pid-${process.pid}.ps1`);
  const script = [
    'Add-Type @"',
    "using System;",
    "using System.Runtime.InteropServices;",
    "public class Win32 {",
    "  [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow();",
    "  [DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);",
    "}",
    '"@',
    "$h = [Win32]::GetForegroundWindow()",
    "$procId = 0",
    "[Win32]::GetWindowThreadProcessId($h, [ref]$procId) | Out-Null",
    "Write-Output $procId",
  ].join("\r\n");
  return new Promise((resolve) => {
    fs.writeFile(tmpFile, script, "utf-8", (err) => {
      if (err) {
        resolve({ pid: null, stdout: "" });
        return;
      }
      execAsync(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`, {
        encoding: "utf-8",
        windowsHide: true,
        timeout: 2000,
      })
        .then(({ stdout }) => {
          const trimmed = (stdout && stdout.trim()) || "";
          const n = parseInt(trimmed, 10);
          const pid = (Number.isNaN(n) || n <= 0) ? null : n;
          resolve({ pid, stdout: trimmed });
        })
        .catch(() => resolve({ pid: null, stdout: "" }))
        .finally(() => {
          try {
            if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
          } catch (_) {}
        });
    });
  });
}

function getDiscordPidsAsync(): Promise<number[]> {
  if (os.platform() !== "win32") return Promise.resolve([]);
  return execAsync(
    'powershell -NoProfile -Command "Get-Process | Where-Object { $_.ProcessName -like \'*Discord*\' } | ForEach-Object { $_.Id }"',
    { encoding: "utf-8", windowsHide: true, timeout: 2000 }
  )
    .then(({ stdout }) =>
      stdout
        .trim()
        .split(/\s+/)
        .filter((s) => /^\d+$/.test(s))
        .map((s) => parseInt(s, 10))
    )
    .catch(() => []);
}

/**
 * Accept: pid > 0, pid !== electronMainPid, and if discord cache has entries then pid not in discord cache.
 * Do NOT reject when discord cache is empty.
 */
function shouldAccept(
  pid: number,
  electronMainPid: number,
  discordPids: number[]
): { accept: boolean; reason: string } {
  if (pid <= 0 || !Number.isInteger(pid)) return { accept: false, reason: "pid invalid (0/undefined)" };
  if (pid === electronMainPid) return { accept: false, reason: "rejected (electron)" };
  if (discordPids.length > 0 && discordPids.includes(pid)) return { accept: false, reason: "rejected (isDiscordPid)" };
  return { accept: true, reason: "accepted" };
}

export function getLastExternalPid(): number | null {
  return lastExternalPid;
}

export function getLastKnownExternalPid(): number | null {
  return lastKnownExternalPid;
}

export function getDiscordPids(): number[] {
  return cachedDiscordPids;
}

export function startForegroundPidPolling(electronMainPid: number): void {
  if (pollTimer) return;

  function tick() {
    if (inFlight) return;
    inFlight = true;
    Promise.all([getForegroundPidWindows(), getDiscordPidsAsync()])
      .then(([fgResult, discordPids]) => {
        cachedDiscordPids = discordPids;
        const rawForegroundPid = fgResult.pid ?? 0;
        const rawStdout = fgResult.stdout ?? "";
        lastRawPidForSnapshot = rawForegroundPid > 0 ? rawForegroundPid : null;

        if (isFpDebug && (lastRawPidLogged !== rawForegroundPid || lastRawStdout !== rawStdout)) {
          console.log('[FP raw] pid=' + rawForegroundPid + ' stdout="' + rawStdout + '"');
          lastRawPidLogged = rawForegroundPid;
          lastRawStdout = rawStdout;
        }

        if (isFpDebug) {
          if (rawForegroundPid > 0) {
            lastExternalPid = rawForegroundPid;
            lastKnownExternalPid = rawForegroundPid;
          }
        } else {
          const { accept, reason } = shouldAccept(rawForegroundPid, electronMainPid, discordPids);
          if (accept) {
            lastExternalPid = rawForegroundPid;
            lastKnownExternalPid = rawForegroundPid;
            if (lastLoggedPid !== rawForegroundPid || lastLoggedDecision !== "accepted") {
              lastLoggedPid = rawForegroundPid;
              lastLoggedDecision = "accepted";
              lastLoggedReason = null;
              getProcessNameAsync(rawForegroundPid).then((name) => {
                console.log("[FP] pid=" + rawForegroundPid + " name=" + name + " accepted -> lastExternalPid=" + rawForegroundPid);
              });
            }
          } else {
            if (lastLoggedPid !== rawForegroundPid || lastLoggedDecision !== "rejected" || lastLoggedReason !== reason) {
              lastLoggedPid = rawForegroundPid;
              lastLoggedDecision = "rejected";
              lastLoggedReason = reason;
              const pidForName = rawForegroundPid > 0 ? rawForegroundPid : 0;
              (pidForName > 0 ? getProcessNameAsync(pidForName) : Promise.resolve("?")).then((name) => {
                console.log("[FP] pid=" + rawForegroundPid + " name=" + name + " " + reason);
              });
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        inFlight = false;
      });
  }

  tick();
  pollTimer = setInterval(tick, FOREGROUND_POLL_MS);

  if (isFpDebug) {
    snapshotTimer = setInterval(() => {
      console.log(
        "[FP] snapshot raw=" + (lastRawPidForSnapshot ?? "null") +
        " lastExternal=" + (lastExternalPid ?? "null") +
        " lastKnown=" + (lastKnownExternalPid ?? "null")
      );
    }, FP_SNAPSHOT_MS);
  }
}

export function stopForegroundPidPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (snapshotTimer) {
    clearInterval(snapshotTimer);
    snapshotTimer = null;
  }
  lastExternalPid = null;
  cachedDiscordPids = [];
}
