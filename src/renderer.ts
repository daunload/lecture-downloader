interface OnlineClass {
	subjNm: string;
	subj: string;
	yearhakgi: string;
}

declare global {
	interface Window {
		bridge: {
			getOnlineClassList: (
				id: string,
				pw: string,
			) => Promise<OnlineClass[]>;
			getClassContents: (
				id: string,
				pw: string,
				subjectName: string,
			) => Promise<string[]>;
			selectDownloadDir: () => Promise<string | null>;
			downloadVideos: (
				videoUrls: string[],
				downloadDir: string,
			) => Promise<void>;
		};
	}
}

const elements = {
	loginBtn: document.getElementById('login-btn') as HTMLButtonElement,
	idInput: document.getElementById('username') as HTMLInputElement,
	pwInput: document.getElementById('password') as HTMLInputElement,
	classListContainer: document.getElementById(
		'class-list-container',
	) as HTMLElement,
	selectDirBtn: document.getElementById(
		'select-dir-btn',
	) as HTMLButtonElement,
	selectedDirPath: document.getElementById(
		'selected-dir-path',
	) as HTMLSpanElement,
} as const;

let selectedDownloadDir: string | null = null;

const showMessage = (
	container: HTMLElement,
	message: string,
	type: 'error' | 'info' = 'info',
) => {
	const color = type === 'error' ? 'red' : 'black';
	container.innerHTML = `<p style="color: ${color};">${escapeHtml(message)}</p>`;
};

const showLoading = (container: HTMLElement, isLoading: boolean) => {
	if (isLoading) {
		container.innerHTML = '<p>Loading...</p>';
	}
};

const escapeHtml = (text: string): string => {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
};

const validateCredentials = (id: string, pw: string): boolean => {
	if (!id.trim() || !pw.trim()) {
		showMessage(
			elements.classListContainer,
			'아이디와 비밀번호를 입력해주세요.',
			'error',
		);
		return false;
	}
	return true;
};

const handleSelectDir = async () => {
	const dir = await window.bridge.selectDownloadDir();
	if (dir) {
		selectedDownloadDir = dir;
		elements.selectedDirPath.textContent = dir;
		elements.selectedDirPath.style.color = 'black';
	}
};

const handleClassClick = async (
	subjectName: string,
	id: string,
	pw: string,
) => {
	if (!selectedDownloadDir) {
		showMessage(
			elements.classListContainer,
			'먼저 다운로드 폴더를 선택해주세요.',
			'error',
		);
		return;
	}

	console.log(`Clicked subject: ${subjectName}`);
	showMessage(
		elements.classListContainer,
		`${subjectName} 강의 목록을 가져오는 중...`,
		'info',
	);

	try {
		const contents = await window.bridge.getClassContents(
			id,
			pw,
			subjectName,
		);
		console.log('Class contents:', contents);

		if (contents.length === 0) {
			showMessage(
				elements.classListContainer,
				'다운로드할 강의가 없습니다.',
				'info',
			);
			return;
		}

		showMessage(
			elements.classListContainer,
			`${contents.length}개의 강의를 다운로드 및 변환 중... (시간이 걸릴 수 있습니다)`,
			'info',
		);

		await window.bridge.downloadVideos(contents, selectedDownloadDir);

		showMessage(
			elements.classListContainer,
			'모든 작업이 완료되었습니다.',
			'info',
		);
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : 'Unknown error';
		console.error(
			'Failed to get class contents or download:',
			errorMessage,
		);
		showMessage(
			elements.classListContainer,
			`오류 발생: ${errorMessage}`,
			'error',
		);
	}
};

// 테이블 행 생성
const createClassRow = (
	cls: OnlineClass,
	id: string,
	pw: string,
): HTMLTableRowElement => {
	const row = document.createElement('tr');
	row.style.cursor = 'pointer';
	row.dataset.subjectName = cls.subjNm;

	const cell = document.createElement('td');
	cell.style.border = '1px solid #ddd';
	cell.style.padding = '8px';
	cell.textContent = cls.subjNm;

	row.appendChild(cell);
	row.addEventListener('click', () => handleClassClick(cls.subjNm, id, pw));
	return row;
};

// 수업 목록 렌더링
const renderClassList = (classes: OnlineClass[], id: string, pw: string) => {
	const container = elements.classListContainer;

	if (classes.length === 0) {
		showMessage(container, '등록된 수업이 없습니다.', 'info');
		return;
	}

	// 테이블 구조 생성
	const table = document.createElement('table');
	table.style.width = '100%';
	table.style.borderCollapse = 'collapse';
	table.style.marginTop = '20px';

	const thead = document.createElement('thead');
	const headerRow = document.createElement('tr');
	const headerCell = document.createElement('th');
	headerCell.style.border = '1px solid #ddd';
	headerCell.style.padding = '8px';
	headerCell.style.backgroundColor = '#f2f2f2';
	headerCell.style.textAlign = 'left';
	headerCell.textContent = '과목';

	headerRow.appendChild(headerCell);
	thead.appendChild(headerRow);
	table.appendChild(thead);

	// tbody 생성 및 행 추가
	const tbody = document.createElement('tbody');
	const fragment = document.createDocumentFragment();

	classes.forEach((cls) => {
		fragment.appendChild(createClassRow(cls, id, pw));
	});

	tbody.appendChild(fragment);
	table.appendChild(tbody);

	container.innerHTML = '';
	container.appendChild(table);
};

const handleLogin = async () => {
	const id = elements.idInput.value;
	const pw = elements.pwInput.value;

	if (!validateCredentials(id, pw)) {
		return;
	}

	const container = elements.classListContainer;
	showLoading(container, true);

	try {
		const onlineClassList = await window.bridge.getOnlineClassList(id, pw);
		renderClassList(onlineClassList, id, pw);
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : 'Unknown error';
		showMessage(container, `로그인 실패: ${errorMessage}`, 'error');
		console.error('Login error:', error);
	}
};

// 이벤트 리스너 등록
elements.loginBtn.addEventListener('click', handleLogin);
elements.selectDirBtn.addEventListener('click', handleSelectDir);
