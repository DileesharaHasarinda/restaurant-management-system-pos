import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("posBridge", {
  getAuthToken: (): Promise<string | null> =>
    ipcRenderer.invoke("pos:session:get-token"),

  setAuthToken: (token: string): Promise<void> =>
    ipcRenderer.invoke("pos:session:set-token", token),

  clearAuthToken: (): Promise<void> =>
    ipcRenderer.invoke("pos:session:clear-token"),

  getDeviceInfo: (): Promise<{
    hostname: string;
    platform: string;
    appVersion: string;
  }> => ipcRenderer.invoke("pos:device-info"),
});
