# 가톨릭대학교 은평성모병원 환자경험평가(CX) & VOC 지능형 분석 시스템

본 시스템은 **가톨릭대학교 은평성모병원**의 환자경험평가(CX) 정량 데이터 및 환자의 소리(VOC) 주관식 의견을 통합 분석하여, 취약부서를 자동 선별하고 맞춤형 개선 Feedback Sheet 및 Word 보고서를 생성하는 지능형 CX 컨설팅 플랫폼입니다.

---

## 1. 시스템 아키텍처 (System Architecture)

### [로컬 개발 환경]
```text
사용자 브라우저 (http://localhost:5173)
      ↓ (HttpOnly Session / credentials: "include")
React / Vite Frontend (:5173)
      ↓ (API Proxy / CORS)
Node.js Express Backend (:3001)
      ↓ (Application Default Credentials: ADC)
Vertex AI Gemini Service
```

### [Google Cloud Run 정식 운영 배포]
```text
Internet / Hospital Internal Network
          ↓
Google Cloud Run (단일 컨테이너 서비스: Port $PORT)
 ├─ Express Server & Static Frontend SPA (dist/)
 └─ Backend API (/api/auth, /api/ai)
          ↓ (Runtime Service Account: gemini-sa)
Google Vertex AI Gemini (gemini-2.5-flash)
```

---

## 2. 프로젝트 디렉토리 구조

```text
project/
│
├─ public/
│  └─ logo.png                     # 은평성모병원 공식 브랜드 로고
│
├─ src/                            # Frontend (React 19, Tailwind CSS, Lucide Icons)
│  ├─ components/
│  │  ├─ auth/
│  │  │  └─ LoginView.tsx          # 접근코드(3432) 인증 화면
│  │  ├─ dashboard/
│  │  ├─ upload/
│  │  ├─ criteria/
│  │  ├─ vulnerable/
│  │  ├─ detail/
│  │  ├─ benchmark/
│  │  ├─ feedback/
│  │  ├─ history/
│  │  └─ layout/
│  │     ├─ Header.tsx
│  │     ├─ Sidebar.tsx
│  │     └─ BrandLogoSection.tsx
│  ├─ services/
│  │  ├─ excelService.ts           # 엑셀/CSV 파싱
│  │  ├─ normalizationService.ts   # 9개 Peer Group 정규화
│  │  ├─ analysisEngine.ts         # 정량 순위/백분위/격차 산출 Engine
│  │  ├─ authService.ts            # 백엔드 인증 API 연동
│  │  ├─ aiService.ts              # 백엔드 AI API 연동
│  │  └─ exportService.ts          # Word/PDF 결과 출력
│  ├─ types/
│  └─ App.tsx
│
├─ server/                         # Backend (Node.js, Express, TypeScript)
│  ├─ index.ts                     # Express 서버 및 Vite 프록시/정적서빙 통합
│  ├─ middleware/
│  │  └─ authMiddleware.ts         # HttpOnly 세션 검증 미들웨어
│  ├─ routes/
│  │  ├─ auth.ts                   # /api/auth (login, session, logout)
│  │  └─ ai.ts                     # /api/ai (voc-analysis, root-cause, action-plan, summary)
│  ├─ services/
│  │  └─ geminiService.ts          # GoogleGenAI Vertex AI/ADC 클라이언트
│  ├─ prompts/
│  │  ├─ vocAnalysisPrompt.ts      # VOC 감성 및 주요 이슈 추출
│  │  ├─ rootCausePrompt.ts        # 저성과 원인(5-Why) 딥매칭
│  │  ├─ actionPlanPrompt.ts       # 3대 개선 과제 수립
│  │  └─ summaryPrompt.ts          # 총평 및 이행 지침
│  └─ types/
│     └─ aiTypes.ts
│
├─ .env.example                    # 환경변수 템플릿
├─ package.json                    # 통합 패키지 정보 및 빌드 스크립트
└─ README.md                       # 가이드 문서
```

---

## 3. 로컬 개발 및 테스트 실행 가이드 (Windows 환경)

Windows 명령 프롬프트(`cmd`) 또는 PowerShell에서 아래 단계를 순서대로 진행합니다.

### 1단계: 프로젝트 패키지 설치
```cmd
npm.cmd install
```

### 2단계: 환경변수 파일(.env) 작성
`.env.example` 파일을 복사하여 `.env` 파일 생성:
```cmd
copy .env.example .env
```
`.env` 파일 내용 편집:
```env
PORT=3001
FRONTEND_ORIGIN=http://localhost:5173
APP_ACCESS_CODE=3432
SESSION_SECRET=eunpyeong-hospital-cx-secret-2026
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=global
GEMINI_MODEL=gemini-2.5-flash
VITE_API_BASE_URL=http://localhost:3001
```

### 3단계: Google Cloud SDK 로그인 및 ADC 설정
```cmd
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud auth application-default login
```
*(주의: 소스 코드나 Git Repository에 Service Account 키 JSON 파일을 직접 포함하거나 저장하지 마세요. ADC가 자동으로 인증을 관리합니다.)*

