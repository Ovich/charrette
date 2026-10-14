// Pidfile + portfile next to the sqlite in the data home: how `open` and `status`
// find a running server. One data home = one server, shared by every project.
import fs from "node:fs";
import path from "node:path";
import { DATA_ROOT, ensureHome } from "./home.ts";

export const PID_FILE = path.join(DATA_ROOT, "aiview.pid");
export const PORT_FILE = path.join(DATA_ROOT, "aiview.port");

export interface ServerStatus {
  running: boolean;
  pid: number | null;
  port: number | null;
  /** Files exist but the process is dead — safe to overwrite. */
  stale: boolean;
}

const readInt = (f: string): number | null => {
  try {
    const n = Number(fs.readFileSync(f, "utf8").trim());
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
};

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

export function writeServerFiles(port: number): void {
  ensureHome();
  fs.writeFileSync(PID_FILE, String(process.pid));
  fs.writeFileSync(PORT_FILE, String(port));
}

export function clearServerFiles(): void {
  // only clear our own files — a newer server may have overwritten them
  if (readInt(PID_FILE) === process.pid) {
    try {
      fs.rmSync(PID_FILE, { force: true });
      fs.rmSync(PORT_FILE, { force: true });
    } catch {}
  }
}

export function readServerStatus(): ServerStatus {
  const pid = readInt(PID_FILE);
  const port = readInt(PORT_FILE);
  if (pid === null || port === null) return { running: false, pid: null, port: null, stale: pid !== null || port !== null };
  if (!alive(pid)) return { running: false, pid, port, stale: true };
  return { running: true, pid, port, stale: false };
}
