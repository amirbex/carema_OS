/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set to "false" to hide the shared demo account on the login screen. */
  readonly VITE_ENABLE_DEMO_LOGIN?: string;
  /**
   * "true" runs the app fully offline: synthetic user, localStorage data and
   * local AI replies. Used by the static GitHub Pages preview build.
   */
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
