---
title: Next.js + Supabase 실전 조합 — 이 스택으로 뭐든 만들 수 있다
date: 2026-04-14T21:00:00+09:00
cover: /images/dev/nextjs-supabase.svg
description: Next.js App Router와 Supabase를 연동하는 방법을 처음부터 끝까지 정리했습니다. DB 조회, 인증, 실시간 기능까지 실제 코드 위주로 설명합니다.
category: 개발
tags: [Next.js, Supabase, App Router, 풀스택, 백엔드]
---

사이드 프로젝트를 시작할 때마다 "이번엔 뭐 쓰지?" 하고 고민하는 게 루틴이 됐는데, 요즘은 Next.js + Supabase 조합으로 거의 굳혔습니다. 백엔드 서버 따로 안 올려도 되고, 인증부터 DB까지 한 방에 해결되니까요.

이 글은 **계정 만들기부터 실제 데이터 꺼내 쓰는 것까지** 따라만 하면 바로 동작하는 앱이 나오도록 순서대로 정리했습니다. 개념 설명보다는 실제 쓰는 코드 위주로 갑니다.

---

## 🤔 왜 이 조합인가

Next.js만 쓰면 DB가 없고, Firebase 쓰면 SQL이 그리워지고, 직접 서버 올리자니 귀찮습니다. Supabase는 PostgreSQL 기반이라 SQL 쿼리를 그대로 쓸 수 있고, JavaScript 클라이언트 라이브러리도 잘 만들어져 있습니다.

Next.js App Router와 궁합이 특히 좋은 이유는 **Server Component에서 Supabase 클라이언트를 직접 써도 된다**는 점입니다. API 라우트 없이 DB 결과를 컴포넌트에서 바로 렌더링할 수 있어서 코드가 훨씬 단순해집니다.

---

## 🚀 1. 프로젝트 세팅

Node.js 18 이상이 설치된 환경이라면 지금 바로 시작할 수 있습니다.

### Next.js 앱 생성

```bash
npx create-next-app@latest my-app --typescript --app
cd my-app
```

실행하면 몇 가지를 물어봅니다. 취향대로 골라도 되지만 한 가지만 꼭 지켜야 합니다.

```
Would you like to use App Router? › Yes  ← 반드시 Yes
```

이 글 전체가 App Router 기준입니다. Pages Router를 선택하면 뒤에 나오는 코드가 전혀 맞지 않습니다. ESLint, Tailwind CSS, `src/` 디렉터리 여부는 프로젝트 성격에 맞게 자유롭게 선택하면 됩니다.

> **⚠️ 흔한 실수** — `--app` 플래그를 붙였는데도 설치 중 App Router 선택지에서 No를 누르면 Pages Router로 생성됩니다. 플래그보다 대화형 선택이 우선이니 주의하세요.

### Supabase 패키지 설치

```bash
npm install @supabase/supabase-js @supabase/ssr
```

두 패키지를 동시에 설치하는 이유가 있습니다.

- `@supabase/supabase-js` — Supabase의 핵심 클라이언트입니다. DB 쿼리, Auth, Realtime 등 실제 기능이 여기 있습니다.
- `@supabase/ssr` — Next.js App Router처럼 SSR 환경에서 쿠키 기반 세션을 다루기 위한 래퍼입니다. 이게 없으면 서버 컴포넌트에서 로그인 상태를 유지하기가 복잡해집니다.

> **⚠️ 주의** — 예전에는 `@supabase/auth-helpers-nextjs`를 많이 썼는데 지금은 deprecated 됐습니다. 검색하면 이 패키지 기준 글이 아직 많이 나오니 헷갈리지 않도록 주의하세요. 새 프로젝트라면 반드시 `@supabase/ssr`로 시작하세요.

### Supabase 프로젝트 생성 및 키 발급

