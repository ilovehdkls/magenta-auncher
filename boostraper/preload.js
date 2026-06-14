const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('boost', {
  onProgress: (cb) => ipcRenderer.on('progress', (_, data) => cb(data)),
  close: () => ipcRenderer.send('window:close')
});
