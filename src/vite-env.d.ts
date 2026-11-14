/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set to "false" to hide the shared demo account on the login screen. */
  readonly VITE_ENABLE_DEMO_LOGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
