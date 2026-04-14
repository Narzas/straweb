---
title: Java 실력 차이를 만드는 코딩 습관 — Enum, Records, 동시성까지
date: 2026-04-14T22:41:37+09:00
cover: /images/dev/java-coding-habits.svg
description: Enum에 동작 넣기, Records로 DTO 정리, try-with-resources, Generics 설계, 단위 테스트, AtomicInteger까지. 코드 리뷰에서 한 단계 올라서게 해주는 Java 실전 습관 10가지.
category: 개발
tags: [Java, 클린코드, 백엔드, 실무, 테스트, 동시성]
---

어느 시점이 되면 내 코드가 "돌아가는 코드"에서 멈춰있다는 걸 느낄 때가 있다.

기능은 완성했고, 테스트도 통과했는데 — 코드 리뷰에서 조용히 질문이 달린다. "이 분기문이 상태 추가될 때마다 여기 찾아서 고쳐야 하지 않나요?", "이 DTO 파일 왜 이렇게 긴 거예요?" 같은 것들. 틀린 코드는 아닌데 뭔가 아쉽다는 느낌. 그 "아쉬움"이 뭔지 한동안 잘 몰랐다.

그때부터 필요해지는 것들이 있다. 입문서에는 잘 안 나오는데 실무에선 당연하게 쓰이는 패턴들. 아래는 그중에서 내가 직접 써보고 "이게 맞다" 싶었던 것들이다.

---

## Enum 은 상수 모음이 아니다

처음에 Enum을 이렇게 배웠다. 상수 묶음. 타입 안전한 값.

```java
public enum OrderStatus {
    PENDING, APPROVED, REJECTED, SHIPPED, DELIVERED
}
```

여기까진 다들 안다. 문제는 그 다음이다. 보통 이 Enum을 쓰는 코드가 이렇게 된다.

```java
if (order.getStatus() == OrderStatus.APPROVED) {
    sendApprovalEmail(order);
} else if (order.getStatus() == OrderStatus.REJECTED) {
    sendRejectionEmail(order);
} else if (order.getStatus() == OrderStatus.SHIPPED) {
    sendShippingNotification(order);
}
```

상태가 하나 추가될 때마다 이 분기문을 찾아서 고쳐야 한다. 서비스 어딘가에 숨어있으면 진짜 못 찾는다. 놓치면 그냥 버그다.

근데 Enum이 메서드를 가질 수 있다는 걸 알고 있었나? 처음 이걸 알았을 때 좀 충격이었다. 클래스처럼 각 값마다 동작을 정의할 수 있다.

```java
public enum OrderStatus {
    PENDING {
        @Override
        public void notify(Order order, NotificationService svc) {
            svc.sendPendingNotice(order);
        }
    },
    APPROVED {
        @Override
        public void notify(Order order, NotificationService svc) {
            svc.sendApprovalEmail(order);
        }
    },
    REJECTED {
        @Override
        public void notify(Order order, NotificationService svc) {
            svc.sendRejectionEmail(order);
        }
    },
    SHIPPED {
        @Override
        public void notify(Order order, NotificationService svc) {
            svc.sendShippingNotification(order);
        }
    };

    public abstract void notify(Order order, NotificationService svc);
}
```

`abstract` 가 붙어있으니 각 상태값이 반드시 `notify()` 를 구현해야 한다. 빠트리면 컴파일 에러가 난다. "실수하면 컴파일러가 잡아준다" — 이게 핵심이다.

호출하는 쪽은 이렇게 된다.

```java
order.getStatus().notify(order, notificationService);
```

if-else가 한 줄로 줄었다. 새 상태가 생기면 Enum에만 추가하면 된다. 더 이상 분기문 찾아다니지 않아도 된다는 게 처음엔 조금 해방감 같은 느낌이었다.

필드랑 생성자도 넣을 수 있다. 관련된 값들을 묶어두는 데 쓴다.

```java
public enum HttpStatus {
    OK(200, "OK"),
    NOT_FOUND(404, "Not Found"),
    INTERNAL_SERVER_ERROR(500, "Internal Server Error");

    private final int code;
    private final String message;

    HttpStatus(int code, String message) {
        this.code = code;
        this.message = message;
    }

    public int getCode()       { return code; }
    public String getMessage() { return message; }
}
```

