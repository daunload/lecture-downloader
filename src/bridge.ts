import { BrowserWindow, IpcMain, dialog } from 'electron';
import {
	downloadVideos,
	getClassContents,
	getOnlineClassList,
} from './browser';

export default class BridgeHandler {
	private abortController: AbortController | null = null;

	constructor(
		private mainWindow: BrowserWindow,
		private ipcMain: IpcMain,
	) {
		this.mainWindow = mainWindow;
		this.ipcMain = ipcMain;
		this.registerIpcEvent();
	}

	private registerIpcEvent() {
		this.ipcMain.handle(
			'get-online-class-list',
			(_, id: string, pw: string) => getOnlineClassList(id, pw),
		);

		this.ipcMain.handle(
			'get-class-contents',
			(_, id: string, pw: string, subjectName: string) =>
				getClassContents(id, pw, subjectName),
		);

		this.ipcMain.handle('select-download-dir', async () => {
			const result = await dialog.showOpenDialog(this.mainWindow, {
				properties: ['openDirectory'],
			});
			if (result.canceled) {
				return null;
			} else {
				return result.filePaths[0];
			}
		});

		this.ipcMain.handle(
			'download-videos',
			async (_, videoUrls: string[], downloadDir: string) => {
				this.abortController = new AbortController();
				try {
					await downloadVideos(
						videoUrls,
						downloadDir,
						(status, progress) => {
							this.mainWindow.webContents.send(
								'download-progress',
								status,
								progress,
							);
						},
						this.abortController.signal,
					);
				} catch (error) {
					if (this.abortController.signal.aborted) {
						console.log('Download cancelled');
					} else {
						throw error;
					}
				} finally {
					this.abortController = null;
				}
			},
		);

		this.ipcMain.handle('cancel-download', () => {
			if (this.abortController) {
				this.abortController.abort();
			}
		});
	}
}
