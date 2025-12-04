# 🎓 온라인 강의 다운로더

온라인 강의 동영상을 다운로드하고 MP3 오디오 파일로 변환하는 Electron 기반 데스크톱 애플리케이션입니다.

<img width="798" height="599" alt="Image" src="https://github.com/user-attachments/assets/af973281-c3a5-4977-94b9-7be4abbfdf30" />

<img width="798" height="599" alt="Image" src="https://github.com/user-attachments/assets/4e5332c1-e033-45ad-a590-81d656265c2a" />


## ✨ 주요 기능

- 📚 수강 중인 강의 목록 조회
- 📥 온라인 강의 동영상 일괄 다운로드
- 🎵 MP4 동영상을 MP3 오디오 파일로 자동 변환

## 🚀 실행 방법

### 1. 사전 요구사항

- **Chrome 브라우저** (Puppeteer 사용을 위해 필수)

### 2. 의존성 설치

```bash
npm ci
```

### 3. 개발 모드로 실행

```bash
npm start
```

### 4. 애플리케이션 빌드

#### macOS용 빌드

```bash
npm run dist:mac
```

#### Windows용 빌드

```bash
npm run dist:win
```

#### 모든 플랫폼용 빌드

```bash
npm run dist
```

빌드된 파일은 `dist` 폴더에 생성됩니다.

## ⚠️ 주의사항

### 🔴 필수 설치 항목

**Chrome 브라우저 설치 필수**

    - Puppeteer는 Chrome/Chromium 브라우저를 사용하여 웹 페이지를 자동화합니다
    - Chrome이 설치되어 있지 않으면 프로그램이 정상적으로 작동하지 않을 수 있습니다

### 📋 기타 주의사항

- ⚖️ 이 프로그램은 개인 학습 목적으로만 사용하세요
- 📝 다운로드한 강의 자료의 저작권을 존중하세요
- 🌐 인터넷 연결이 필요합니다
- 💾 충분한 저장 공간을 확보하세요 (동영상 파일은 용량이 큽니다)

## 🛠️ 기술 스택

- **Electron** - 크로스 플랫폼 데스크톱 애플리케이션 프레임워크
- **Puppeteer** - 헤드리스 Chrome 자동화
- **FFmpeg** - 동영상/오디오 변환
- **TypeScript** - 타입 안정성
- **Vite** - 빌드 도구

## 📝 사용 방법

1. 프로그램 실행
2. KLAS 아이디와 비밀번호 입력
3. 저장할 폴더 선택
4. 다운로드할 강의 선택
5. 다운로드 및 변환 완료 대기

다운로드된 파일은 선택한 폴더의 `downloads` 폴더에 저장되고, 변환된 MP3 파일은 `converted_mp3s` 폴더에 저장됩니다.