`HttpStatus.NOT_FOUND.getCode()` 하면 404가 나온다. 숫자를 상수로 따로 관리하다가 어디서 쓰는지 모르게 되는 것보다 훨씬 낫다.

---

## Record 쓰면 DTO 파일 절반으로 줄어든다

솔직히 Java로 DTO 만들 때마다 조금 짜증났다. 필드 3개짜리 클래스인데 파일이 40줄이 넘는다.

```java
public class UserDto {
    private final String name;
    private final String email;
    private final int age;

    public UserDto(String name, String email, int age) {
        this.name = name;
        this.email = email;
        this.age = age;
    }

    public String getName()  { return name; }
    public String getEmail() { return email; }
    public int getAge()      { return age; }

    @Override
    public boolean equals(Object o) { ... }

    @Override
    public int hashCode() { ... }

    @Override
    public String toString() { ... }
}
```

생성자 만들고, getter 만들고, equals/hashCode/toString 만들고... 실제 데이터는 3개인데 코드 길이는 왜 이렇게 긴 거야. 이걸 Java 개발자들이 오래 불만으로 가져왔는데 Java 16에서 `record` 가 정식으로 들어왔다.

```java
public record UserDto(String name, String email, int age) {}
```

이게 전부다. 생성자, getter, `equals()`, `hashCode()`, `toString()` 전부 컴파일러가 자동으로 만들어준다. 처음 봤을 때 "이게 뭐야" 싶었는데, 한 번 쓰고 나서 이전 방식으로 돌아가기 싫어졌다.

한 가지 다른 점이 있다. getter가 `getName()` 이 아니라 `name()` 형태다. 헷갈리는 부분이니 기억해두면 좋다.

유효성 검사가 필요하면 이렇게 추가할 수 있다. `public UserDto { ... }` 형태가 record 전용 생성자 블록인데, 여기에 검사 로직을 넣으면 된다.

```java
public record UserDto(String name, String email, int age) {
    public UserDto {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("이름은 필수입니다.");
        }
        if (age < 0 || age > 150) {
            throw new IllegalArgumentException("나이가 유효하지 않습니다: " + age);
        }
        name = name.trim();
    }
}
```

API 응답 객체, 커맨드 객체처럼 "데이터를 담아서 전달하는" 용도에 딱 맞는다. Record는 불변이라서 한번 만들면 필드 값을 바꿀 수 없다. 그래서 안심하고 여기저기 넘길 수 있다.

JPA Entity에는 쓰지 않는 게 좋다. JPA는 기본 생성자가 필요하고 내부적으로 필드를 바꾸는 경우가 있는데, Record의 불변성과 충돌한다. 처음에 Entity를 record로 만들려다가 삽질한 기억이 있다.

---

## 자원 닫는 코드, 더 이상 직접 쓰지 않아도 된다

파일을 열거나, DB 커넥션을 맺거나, 소켓을 열면 — 반드시 다 쓰고 나서 닫아야 한다. 안 닫으면 메모리 누수가 생기거나 커넥션 풀이 고갈된다.

예전엔 `finally` 블록에서 직접 닫았다.

```java
BufferedReader reader = null;
try {
    reader = new BufferedReader(new FileReader("data.txt"));
    String line;
    while ((line = reader.readLine()) != null) {
        process(line);
    }
} catch (IOException e) {
    log.error("파일 읽기 실패", e);
} finally {
    if (reader != null) {
        try {
            reader.close(); // 여기서도 예외가 날 수 있다
        } catch (IOException e) {
            log.error("파일 닫기 실패", e);
        }
    }
}
```

`finally` 안에서 또 try-catch를 써야 한다. 처음 이걸 봤을 때 "이게 맞나?" 싶었다. 실수할 포인트가 너무 많고, 피로하다.

Java 7에서 `try-with-resources` 가 나왔다. `try (...)` 안에 자원을 선언하면, 블록이 끝날 때 자동으로 `close()` 가 호출된다. 정상 종료든, 예외가 터지든 상관없이.

```java
try (BufferedReader reader = new BufferedReader(new FileReader("data.txt"))) {
    String line;
    while ((line = reader.readLine()) != null) {
        process(line);
    }
} catch (IOException e) {
    log.error("파일 읽기 실패", e);
}
```

