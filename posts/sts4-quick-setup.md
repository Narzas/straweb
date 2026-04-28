---
title: "STS4 5분 셋팅 — 첫 출근 첫날 바로 코딩 시작하기"
date: 2026-04-28T15:00:00+09:00
description: SI·금융·공기업 신입이 첫 출근하자마자 STS4를 5분 만에 셋팅해서 바로 코딩 시작하는 방법. JDK 매핑·UTF-8 인코딩 4군데·Lombok·Boot Dashboard까지 2026년 최신 기준 가이드입니다.
category: 개발
tags: [STS, SpringToolSuite, SpringBoot, IDE, 셋팅, 초보자, SI, 공기업, 신입, JDK17, Lombok]
cover: /images/dev/sts-quick-setup.svg
---

첫 출근날, 사수가 USB 던지면서 "이거 깔고 점심 먹고 와" 하고 사라지는 그 상황. 회사가 IntelliJ 안 사주고 STS만 쓰라고 할 때, **5분 안에** 코딩 시작 가능한 상태까지 만드는 방법을 정리합니다.

검색하면 STS3 시절(2018~2020) 글이 대부분이라 화면이 다르고 메뉴 위치도 안 맞습니다. 이 글은 **STS 4.21 + JDK 17** 기준입니다.

![STS4 5분 셋팅](/images/dev/sts-quick-setup.svg)

---

## 누구한테 필요한 글인가요?

- SI·금융·공기업 신입으로 첫 출근한 분
- 회사가 IntelliJ 라이선스 안 사주고 **STS만 강요**하는 환경
- 이미 STS 깔아봤는데 한글이 `???`로 깨져서 빡친 분
- 사수가 "그냥 알아서 해" 라고 하고 사라진 분

순서대로만 따라가면 막히지 않습니다.

---

## 1단계. STS4 다운로드 (1분)

