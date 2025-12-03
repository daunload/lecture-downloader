import ffmpeg from 'fluent-ffmpeg';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { pipeline } from 'node:stream/promises';
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
) => {
	const fileName = `video_${index + 1}.mp4`;
	const outputPath = path.join(downloadDir, fileName);
	try {
		const response = await fetch(videoUrl);
		if (!response.ok) throw new Error(`서버 응답 오류 ${response.status}`);
		await pipeline(response.body, fs.createWriteStream(outputPath));
		console.log(`[다운로드 완료] ${fileName}`);
		return { success: true, path: outputPath, file: fileName };
	} catch (error) {
		console.error(`[다운로드 오류] ${fileName}:`, error.message);
		return { success: false, file: fileName };
	}
};

// 2단계: MP3 변환 함수
const convertToMp3 = (filePath: string, convertedDir: string) => {
	return new Promise((resolve, reject) => {
		const inputFileName = path.basename(filePath);
		const outputFileName = `${path.parse(inputFileName).name}.mp3`;
		const outputPath = path.join(convertedDir, outputFileName);

		console.log(`[변환 시작] ${inputFileName} -> ${outputFileName}`);

		ffmpeg(filePath)
			.toFormat('mp3')
			.on('end', () => {
				console.log(`[변환 완료] ${outputFileName}`);
				resolve({ success: true, file: outputFileName });
			})
			.on('error', (err) => {
				console.error(`[변환 오류] ${inputFileName}:`, err.message);
				reject(err);
			})
			.save(outputPath);
	});
};

export const downloadVideos = async (
	videoUrlList: string[],
	baseDir: string,
) => {
	const downloadsDir = path.join(baseDir, 'downloads');
	const convertedDir = path.join(baseDir, 'converted_mp3s');

	console.log('--- 1단계: 동영상 다운로드 시작 ---');
	if (!fs.existsSync(downloadsDir))
		fs.mkdirSync(downloadsDir, { recursive: true });

	const downloadPromises = videoUrlList.map((url, index) =>
		downloadVideo(url, index, downloadsDir),
	);
	const downloadResults = await Promise.all(downloadPromises);
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
	for (const download of successfulDownloads) {
		await convertToMp3(download.path, convertedDir);
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

// (async () => {
// 	const browser = await puppeteer.launch({ headless: true });
// 	const page = await browser.newPage();

// 	try {
// 		await loginAndNavigate(page);
// 		const yearHakgi = await searchYearHakgi(page);
// 		const atnlcSbjectList = yearHakgi.atnlcSbjectList;

// 		const subjects = atnlcSbjectList.map((sbj) => sbj.subjNm);
// 		const selectedOption = await selectOption(subjects);

// 		const selectedSubj = atnlcSbjectList.find(
// 			(sbj) => sbj.subjNm === selectedOption,
// 		);

// 		const onlineContents = await onlineContentList(
// 			page,
// 			selectedSubj.subj,
// 			selectedSubj.yearhakgi,
// 			'Y',
// 		);

// 		const videoIdList = onlineContents.map((content) =>
// 			content.starting.split('/').pop(),
// 		);

// 		const videoUrlList = videoIdList.map(
// 			(id) =>
// 				`https://kwcommons.kw.ac.kr/contents5/KW10000001/${id}/contents/media_files/screen.mp4`,
// 		);
// 		await runMacro(videoUrlList);
// 	} finally {
// 		await browser.close();
// 		process.exit();
// 	}
// })();
