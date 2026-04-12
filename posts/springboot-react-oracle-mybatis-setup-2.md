---
title: "Spring Boot + React + Oracle + MyBatis 셋팅 — 2편: Spring Boot 프로젝트 생성 & Oracle 연결"
date: 2026-04-12T02:00:00
description: Spring Initializr로 프로젝트를 만들고 application.yml에 Oracle 접속 정보를 설정해 실제로 DB에 연결하는 법을 알아봅니다.
category: 개발
tags: [SpringBoot, Oracle, MyBatis, 풀스택, 초보자, 백엔드]
cover: /images/dev/springboot-fullstack-2.svg
---

> **시리즈 목차**
> - 1편: 개발 환경 준비
> - **2편: Spring Boot 프로젝트 생성 & Oracle 연결** ← 지금 여기
> - 3편: MyBatis 설정 & CRUD API 만들기
> - 4편: React 프로젝트 생성 & Spring Boot API 연동

---

## Spring Initializr로 프로젝트 만들기

[start.spring.io](https://start.spring.io) 에 접속합니다. 직접 설정할 수도 있고, IntelliJ에서 바로 만들 수도 있습니다. 여기선 웹에서 만드는 방법을 먼저 설명합니다.

### 설정값

| 항목 | 선택 |
|------|------|
| Project | **Gradle - Groovy** |
| Language | Java |
| Spring Boot | **3.x.x** (최신 정식 버전) |
| Packaging | Jar |
| Java | **17** |

**Project Metadata:**
- Group: `com.example`
- Artifact: `backend`
- Name: `backend`
- Package name: `com.example.backend`

### 의존성(Dependencies) 추가

**ADD DEPENDENCIES** 버튼 클릭 후 아래 항목 추가:

| 의존성 | 설명 |
|--------|------|
| Spring Web | REST API 만들기 |
| MyBatis Framework | SQL 매핑 |
| Oracle Driver | Oracle JDBC 드라이버 |
| Lombok | 반복 코드 줄이기 |

설정 완료 후 **GENERATE** → ZIP 다운로드 → 원하는 폴더에 압축 해제

---

## IntelliJ에서 프로젝트 열기

1. IntelliJ 실행 → **Open** → 압축 해제한 `backend` 폴더 선택
2. Gradle 빌드가 자동으로 시작됩니다 (우측 하단 진행바 확인)
3. 빌드 완료까지 잠깐 기다립니다

> 처음엔 인터넷에서 라이브러리를 받아야 해서 시간이 걸립니다. 2~3분 정도 기다리면 됩니다.

---

## build.gradle 확인

`build.gradle` 파일을 열어 의존성이 제대로 들어왔는지 확인합니다.

```groovy
dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.mybatis.spring.boot:mybatis-spring-boot-starter:3.0.3'
    runtimeOnly 'com.oracle.database.jdbc:ojdbc11'
    compileOnly 'org.projectlombok:lombok'
    annotationProcessor 'org.projectlombok:lombok'
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
}
```

> MyBatis 버전(`3.0.3`)은 Spring Boot 3.x와 맞춰야 합니다. 자동으로 맞는 버전이 들어오지만, 혹시 에러가 나면 버전을 확인해보세요.

---

## application.yml 설정

`src/main/resources/application.properties` 파일이 기본으로 있을 겁니다. 이걸 **application.yml**로 바꾸면 더 보기 편합니다.

1. 파일명을 `application.yml`로 변경
2. 아래 내용 작성:

```yaml
spring:
  datasource:
    url: jdbc:oracle:thin:@localhost:1521/XE
    username: devuser
    password: devpass123
    driver-class-name: oracle.jdbc.OracleDriver

  sql:
    init:
      platform: oracle

mybatis:
  mapper-locations: classpath:mapper/**/*.xml
  type-aliases-package: com.example.backend.dto
  configuration:
    map-underscore-to-camel-case: true
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl

server:
  port: 8080
```

### 각 설정 설명

**datasource:**
- `url`: Oracle 접속 주소. `@localhost:1521/XE` 형식입니다. XE는 서비스명입니다.
- `username` / `password`: 1편에서 만든 계정 정보

**mybatis:**
- `mapper-locations`: SQL XML 파일 위치. `resources/mapper/` 폴더 아래에 둡니다.
- `map-underscore-to-camel-case`: DB의 `USER_NAME` → Java의 `userName` 자동 변환
- `log-impl`: 실행되는 SQL을 콘솔에 출력 (개발할 때 편합니다)

---

## 폴더 구조 만들기

`src/main/java/com/example/backend/` 아래에 폴더를 만듭니다:

```
backend/
└── src/main/java/com/example/backend/
    ├── BackendApplication.java  ← 자동 생성됨
    ├── controller/
    ├── service/
    ├── mapper/
    └── dto/
```

`src/main/resources/` 아래:

```
resources/
├── application.yml
└── mapper/          ← SQL XML 파일 놓을 곳
```

IntelliJ에서 폴더 만드는 법: 해당 패키지 우클릭 → New → Package

---

## 연결 테스트

프로젝트가 Oracle에 제대로 붙는지 확인해봅니다.

### 간단한 테스트 컨트롤러 작성

`controller/TestController.java` 생성:

```java
package com.example.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TestController {

    @GetMapping("/api/hello")
    public String hello() {
        return "Spring Boot 연결 성공!";
    }
}
```

### 실행

`BackendApplication.java` 파일을 열고 왼쪽 초록 삼각형 클릭 → **Run**

콘솔에 이런 로그가 보이면 성공:

```
  .   ____          _            __ _ _
 /\\ / ___'_ __ _ _(_)_ __  __ _ \ \ \ \
...
Tomcat started on port 8080
Started BackendApplication in 3.xxx seconds
```

브라우저에서 `http://localhost:8080/api/hello` 접속 → `Spring Boot 연결 성공!` 텍스트 확인

---

## 자주 나오는 에러와 해결법

### ORA-01017: invalid username/password

`application.yml`의 username/password가 틀렸습니다. 1편에서 만든 계정 정보를 다시 확인하세요.

### Listener refused the connection

Oracle 서비스가 안 켜져 있습니다. Windows 서비스에서 `OracleServiceXE`와 `OracleXETNSListener`가 실행 중인지 확인하세요.

```
작업 관리자 → 서비스 탭 → OracleServiceXE 검색
```

상태가 "중지됨"이면 우클릭 → 시작

### ClassNotFoundException: oracle.jdbc.OracleDriver

`build.gradle`에 Oracle 드라이버 의존성이 없거나, Gradle 새로고침이 안 됐습니다. IntelliJ 우측 Gradle 패널 → 새로고침 버튼 클릭.

---

## DB 연결까지 확인하기

단순히 서버가 뜨는 것만으로는 Oracle 연결이 됐는지 알 수 없습니다. 실제 쿼리를 날려보겠습니다.

### DUAL 테이블로 테스트

Oracle에는 기본 제공 테이블인 `DUAL`이 있습니다. 아무 데이터도 없지만 간단한 쿼리 테스트에 씁니다.

`mapper/TestMapper.java` 인터페이스 생성:

```java
package com.example.backend.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface TestMapper {

    @Select("SELECT 'DB 연결 성공' AS msg FROM DUAL")
    String testConnection();
}
```

컨트롤러 수정:

```java
package com.example.backend.controller;

import com.example.backend.mapper.TestMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class TestController {

    private final TestMapper testMapper;

    @GetMapping("/api/hello")
    public String hello() {
        return testMapper.testConnection();
    }
}
```

다시 실행 후 `http://localhost:8080/api/hello` 접속 → `DB 연결 성공` 텍스트가 나오면 **Oracle까지 완벽하게 연결된 겁니다.**

---

## 정리

- Spring Initializr로 프로젝트 생성
- `application.yml`에 Oracle 접속 정보 설정
- 서버 실행 & DUAL 테이블로 DB 연결 확인

---

## 다음 편 예고

**3편: MyBatis 설정 & CRUD API 만들기**

실제 테이블을 만들고, MyBatis XML 매퍼를 작성해서 회원 목록 조회 / 등록 / 수정 / 삭제 API를 만들어봅니다. 실무에서 가장 자주 쓰는 패턴으로 작성합니다.