[supabase.com](https://supabase.com)에서 계정을 만들고 새 프로젝트를 생성합니다. 프로젝트 이름과 DB 비밀번호, 리전(Region)을 설정하면 1분 안에 프로비저닝이 끝납니다.

**리전은 `Northeast Asia (Seoul)`을 선택하면 국내 사용자 기준으로 응답 속도가 가장 빠릅니다.**

프로젝트가 생성되면 **Settings → API** 메뉴로 이동합니다. 여기서 세 가지 값을 확인할 수 있습니다.

| 항목 | 용도 | 공개 여부 |
|------|------|-----------|
| Project URL | Supabase 서버 주소 | 공개 가능 |
| anon public key | 클라이언트용 공개 키 | 공개 가능 |
| service_role key | RLS 우회 관리자 키 | **절대 노출 금지** |

이 중 **Project URL과 anon key**만 `.env.local`에 넣으면 됩니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

`NEXT_PUBLIC_` 접두사가 붙은 변수는 브라우저에서도 읽을 수 있습니다. anon key는 원래 공개되어도 되는 키로, 실제로 어떤 데이터에 접근할 수 있는지는 **Row Level Security(RLS)** 가 제어합니다.

반면 `service_role` 키는 RLS를 전부 우회하는 관리자 키입니다. 서버 전용 환경변수로만 쓰고 절대 클라이언트에 노출하면 안 됩니다.

`.env.local`은 `.gitignore`에 이미 포함되어 있으니 Git에 올라갈 걱정은 안 해도 됩니다. Vercel에 배포할 때는 **Settings → Environment Variables**에 동일하게 등록해줘야 합니다.

> **⚠️ 트러블슈팅** — 환경변수를 추가했는데 `undefined`가 뜬다면, 개발 서버를 재시작했는지 확인하세요. `.env.local` 변경 사항은 서버를 껐다 켜야 반영됩니다.

---

## 🔧 2. Supabase 클라이언트 만들기

App Router에서는 서버용과 클라이언트용 인스턴스를 **반드시 분리**해서 만들어야 합니다. 같은 파일로 통일하고 싶은 마음이 들 수 있는데, 서버에선 쿠키를 직접 다뤄야 하기 때문에 구조가 다릅니다.

**서버용 (`utils/supabase/server.ts`)**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

**클라이언트용 (`utils/supabase/client.ts`)**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

> **⚠️ 흔한 실수** — 서버 컴포넌트에서 `utils/supabase/client.ts`를 import하면 빌드 에러가 납니다. `createBrowserClient`는 `window` 객체에 의존하기 때문입니다. 서버 컴포넌트에는 반드시 `server.ts`를 쓰세요.

---

## 📦 3. Server Component에서 DB 조회

이게 이 스택의 핵심입니다. `async` 컴포넌트 안에서 DB 데이터를 바로 꺼내 쓸 수 있습니다.

```typescript
// app/posts/page.tsx
import { createClient } from '@/utils/supabase/server'

export default async function PostsPage() {
  const supabase = await createClient()
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, title, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) return <p>불러오기 실패</p>

  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

`fetch` 따로 없고, `useEffect` 없고, 상태 관리도 없습니다. 그냥 읽어서 렌더링합니다.

> **⚠️ 트러블슈팅** — `data`가 빈 배열로 오거나 `error`에 `permission denied`가 뜬다면 RLS 문제입니다. Supabase 대시보드에서 **Authentication → Policies** 메뉴로 이동해 해당 테이블에 SELECT 정책을 추가해주세요. 개발 중에 빠르게 테스트하고 싶다면 임시로 `Enable read access for all users` 정책을 켜도 됩니다. 다만 프로덕션에선 반드시 세분화된 정책을 설정해야 합니다.

---

## ✏️ 4. 데이터 삽입 — Server Action 활용

Next.js의 Server Action을 쓰면 API 라우트를 따로 만들지 않아도 서버에서 데이터를 쓸 수 있습니다.

```typescript
// app/posts/new/actions.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function createPost(formData: FormData) {
  const supabase = await createClient()
  const title = formData.get('title') as string
  const content = formData.get('content') as string

  const { error } = await supabase
    .from('posts')
    .insert({ title, content })

  if (error) throw new Error(error.message)
  redirect('/posts')
}
```

```typescript
// app/posts/new/page.tsx
import { createPost } from './actions'