훨씬 낫다. 자원이 여러 개면 세미콜론으로 구분하면 된다. 마지막에 선언한 것부터 역순으로 닫힌다.

```java
try (
    Connection conn = dataSource.getConnection();
    PreparedStatement stmt = conn.prepareStatement(sql);
    ResultSet rs = stmt.executeQuery()
) {
    while (rs.next()) {
        // 처리
    }
}
```

직접 만든 클래스도 이 기능을 쓸 수 있다. `AutoCloseable` 인터페이스를 구현하고 `close()` 메서드를 정의하면 된다. "닫을 수 있는 자원"이라고 JVM에게 알려주는 셈이다.

```java
public class HttpClient implements AutoCloseable {
    private final CloseableHttpClient client;

    public HttpClient() {
        this.client = HttpClients.createDefault();
    }

    public String get(String url) throws IOException {
        // HTTP 요청 처리
    }

    @Override
    public void close() throws Exception {
        client.close(); // try 블록이 끝나면 이게 자동으로 호출됨
    }
}

try (HttpClient client = new HttpClient()) {
    String response = client.get("https://api.example.com/data");
    process(response);
}
```

---

## Generic 클래스 한 번쯤은 직접 만들어봐야 한다

`List<String>`, `Map<String, Integer>` 처럼 꺽쇠 안에 타입을 넣는 건 누구나 쓴다. 그런데 저 꺽쇠를 **내가 직접 만드는** 건 처음엔 어색하다. 왠지 어렵고 고급진 느낌이라 손이 잘 안 간다.

핵심 개념만 먼저 짚고 가자. `<T>` 는 "어떤 타입이든 여기에 넣을 수 있어요" 라는 표시다. `T` 는 Type의 약자고 이름은 아무거나 써도 되는데 관례적으로 T, E, K, V 같은 걸 쓴다.

예를 들어 API 응답 포맷을 통일하고 싶다고 하자. 그냥 짜면 이렇게 된다.

```java
public class UserApiResponse {
    private boolean success;
    private String message;
    private UserDto data;      // 유저 조회 응답
}

public class OrderApiResponse {
    private boolean success;
    private String message;
    private OrderDto data;     // 주문 조회 응답
}
```

`success`, `message` 는 똑같은데 `data` 타입만 달라서 파일이 두 개다. API가 10개면 파일이 10개. Generic을 쓰면 하나로 통일된다.

```java
public class ApiResponse<T> {          // T 자리에 어떤 타입이든 들어올 수 있다
    private final boolean success;
    private final String message;
    private final T data;              // 실제 응답 데이터

    private ApiResponse(boolean success, String message, T data) {
        this.success = success;
        this.message = message;
        this.data = data;
    }

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, "OK", data);
    }

    public static <T> ApiResponse<T> fail(String message) {
        return new ApiResponse<>(false, message, null);
    }
}
```

컨트롤러에서는 이렇게 쓴다. `ApiResponse<UserDto>` 라고 쓰면 T 자리에 `UserDto` 가 들어간다.

```java
@GetMapping("/users/{id}")
public ResponseEntity<ApiResponse<UserDto>> getUser(@PathVariable Long id) {
    UserDto user = userService.findById(id);
    return ResponseEntity.ok(ApiResponse.ok(user));
}
```

`extends` 로 "이 타입의 자식만 받겠다" 는 제한도 걸 수 있다.

```java
// T가 Number를 상속한 타입이어야만 이 메서드를 쓸 수 있다
// Integer, Double, Long은 가능하지만 String은 컴파일 에러가 난다
public <T extends Number & Comparable<T>> T max(List<T> list) {
    return list.stream()
        .max(Comparator.naturalOrder())
        .orElseThrow(() -> new IllegalArgumentException("빈 리스트"));
}
```

`?` 와일드카드는 "타입이 뭔지 아예 모르거나 신경 안 써도 될 때" 쓴다.

```java
// 어떤 타입의 리스트든 출력만 하면 되니까 ? 로 충분
public void printAll(List<?> list) {
    list.forEach(System.out::println);
}

// Number 자식 타입이면 다 받겠다 — 읽기만 하고 추가는 안 됨
public double sum(List<? extends Number> numbers) {
    return numbers.stream().mapToDouble(Number::doubleValue).sum();
}
```

