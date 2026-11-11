/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** '1' in the build:cap:dev test APK: every dev item is on without ?dev=1. */
  readonly VITE_SOW_DEV?: string;
}
