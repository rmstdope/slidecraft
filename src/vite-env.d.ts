/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** '1' when built for static hosting without the API server (docs site). */
  readonly VITE_STATIC?: string
}