이걸 처음 보고 "왜 이렇게 만들어놨지?" 싶었는데, 나중에 내가 비슷한 중복 코드를 만들고 있는 걸 발견했다. 그때서야 Generic이 왜 필요한지 체감이 됐다.

---

## 메서드 이름이 거짓말을 하고 있을 때

이름은 "조회"인데 내부에서 카운트를 올리고 로그를 남기고 알림까지 보내는 메서드를 본 적이 있다. 아마 처음엔 작은 기능이었는데 거기에 계속 뭔가를 붙이다 보니 그렇게 됐을 거다. 이런 코드는 보는 순간 피로감이 온다.

```java
public User getUser(Long id) {
    User user = userRepository.findById(id).orElseThrow();
    user.setViewCount(user.getViewCount() + 1);  // 조회수 올리기
    userRepository.save(user);
    auditLog.record("USER_VIEW", id);             // 감사 로그 남기기
    return user;
}
```

`getUser` 라는 이름에서 "조회수 올리기"와 "감사 로그"는 전혀 예상이 안 된다. 이게 왜 문제냐면:

- **테스트하기 어렵다.** "그냥 유저 조회하는 테스트"를 쓰고 싶은데 카운트까지 올라가버린다.
- **재사용이 안 된다.** 다른 곳에서 유저를 조회할 때 카운트를 올리면 안 되는 상황이 오면 새 메서드를 또 만들어야 한다.
- **이런 게 쌓이면** 비슷하게 생긴 메서드가 여러 개 생기고 어디서 뭘 써야 할지 모르게 된다.

책임을 쪼개야 한다. 각 메서드가 딱 한 가지 일만 하게.

```java
public User getUser(Long id) {
    return userRepository.findById(id)
        .orElseThrow(() -> new UserNotFoundException(id));
}

public void recordUserView(Long id) {
    userRepository.incrementViewCount(id);
    auditLog.record("USER_VIEW", id);
}
```

파라미터 개수도 신경 쓰인다. 3개까지는 봐줄 만한데 4개 넘어가면 파라미터 객체를 고민해봐야 한다. 인수가 6개 나란히 있으면 솔직히 읽기 싫다.

```java
// 이게 뭔지 한눈에 파악이 안 된다
public Order createOrder(Long userId, Long productId, int quantity,
                         String address, String couponCode, boolean expressDelivery) { ... }

// Record로 묶으면 이름이 생긴다
public record CreateOrderRequest(
    Long userId, Long productId, int quantity,
    String address, String couponCode, boolean expressDelivery
) {}

public Order createOrder(CreateOrderRequest request) { ... }
```

`sendEmail(user, true)` 처럼 Boolean 파라미터를 넘기는 것도 마찬가지다. 저 `true` 가 뭘 의미하는지 메서드 시그니처를 직접 열어봐야 알 수 있다. 실제로 열어봤을 때 "이게 뭐지" 한 적이 한두 번이 아니다.

```java
// true 가 뭘 의미하는 건지 알 수가 없다
sendEmail(user, true);

// 이름이 있으면 바로 이해된다
sendEmail(user, EmailType.WELCOME);
sendWelcomeEmail(user);
```

---

## 테스트 짜기 어려운 코드가 나쁜 코드다

테스트를 쓰다 보면 "이게 왜 이렇게 짜기 어렵지?" 하는 순간이 온다. 그때 짜증을 테스트 탓으로 하지 말고 코드 탓을 해야 한다. 테스트가 어려운 건 대부분 설계가 잘못됐다는 신호다. 이걸 알고 나서 오히려 테스트가 좋아졌다.

JUnit 5 + Mockito 기본 구조다. 처음 보는 분들을 위해 빠르게 설명하면:
- `@Mock` — 진짜 DB 대신 가짜 Repository를 만든다
- `@InjectMocks` — 테스트할 서비스에 저 가짜 객체들을 주입한다
- `given(...)` — 가짜 객체가 어떻게 동작할지 미리 정의한다

