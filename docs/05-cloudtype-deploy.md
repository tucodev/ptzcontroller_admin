# Cloudtype.io 배포 가이드

## 목차

1. [사전 준비](#사전-준비)
2. [로컬 DB 초기화](#로컬-db-초기화)
3. [GitHub 푸시](#github-푸시)
4. [Cloudtype 배포 설정](#cloudtype-배포-설정)
5. [환경 변수 설정](#환경-변수-설정)
6. [배포 후 확인](#배포-후-확인)
7. [문제 해결](#문제-해결)

---

## 주의사항

> ⚠️ **Cloudtype 배포 전에 반드시 로컬에서 DB 마이그레이션을 완료해야 합니다.**

```bash
cd ptzcontroller_admin
yarn install
yarn prisma generate
yarn prisma migrate dev
yarn prisma db seed    # 선택 사항 (테스트 계정 생성)
```

---

## Cloudtype 설정 화면

아래 입력중 환경변수는 너무 많아서 등록하기 힘들다.
이때는 환경변수를 정리한 .env 파일을 환경변수 입력 영역에 드래그 & 드롭하면 모든 변수가 자동 입력된다.

```
형식은 아래와 같다. (정리된 변수는 cloudtype.data 폴더 참고)
PORT=4000
```

![Cloudtype 설정](./cloudtype-setup.png)

---

## 사전 준비

### 1. Neon PostgreSQL 준비

1. [console.neon.tech](https://console.neon.tech) 접속
2. 프로젝트 생성
3. Connection string 복사

### 2. 필수 파일 확인

```
ptzcontroller_admin/
├── package.json          ✅ build-cloudtype 스크립트 포함
├── next.config.js        ✅ output: "standalone" 설정
├── cloudtype.yaml        ✅ 배포 설정
└── prisma/schema.prisma  ✅ binaryTargets 포함
```

### 3. `package.json` 확인

```json
{
    "scripts": {
        "dev": "next dev",
        "build": "prisma generate && next build",
        "build-cloudtype": "prisma generate && next build",
        "rebuild": "next build",
        "start": "next start"
    },
    "engines": {
        "node": ">=18.0.0"
    }
}
```

### 4. `next.config.js` 확인

```javascript
const nextConfig = {
    output: "standalone",
    eslint: { ignoreDuringBuilds: true },
    typescript: { ignoreBuildErrors: false },
    images: { unoptimized: true },
};
module.exports = nextConfig;
```

---

## 로컬 DB 초기화

Cloudtype 배포 전 로컬에서 DB를 먼저 구성합니다.

```bash
cd ptzcontroller_admin
yarn install
yarn prisma generate
yarn prisma migrate dev --name init
yarn prisma db seed    # 선택
```

---

## GitHub 푸시

```bash
cd ptzcontroller_admin
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/username/ptzcontroller_admin.git
git push -u origin main
```

---

## Cloudtype 배포 설정

### 1. 프로젝트 생성

1. [cloudtype.io](https://cloudtype.io) 접속 → "새 프로젝트"
2. GitHub 저장소 연결 → 저장소 선택

### 2. 배포 설정값

| 항목          | 값                     |
| ------------- | ---------------------- |
| 프레임워크    | Next.js                |
| Node.js 버전  | **18**                 |
| 빌드 명령어   | `yarn build-cloudtype` |
| 시작 명령어   | `yarn start`           |
| 루트 디렉토리 | `ptzcontroller_admin`  |
| 포트          | `3000`                 |

---

## 환경 변수 설정

Cloudtype 대시보드 → 프로젝트 → **환경 변수** 탭에서 설정:

| 변수명               | 설명                                            |
| -------------------- | ----------------------------------------------- |
| `DATABASE_URL`       | Neon DB 연결 URL                                |
| `NEXTAUTH_SECRET`    | JWT 서명 키 (32자 랜덤)                         |
| `NEXTAUTH_URL`       | (선택) 배포 URL                                 |
| `DB_TYPE`            | `neon`                                          |
| `STORAGE_MODE`       | `off` (Neon만 사용)                             |
| `LICENSE_SECRET`     | 라이선스 서명 키                                |
| `LICENSE_SERVER_URL` | 라이선스 서버 URL                               |
| `JWT_SECRET`         | 관리자 JWT 서명 키                              |
| `SMTP_HOST`          | (선택) SMTP 서버 — 비밀번호 재설정 기능 사용 시 |
| `SMTP_PORT`          | (선택) 587                                      |
| `SMTP_USER`          | (선택) SMTP 계정                                |
| `SMTP_PASSWORD`      | (선택) SMTP 비밀번호                            |
| `APP_URL`            | (선택) 비밀번호 재설정 링크 URL                 |

---

## 배포 후 확인

### 1. 첫 번째 회원가입 → admin 자동 부여

배포 후 처음 가입하는 사용자는 자동으로 **admin** 권한이 부여됩니다.

### 2. admin 버튼 확인

로그인 후 헤더에 🛡️ 버튼이 표시되면 admin으로 정상 로그인된 것입니다.

### 3. Proxy 파일 업로드 (선택)

🛡️ → "Proxy 파일" 탭 → `ptz-proxy-setup.exe` 등 업로드
→ 사용자 Proxy 연결 실패 팝업에 자동으로 다운로드 링크 표시

---

## Proxy 모드 관련 주의사항

Cloudtype에 배포된 웹 서버는 **Direct 모드**에서 Private 네트워크의 PTZ 카메라에 직접 접근할 수 없습니다.

**권장 구조:**

```
[Cloudtype Web Server]   [사용자 PC]          [로컬 네트워크]
         │                    │                     │
    웹앱 호스팅   ←─ HTTPS ─── 브라우저  ─WebSocket─→  PTZ Proxy
    (UI + API)               │                     │
                             └────────────────────→ PTZ Camera
```

→ **Proxy 모드**를 사용하고, 사용자 PC에서 `ptz-proxy-electron`을 실행하세요.

---

## 문제 해결

### 빌드 실패: Prisma Client 오류

`package.json`의 `build-cloudtype` 스크립트에 `prisma generate`가 포함되어 있는지 확인.

### 빌드 실패: 메모리 부족

Cloudtype 대시보드에서 리소스 증가: CPU 1.0, Memory 1024Mi

### 로그인이 안 됨

환경 변수 `NEXTAUTH_SECRET`이 설정되었는지 확인. 설정 후 **재배포** 필요.

### DATABASE_URL 연결 실패

1. Neon URL 형식 확인: `?sslmode=require` 포함 여부
2. Neon 프로젝트가 활성 상태인지 확인
3. 변수명 대소문자 확인 (`DATABASE_URL`)

### admin 권한이 안 됨

Neon 대시보드 → SQL Editor에서 직접 수정:

```sql
SELECT email, role FROM "User";
UPDATE "User" SET role = 'admin' WHERE email = '본인이메일@example.com';
```
