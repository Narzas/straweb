---
title: "Spring Boot + React + Oracle + MyBatis 셋팅 — 3편: MyBatis 설정 & CRUD API 만들기"
date: 2026-04-12T02:00:00
description: MyBatis XML 매퍼를 작성해 회원 테이블 CRUD API를 완성합니다. 실무에서 쓰는 패턴 그대로 따라합니다.
category: 개발
tags: [SpringBoot, MyBatis, Oracle, CRUD, REST API, 초보자]
---

> **시리즈 목차**
> - 1편: 개발 환경 준비
> - 2편: Spring Boot 프로젝트 생성 & Oracle 연결
> - **3편: MyBatis 설정 & CRUD API 만들기** ← 지금 여기
> - 4편: React 프로젝트 생성 & Spring Boot API 연동

---

## 이번 편에서 만들 것

Oracle에 `MEMBER` 테이블을 만들고, 아래 4가지 API를 완성합니다.

| HTTP 메서드 | URL | 기능 |
|------------|-----|------|
| GET | `/api/members` | 전체 회원 조회 |
| GET | `/api/members/{id}` | 특정 회원 조회 |
| POST | `/api/members` | 회원 등록 |
| PUT | `/api/members/{id}` | 회원 수정 |
| DELETE | `/api/members/{id}` | 회원 삭제 |

---

## 1. Oracle 테이블 생성

DBeaver를 열고 `devuser` 계정으로 접속 후, SQL 에디터에서 실행합니다.

```sql
-- 회원 테이블
CREATE TABLE MEMBER (
    MEMBER_ID   NUMBER          NOT NULL,
    USER_NAME   VARCHAR2(50)    NOT NULL,
    EMAIL       VARCHAR2(100)   NOT NULL,
    PHONE       VARCHAR2(20),
    REG_DATE    DATE            DEFAULT SYSDATE NOT NULL,
    CONSTRAINT PK_MEMBER PRIMARY KEY (MEMBER_ID)
);

-- 시퀀스 (자동 증가 PK용)
CREATE SEQUENCE SEQ_MEMBER
    START WITH 1
    INCREMENT BY 1
    NOCACHE;

-- 테스트 데이터
INSERT INTO MEMBER (MEMBER_ID, USER_NAME, EMAIL, PHONE)
VALUES (SEQ_MEMBER.NEXTVAL, '홍길동', 'hong@example.com', '010-1234-5678');

INSERT INTO MEMBER (MEMBER_ID, USER_NAME, EMAIL, PHONE)
VALUES (SEQ_MEMBER.NEXTVAL, '김철수', 'kim@example.com', '010-9876-5432');

COMMIT;
```

> Oracle은 MySQL의 `AUTO_INCREMENT`가 없습니다. 대신 **시퀀스(SEQUENCE)**를 따로 만들어서 씁니다. `SEQ_MEMBER.NEXTVAL`을 호출할 때마다 1씩 증가합니다.

---

## 2. DTO 클래스 만들기

`dto/MemberDto.java` 생성:

```java
package com.example.backend.dto;

import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.ToString;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class MemberDto {
    private Long memberId;
    private String userName;
    private String email;
    private String phone;
    private String regDate;
}
```

**Lombok 어노테이션 설명:**
- `@Getter` / `@Setter`: get/set 메서드 자동 생성
- `@NoArgsConstructor`: 기본 생성자 자동 생성
- `@AllArgsConstructor`: 전체 필드 생성자 자동 생성
- `@ToString`: toString() 메서드 자동 생성

> 2편에서 `application.yml`에 `map-underscore-to-camel-case: true` 설정을 해뒀습니다. 덕분에 DB의 `USER_NAME` → Java의 `userName`으로 자동 변환됩니다.

---

## 3. Mapper 인터페이스 만들기

`mapper/MemberMapper.java` 생성:

```java
package com.example.backend.mapper;

import com.example.backend.dto.MemberDto;
import org.apache.ibatis.annotations.Mapper;
import java.util.List;

@Mapper
public interface MemberMapper {

    // 전체 조회
    List<MemberDto> selectAllMembers();

    // 단건 조회
    MemberDto selectMemberById(Long memberId);

    // 등록
    int insertMember(MemberDto member);

    // 수정
    int updateMember(MemberDto member);

    // 삭제
    int deleteMember(Long memberId);
}
```

인터페이스만 선언하고, 실제 SQL은 XML 파일에 작성합니다. `@Mapper` 어노테이션이 있으면 MyBatis가 자동으로 구현체를 만들어줍니다.

---

## 4. MyBatis XML 매퍼 작성

`src/main/resources/mapper/MemberMapper.xml` 생성:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-mapper.dtd">

<mapper namespace="com.example.backend.mapper.MemberMapper">

    <!-- ResultMap: DB 컬럼 → Java 필드 매핑 -->
    <resultMap id="memberResultMap" type="MemberDto">
        <id     property="memberId"  column="MEMBER_ID"/>
        <result property="userName"  column="USER_NAME"/>
        <result property="email"     column="EMAIL"/>
        <result property="phone"     column="PHONE"/>
        <result property="regDate"   column="REG_DATE"/>
    </resultMap>

    <!-- 전체 조회 -->
    <select id="selectAllMembers" resultMap="memberResultMap">
        SELECT MEMBER_ID, USER_NAME, EMAIL, PHONE,
               TO_CHAR(REG_DATE, 'YYYY-MM-DD') AS REG_DATE
        FROM MEMBER
        ORDER BY MEMBER_ID DESC
    </select>

    <!-- 단건 조회 -->
    <select id="selectMemberById" parameterType="Long" resultMap="memberResultMap">
        SELECT MEMBER_ID, USER_NAME, EMAIL, PHONE,
               TO_CHAR(REG_DATE, 'YYYY-MM-DD') AS REG_DATE
        FROM MEMBER
        WHERE MEMBER_ID = #{memberId}
    </select>

    <!-- 등록 -->
    <insert id="insertMember" parameterType="MemberDto">
        INSERT INTO MEMBER (MEMBER_ID, USER_NAME, EMAIL, PHONE)
        VALUES (SEQ_MEMBER.NEXTVAL, #{userName}, #{email}, #{phone})
    </insert>

    <!-- 수정 -->
    <update id="updateMember" parameterType="MemberDto">
        UPDATE MEMBER
        SET USER_NAME = #{userName},
            EMAIL     = #{email},
            PHONE     = #{phone}
        WHERE MEMBER_ID = #{memberId}
    </update>

    <!-- 삭제 -->
    <delete id="deleteMember" parameterType="Long">
        DELETE FROM MEMBER
        WHERE MEMBER_ID = #{memberId}
    </delete>

</mapper>
```

### 핵심 문법 설명

- `namespace`: 연결할 Mapper 인터페이스의 패키지 + 클래스명
- `#{변수명}`: 파라미터 바인딩. SQL Injection 방지를 위해 항상 `#{}` 사용
- `resultMap`: DB 컬럼과 Java 필드를 명시적으로 매핑
- `TO_CHAR(REG_DATE, 'YYYY-MM-DD')`: Oracle의 DATE 타입을 문자열로 변환

---

## 5. Service 클래스 만들기

`service/MemberService.java` 생성:

```java
package com.example.backend.service;

import com.example.backend.dto.MemberDto;
import com.example.backend.mapper.MemberMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MemberService {

    private final MemberMapper memberMapper;

    public List<MemberDto> getAllMembers() {
        return memberMapper.selectAllMembers();
    }

    public MemberDto getMemberById(Long memberId) {
        return memberMapper.selectMemberById(memberId);
    }

    public int createMember(MemberDto member) {
        return memberMapper.insertMember(member);
    }

    public int updateMember(MemberDto member) {
        return memberMapper.updateMember(member);
    }

    public int deleteMember(Long memberId) {
        return memberMapper.deleteMember(memberId);
    }
}
```

> Controller → Service → Mapper 3계층 구조가 실무 표준입니다. Service에 비즈니스 로직을 담고, Mapper는 DB 접근만 담당합니다.

---

## 6. Controller 만들기

`controller/MemberController.java` 생성:

```java
package com.example.backend.controller;

import com.example.backend.dto.MemberDto;
import com.example.backend.service.MemberService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/members")
@RequiredArgsConstructor
public class MemberController {

    private final MemberService memberService;

    // 전체 조회
    @GetMapping
    public ResponseEntity<List<MemberDto>> getAllMembers() {
        return ResponseEntity.ok(memberService.getAllMembers());
    }

    // 단건 조회
    @GetMapping("/{id}")
    public ResponseEntity<MemberDto> getMember(@PathVariable Long id) {
        MemberDto member = memberService.getMemberById(id);
        if (member == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(member);
    }

    // 등록
    @PostMapping
    public ResponseEntity<String> createMember(@RequestBody MemberDto member) {
        memberService.createMember(member);
        return ResponseEntity.ok("등록 완료");
    }

    // 수정
    @PutMapping("/{id}")
    public ResponseEntity<String> updateMember(
            @PathVariable Long id,
            @RequestBody MemberDto member) {
        member.setMemberId(id);
        memberService.updateMember(member);
        return ResponseEntity.ok("수정 완료");
    }

    // 삭제
    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteMember(@PathVariable Long id) {
        memberService.deleteMember(id);
        return ResponseEntity.ok("삭제 완료");
    }
}
```

---

## 7. CORS 설정

React(3000포트)에서 Spring Boot(8080포트)를 호출할 때 브라우저가 **CORS 에러**를 냅니다. 미리 설정해둡니다.

`config/WebConfig.java` 생성:

```java
package com.example.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins("http://localhost:3000")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }
}
```

---

## 8. API 테스트

서버를 실행하고 브라우저나 Postman으로 테스트합니다.

### 전체 조회

```
GET http://localhost:8080/api/members
```

응답:
```json
[
  {
    "memberId": 2,
    "userName": "김철수",
    "email": "kim@example.com",
    "phone": "010-9876-5432",
    "regDate": "2026-04-12"
  },
  {
    "memberId": 1,
    "userName": "홍길동",
    "email": "hong@example.com",
    "phone": "010-1234-5678",
    "regDate": "2026-04-12"
  }
]
```

### 회원 등록

```
POST http://localhost:8080/api/members
Content-Type: application/json

{
  "userName": "이영희",
  "email": "lee@example.com",
  "phone": "010-5555-6666"
}
```

콘솔에 실행된 SQL이 출력됩니다 (application.yml의 `log-impl` 설정 덕분):

```
==>  Preparing: INSERT INTO MEMBER (MEMBER_ID, USER_NAME, EMAIL, PHONE) VALUES (SEQ_MEMBER.NEXTVAL, ?, ?, ?)
==> Parameters: 이영희(String), lee@example.com(String), 010-5555-6666(String)
<==    Updates: 1
```

---

## 완성된 폴더 구조

```
src/main/
├── java/com/example/backend/
│   ├── BackendApplication.java
│   ├── config/
│   │   └── WebConfig.java
│   ├── controller/
│   │   └── MemberController.java
│   ├── service/
│   │   └── MemberService.java
│   ├── mapper/
│   │   └── MemberMapper.java
│   └── dto/
│       └── MemberDto.java
└── resources/
    ├── application.yml
    └── mapper/
        └── MemberMapper.xml
```

---

## 다음 편 예고

**4편: React 프로젝트 생성 & Spring Boot API 연동**

`create-react-app`(또는 Vite)으로 프론트엔드를 만들고, axios로 방금 만든 Spring Boot API를 호출해서 화면에 회원 목록을 뿌려봅니다. 프론트와 백이 실제로 연결되는 순간입니다.
