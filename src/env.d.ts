/// <reference types="vite/client" />

/** Typed environment variables (see .env.example). Only `VITE_`-prefixed variables reach the browser. */
interface ImportMetaEnv {
  /** Base URL of the NestJS backend INCLUDING the `/api` prefix, e.g. http://localhost:3000/api */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
