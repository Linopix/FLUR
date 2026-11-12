const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("flurBar", {
  publish(snapshot) {
    ipcRenderer.send("flur-bar", snapshot);
  },
});
