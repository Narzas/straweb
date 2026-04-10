---
title: 시니어가 절대 하지 않는 Spring Boot API 설계 실수 7가지 — 실무 아키텍처 가이드
date: 2026-04-10
cover: /images/dev/spring-api-design.svg
description: 돌아가는 API가 아니라 유지되는 API를 만들기 위해 반드시 피해야 할 설계 실수들을 실무 기준으로 정리했습니다.
category: 개발
tags: [Spring Boot, API 설계, 백엔드, 아키텍처, 실무팁]
---

## 왜 API는 "나중에" 망할까?

Spring Boot로 API 만드는 건 어렵지 않습니다.  
문제는 시간이 지나면서 점점 망가진다는 점입니다.

처음에는 빠르게 개발하려고 만든 구조가  
나중에는 수정 하나 할 때마다 전체를 건드려야 하는 상태가 됩니다.

**API는 처음이 아니라 "변경이 쌓일 때" 무너집니다**

---

## 1. Controller에 비즈니스 로직 넣기

가장 흔하게 보이는 패턴입니다.

```java
@PostMapping("/orders")
public ResponseEntity<?> createOrder(@RequestBody OrderRequest request) {
    // validation
    if (request.getAmount() <= 0) throw new RuntimeException("금액 오류");

    // 비즈니스 로직
    Order order = new Order();
    order.setUserId(request.getUserId());
    order.setAmount(request.getAmount());
    order.setStatus("PENDING");

    // 외부 API 호출
    paymentClient.requestPayment(order);

    // DB 저장
    orderRepository.save(order);

    return ResponseEntity.ok("success");
}
```

Controller는 HTTP 요청을 받아서 응답을 내려주는 역할만 해야 합니다.  
비즈니스 로직이 들어오는 순간, 이 코드는 테스트하기 어려워지고 재사용도 불가능해집니다.

### 개선 방법

```java
@PostMapping("/orders")
public ResponseEntity<OrderResponse> createOrder(@RequestBody @Valid OrderRequest request) {
    OrderResponse response = orderService.createOrder(request);
    return ResponseEntity.ok(response);
}
```

```java
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final PaymentClient paymentClient;

    @Transactional
    public OrderResponse createOrder(OrderRequest request) {
        Order order = Order.create(request.getUserId(), request.getAmount());
        paymentClient.requestPayment(order);
        orderRepository.save(order);
        return OrderResponse.from(order);
    }
}
```

Controller는 얇게, Service는 두껍게.  
이 원칙을 지켜야 나중에 로직을 수정할 때 Controller를 건드리지 않아도 됩니다.

---

## 2. Entity 그대로 API 응답으로 사용

```java
@GetMapping("/orders")
public List<Order> getOrders() {
    return orderRepository.findAll();  // Entity 직접 반환
}
```

이 코드는 처음엔 빠르게 동작합니다.  
그런데 실제로 벌어지는 일은 이렇습니다.

- DB 컬럼이 API 스펙에 그대로 노출됨
- 비밀번호, 내부 상태값 같은 민감 정보 유출 가능
- JPA 연관관계 때문에 무한 직렬화(`StackOverflowError`) 발생
- Entity 수정이 곧바로 API 스펙 변경으로 이어짐

### 개선 방법

```java
@Getter
public class OrderResponse {
    private Long orderId;
    private String status;
    private int amount;
    private LocalDateTime createdAt;

    public static OrderResponse from(Order order) {
        OrderResponse dto = new OrderResponse();
        dto.orderId = order.getId();
        dto.status = order.getStatus().name();
        dto.amount = order.getAmount();
        dto.createdAt = order.getCreatedAt();
        return dto;
    }
}
```

DTO는 귀찮은 작업이 맞습니다.  
그러나 Entity와 API 스펙을 분리하는 순간, DB 구조를 바꿔도 API 계약이 깨지지 않습니다.  
이게 1년 뒤의 나를 살려줍니다.

---

## 3. 예외 처리 기준 없음

실무에서 가장 많이 보이는 두 가지 패턴입니다.

```java
// 패턴 1 — 예외를 그냥 던짐
throw new RuntimeException("주문을 찾을 수 없습니다");

// 패턴 2 — 예외 응답이 제각각
{ "error": "fail" }
{ "message": "not found" }
{ "result": "error", "code": 404 }
```

