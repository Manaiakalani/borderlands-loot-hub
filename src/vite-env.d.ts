/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TWITTER_BEARER_TOKEN: string;
  readonly VITE_TWITTER_API_KEY: string;
  readonly VITE_TWITTER_API_SECRET: string;
  readonly VITE_TWITTER_PROXY_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