[spring.io/tools](https://spring.io/tools) 접속 → 자기 OS 골라서 다운로드.

- **Windows**: `.zip` (win32.x86_64)
- **macOS**: `.dmg`
- **Linux**: `.tar.gz`

**중요**: STS는 Eclipse 기반이라 **설치 마법사가 없습니다**. 그냥 압축 파일이에요.

> **왜 설치 프로그램이 없나요?**
>
> Eclipse 계열은 "압축 풀면 그게 설치 끝"이라는 철학을 따릅니다. 레지스트리에 뭐 박지도 않고, 시스템 PATH에도 안 건드립니다. 회사 노트북에서 관리자 권한 없이도 동작한다는 게 큰 장점이에요.

---

## 2단계. 압축 풀고 워크스페이스 만들기 (30초)

압축은 **C 드라이브 루트** 또는 **사용자 폴더 하위**에 풀어주세요. `Program Files` 같은 권한 필요한 경로는 피합니다 (나중에 Lombok 설치 때 권한 에러 납니다).

```
C:\sts-4.21.0.RELEASE\
└── SpringToolSuite4.exe   ← 더블클릭
```

처음 실행하면 **Workspace 경로**를 물어봅니다. 기본값 그대로 `Use this as the default and do not ask again` 체크하고 Launch.

---

## 3단계. JDK 17 매핑 (1분)

`Window > Preferences > Java > Installed JREs`

![Installed JREs 화면](/images/dev/sts-jre-mapping.svg)

1. **Add...** → Standard VM 선택
2. JRE home에 JDK 17 설치 폴더 지정 (`C:\Program Files\Java\jdk-17` 등)
3. Finish
4. 추가된 JDK 17 옆 **체크박스** 클릭 → Default 지정
5. Apply and Close

> **왜 명시적으로 매핑하나요?**
>
> STS는 처음 켜질 때 시스템 PATH에 잡힌 JRE를 자동으로 찾습니다. 그런데 회사 노트북에는 **JDK 8과 17이 같이 깔려있는 경우**가 많아요. 자동 인식이 JDK 8을 잡으면 Spring Boot 3.x 프로젝트가 통째로 안 뜹니다. 그래서 명시적으로 17을 default로 박아둡니다.

JDK가 아예 없다면 [Eclipse Temurin](https://adoptium.net) 에서 무료로 받으세요. Oracle JDK는 회사용 라이선스 이슈가 있어서 Temurin이 안전합니다.

---

## 4단계. UTF-8 인코딩 4군데 박기 (★ 핵심, 1분 30초)

**이 글에서 제일 중요한 부분입니다.** 한글이 `???`로 깨져서 회의록 PR에서 사수에게 욕먹는 그 사건, 여기서 막아둡니다.

![UTF-8 박는 4군데](/images/dev/sts-encoding-map.svg)

### 4-1. Workspace 전역 인코딩

`Window > Preferences > General > Workspace`

→ 하단 **Text file encoding** → Other 선택 → **UTF-8**

### 4-2. Web 파일들 (CSS · HTML · JSP)

`Window > Preferences > Web` 아래 세 항목 모두:

- **CSS Files** → Encoding: ISO 10646/Unicode(UTF-8)
- **HTML Files** → Encoding: ISO 10646/Unicode(UTF-8)
- **JSP Files** → Encoding: ISO 10646/Unicode(UTF-8)

JSP 안 쓴다고 빼지 마세요. 회사 레거시 프로젝트에서 갑자기 튀어나옵니다.

### 4-3. Content Types

`Window > Preferences > General > Content Types`

- **Text > Java Source File** 선택 → Default encoding: `UTF-8` 입력 → Update
- **Text > CSS · HTML · JSP** 도 동일하게 처리

### 4-4. 프로젝트 단위 재설정

전역 설정을 해도 **이미 만든 프로젝트는 자동 적용 안 됩니다.** 기존 프로젝트가 있다면:

`프로젝트 우클릭 > Properties > Resource > Text file encoding > UTF-8`

> **왜 4군데 다 박나요?**
>
> Eclipse 계열의 인코딩 설정은 **상속 구조**입니다. Workspace → Content Type → 파일 타입별 설정 → 프로젝트 설정 순으로 덮어쓰기 됩니다. 한 군데라도 빠지면 그 영역만 시스템 기본값(Windows = MS949)으로 떨어져서, 거기서만 한글이 깨집니다. 그래서 한꺼번에 다 박아두는 거예요.
>
> 한 번 깨진 한글은 **복구 불가능**합니다. 셋팅 먼저, 코딩은 그 다음입니다.

---

## 5단계. Lombok 설치 (1분)

Spring Boot 프로젝트에서 `@Getter`, `@Setter`, `@RequiredArgsConstructor` 같은 어노테이션을 쓰려면 IDE에 Lombok이 인식되어야 합니다.

![Lombok Installer](/images/dev/sts-lombok-installer.svg)

1. [projectlombok.org](https://projectlombok.org) 접속 → **Download** 클릭 → 최신 jar 다운
2. 다운받은 폴더로 이동 → `lombok-1.18.x.jar` **더블클릭**
   - 안 열리면 PowerShell에서 `java -jar lombok-1.18.x.jar`
3. 인스톨러가 시스템 IDE를 자동 검색합니다 → STS4 경로 자동 감지
4. STS 옆 체크박스 ✓ → **Install / Update** 클릭
5. STS 재시작 (중요!)

> **왜 별도 설치인가요? Maven 의존성으로 충분하지 않나요?**
>
> Lombok은 **컴파일 시점에 코드를 자동 생성**하는 라이브러리입니다. Maven에 의존성을 추가하면 빌드는 되지만, IDE는 별도로 설정해줘야 빨간 줄이 안 그어집니다. jar 실행은 `SpringToolSuite4.ini` 파일에 `-javaagent:lombok.jar` 라인을 자동으로 추가해줘요. 직접 ini 파일 건드리는 것보다 인스톨러가 안전합니다.

설치 후 STS 재시작 안 하면 적용 안 됩니다. 꼭 재시작.

---

## 6단계. Boot Dashboard 켜기 (15초)

`Window > Show View > Other > Spring > Boot Dashboard`

![Boot Dashboard](/images/dev/sts-boot-dashboard.svg)

이게 **STS의 진짜 핵심 기능**입니다. Spring Boot 앱을 클릭 한 번으로 Run / Debug / Stop / Restart 가능. IntelliJ의 Run 버튼이랑 같은 역할이에요.

여기서 앱을 Run하면 자동으로 활성 프로파일, 포트, PID까지 한눈에 보입니다. 디버그 모드 토글도 바로 가능.

---

## 7단계. 자주 쓰는 단축키 5개

| 단축키 | 기능 |
|---|---|
| `Ctrl + Shift + R` | 파일 빠른 검색 (Resource) |
| `Ctrl + Shift + T` | 클래스(타입) 빠른 검색 |
| `Ctrl + .` | 다음 에러로 이동 |
| `Ctrl + 1` | Quick Fix (자동 import, 자동 변수 선언 등) |
| `Ctrl + Shift + O` | import 정리 |

**`Ctrl + 1`** 하나만 익혀도 코딩 속도가 두 배가 됩니다. 빨간 줄 그어진 곳에서 누르면 거의 다 해결돼요.

---

## 8단계. 첫 프로젝트 만들고 검증 (1분)

`File > New > Spring Starter Project`

| 항목 | 값 |
|---|---|
| Type | Maven |
| Java Version | **17** |
| Packaging | Jar |
| Language | Java |

Next → **Dependencies** 에서 `Spring Web`, `Lombok` 두 개 체크 → Finish.

Boot Dashboard에서 프로젝트 선택 → **▶ Run** → 콘솔에 `Started Application in X.X seconds` 뜨면 성공.

브라우저에서 `http://localhost:8080` 접속해서 White Label Error Page 뜨면 셋팅 완료입니다. (404 같지만 Spring Boot가 정상 동작 중이라는 뜻)

---

## 자주 막히는 5가지

### "JRE not found" 에러

→ 3단계 누락. Installed JREs에 JDK 17 등록 안 됨. 다시 가서 등록 + Default 체크.

### 한글이 `???`로 깨짐

→ 4단계 4군데 중 한 군데 누락. 특히 **Content Types를 빼먹는 경우**가 가장 흔합니다. 프로젝트 단위 설정도 따로 해야 한다는 점 잊지 마세요.

### Lombok `@Getter` 가 안 먹힘

→ 5단계 후 STS 재시작 안 한 경우. 또는 `SpringToolSuite4.ini`에 `-javaagent` 라인이 안 들어간 경우. ini 파일 직접 열어서 확인:

```ini
-javaagent:lombok.jar
```

### Maven 빌드 시 한글이 깨짐

→ IDE 인코딩이랑 별개로 Maven은 자체 설정을 봅니다. `pom.xml`에 추가:

```xml
<properties>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    <java.version>17</java.version>
</properties>
```

### Boot Dashboard에 프로젝트가 안 보임

→ Spring Boot 프로젝트로 인식 안 됨. `pom.xml`에 `spring-boot-starter-parent` 또는 `spring-boot-starter` 의존성이 있는지 확인하세요. Maven Update (`Alt + F5`)도 해보세요.

---

## 이제 진짜 시작입니다

5분 안에 끝났을 거예요. 이제 진짜 코드를 짤 시간입니다.

다음 단계로 풀스택 셋팅(React 연동, Oracle DB, MyBatis)이 궁금하다면 [Spring Boot + React + Oracle + MyBatis 셋팅 시리즈](/posts/springboot-react-oracle-mybatis-setup-1)에서 이어서 보시면 됩니다.

회사에서 사수가 "왜 IntelliJ 안 쓰냐" 라고 묻거든, "라이선스 사주시면 쓰겠습니다" 라고 답하시면 됩니다. 그 전까진 STS4도 충분히 잘 굴러갑니다.