API 소비자(프론트, 외부 시스템)는 이 응답들을 예측할 수 없습니다.  
예외 응답 구조가 다르면 클라이언트 에러 처리 코드도 매번 달라져야 합니다.

### 개선 방법

먼저 공통 예외 응답 구조를 정의합니다.

```java
@Getter
@AllArgsConstructor
public class ErrorResponse {
    private String code;
    private String message;

    public static ErrorResponse of(String code, String message) {
        return new ErrorResponse(code, message);
    }
}
```

그리고 `@RestControllerAdvice`로 예외를 중앙에서 처리합니다.

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(OrderNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleOrderNotFound(OrderNotFoundException e) {
        return ResponseEntity
            .status(HttpStatus.NOT_FOUND)
            .body(ErrorResponse.of("ORDER_NOT_FOUND", e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
            .map(FieldError::getDefaultMessage)
            .findFirst()
            .orElse("입력값 오류");
        return ResponseEntity
            .badRequest()
            .body(ErrorResponse.of("INVALID_INPUT", message));
    }
}
```

모든 예외 응답이 같은 구조로 나오면,  
클라이언트 개발자는 에러 응답 파싱 코드를 한 번만 짜도 됩니다.

---

## 4. 트랜잭션 범위를 크게 잡는 설계

```java
@Transactional
public void processOrder() {
    Order order = orderRepository.findById(id).orElseThrow();
    
    // 외부 결제 API 호출 — 최대 3초 소요
    PaymentResult result = paymentClient.requestPayment(order);
    
    // 파일 업로드 처리 — 최대 5초 소요
    fileService.uploadReceipt(result);
    
    // DB 저장
    order.confirm(result);
}
```

이 코드의 문제는 트랜잭션이 "외부 API 호출 + 파일 처리 + DB 저장"을 전부 감싸고 있다는 점입니다.

- 외부 API 호출 중 DB 커넥션을 잡고 있음
- 동시 요청이 많아지면 커넥션 풀 고갈
- 외부 API 타임아웃 3초 동안 락 유지

### 개선 방법

트랜잭션은 실제로 DB를 건드리는 구간에만 최소 범위로 적용합니다.

```java
public void processOrder(Long orderId) {
    Order order = orderRepository.findById(orderId).orElseThrow();

    // 외부 API — 트랜잭션 불필요
    PaymentResult result = paymentClient.requestPayment(order);

    // 파일 처리 — 트랜잭션 불필요
    fileService.uploadReceipt(result);

    // DB 저장 — 트랜잭션 필요
    confirmOrder(orderId, result);
}

@Transactional
public void confirmOrder(Long orderId, PaymentResult result) {
    Order order = orderRepository.findById(orderId).orElseThrow();
    order.confirm(result);
}
```

트랜잭션 시간 = DB 커넥션 점유 시간입니다.  
짧을수록 동시 처리량이 늘어납니다.

---

## 5. API 응답 구조가 일관되지 않음

팀이 커지면 이런 상황이 생깁니다.

```json
// A 개발자가 만든 API
{ "data": { "orderId": 1, "status": "PENDING" } }

// B 개발자가 만든 API
{ "result": "ok", "order": { "id": 1 } }

// C 개발자가 만든 API
{ "orderId": 1, "status": "PENDING", "success": true }
```

프론트 개발자는 API마다 응답 구조를 다르게 파싱해야 합니다.  
사소해 보이지만 API가 수십 개 쌓이면 유지보수 비용이 급격히 커집니다.

### 개선 방법

공통 응답 wrapper를 정의하고 팀 전체가 동일하게 사용합니다.

```java
@Getter
@AllArgsConstructor
public class ApiResponse<T> {
    private boolean success;
    private T data;
    private String message;

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, data, null);
    }

    public static <T> ApiResponse<T> fail(String message) {
        return new ApiResponse<>(false, null, message);
    }
}
```

```java
// 모든 Controller에서 동일한 구조로 응답
@GetMapping("/orders/{id}")
public ResponseEntity<ApiResponse<OrderResponse>> getOrder(@PathVariable Long id) {
    OrderResponse order = orderService.findById(id);
    return ResponseEntity.ok(ApiResponse.ok(order));
}
```

```json
{
  "success": true,
  "data": { "orderId": 1, "status": "PENDING" },
  "message": null
}
```

응답 구조를 통일하면 프론트 개발자와의 협업 비용이 확연히 줄어듭니다.

---

## 6. API 버전 관리 없음

```
GET /api/orders
```

서비스가 성장하면 반드시 마주치는 상황입니다.

- 모바일 앱 구버전 사용자는 아직 옛날 API를 씁니다
- 프론트를 새로 바꿨는데 기존 스펙을 바꾸면 구버전 앱이 깨집니다
- 결국 레거시 코드를 무한정 유지해야 합니다

### 개선 방법

처음부터 URL에 버전을 박아 넣습니다.

```java
// v1 Controller — 기존 클라이언트용
@RestController
@RequestMapping("/api/v1/orders")
public class OrderV1Controller {
    // ...
}

