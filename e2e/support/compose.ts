import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const STATE_FILE = path.join(__dirname, "..", ".compose-state.json");

export interface ComposeState {
  projectName: string;
  composeFile: string;
  appPort: number;
}

export function repoRootFromE2E(): string {
  return path.resolve(__dirname, "..", "..");
}

export function resolveComposeFile(repoRoot: string): string {
  const yaml = path.join(repoRoot, "docker-compose.yaml");
  const yml = path.join(repoRoot, "docker-compose.yml");
  if (fs.existsSync(yaml)) return yaml;
  if (fs.existsSync(yml)) return yml;
  throw new Error("No docker-compose.yaml or docker-compose.yml found at repository root.");
}

export function dockerExists(): boolean {
  const check = spawnSync("docker", ["--version"], { stdio: "ignore" });
  return check.status === 0;
}

export function runOrThrow(
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv },
): string {
  const result = spawnSync("docker", args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: docker ${args.join(" ")}`,
        `exit: ${result.status}`,
        `stdout:\n${result.stdout ?? ""}`,
        `stderr:\n${result.stderr ?? ""}`,
      ].join("\n\n"),
    );
  }
  return result.stdout ?? "";
}

export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate port"));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

export async function waitForHealth(baseUrl: string, timeoutMs = 180_000): Promise<void> {
  const started = Date.now();
  let lastError = "unknown";
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        const body = (await response.json()) as { status?: string };
        if (body.status === "ok") return;
      } else {
        lastError = `HTTP ${response.status}`;
      }
    } catch (error) {
      lastError = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Timed out waiting for health at ${baseUrl}/health (${lastError})`);
}

export function saveState(state: ComposeState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

export function loadState(): ComposeState | null {
  if (!fs.existsSync(STATE_FILE)) return null;
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) as ComposeState;
}

export function clearState(): void {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
}
