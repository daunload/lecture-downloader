import ffmpeg from 'fluent-ffmpeg';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer, { Page } from 'puppeteer';

/** 로그인 */
const loginAndNavigate = async (page: Page, id: string, pw: string) => {
	await page.goto('https://klas.kw.ac.kr');
	await page.type('#loginId', id);
	await page.type('#loginPwd', pw);

	await Promise.all([
		page.click('button[type="submit"]'),
		page.waitForFunction(
			() => location.pathname === '/std/cmn/frame/Frame.do',
			{ timeout: 30000 },
		),
	]);
};

const searchYearHakgi = async (page: Page) => {
	return await page.evaluate(async () => {
		const res = await fetch('StdHome.do', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json;charset=UTF-8' },
			body: JSON.stringify({ searchYearhakgi: null }),
			credentials: 'same-origin',
		});
		return res.json();
	});
};

const onlineContentList = async (
	page: Page,
	selectSubj,
	selectYearhakgi,
	selectChangeYn,
) => {
	return await page.evaluate(
		async (selectSubj, selectYearhakgi, selectChangeYn) => {
			const res = await fetch(
				'/std/lis/evltn/SelectOnlineCntntsStdList.do',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json;charset=UTF-8',
					},
					body: JSON.stringify({
						selectSubj: selectSubj,
						selectYearhakgi: selectYearhakgi,
						selectChangeYn: selectChangeYn,
					}),
					credentials: 'same-origin',
				},
			);
			return res.json();
		},
		selectSubj,
		selectYearhakgi,
		selectChangeYn,
	);
};

// 1단계: 동영상 다운로드 함수
const downloadVideo = async (
	videoUrl: string,
	index: number,
	downloadDir: string,
	signal?: AbortSignal,
	onProgress?: (percent: number) => void,
) => {
	const fileName = `video_${index + 1}.mp4`;
	const outputPath = path.join(downloadDir, fileName);
	try {
		const response = await fetch(videoUrl, { signal });
		if (!response.ok) throw new Error(`서버 응답 오류 ${response.status}`);

		const totalLength = response.headers.get('content-length');
		const totalBytes = totalLength ? parseInt(totalLength, 10) : 0;
		let downloadedBytes = 0;

		if (response.body) {
			const reader = response.body.getReader();
			const writer = fs.createWriteStream(outputPath);

			const stream = new ReadableStream({
				async start(controller) {
					let result = await reader.read();
					while (!result.done) {
						const { value } = result;
						downloadedBytes += value.byteLength;
						if (totalBytes > 0 && onProgress) {
							const percent =
								(downloadedBytes / totalBytes) * 100;
							onProgress(percent);
						}
						controller.enqueue(value);
						writer.write(Buffer.from(value));
						result = await reader.read();
					}
					controller.close();
					writer.end();
				},
				cancel() {
					reader.cancel();
					writer.end();
				},
			});

			// Wait for the stream to finish
			await new Promise((resolve, reject) => {
				const writable = new WritableStream({
					write() {
						// We already wrote to file in the readable stream loop
					},
					close() {
						resolve(true);
					},
					abort(err) {
						reject(err);
					},
				});
				stream.pipeTo(writable).catch(reject);

				if (signal) {
					signal.addEventListener('abort', () => {
						reject(new Error('Aborted'));
					});
				}
			});
		}

		console.log(`[다운로드 완료] ${fileName}`);
		return { success: true, path: outputPath, file: fileName };
	} catch (error) {
		if (
			error.name === 'AbortError' ||
			(error instanceof Error && error.message === 'Aborted')
		) {
			console.log(`[다운로드 취소] ${fileName}`);
		} else {
			console.error(`[다운로드 오류] ${fileName}:`, error.message);
		}
		return { success: false, file: fileName };
	}
};

