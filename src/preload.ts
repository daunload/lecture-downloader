// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('bridge', {
	getOnlineClassList: (id: string, pw: string) =>
		ipcRenderer.invoke('get-online-class-list', id, pw),
	getClassContents: (id: string, pw: string, subjectName: string) =>
		ipcRenderer.invoke('get-class-contents', id, pw, subjectName),
	selectDownloadDir: () => ipcRenderer.invoke('select-download-dir'),
	downloadVideos: (videoUrls: string[], downloadDir: string) =>
		ipcRenderer.invoke('download-videos', videoUrls, downloadDir),
});
