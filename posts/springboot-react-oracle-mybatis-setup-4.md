---
title: "Spring Boot + React + Oracle + MyBatis 셋팅 — 4편: React 프로젝트 생성 & API 연동"
date: 2026-04-12T17:35:00+09:00
description: Vite로 React 프로젝트를 만들고 axios로 Spring Boot API를 호출해 회원 목록을 화면에 출력합니다. 프론트와 백이 연결되는 순간입니다.
category: 개발
tags: [React, SpringBoot, axios, 풀스택, 초보자, 프론트엔드]
cover: /images/dev/springboot-fullstack-4.svg
---

> **시리즈 목차**
> - 1편: 개발 환경 준비
> - 2편: Spring Boot 프로젝트 생성 & Oracle 연결
> - 3편: MyBatis 설정 & CRUD API 만들기
> - **4편: React 프로젝트 생성 & Spring Boot API 연동** ← 지금 여기

---

## React 프로젝트 만들기

터미널을 열고 프로젝트를 만들 상위 폴더로 이동 후 실행합니다.

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install
```

> **왜 Vite인가요?** 예전엔 `create-react-app`을 많이 썼는데, 빌드 속도가 너무 느립니다. 요즘은 **Vite**가 표준입니다. 개발 서버 시작이 1~2초면 됩니다.

---

## 폴더 구조 정리

기본 생성된 파일 중 불필요한 것을 정리합니다.

```
frontend/
├── src/
│   ├── api/           ← 새로 만들기 (API 호출 모음)
│   ├── components/    ← 새로 만들기 (재사용 컴포넌트)
│   ├── pages/         ← 새로 만들기 (페이지 컴포넌트)
│   ├── App.jsx
│   └── main.jsx
├── index.html
└── package.json
```

`src/App.css`, `src/assets/react.svg` 등 기본 파일은 삭제해도 됩니다.

---

## axios 설치

API 호출에 axios를 씁니다.

```bash
npm install axios
```

---

## API 설정 파일 만들기

`src/api/api.js` 생성:

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8080/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
```

`baseURL`을 여기서 한 번만 설정하면, 이후에는 `/members`처럼 경로만 쓸 수 있습니다.

---

## 회원 API 함수 만들기

`src/api/memberApi.js` 생성:

```javascript
import api from './api';

// 전체 조회
export const getMembers = () => api.get('/members');

// 단건 조회
export const getMember = (id) => api.get(`/members/${id}`);

// 등록
export const createMember = (data) => api.post('/members', data);

// 수정
export const updateMember = (id, data) => api.put(`/members/${id}`, data);

// 삭제
export const deleteMember = (id) => api.delete(`/members/${id}`);
```

---

## 회원 목록 페이지 만들기

`src/pages/MemberList.jsx` 생성:

```jsx
import { useEffect, useState } from 'react';
import { getMembers, deleteMember } from '../api/memberApi';
import MemberForm from '../components/MemberForm';

export default function MemberList() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  // 목록 불러오기
  const fetchMembers = async () => {
    try {
      const res = await getMembers();
      setMembers(res.data);
    } catch (err) {
      console.error('목록 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  // 삭제
  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      await deleteMember(id);
      fetchMembers(); // 목록 새로고침
    } catch (err) {
      alert('삭제 실패');
    }
  };

  // 수정 버튼
  const handleEdit = (member) => {
    setEditTarget(member);
    setShowForm(true);
  };

  // 폼 닫기
  const handleFormClose = () => {
    setShowForm(false);
    setEditTarget(null);
    fetchMembers();
  };

  if (loading) return <p>불러오는 중...</p>;

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1>회원 목록</h1>
        <button
          onClick={() => setShowForm(true)}
          style={{ padding: '8px 16px', background: '#4a90d9', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          + 회원 등록
        </button>
      </div>

      {showForm && (
        <MemberForm
          editTarget={editTarget}
          onClose={handleFormClose}
        />
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={thStyle}>ID</th>
            <th style={thStyle}>이름</th>
            <th style={thStyle}>이메일</th>
            <th style={thStyle}>전화번호</th>
            <th style={thStyle}>등록일</th>
            <th style={thStyle}>관리</th>
          </tr>
        </thead>
        <tbody>
          {members.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#888' }}>
                등록된 회원이 없습니다.
              </td>
            </tr>
          ) : (
            members.map((m) => (
              <tr key={m.memberId} style={{ borderBottom: '1px solid #eee' }}>
                <td style={tdStyle}>{m.memberId}</td>
                <td style={tdStyle}>{m.userName}</td>
                <td style={tdStyle}>{m.email}</td>
                <td style={tdStyle}>{m.phone || '-'}</td>
                <td style={tdStyle}>{m.regDate}</td>
                <td style={tdStyle}>
                  <button onClick={() => handleEdit(m)} style={btnStyle('#f0a500')}>수정</button>
                  {' '}
                  <button onClick={() => handleDelete(m.memberId)} style={btnStyle('#e53935')}>삭제</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const thStyle = { padding: '10px 12px', textAlign: 'left', fontWeight: '600' };
const tdStyle = { padding: '10px 12px' };
const btnStyle = (bg) => ({
  padding: '4px 10px', background: bg, color: 'white',
  border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px',
});
```

