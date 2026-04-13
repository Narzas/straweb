---
title: 신입 백엔드 때 진짜로 혼났던 것들 — JPA, 트랜잭션, 예외처리
date: 2026-04-13T20:00:00
cover: /images/dev/java-tips.svg
description: 교과서엔 없는데 현장에선 기본인 것들. JPA N+1, @Transactional 남발, 예외처리 패턴 등 실제로 코드 리뷰에서 지적받았던 내용들을 정리했습니다.
category: 개발
tags: [Java, Spring Boot, JPA, 신입개발자, 백엔드, 실무]
---

입사하고 처음 몇 달은 코드가 일단 돌아가면 된다고 생각했다.

그러다 코드 리뷰에서 조용히 코멘트가 달리기 시작했다. "이거 N+1 터집니다", "여기 트랜잭션 범위 다시 확인해보세요", "Entity 그대로 반환하면 안 됩니다" — 다 아는 말 같은데 왜 내 코드가 문제인지 처음엔 잘 몰랐다.

아래는 그때 지적받고 나서야 이해한 것들이다.

---

## JPA N+1 — 모르면 운영서버에서 알게 된다

처음에 N+1이 뭔지 설명을 들어도 와닿지 않았다. 직접 겪기 전까진.

이름 자체가 좀 생소한데, 일단 이렇게 생각하면 된다.

> **주문 목록을 조회했더니, 각 주문마다 주문한 사람 정보를 따로 또 DB에 물어보는 상황**

코드로 보면 이렇다.

```java
List<Order> orders = orderRepository.findAll(); // 쿼리 1번

for (Order order : orders) {
    // 루프 돌 때마다 getMember() 할 때마다 쿼리가 1번씩 더 나간다
    System.out.println(order.getMember().getName());
}
```

주문이 100개면 쿼리가 총 **101번** 나간다. 주문 목록 가져올 때 1번, 루프 돌면서 각 주문 주인 조회할 때 100번.

왜 이런 일이 생기냐면, JPA가 연관된 엔티티(여기선 `Member`)를 기본적으로 **필요할 때 가져오도록** 설정되어 있기 때문이다. `order.getMember()` 를 호출하는 그 순간 "아, 멤버가 필요하구나" 하고 그때서야 DB에 쿼리를 날린다. 이걸 **지연 로딩(Lazy Loading)** 이라고 한다.

개발할 때는 데이터가 5~10개라 전혀 모르고 넘어간다. 운영에서 주문이 수천 건 쌓이고 나서야 슬로우쿼리 알람으로 알게 된다.

해결은 단순하다. **처음부터 같이 가져오면 된다.**

```java
// JPQL fetch join — "주문 가져올 때 멤버도 같이 JOIN해서 가져와"
@Query("SELECT o FROM Order o JOIN FETCH o.member")
List<Order> findAllWithMember();
```

이렇게 하면 쿼리 1번에 주문 + 멤버 정보를 한 번에 가져온다.

```sql
-- fetch join 시 실제로 나가는 쿼리 (1번)
SELECT o.*, m.*
FROM orders o
INNER JOIN member m ON o.member_id = m.id
```

`@EntityGraph` 를 쓰는 방법도 있다. JPQL 직접 안 쓰고 어노테이션으로 해결할 수 있어서 간단한 경우엔 이게 더 편하다.

```java
@EntityGraph(attributePaths = {"member"})
List<Order> findAll();
```

한 가지 주의할 점은 `fetch join` 과 페이징을 같이 쓰면 경고가 뜬다. `HibernateJpaDialect: firstResult/maxResults specified with collection fetch; applying in memory` 이 로그가 보이면 **페이징이 메모리에서 처리되고 있다는 뜻**이다. 데이터 많으면 OOM 난다. 이때는 `@BatchSize` 나 쿼리 분리로 풀어야 한다.

---

## `@Transactional` 붙이면 다 해결된다는 착각

트랜잭션이 중요하다는 건 알겠는데, 처음엔 그냥 서비스 메서드마다 다 붙이면 되는 거 아닌가 싶었다.

```java
@Service
public class UserService {

    @Transactional // 일단 다 붙이고 보자
    public void createUser(UserDto dto) { ... }

    @Transactional // 조회인데도 붙임
    public UserDto getUser(Long id) { ... }

    @Transactional // private 메서드에도 붙임 — 이건 아예 동작 안 함
    private void sendWelcomeEmail(User user) { ... }
}
```

문제가 몇 가지 있다.

**조회에 쓰기 트랜잭션을 열면 불필요한 비용이 생긴다.** 읽기만 하는 메서드엔 `@Transactional(readOnly = true)` 를 쓰는 게 맞다. DB 입장에선 읽기 전용으로 최적화할 수 있고, 실수로 영속성 컨텍스트에서 변경이 일어나도 flush가 안 된다.

**`private` 메서드에 `@Transactional` 은 아무 효과가 없다.** Spring 트랜잭션은 프록시 기반이라 외부에서 호출되는 `public` 메서드에서만 동작한다. 이걸 모르고 같은 클래스 내에서 `@Transactional` 붙은 메서드를 내부 호출하면 트랜잭션이 적용되지 않는다.