// 2단계: MP3 변환 함수
const convertToMp3 = (
	filePath: string,
	convertedDir: string,
	signal?: AbortSignal,
	onProgress?: (percent: number) => void,
) => {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			return reject(new Error('Aborted'));
		}

		const inputFileName = path.basename(filePath);
		const outputFileName = `${path.parse(inputFileName).name}.mp3`;
		const outputPath = path.join(convertedDir, outputFileName);

		console.log(`[변환 시작] ${inputFileName} -> ${outputFileName}`);

		const command = ffmpeg(filePath)
			.toFormat('mp3')
			.on('progress', (progress) => {
				if (onProgress) {
					onProgress(progress.percent);
				}
			})
			.on('end', () => {
				console.log(`[변환 완료] ${outputFileName}`);
				resolve({ success: true, file: outputFileName });
			})
			.on('error', (err) => {
				if (err.message.includes('SIGKILL')) {
					console.log(`[변환 취소] ${inputFileName}`);
					reject(new Error('Aborted'));
				} else {
					console.error(`[변환 오류] ${inputFileName}:`, err.message);
					reject(err);
				}
			});

		if (signal) {
			signal.addEventListener('abort', () => {
				command.kill('SIGKILL');
			});
		}

		command.save(outputPath);
	});
};

export const downloadVideos = async (
	videoUrlList: string[],
	baseDir: string,
	onProgress?: (status: string, progress: number) => void,
	signal?: AbortSignal,
) => {
	const downloadsDir = path.join(baseDir, 'downloads');
	const convertedDir = path.join(baseDir, 'converted_mp3s');

	console.log('--- 1단계: 동영상 다운로드 시작 ---');
	if (!fs.existsSync(downloadsDir))
		fs.mkdirSync(downloadsDir, { recursive: true });

	const downloadResults = [];
	for (let i = 0; i < videoUrlList.length; i++) {
		if (signal?.aborted) break;
		const url = videoUrlList[i];
		if (onProgress) {
			onProgress(
				`동영상 다운로드 중 (${i + 1}/${videoUrlList.length})`,
				0,
			);
		}
		const result = await downloadVideo(
			url,
			i,
			downloadsDir,
			signal,
			(percent) => {
				if (onProgress) {
					onProgress(
						`동영상 다운로드 중 (${i + 1}/${videoUrlList.length})`,
						percent,
					);
				}
			},
		);
		downloadResults.push(result);
	}

	const successfulDownloads = downloadResults.filter((res) => res.success);

	console.log(
		`\n다운로드 완료: 총 ${downloadResults.length}개 중 ${successfulDownloads.length}개 성공\n`,
	);

	if (successfulDownloads.length === 0) {
		console.log('변환할 파일이 없어 작업을 종료합니다.');
		return;
	}

	// --- 2단계: 다운로드된 MP4 파일들을 MP3로 변환 ---
	console.log('--- 2단계: MP3 변환 시작 ---');
	if (!fs.existsSync(convertedDir))
		fs.mkdirSync(convertedDir, { recursive: true });

	// 변환은 서버에 부하를 줄 수 있으므로 순차적으로 진행
	for (let i = 0; i < successfulDownloads.length; i++) {
		if (signal?.aborted) break;
		const download = successfulDownloads[i];
		if (onProgress) {
			onProgress(
				`MP3 변환 중 (${i + 1}/${successfulDownloads.length})`,
				0,
			);
		}
		try {
			await convertToMp3(
				download.path,
				convertedDir,
				signal,
				(percent) => {
					if (onProgress) {
						onProgress(
							`MP3 변환 중 (${i + 1}/${successfulDownloads.length})`,
							percent,
						);
					}
				},
			);
		} catch (e) {
			if (signal?.aborted) break;
		}
	}

	console.log('\n모든 작업이 완료되었습니다.');
};

export const getOnlineClassList = async (id: string, pw: string) => {
	const browser = await puppeteer.launch({ headless: true });
	const page = await browser.newPage();

	await loginAndNavigate(page, id, pw);
	const subjects = await searchYearHakgi(page);
	browser.close();
	return subjects.atnlcSbjectList;
};

export const getClassContents = async (
	id: string,
	pw: string,
	subjectName: string,
) => {
	const browser = await puppeteer.launch({ headless: true });
	const page = await browser.newPage();

	await loginAndNavigate(page, id, pw);
	const subjects = await searchYearHakgi(page);

	const selectedSubj = subjects.atnlcSbjectList.find(
		(sbj) => sbj.subjNm === subjectName,
	);

	const onlineContents = await onlineContentList(
		page,
		selectedSubj.subj,
		selectedSubj.yearhakgi,
		'Y',
	);

	const videoIdList = onlineContents.map((content) =>
		content.starting.split('/').pop(),
	);

	const videoUrlList = videoIdList.map(
		(id) =>
			`https://kwcommons.kw.ac.kr/contents5/KW10000001/${id}/contents/media_files/screen.mp4`,
	);

	return videoUrlList;
};
