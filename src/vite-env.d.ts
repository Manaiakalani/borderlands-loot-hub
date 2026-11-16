/// <reference types="vite/client" />

/**
 * Only public, non-secret values belong here. Vite inlines every `VITE_`-prefixed
 * variable into the shipped client bundle, so anything declared below is readable
 * by anyone who loads the site. Never put API credentials in `VITE_` variables.
 */
interface ImportMetaEnv {
  /** Optional public JSON endpoint to fetch SHiFT codes from. */
  readonly VITE_DATA_SOURCE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