// v2 Controller — 신규 스펙 적용
@RestController
@RequestMapping("/api/v2/orders")
public class OrderV2Controller {
    // ...
}
```

```
GET /api/v1/orders  → 구버전 모바일 앱
GET /api/v2/orders  → 신규 웹/앱
```

버전 없이 API를 제공하면  
"한 번 배포한 스펙을 절대 바꿀 수 없는" 상태가 됩니다.  
나중에 버전을 추가하는 건 이미 늦습니다.

---

## 7. 확장성 고려 없는 구조

단일 기능 추가가 전체를 건드리게 되는 구조입니다.

```java
// 하나의 메서드가 너무 많은 것을 알고 있음
public void createOrder(OrderRequest request) {
    validateUser(request.getUserId());       // 유저 검증
    checkInventory(request.getProductId()); // 재고 확인
    calculateDiscount(request);              // 할인 계산
    processPayment(request);                 // 결제 처리
    sendNotification(request.getUserId());  // 알림 발송
    updateStatistics(request);               // 통계 갱신
}
```

기능이 추가될수록 이 메서드는 계속 커집니다.  
할인 로직을 바꾸려면 결제 코드 옆을 건드려야 하고,  
테스트하려면 전체 의존성을 다 준비해야 합니다.

### 개선 방법

책임을 분리하고, 후처리는 이벤트로 분리합니다.

```java
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderValidator orderValidator;
    private final PaymentService paymentService;
    private final OrderRepository orderRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public OrderResponse createOrder(OrderRequest request) {
        // 핵심 비즈니스 로직만
        orderValidator.validate(request);
        Order order = Order.create(request);
        paymentService.process(order);
        orderRepository.save(order);

        // 부가 처리는 이벤트로 분리
        eventPublisher.publishEvent(new OrderCreatedEvent(order));

        return OrderResponse.from(order);
    }
}
```

```java
@Component
public class OrderEventListener {

    @EventListener
    public void onOrderCreated(OrderCreatedEvent event) {
        notificationService.sendOrderConfirm(event.getOrder());
        statisticsService.record(event.getOrder());
    }
}
```

핵심 로직과 부가 로직을 이벤트로 분리하면  
알림 발송 방식이 바뀌어도 `OrderService`는 건드리지 않아도 됩니다.

---

## 7가지 요약

| 번호 | 문제 | 핵심 원칙 |
|------|------|----------|
| 1 | Controller에 비즈니스 로직 | Controller는 얇게, Service는 두껍게 |
| 2 | Entity 직접 반환 | 항상 DTO/Response 객체로 변환 |
| 3 | 예외 처리 기준 없음 | `@RestControllerAdvice`로 중앙화 |
| 4 | 트랜잭션 범위 과도 | DB 작업 구간에만 최소 범위 적용 |
| 5 | 응답 구조 불일치 | 공통 `ApiResponse<T>` wrapper 정의 |
| 6 | API 버전 관리 없음 | 처음부터 `/api/v1/` 구조로 시작 |
| 7 | 확장성 고려 없는 구조 | 부가 처리는 이벤트로 분리 |

---

## 마무리

API 설계는 "미래를 대비하는 선택"입니다.

처음 개발할 때 조금 더 신경 쓰는 것이  
6개월 후에 전체를 뜯어고치는 것보다 훨씬 적은 비용입니다.

**돌아가는 API보다 유지되는 API를 만드는 것**  
그게 시니어 개발자가 가장 먼저 생각하는 기준입니다.
