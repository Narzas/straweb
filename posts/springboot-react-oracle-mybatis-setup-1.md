---
title: "Spring Boot + React + Oracle + MyBatis 셋팅 — 1편: 개발 환경 준비"
date: 2026-04-12T00:00:00
description: 초보도 쉽게 따라하는 풀스택 셋팅 시리즈 1편. JDK, Node.js, Oracle XE, IDE까지 개발 환경을 처음부터 세팅합니다.
category: 개발
tags: [SpringBoot, React, Oracle, MyBatis, 풀스택, 초보자]
---

> **시리즈 목차**
> - **1편: 개발 환경 준비** ← 지금 여기
> - 2편: Spring Boot 프로젝트 생성 & Oracle 연결
> - 3편: MyBatis 설정 & CRUD API 만들기
> - 4편: React 프로젝트 생성 & Spring Boot API 연동

---

## 이 시리즈가 뭔가요?

회사에서 가장 많이 쓰는 기술 스택 중 하나가 바로 **Spring Boot + React + Oracle + MyBatis** 조합입니다. 특히 국내 SI, 금융, 공공 분야에서 거의 표준처럼 쓰입니다.

그런데 막상 처음 시작하려면 막막합니다. 어디서부터 설치해야 하는지, 왜 에러가 나는지 모르겠고... 이 시리즈는 그런 분들을 위해 **처음부터 하나씩** 같이 세팅합니다.

---

## 필요한 것 목록

| 도구 | 역할 | 버전 |
|------|------|------|
| JDK 17 | Spring Boot 실행 환경 | 17 LTS |
| Node.js | React 실행 환경 | 20 LTS |
| Oracle XE | 데이터베이스 | 21c |
| IntelliJ IDEA | 백엔드 IDE | Community 무료 |
| VS Code | 프론트엔드 IDE | 최신 |
| DBeaver | DB 관리 GUI | Community 무료 |

다 무료입니다. 걱정 마세요.

---

## 1. JDK 17 설치

### 왜 17인가요?

JDK 8, 11, 17, 21 중에서 고르라면 **17을 추천**합니다. Spring Boot 3.x 이상이 JDK 17을 최소 요구사항으로 하고 있고, 현재 LTS(장기 지원) 버전 중 가장 널리 쓰입니다.

### 설치 방법

