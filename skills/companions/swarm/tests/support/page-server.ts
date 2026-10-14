// `swarm open` starts the page's server detached (Slice 3): a suite spawning the CLI gives each
// test its own free port and stops the server the test started, so no test claims 4322 and
// no detached process outlives its temporary data home.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => resolve(port));
    });
  });
}

/** Stops the server whose pid file sits in `home`, if any, and waits for it to be gone. */
export function stopServer(home: string): void {
  let pid: number;
  try {
    pid = Number(fs.readFileSync(path.join(home, "swarm.pid"), "utf8"));
  } catch {
    return;
  }
  try {
    process.kill(pid);
  } catch {
    return;
  }
  const t0 = Date.now();
  for (;;) {
    try {
      process.kill(pid, 0);
    } catch {
      return; // gone
    }
    if (Date.now() - t0 > 5000) return;
    spawnSync(process.execPath, ["-e", "setTimeout(()=>{},100)"]);
  }
}