```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;   // 진짜 DB 대신 가짜

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private OrderService orderService;         // 진짜 서비스, 위 가짜들이 주입됨

    @Test
    @DisplayName("주문 승인 시 알림이 발송되어야 한다")
    void approveOrder_shouldSendNotification() {
        // given: 이 상황을 가정한다
        Long orderId = 1L;
        Order order = Order.builder()
            .id(orderId)
            .status(OrderStatus.PENDING)
            .build();

        given(orderRepository.findById(orderId)).willReturn(Optional.of(order));

        // when: 이 동작을 한다
        orderService.approve(orderId);

        // then: 이 결과가 나와야 한다
        then(notificationService).should().notify(any(Order.class));
        assertThat(order.getStatus()).isEqualTo(OrderStatus.APPROVED);
    }

    @Test
    @DisplayName("존재하지 않는 주문 승인 시 예외가 발생해야 한다")
    void approveOrder_whenNotFound_shouldThrow() {
        given(orderRepository.findById(anyLong())).willReturn(Optional.empty());

        assertThatThrownBy(() -> orderService.approve(999L))
            .isInstanceOf(OrderNotFoundException.class)
            .hasMessageContaining("999");
    }
}
```

`given / when / then` 구조로 나눠두면 나중에 읽기 편하다. `@DisplayName` 에 조건과 기대 결과를 문장으로 쓰는 게 습관이 되면 테스트 코드가 스펙 문서 역할을 한다. 6개월 뒤에 이 테스트를 열었을 때 고마워지는 게 이 부분이다.

여러 케이스를 한 번에 검증하고 싶을 때 `@ParameterizedTest` 를 쓰면 같은 테스트 구조를 여러 데이터로 돌릴 수 있다.

```java
@ParameterizedTest
@CsvSource({
    "PENDING,   true",   // 대기 상태 → 취소 가능
    "APPROVED,  false",  // 승인됨 → 취소 불가
    "REJECTED,  false",
    "SHIPPED,   false"
})
@DisplayName("대기 상태인 주문만 취소 가능하다")
void isCancellable(OrderStatus status, boolean expected) {
    Order order = Order.builder().status(status).build();
    assertThat(order.isCancellable()).isEqualTo(expected);
}
```

커버리지 숫자보다 중요한 건 핵심 비즈니스 로직이 테스트되고 있느냐다. 100%를 채우려고 getter 테스트 만드는 건 솔직히 시간 낭비다.

---

## 멀티스레드 버그는 재현하기도 어렵다

동시성 버그는 특이하다. 개발 환경에서는 아무 문제 없다가 트래픽이 몰리면 갑자기 나온다. 재현하려고 하면 또 안 된다. 원인 찾는 동안 진짜 멘붕이 오는 케이스 중 하나다.

기본적인 것만 알고 있어도 흔한 실수는 피할 수 있다.

```java
public class Counter {
    private int count = 0;

    public void increment() {
        count++;
    }
}
```

이게 왜 위험하냐면 — `count++` 은 한 줄이지만 실제로 CPU 입장에서는 세 단계다.

1. count 값을 읽는다
2. 1을 더한다
3. 저장한다

두 스레드가 동시에 같은 값(예: 5)을 읽으면, 둘 다 6을 저장한다. 원래는 7이 되어야 하는데. 이런 게 수천 번 반복되면 카운트가 조용히 틀려진다. 단일 스레드 테스트에서는 절대 잡히지 않는다.

`synchronized` 를 붙이면 한 번에 한 스레드만 들어올 수 있게 잠근다.

```java
public class Counter {
    private int count = 0;

    public synchronized void increment() {
        count++;
    }

    public synchronized int getCount() {
        return count;
    }
}
```

단순한 정수 연산이라면 `AtomicInteger` 가 더 낫다. `synchronized` 는 잠금을 걸고 푸는 과정이 있어서 오버헤드가 있는데, `AtomicInteger` 는 그보다 가벼운 방식으로 원자성을 보장한다.

```java
import java.util.concurrent.atomic.AtomicInteger;

public class Counter {
    private final AtomicInteger count = new AtomicInteger(0);

    public void increment() {
        count.incrementAndGet(); // 읽기-증가-저장을 원자적으로 처리
    }

    public int getCount() {
        return count.get();
    }
}
```

