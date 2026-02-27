/**
 * Discord game detection via Local RPC (named pipes).
 * Frame format: 8-byte header (int32 LE opcode, int32 LE length) + UTF-8 JSON payload.
 */

import * as net from "net";
import * as os from "os";
import * as foregroundPid from "./foregroundPid";

const IPC_PIPE_PREFIX = "\\\\.\\pipe\\discord-ipc-";
const HANDSHAKE_OPCODE = 0;
const FRAME_OPCODE = 1;
const POLL_MS = 5000;
const REQUEST_TIMEOUT_MS = 1500;
const FALLBACK_GAME_TTL_MS = 30_000;
const HEARTBEAT_MS = 15_000;
const CLIENT_ID = "463151697341677579";

const isDebug =
  process.env.DISCORD_DEBUG === "1" || process.env.NODE_ENV !== "production";

export interface DiscordStatus {
  connected: boolean;
  game: string | null;
}

let lastStatus: DiscordStatus = { connected: false, game: null };
let lastKnownGame: string | null = null;
let lastKnownGameAt: number = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let statusListeners: ((status: DiscordStatus) => void)[] = [];

let currentSocket: net.Socket | null = null;
let pipeConnected = false;
let handshaken = false;
let lastPidAttempted: number | null = null;

/** Write frame: 8-byte header (int32 LE opcode, int32 LE length) + UTF-8 JSON payload. */
function writeFrame(socket: net.Socket, opcode: number, payload: object): void {
  const json = JSON.stringify(payload);
  const payloadBuf = Buffer.from(json, "utf8");
  const len = payloadBuf.length;
  const header = Buffer.allocUnsafe(8);
  header.writeInt32LE(opcode, 0);
  header.writeInt32LE(len, 4);
  socket.write(Buffer.concat([header, payloadBuf]));
}

/** Buffered reader: accumulate chunks until we have a complete frame. */
function readFrameBuffered(socket: net.Socket): Promise<{ opcode: number; data: unknown } | null> {
  if (!(socket as net.Socket & { _discordBuf?: Buffer })._discordBuf) {
    (socket as net.Socket & { _discordBuf: Buffer })._discordBuf = Buffer.alloc(0);
  }
  const buf = (socket as net.Socket & { _discordBuf: Buffer })._discordBuf;

  const tryExtract = (): { opcode: number; data: unknown } | null => {
    if (buf.length < 8) return null;
    const opcode = buf.readInt32LE(0);
    const len = buf.readInt32LE(4);
    if (buf.length < 8 + len) return null;
    const json = buf.subarray(8, 8 + len).toString("utf-8");
    (socket as net.Socket & { _discordBuf: Buffer })._discordBuf = buf.subarray(8 + len);
    let data: unknown = null;
    try {
      data = JSON.parse(json);
    } catch (_) {}
    return { opcode, data };
  };

  const extracted = tryExtract();
  if (extracted) return Promise.resolve(extracted);

  return new Promise((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      (socket as net.Socket & { _discordBuf: Buffer })._discordBuf = Buffer.concat([
        (socket as net.Socket & { _discordBuf: Buffer })._discordBuf,
        chunk,
      ]);
      const ex = tryExtract();
      if (ex) {
        socket.removeListener("data", onData);
        socket.removeListener("error", onErr);
        socket.removeListener("close", onClose);
        resolve(ex);
      }
    };
    const onErr = (e: Error) => {
      socket.removeListener("data", onData);
      socket.removeListener("close", onClose);
      reject(e);
    };
    const onClose = () => {
      socket.removeListener("data", onData);
      socket.removeListener("error", onErr);
      resolve(null);
    };
    socket.on("data", onData);
    socket.once("error", onErr);
    socket.once("close", onClose);
  });
}

