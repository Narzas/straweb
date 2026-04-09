---
title: Spring Boot 성능이 느릴 때 바로 의심해야 할 5가지 — 실무 디버깅 가이드
date: 2026-04-09
description: Spring Boot API가 갑자기 느려졌을 때 어디부터 봐야 하는지, 실무 기준으로 가장 효과적인 점검 포인트를 정리했습니다.
category: 개발
tags: [Spring Boot, 성능최적화, 백엔드, MyBatis, Redis, DB튜닝]
---

## 왜 갑자기 느려지는 걸까?

Spring Boot는 기본적으로 빠릅니다. 그래서 "느려졌다"는 건 거의 항상 **내부 어딘가가 병목이 된 상태**입니다.

문제는 대부분 코드 한 줄이 아니라  
DB, 네트워크, 캐시, 스레드 같은 구조적인 요소에서 발생합니다.

---

## 1. DB 쿼리 — 가장 먼저 의심해야 하는 구간

실무에서 성능 문제의 대부분은 DB에서 발생합니다.

특히 이런 쿼리는 위험 신호입니다.

```sql
SELECT * FROM orders WHERE user_id = 10;
```

겉보기엔 문제 없어 보이지만 데이터가 많아지면 인덱스 유무에 따라 성능이 급격히 달라집니다.

핵심은 단순합니다.  
인덱스를 타지 못하는 순간 성능은 데이터 양에 비례해서 무너집니다.

### 체크 포인트

- 인덱스가 실제로 사용되는지 (`EXPLAIN`)
- 불필요한 `SELECT *` 사용 여부
- N+1 쿼리 발생 여부 (JPA / MyBatis 모두 포함)

```sql
EXPLAIN SELECT * FROM orders WHERE user_id = 10;
```

---

## 2. MyBatis batch 미사용

대량 insert/update에서 가장 흔한 실수입니다.

```java
for (Item item : items) {
    mapper.insert(item);
}
```

이 방식은 DB를 N번 호출하는 구조입니다.

### 개선 방법

MyBatis `<foreach>`로 단일 쿼리로 묶어서 처리합니다.

```xml
<insert id="batchInsert">
  INSERT INTO orders (id, user_id, amount)
  VALUES
  <foreach collection="list" item="item" separator=",">
    (#{item.id}, #{item.userId}, #{item.amount})
  </foreach>
</insert>
```

또는 JDBC batch 처리:

```java
try (SqlSession session = sqlSessionFactory.openSession(ExecutorType.BATCH)) {
    for (Item item : items) {
        session.getMapper(ItemMapper.class).insert(item);
    }
    session.flushStatements();
}
```

성능 차이는 단순 개선 수준이 아니라  
수 초 → 수 ms로 줄어드는 경우도 많습니다.

---

## 3. Redis 없는 구조 (캐싱 부재)

같은 데이터를 계속 DB에서 조회하고 있다면 구조 문제입니다.

```java
@GetMapping("/user/{id}")
public User getUser(@PathVariable Long id) {
    return userService.findById(id);  // 매 요청마다 DB 조회
}
```

이 구조는 트래픽이 늘어날수록 DB가 그대로 부담을 받습니다.

```text
Client → Redis (캐시 히트) → 응답
Client → Redis (캐시 미스) → DB → Redis 저장 → 응답
```

캐싱만 제대로 적용해도 DB 부하는 크게 줄어듭니다.

```java
@Cacheable(value = "user", key = "#id")
public User findById(Long id) {
    return userRepository.findById(id).orElseThrow();
}
```

---

## 4. 트랜잭션 범위 과도하게 큰 경우

```java
@Transactional
public void process() {
    step1();  // 외부 API 호출
    step2();  // 파일 처리
    step3();  // DB 저장
}
```

문제는 "전체를 하나의 트랜잭션으로 묶는 것"입니다.

- 락 유지 시간 증가
- 커넥션 점유 시간 증가
- 동시 요청 처리량 감소

### 개선 방법

DB 작업이 필요한 구간에만 `@Transactional`을 최소 범위로 적용합니다.

```java
public void process() {
    step1();          // 트랜잭션 불필요 — 외부 API
    step2();          // 트랜잭션 불필요 — 파일 처리
    step3Transactional();  // 트랜잭션 필요 — DB 저장만
}

@Transactional
private void step3Transactional() {
    // DB 저장 로직
}
```

---

## 5. Tomcat 스레드 풀 기본값

```yaml
server:
  tomcat:
    threads:
      max: 200       # 기본값
      min-spare: 10
```

트래픽이 증가하면 이 설정이 병목이 됩니다.

- 너무 낮으면 요청 대기 증가
- 너무 높으면 DB 커넥션 폭발

HikariCP 커넥션 풀 설정과 함께 조정하는 것이 중요합니다.

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      connection-timeout: 3000
```

---

## 성능 문제를 보는 순서

| 순서 | 점검 항목 | 주요 도구 |
|------|----------|----------|
| 1 | DB 쿼리 (인덱스, N+1) | EXPLAIN, p6spy |
| 2 | 캐시 여부 | Redis, Spring Cache |
| 3 | API 응답 시간 | Actuator, Prometheus |
| 4 | 트랜잭션 범위 | 코드 리뷰 |
| 5 | 스레드 / 커넥션 풀 | HikariCP 로그 |

---

## 마무리

성능 최적화의 핵심은 복잡한 기술이 아니라  
병목 지점을 빠르게 찾는 능력입니다.

그리고 대부분의 문제는 새로운 기술이 아니라  
DB, 캐시, 쿼리 같은 기본기에서 발생합니다.

결국 중요한 건 "잘 짜는 코드"보다  
"느려진 이유를 빨리 찾는 감각"입니다.
