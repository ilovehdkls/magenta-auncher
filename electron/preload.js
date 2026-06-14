const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('magenta', {
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),
  getPaths: () => ipcRenderer.invoke('app:getPaths'),
  getHwid: () => ipcRenderer.invoke('app:getHwid'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  copyText: (text) => ipcRenderer.invoke('clipboard:writeText', text),
  loadStore: () => ipcRenderer.invoke('store:load'),
  saveStore: (data) => ipcRenderer.invoke('store:save', data),
  login: (payload) => ipcRenderer.invoke('auth:login', payload),
  register: (payload) => ipcRenderer.invoke('auth:register', payload),
  activate: (payload) => ipcRenderer.invoke('auth:activate', payload),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getSession: () => ipcRenderer.invoke('auth:session'),
  installClient: (client) => ipcRenderer.invoke('client:install', client),
  launchClient: (client) => ipcRenderer.invoke('client:launch', client),
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  openFolder: (folder) => ipcRenderer.invoke('shell:openFolder', folder),
  onInstallProgress: (cb) => ipcRenderer.on('client:installProgress', (_, data) => cb(data)),
  onProtectionThreat: (cb) => ipcRenderer.on('protection:threat', () => cb())
});
