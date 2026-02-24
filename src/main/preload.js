const { contextBridge, ipcRenderer } = require("electron");
const { IPC_CHANNELS } = require("./ipc");

contextBridge.exposeInMainWorld("deepworkApi", {
  invoke(channel, payload) {
    return ipcRenderer.invoke(channel, payload);
  },
  channels: IPC_CHANNELS,
  onSessionUpdated(callback) {
    ipcRenderer.on("session:updated", (_event, status) => callback(status));
  },
});