`volatile` 이라는 것도 있다. 이건 좀 다른 문제를 해결하는데 — 여러 CPU 코어가 각자 캐시에 값을 가지고 있을 때, 한 스레드가 값을 바꿔도 다른 스레드가 못 보는 경우가 있다. `volatile` 은 항상 메인 메모리에서 읽고 쓰도록 강제해서 이 문제를 해결한다.

```java
// 스레드 종료 플래그처럼 "쓰는 건 하나, 읽는 건 여럿"인 단순한 경우에 적합
private volatile boolean running = true;

public void stop() {
    running = false; // 이 변경이 다른 스레드에서 즉시 보임
}
```

주의할 점은 `volatile` 은 가시성만 보장한다. `count++` 처럼 "읽고 → 더하고 → 쓰는" 복합 연산은 여전히 위험하다. 그런 경우는 `AtomicInteger` 를 써야 한다. 처음에 이 차이를 제대로 몰라서 `volatile` 붙이고 안심했다가 낭패 본 적이 있다.

동시성 코드는 직접 구현하는 것보다 `java.util.concurrent` 의 검증된 구현체를 활용하는 편이 훨씬 낫다. `ConcurrentHashMap`, `CopyOnWriteArrayList`, `BlockingQueue` 같은 것들이 있다.

---

## Stream, filter/map 그 이상

`filter`, `map`, `collect` 는 이제 기본인데 그 이상은 막히는 경우가 있다. `groupingBy` 같은 걸 처음 봤을 때 "이런 게 있었어?" 싶었다.

부서별로 직원을 그룹화한다고 하면 for 루프 짜지 않아도 된다. `groupingBy` 는 "이 기준으로 묶어줘"다.

```java
// employees 를 getDepartment() 값 기준으로 묶는다
Map<String, List<Employee>> byDepartment = employees.stream()
    .collect(Collectors.groupingBy(Employee::getDepartment));

// 부서별 평균 연봉 — groupingBy 두 번째 인수로 집계 방식을 지정할 수 있다
Map<String, Double> avgSalaryByDept = employees.stream()
    .collect(Collectors.groupingBy(
        Employee::getDepartment,
        Collectors.averagingInt(Employee::getSalary)
    ));
```

`flatMap` 은 "리스트 안에 리스트" 를 하나로 펼칠 때 쓴다. `map` 이랑 자꾸 헷갈리는데 — `map` 은 각 요소를 변환하고, `flatMap` 은 각 요소를 리스트로 변환한 다음 그걸 하나로 합친다.

```java
// orders 가 [주문A, 주문B] 이고
// 주문A.getProducts() 가 [상품1, 상품2] 라면
// flatMap 으로 [상품1, 상품2, 상품3, ...] 처럼 하나의 리스트로 만들 수 있다
List<Product> allProducts = orders.stream()
    .flatMap(order -> order.getProducts().stream())
    .collect(Collectors.toList());
```

Stream은 **게으르다(lazy)**. `filter`, `map` 같은 중간 연산은 `collect`, `findFirst` 같은 최종 연산이 호출되기 전까지 아무것도 실행하지 않는다. 파이프라인을 조립만 해두고 실행은 나중에 한다고 보면 된다.

```java
Optional<User> first = users.stream()
    .filter(u -> u.getAge() > 30)
    .map(User::toDto)
    .findFirst(); // 여기서야 실행 시작, 조건 맞는 첫 번째 찾으면 바로 멈춤
```

`findFirst()` 같은 경우 조건을 만족하는 첫 번째 요소를 찾는 순간 멈춰버린다. 리스트 전체를 다 처리하지 않아도 된다. 데이터가 많을 때 성능 차이가 꽤 난다.

---

## Optional, 잘못 쓰면 더 복잡해진다

`Optional` 은 "이 값이 있을 수도, 없을 수도 있다"는 걸 코드로 표현하는 방법이다. `null` 을 직접 다루는 대신 `Optional` 로 감싸서 처리한다.

처음 배우고 나서 뭔가 모든 곳에 쓰고 싶어지는 시기가 온다. 나도 그랬다. 근데 그러면 안 된다.

**써야 할 때**: 메서드 반환값이 없을 수 있을 때. 특히 DB 단건 조회가 대표적이다.

