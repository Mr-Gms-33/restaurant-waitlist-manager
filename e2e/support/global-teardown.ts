import { clearState, loadState, repoRootFromE2E, runOrThrow } from "./compose";

function globalTeardown() {
  const state = loadState();
  if (!state) return;

  const repoRoot = repoRootFromE2E();
  try {
    runOrThrow(
      [
        "compose",
        "-f",
        state.composeFile,
        "-p",
        state.projectName,
        "down",
        "-v",
        "--remove-orphans",
      ],
      { cwd: repoRoot, env: process.env },
    );
  } finally {
    clearState();
  }
}

export default globalTeardown;