export default function NewPostPage() {
  return (
    <form action={createPost}>
      <input name="title" placeholder="제목" />
      <textarea name="content" placeholder="내용" />
      <button type="submit">저장</button>
    </form>
  )
}
```

폼을 제출하면 Server Action이 실행되고, 완료 후 `/posts`로 리다이렉트됩니다. 전통적인 HTML 폼처럼 보이지만 Next.js가 뒤에서 다 처리합니다.

> **⚠️ 트러블슈팅** — `insert`에서 `new row violates row-level security policy` 에러가 나면, 해당 테이블에 INSERT 정책이 없는 겁니다. 로그인한 사용자만 삽입 가능하게 하려면 Supabase 대시보드에서 아래 정책을 추가하세요.
>
> ```sql
> CREATE POLICY "로그인한 사용자만 삽입 가능"
> ON posts FOR INSERT
> TO authenticated
> WITH CHECK (true);
> ```

---

## 🔐 5. 인증 연동

Supabase Auth는 이메일/비밀번호, OAuth(Google, GitHub 등)를 지원합니다. 세션을 모든 요청에서 자동으로 확인하려면 미들웨어에 설정을 추가해야 합니다.

**미들웨어 (`middleware.ts`)**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // 로그인이 필요한 페이지 보호
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

로그인 처리는 Server Action으로 간단하게 만들 수 있습니다.

```typescript
// app/login/actions.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) throw new Error(error.message)
  redirect('/dashboard')
}
```

> **⚠️ 트러블슈팅** — 로그인 후 서버 컴포넌트에서 여전히 `user`가 `null`로 뜬다면, 미들웨어가 세션 쿠키를 갱신하지 못하고 있는 겁니다. `middleware.ts`가 프로젝트 루트에 있는지, `matcher` 패턴이 해당 경로를 포함하는지 먼저 확인하세요. 미들웨어가 실행되지 않으면 쿠키 갱신 자체가 안 됩니다.

---

## ⚡ 6. 실시간 기능 (Realtime)

Supabase는 PostgreSQL 변경 사항을 WebSocket으로 실시간 스트리밍해줍니다. 채팅, 알림, 실시간 업데이트 같은 기능에 쓸 수 있습니다.

이건 클라이언트 컴포넌트에서만 동작합니다.

```typescript
'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'

type Message = { id: string; content: string }

export default function ChatFeed() {
  const [messages, setMessages] = useState<Message[]>([])
  const supabase = createClient()

  useEffect(() => {
    // 기존 메시지 초기 로드
    supabase
      .from('messages')
      .select('*')
      .order('created_at')
      .then(({ data }) => {
        if (data) setMessages(data)
      })

    // 실시간 구독 등록
    const channel = supabase
      .channel('messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <ul>
      {messages.map((msg) => (
        <li key={msg.id}>{msg.content}</li>
      ))}
    </ul>
  )
}
```

INSERT 이벤트가 발생할 때마다 상태가 자동으로 업데이트됩니다.

> **⚠️ 트러블슈팅** — 구독을 설정했는데 이벤트가 아무것도 안 온다면, Supabase 대시보드에서 **Database → Replication** 메뉴를 확인하세요. 해당 테이블의 Realtime이 비활성화되어 있으면 이벤트가 전송되지 않습니다. 토글을 켜주면 바로 동작합니다.

---

## ✅ 마무리

| 기능 | 담당 |
|------|------|
| UI 렌더링 | Next.js Server/Client Component |
| DB 읽기 | Supabase (서버 컴포넌트에서 직접) |
| DB 쓰기 | Supabase (Server Action 통해) |
| 인증 | Supabase Auth + 미들웨어 |
| 실시간 | Supabase Realtime (클라이언트 컴포넌트) |

처음엔 서버 클라이언트/브라우저 클라이언트를 분리하는 게 헷갈릴 수 있는데, 한 번 손에 익으면 별거 아닙니다. **"서버에서 읽고, 서버에서 쓰고, 실시간만 클라이언트"** 이렇게 기억해두면 됩니다.

이 글의 코드는 전부 실제로 동작하는 코드입니다. 위에서부터 순서대로 따라오면 오늘 안에 데이터를 읽고 쓰는 앱 하나를 완성할 수 있습니다. 백엔드 서버 없이 이 정도 기능을 갖춘 앱을 만들 수 있다는 게 아직도 조금 신기합니다. 사이드 프로젝트 빠르게 띄우기엔 이만한 조합이 없는 것 같습니다. 🙌