### 4단계: Frontend + Backend 동시 실행
```cmd
npm.cmd run dev:all
```
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

### 5단계: 시스템 접속 및 로그인
- 브라우저 접속: `http://localhost:5173`
- 초기 접근코드 입력: `3432`

---

## 4. Google Cloud Run 정식 운영 배포 가이드 (Production Deployment)

정식 운영 환경에서는 **Runtime Service Account**와 **Build Service Account**를 최소권한 원칙(Principle of Least Privilege)에 따라 엄격히 분리하여 배포합니다.

### 1. IAM 계정 역할 분리

#### A. Runtime Service Account (`gemini-sa`)
- **계정명**: `gemini-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com`
- **역할**: Cloud Run 컨테이너가 실행 중 Vertex AI API를 호출할 때 사용하는 실행 계정입니다.
- **최소 권한 역할**:
  - `roles/aiplatform.user` (Vertex AI 사용자)

#### B. Build Service Account (`cx-build-sa`)
- **계정명**: `cx-build-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com`
- **역할**: Cloud Build를 통해 소스 코드 및 컨테이너를 빌드할 때 사용하는 전용 빌드 계정입니다.
- **최소 권한 역할**:
  - `roles/run.builder` (Cloud Run 빌드 생성자)
  - `roles/artifactregistry.writer` (아티팩트 저장소 쓰기 권한)
  - `roles/logging.logWriter` (로그 기록 권한)
*(Owner/Editor 권한 절대 부여 금지)*

---

### 2. 초기 테스트(PoC) 배포 명령
```cmd
gcloud run deploy cx-analysis-app ^
  --source . ^
  --region asia-northeast3 ^
  --service-account gemini-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com ^
  --allow-unauthenticated
```

---

### 3. 정식 운영(Production) 배포 명령
Build 계정과 Runtime 계정을 분리하여 배포합니다:

#### [Windows CMD]
```cmd
gcloud run deploy cx-analysis-app ^
  --source . ^
  --region asia-northeast3 ^
  --service-account gemini-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com ^
  --build-service-account projects/YOUR_PROJECT_ID/serviceAccounts/cx-build-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com ^
  --set-env-vars APP_ACCESS_CODE=3432,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,GOOGLE_CLOUD_LOCATION=global,GEMINI_MODEL=gemini-2.5-flash ^
  --allow-unauthenticated
```

#### [PowerShell / Bash]
```bash
gcloud run deploy cx-analysis-app \
  --source . \
  --region asia-northeast3 \
  --service-account gemini-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --build-service-account projects/YOUR_PROJECT_ID/serviceAccounts/cx-build-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars APP_ACCESS_CODE=3432,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,GOOGLE_CLOUD_LOCATION=global,GEMINI_MODEL=gemini-2.5-flash \
  --allow-unauthenticated
```

---

### 4. Secret Manager 연동 (운영 보안 권장)
정식 운영 환경에서는 `APP_ACCESS_CODE` 및 `SESSION_SECRET`을 Google Secret Manager에 등록하여 전달할 수 있습니다:
```bash
gcloud run deploy cx-analysis-app \
  --source . \
  --region asia-northeast3 \
  --service-account gemini-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --set-secrets APP_ACCESS_CODE=cx-app-access-code:latest,SESSION_SECRET=cx-session-secret:latest
```

---

## 5. 보안 및 데이터 보호 원칙 (Security & Data Governance)

1. **Frontend API Key & Secret 노출 금지**:
   - 프론트엔드 코드나 브라우저 번들에는 어떠한 Gemini API Key나 접근코드(`3432`)도 하드코딩되지 않으며, 모든 AI 호출은 백엔드 프록시(`/api/ai/*`)를 거칩니다.
2. **HttpOnly 세션 보안**:
   - 쿠키 `cx_session`은 HttpOnly, SameSite=Lax 설정으로 관리되어 XSS 공격으로부터 안전합니다.
3. **휘발성 메모리 데이터 처리**:
   - 업로드된 환자경험평가 엑셀 데이터 및 VOC 원문은 백엔드 영구 DB에 저장되지 않고 클라이언트/메모리 상에서 실시간 분석 후 보고서 형태로 다운로드됩니다.
4. **개인정보 비식별화 필터링**:
   - 환자명, 병록번호, 주치의 실명 등 민감 정보는 AI 전송 전 `PrivacyService` 비식별화 필터를 거쳐 Masking 처리됩니다.

---

## 6. 헬스체크 (Health Check) API

- **백엔드 서버 상태 점검**: `GET /api/health`
  ```json
  {
    "status": "ok",
    "service": "cx-analysis-backend"
  }
  ```
- **AI 서비스 연결 점검**: `GET /api/ai/health`
  ```json
  {
    "status": "ok",
    "model": "gemini-2.5-flash",
    "project": "your-project-id"
  }
  ```