```java
@Service
public class OrderService {

    public void placeOrder(OrderDto dto) {
        validate(dto);
        saveOrder(dto); // 이 호출은 트랜잭션 없이 실행됨
    }

    @Transactional // 의미없음 — 내부 호출이라 프록시 거치지 않음
    private void saveOrder(OrderDto dto) { ... }
}
```

의도한 대로 트랜잭션이 걸리길 원하면, 해당 로직을 별도 빈으로 분리하거나 `placeOrder` 자체에 트랜잭션을 걸어야 한다.

---

## Entity를 API 응답으로 그냥 반환하면 생기는 일

처음에 Controller에서 이렇게 짜면 편하긴 하다.

```java
@GetMapping("/users/{id}")
public User getUser(@PathVariable Long id) {
    return userRepository.findById(id).orElseThrow();
}
```

근데 이게 쌓이면 나중에 꽤 골치 아파진다.

일단 Entity에 `@JsonIgnore` 같은 어노테이션이 생기기 시작한다. 비밀번호 필드는 내보내면 안 되니까. 양방향 연관관계가 있으면 JSON 직렬화하다가 무한 루프로 `StackOverflowError` 가 터지기도 한다. 그리고 나중에 API 스펙을 바꾸려고 하면 DB 구조랑 응답 구조가 엮여있어서 꼼짝을 못 하게 된다.

```java
// 이렇게 분리하는 게 맞다
@GetMapping("/users/{id}")
public UserResponse getUser(@PathVariable Long id) {
    User user = userService.findById(id);
    return UserResponse.from(user);
}

// 응답 전용 DTO
public record UserResponse(Long id, String name, String email) {
    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getName(), user.getEmail());
    }
}
```

처음엔 클래스가 늘어나는 게 번거롭게 느껴지는데, 한 번 경험하고 나면 당연하게 쓰게 된다.

---

## 예외처리 — 그냥 터지게 두거나, 모든 걸 잡거나

초반에 예외 처리 방식이 둘 중 하나였다.

```java
// 방법 1 — 그냥 터지게 둠
public User findUser(Long id) {
    return userRepository.findById(id).get(); // NoSuchElementException
}

// 방법 2 — 무조건 잡고 로그만 남김
try {
    process();
} catch (Exception e) {
    e.printStackTrace(); // 이게 운영 코드에 있으면 안 됨
}
```

둘 다 문제다.

`.get()` 은 값이 없을 때 `NoSuchElementException` 을 던지는데 어디서 왜 터졌는지 알기 어렵다. `Exception` 을 통으로 잡고 `e.printStackTrace()` 만 하면 로그 수집 시스템에 안 찍히는 경우가 많고, 예외가 삼켜지면 호출부에서 정상 처리된 것처럼 흘러간다.

실무에서 많이 쓰는 패턴은 **커스텀 예외 + 전역 핸들러** 조합이다.

```java
// 커스텀 예외
public class UserNotFoundException extends RuntimeException {
    public UserNotFoundException(Long id) {
        super("사용자를 찾을 수 없습니다. id=" + id);
    }
}

// 서비스
public User findUser(Long id) {
    return userRepository.findById(id)
        .orElseThrow(() -> new UserNotFoundException(id));
}

// 전역 예외 핸들러
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(UserNotFoundException e) {
        log.warn(e.getMessage());
        return ResponseEntity.status(404).body(new ErrorResponse(e.getMessage()));
    }
}
```

이렇게 구조를 잡으면 예외가 터졌을 때 어디서 뭐가 문제인지 바로 보인다. 그리고 Controller마다 try-catch를 반복할 필요도 없어진다.

---

## 테스트 없이 배포하는 습관

이건 기술 문제가 아닌데 넣는 이유가 있다.

신입 때 "일단 배포해보고 문제 생기면 고친다" 는 생각을 은근히 했다. 빠르게 치고 나가고 싶은 마음도 있었고, 테스트 짜는 시간이 아깝게 느껴지기도 했다.

근데 운영 서버에서 오류가 나면 디버깅하는 시간이 테스트 코드 짜는 시간보다 훨씬 길다. 특히 다른 사람 코드를 건드린 경우는 더 그렇다.

최소한 서비스 레이어 핵심 로직에는 테스트를 붙이는 게 낫다.

```java
@Test
void 사용자_생성_성공() {
    // given
    UserCreateRequest request = new UserCreateRequest("홍길동", "test@example.com");

    // when
    UserResponse response = userService.createUser(request);

    // then
    assertThat(response.name()).isEqualTo("홍길동");
    assertThat(response.email()).isEqualTo("test@example.com");
}
```

given/when/then 구조로 짜면 나중에 읽을 때 뭘 테스트하는지 바로 보인다. 처음엔 어색하지만 한 달만 해보면 없는 게 더 불안해진다.

---

## 마무리

솔직히 위에 적은 것들은 다 "들어봤다"에서 끝나지 않고 **직접 겪어야** 제대로 느껴진다.

그래도 미리 알고 있으면 최소한 어디서 막혔을 때 "아, 이거 그 얘기구나" 하고 빠르게 연결이 된다. 그게 있는 것과 없는 것의 차이가 꽤 크다.

JPA나 트랜잭션 쪽은 특히 Spring Boot 프로젝트라면 거의 반드시 마주치는 주제니까, 한 번씩 직접 실험해보는 걸 추천한다.