1. [Eclipse Temurin](https://adoptium.net) 접속 (OpenJDK 무료 배포판)
2. **Temurin 17 (LTS)** 선택 → Windows x64 Installer `.msi` 다운로드
3. 설치 시 **"Add to PATH"** 옵션 반드시 체크

설치 후 터미널에서 확인:

```bash
java -version
```

```
openjdk version "17.0.x" 2024-xx-xx
```

이렇게 나오면 성공입니다.

> **JAVA_HOME 환경변수 설정 (안 되어있을 경우)**
> 
> 시스템 환경 변수 → 새로 만들기
> - 변수 이름: `JAVA_HOME`
> - 변수 값: `C:\Program Files\Eclipse Adoptium\jdk-17.x.x.x-hotspot`
>
> PATH에 `%JAVA_HOME%\bin` 추가

---

## 2. Node.js 설치

### 설치 방법

1. [nodejs.org](https://nodejs.org) 접속
2. **LTS 버전** (현재 20.x) 다운로드 및 설치
3. 기본 옵션 그대로 Next → Next → Install

확인:

```bash
node -v   # v20.x.x
npm -v    # 10.x.x
```

---

## 3. Oracle Database XE 설치

### XE가 뭔가요?

Oracle XE(Express Edition)는 Oracle DB 무료 버전입니다. CPU 2코어, 2GB RAM, 12GB 스토리지 제한이 있지만 개발·학습 용도로는 충분합니다.

### 설치 방법

1. [Oracle XE 다운로드](https://www.oracle.com/database/technologies/xe-downloads.html) → Oracle 계정 필요 (무료 가입)
2. Windows x64 ZIP 다운로드 후 압축 해제
3. `setup.exe` 실행
4. 설치 중 **SYS, SYSTEM 비밀번호 설정** — 꼭 기억해두세요!

설치 완료 후 기본 포트:
- Oracle Listener: **1521**
- Oracle EM Express: **5500**

### 설치 확인

시작 메뉴에서 **SQL Plus** 실행:

```sql
sqlplus sys/[비밀번호]@localhost:1521/XE as sysdba
```

`SQL>` 프롬프트가 뜨면 성공입니다.

### 개발용 계정 생성

SYS로 접속 후 개발에서 쓸 전용 계정을 만듭니다.

```sql
-- 사용자 생성
CREATE USER devuser IDENTIFIED BY devpass123;

-- 권한 부여
GRANT CONNECT, RESOURCE, DBA TO devuser;

-- 커넥션 가능한 테이블스페이스 허용
ALTER USER devuser QUOTA UNLIMITED ON USERS;

EXIT;
```

> `devuser` / `devpass123` 부분을 원하는 아이디/비밀번호로 바꾸세요.

---

## 4. DBeaver 설치 (DB GUI 도구)

SQL Plus는 터미널 환경이라 불편합니다. **DBeaver**를 쓰면 GUI로 편하게 DB를 관리할 수 있습니다.

1. [dbeaver.io](https://dbeaver.io/download/) → Community Edition 다운로드
2. 설치 후 실행
3. 새 연결 → Oracle 선택

연결 정보:

| 항목 | 값 |
|------|-----|
| Host | localhost |
| Port | 1521 |
| Database | XE |
| Username | devuser |
| Password | devpass123 |

**Test Connection** 클릭해서 `Connected` 뜨면 성공.

> 처음 Oracle 드라이버 설치 요청이 뜨면 **Download** 버튼 클릭하면 자동으로 설치됩니다.

---

## 5. IntelliJ IDEA 설치

Spring Boot 개발엔 IntelliJ가 압도적으로 편합니다.

1. [jetbrains.com/idea](https://www.jetbrains.com/idea/download/) → **Community Edition** (무료) 다운로드
2. 설치 시 **"Add launchers dir to the PATH"** 체크

> Community Edition으로도 Spring Boot 개발 가능합니다. Ultimate는 유료인데 DB 툴, HTTP Client 등이 추가되어 있습니다. 처음엔 Community로 충분.

---

## 6. VS Code 설치

React 개발엔 VS Code를 씁니다.

1. [code.visualstudio.com](https://code.visualstudio.com) 다운로드 설치
2. 확장 플러그인 설치 (Extensions 탭에서 검색):
   - **ES7+ React/Redux/React-Native snippets**
   - **Prettier - Code formatter**
   - **ESLint**

---

## 전체 구조 미리보기

이 시리즈를 다 따라하면 이런 구조가 완성됩니다:

```
프로젝트/
├── backend/          ← Spring Boot (포트 8080)
│   ├── src/
│   │   ├── controller/   ← API 엔드포인트
│   │   ├── service/      ← 비즈니스 로직
│   │   ├── mapper/       ← MyBatis 인터페이스
│   │   └── resources/
│   │       └── mapper/   ← SQL XML 파일
│   └── build.gradle
│
└── frontend/         ← React (포트 3000)
    ├── src/
    │   ├── pages/
    │   ├── components/
    │   └── api/          ← Spring Boot 호출
    └── package.json
```

**React(3000) → Spring Boot(8080) → Oracle(1521)** 이 흐름으로 데이터가 오갑니다.

---

## 설치 완료 체크리스트

```
☐ java -version  → openjdk 17.x.x 확인
☐ node -v        → v20.x.x 확인
☐ npm -v         → 10.x.x 확인
☐ Oracle XE 설치 & devuser 계정 생성
☐ DBeaver에서 Oracle 연결 성공
☐ IntelliJ IDEA 설치 완료
☐ VS Code 설치 완료
```

모두 체크됐나요? 그러면 다음 편으로 넘어갈 준비가 됐습니다.

---

## 다음 편 예고

**2편: Spring Boot 프로젝트 생성 & Oracle 연결**

Spring Initializr로 프로젝트를 만들고, `application.yml`에 Oracle 접속 정보를 설정하고, 실제로 DB에 붙는 것까지 해봅니다.

에러 없이 연결되는 그 순간이 생각보다 짜릿합니다 😄