function readFrameWithTimeout(socket: net.Socket): Promise<{ opcode: number; data: unknown } | null> {
  return Promise.race([
    readFrameBuffered(socket),
    new Promise<{ opcode: number; data: unknown } | null>((_, reject) => {
      setTimeout(() => {
        if (!socket.destroyed) socket.destroy();
        reject(new Error("read timeout"));
      }, REQUEST_TIMEOUT_MS);
    }),
  ]);
}

function parseActivityName(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const dataObj = o.data as Record<string, unknown> | undefined;
  const activity = (dataObj?.activity ?? o.activity) as Record<string, unknown> | undefined;
  if (activity) {
    const name = activity.name;
    if (typeof name === "string" && name.trim()) return name.trim();
    const details = activity.details;
    if (typeof details === "string" && details.trim()) return details.trim();
    const state = activity.state;
    if (typeof state === "string" && state.trim()) return state.trim();
  }
  const activities = (dataObj?.activities ?? o.activities) as unknown[] | undefined;
  if (Array.isArray(activities) && activities.length > 0) {
    for (const act of activities) {
      const a = act as Record<string, unknown>;
      const name = a.name;
      if (typeof name === "string" && name.trim()) return (name as string).trim();
    }
  }
  return null;
}

function tryConnectPipe(index: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const pipePath = `${IPC_PIPE_PREFIX}${index}`;
    const socket = net.connect(pipePath, () => resolve(socket));
    socket.on("error", reject);
    socket.setTimeout(3000, () => {
      socket.destroy();
      reject(new Error("connect timeout"));
    });
  });
}

function attachSocketDiagnostics(socket: net.Socket): void {
  if (!isDebug) return;
  socket.on("error", (e: Error) => {
    console.log("[Discord] socket error", e.message);
  });
  socket.on("close", (hadErr: boolean) => {
    console.log("[Discord] socket close hadErr=" + hadErr + " lastPid=" + (lastPidAttempted ?? "null"));
  });
}

async function ensureConnected(): Promise<net.Socket | null> {
  if (currentSocket && !currentSocket.destroyed) return currentSocket;
  currentSocket = null;
  pipeConnected = false;
  handshaken = false;
  for (let i = 0; i <= 9; i++) {
    try {
      const socket = await tryConnectPipe(i);
      socket.setTimeout(0);
      (socket as net.Socket & { _discordBuf?: Buffer })._discordBuf = Buffer.alloc(0);
      currentSocket = socket;
      pipeConnected = true;
      attachSocketDiagnostics(socket);
      socket.once("error", () => {
        if (currentSocket === socket) currentSocket = null;
      });
      socket.once("close", () => {
        if (currentSocket === socket) currentSocket = null;
      });
      return socket;
    } catch (_) {}
  }
  pipeConnected = false;
  handshaken = false;
  return null;
}

async function ensureConnectedAndHandshaken(): Promise<boolean> {
  const socket = await ensureConnected();
  if (!socket) return false;
  if (handshaken) return true;
  try {
    writeFrame(socket, HANDSHAKE_OPCODE, { v: 1, client_id: CLIENT_ID });
    const first = await readFrameWithTimeout(socket);
    if (!first) {
      if (!socket.destroyed) socket.destroy();
      currentSocket = null;
      handshaken = false;
      return false;
    }
    handshaken = true;
    return true;
  } catch (_) {
    if (socket && !socket.destroyed) socket.destroy();
    currentSocket = null;
    handshaken = false;
    return false;
  }
}

