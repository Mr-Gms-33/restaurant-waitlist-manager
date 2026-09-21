/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the FastAPI backend's API, e.g. http://localhost:8000/api/v1 */
  readonly VITE_API_BASE_URL?: string;
  /** Set to "true" to run against the in-memory mock instead of the real backend. */
  readonly VITE_USE_MOCK_BACKEND?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