```java
Optional<User> findByEmail(String email);

// orElseThrow 로 없으면 예외를 던지도록 처리
User user = userRepository.findByEmail(email)
    .orElseThrow(() -> new UserNotFoundException("이메일: " + email));
```

**쓰면 안 되는 경우**를 정리하면:

```java
// 1. 필드에 쓰지 말 것 — 직렬화가 안 되고 메모리도 낭비됨
public class User {
    private Optional<String> phoneNumber; // 그냥 null 허용 String 으로 쓰면 됨
}

// 2. 메서드 파라미터로 쓰지 말 것
// 호출할 때 Optional.of(name) 을 만들어서 넘겨야 하는게 더 불편하다
public void update(Long id, Optional<String> name) { }

// 3. 컬렉션을 감싸지 말 것 — 없으면 빈 리스트를 반환하면 된다
Optional<List<User>> findAll(); // List<User> 가 낫다, 없으면 Collections.emptyList()
```

파라미터에 `Optional` 을 쓴 API를 처음 봤을 때 뭔가 이상하다는 느낌이 들었는데, 막상 왜 이상한지 설명하기 어려웠다. 호출하는 쪽을 써보니까 바로 알게 됐다.

체이닝 패턴은 알아두면 편하다. null 체크를 if 중첩으로 하지 않아도 된다.

```java
// order 가 null 일 수도, address 가 null 일 수도, city 가 null 일 수도 있는 상황
// Optional 체이닝으로 null 체크 없이 안전하게 꺼낼 수 있다
String zipCode = Optional.ofNullable(order)
    .map(Order::getAddress)
    .map(Address::getCity)
    .map(City::getZipCode)
    .orElse("00000"); // 중간에 하나라도 null 이면 "00000" 반환
```

---

## Interface를 무조건 만들지 않아도 된다

경험이 쌓이면 역설적으로 과도한 설계를 하게 되는 시기가 온다. Interface를 만들고, Factory를 만들고, Strategy 패턴을 넣는다. 뭔가 구조적으로 설계된 것 같고 좋아보인다. 실제로 나도 그 시기가 있었다.

구현체가 하나뿐인데 Interface가 있는 경우가 그렇다.

```java
public interface UserFinder {
    User findById(Long id);
}

public class UserFinderImpl implements UserFinder {
    @Override
    public User findById(Long id) { ... }
}
```

`UserFinderImpl` 말고 다른 구현이 생길 가능성이 없다면 이 Interface는 없애도 된다.

"테스트할 때 Mock 만들려면 Interface가 있어야 하지 않냐" 는 생각도 있는데, Mockito는 구현 클래스도 바로 Mock할 수 있다. Interface가 없어도 `@Mock UserFinderImpl` 이 된다. 나중에 이런 코드들을 정리하면서 "내가 왜 이걸 만들었지" 하며 웃었다.

설계 원칙은 현재의 문제를 해결하기 위한 도구다. "나중에 혹시 쓸 것 같으니까" 미리 만들어두는 게 아니다.

```java
// 5줄짜리 로직을 위해 Helper 클래스를 따로 만들 필요 없다
// 같은 클래스 안에 private 메서드로 충분하다
private String formatDisplayName(User user) {
    return user.getLastName() + " " + user.getFirstName();
}
```

코드를 줄이는 것 자체가 가치다. 지금 요구사항을 가장 단순하게 구현하면서 변경이 쉬운 구조를 만드는 게 좋은 설계다.

---

지금까지 쓴 게 한꺼번에 머리에 들어올 필요는 없다. Enum 짤 때 "동작을 넣을 수 있지 않을까?", DTO 만들 때 "Record로 할 수 있지 않을까?", 자원 쓸 때 `try-with-resources` — 이것만 자연스럽게 나오기 시작해도 코드 리뷰에서 받는 질문의 색깔이 달라진다.

그때 기분이 나쁘지 않다.

---

**관련 글**
- [Java 신입 개발자가 꼭 알아야 할 실무 팁 10가지](/posts/java-tips-for-junior-developers)
- [신입 백엔드 때 진짜로 혼났던 것들 — JPA, 트랜잭션, 예외처리](/posts/java-real-mistakes-backend)
