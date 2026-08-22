export {};

declare global {
  interface Window {
    posBridge: {
      getAuthToken: () => Promise<string | null>;

      setAuthToken: (token: string) => Promise<void>;

      clearAuthToken: () => Promise<void>;

      getDeviceInfo: () => Promise<{
        hostname: string;
        platform: string;
        appVersion: string;
      }>;
    };
  }

  interface ImportMetaEnv {
    readonly VITE_API_BASE_URL?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