async function getActivity(pid: number): Promise<string | null> {
  const socket = currentSocket;
  if (!socket || socket.destroyed) return null;
  lastPidAttempted = pid;
  try {
    const nonce = "obs-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    const payload = { cmd: "GET_ACTIVITY", args: { pid }, nonce };
    if (isDebug) {
      console.log("[Discord debug] sending GET_ACTIVITY pid=" + pid + " nonce=" + nonce.slice(0, 20) + "...");
    }
    writeFrame(socket, FRAME_OPCODE, payload);
    const response = await readFrameWithTimeout(socket);
    if (response && response.data && isDebug) {
      const preview = JSON.stringify(response.data).slice(0, 200);
      console.log("[Discord debug] GET_ACTIVITY reply preview: " + preview + "...");
    }
    if (!response) {
      if (!socket.destroyed) socket.destroy();
      currentSocket = null;
      return null;
    }
    return response.data ? parseActivityName(response.data) : null;
  } catch (_) {
    if (socket && !socket.destroyed) socket.destroy();
    currentSocket = null;
    return null;
  }
}

async function tryFetchActivity(): Promise<DiscordStatus> {
  if (os.platform() !== "win32") {
    return { connected: false, game: null };
  }

  const connected = await ensureConnectedAndHandshaken();
  const pidToUse =
    foregroundPid.getLastExternalPid() ??
    foregroundPid.getLastKnownExternalPid() ??
    null;

  let game: string | null = null;
  if (connected && pidToUse && pidToUse > 0) {
    game = await getActivity(pidToUse);
  }
  if (connected && game === null && foregroundPid.getDiscordPids().length > 0) {
    for (const dp of foregroundPid.getDiscordPids()) {
      game = await getActivity(dp);
      if (game) break;
    }
  }

  const exposedConnected = pipeConnected && handshaken;
  if (isDebug) {
    console.log("[Discord debug] pidToUse=" + (pidToUse ?? "null") + " connected=" + exposedConnected + " game=" + (game ?? "null"));
  }

  if (game) {
    lastKnownGame = game;
    lastKnownGameAt = Date.now();
    return { connected: exposedConnected, game };
  }
  if (exposedConnected && lastKnownGame !== null && Date.now() - lastKnownGameAt <= FALLBACK_GAME_TTL_MS) {
    return { connected: true, game: lastKnownGame };
  }
  lastKnownGame = null;
  return { connected: exposedConnected, game: null };
}

function notifyListeners(status: DiscordStatus) {
  lastStatus = status;
  for (const fn of statusListeners) {
    try {
      fn(status);
    } catch (_) {}
  }
}

function poll() {
  tryFetchActivity().then((status) => {
    if (status.connected !== lastStatus.connected || status.game !== lastStatus.game) {
      if (isDebug) {
        console.log("[Discord] connected=" + status.connected + " game=" + (status.game ?? "null"));
      }
      notifyListeners(status);
    }
  }).catch((e) => {
    if (isDebug) console.warn("[Discord] poll error:", e);
    notifyListeners({ connected: false, game: null });
  });
}

function heartbeat() {
  if (!isDebug) return;
  const ext = foregroundPid.getLastExternalPid();
  const known = foregroundPid.getLastKnownExternalPid();
  console.log(
    "[Discord debug] heartbeat connected=" + lastStatus.connected +
    " game=" + (lastStatus.game ?? "null") +
    " lastExternalPid=" + (ext ?? "null") +
    " lastKnownExternalPid=" + (known ?? "null")
  );
}

export function getStatus(): DiscordStatus {
  return { ...lastStatus };
}

export function refresh(): void {
  poll();
}

export function startPolling(): void {
  if (pollTimer) return;
  foregroundPid.startForegroundPidPolling(process.pid);
  poll();
  pollTimer = setInterval(poll, POLL_MS);
  if (isDebug) {
    heartbeatTimer = setInterval(heartbeat, HEARTBEAT_MS);
  }
}

export function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (currentSocket && !currentSocket.destroyed) {
    currentSocket.destroy();
    currentSocket = null;
  }
  pipeConnected = false;
  handshaken = false;
  foregroundPid.stopForegroundPidPolling();
}

export function onStatusChange(fn: (status: DiscordStatus) => void): () => void {
  statusListeners.push(fn);
  return () => {
    statusListeners = statusListeners.filter((f) => f !== fn);
  };
}
