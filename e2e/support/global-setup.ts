import {
  clearState,
  dockerExists,
  findFreePort,
  repoRootFromE2E,
  resolveComposeFile,
  runOrThrow,
  saveState,
  waitForHealth,
} from "./compose";

async function globalSetup() {
  if (!dockerExists()) {
    throw new Error("Docker is required for e2e tests but was not found on PATH.");
  }

  const repoRoot = repoRootFromE2E();
  const composeFile = resolveComposeFile(repoRoot);
  const appPort = Number(process.env.E2E_APP_PORT ?? (await findFreePort()));
  const projectName = `sdip_e2e_${Date.now().toString(36)}`;
  const baseUrl = `http://127.0.0.1:${appPort}`;

  const env = {
    ...process.env,
    APP_PORT: String(appPort),
  };

  clearState();
  runOrThrow(["compose", "-f", composeFile, "-p", projectName, "up", "--build", "-d"], {
    cwd: repoRoot,
    env,
  });

  await waitForHealth(baseUrl);
  process.env.E2E_BASE_URL = baseUrl;
  saveState({ projectName, composeFile, appPort });
}

export default globalSetup;