---

## 회원 등록/수정 폼 컴포넌트

`src/components/MemberForm.jsx` 생성:

```jsx
import { useState, useEffect } from 'react';
import { createMember, updateMember } from '../api/memberApi';

export default function MemberForm({ editTarget, onClose }) {
  const [form, setForm] = useState({
    userName: '',
    email: '',
    phone: '',
  });

  // 수정일 경우 기존 데이터 채우기
  useEffect(() => {
    if (editTarget) {
      setForm({
        userName: editTarget.userName,
        email: editTarget.email,
        phone: editTarget.phone || '',
      });
    }
  }, [editTarget]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editTarget) {
        await updateMember(editTarget.memberId, form);
        alert('수정 완료!');
      } else {
        await createMember(form);
        alert('등록 완료!');
      }
      onClose();
    } catch (err) {
      alert('저장 실패: ' + err.message);
    }
  };

  return (
    <div style={{
      background: '#f9f9f9', border: '1px solid #ddd',
      borderRadius: '8px', padding: '20px', marginBottom: '20px',
    }}>
      <h3 style={{ marginTop: 0 }}>{editTarget ? '회원 수정' : '회원 등록'}</h3>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '12px' }}>
          <label>이름 *</label><br />
          <input
            name="userName"
            value={form.userName}
            onChange={handleChange}
            required
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label>이메일 *</label><br />
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            required
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label>전화번호</label><br />
          <input
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="010-0000-0000"
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="submit" style={{ padding: '8px 20px', background: '#4a90d9', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            {editTarget ? '수정' : '등록'}
          </button>
          <button type="button" onClick={onClose} style={{ padding: '8px 20px', background: '#888', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            취소
          </button>
        </div>
      </form>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '8px 10px', marginTop: '4px',
  border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px',
  boxSizing: 'border-box',
};
```

---

## App.jsx 수정

`src/App.jsx`:

```jsx
import MemberList from './pages/MemberList';

function App() {
  return <MemberList />;
}

export default App;
```

---

## 실행 및 테스트

터미널 두 개를 열어서 각각 실행합니다.

**터미널 1 — Spring Boot:**
```bash
# IntelliJ에서 실행하거나
cd backend
./gradlew bootRun
```

**터미널 2 — React:**
```bash
cd frontend
npm run dev
```

브라우저에서 `http://localhost:5173` 접속 (Vite 기본 포트)

회원 목록이 보이면 성공입니다!

---

## 자주 나오는 에러

### CORS 에러

```
Access to XMLHttpRequest at 'http://localhost:8080/api/members' 
from origin 'http://localhost:5173' has been blocked by CORS policy
```

3편에서 만든 `WebConfig.java`의 `allowedOrigins`에 `5173` 포트를 추가합니다:

```java
.allowedOrigins("http://localhost:3000", "http://localhost:5173")
```

### Network Error

Spring Boot 서버가 실행 중인지 확인. 서버가 꺼져 있으면 axios 요청 자체가 실패합니다.

---

## 시리즈 마무리

4편에 걸쳐 아래 스택을 처음부터 완성했습니다:

```
React (Vite, 5173)
  │  axios HTTP 요청
  ▼
Spring Boot (8080)
  │  MemberController → MemberService → MemberMapper
  ▼
Oracle XE (1521)
  └  MEMBER 테이블
```

실무에서 쓰는 구조와 거의 동일합니다. 여기서 테이블과 기능을 추가해가면서 진짜 프로젝트로 키울 수 있습니다.

### 다음에 추가해볼 것

- **페이징 처리**: MyBatis + Oracle `ROWNUM`으로 페이징
- **검색 기능**: MyBatis `<if>` 동적 쿼리
- **JWT 인증**: Spring Security + JWT 토큰
- **파일 업로드**: MultipartFile + Oracle BLOB
- **React Router**: 여러 페이지 전환
