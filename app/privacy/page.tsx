import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "StraWeb 개인정보 처리방침입니다.",
  alternates: { canonical: "/privacy" },
  robots: { index: false }, // 검색 노출 불필요
};

const LAST_UPDATED = "2026-04-14";

const sections = [
  {
    title: "1. 수집하는 개인정보",
    content: `본 블로그는 다음과 같은 개인정보를 수집할 수 있습니다.

• 문의 양식을 통해 제출한 이름, 이메일 주소, 메시지 내용
• 웹사이트 방문 시 자동으로 수집되는 IP 주소, 브라우저 정보, 접속 시간
• 쿠키 및 유사 기술을 통해 수집되는 사용 패턴 정보`,
  },
  {
    title: "2. 개인정보 수집 및 이용 목적",
    content: `수집한 개인정보는 다음의 목적을 위해 활용됩니다.

• 문의사항 답변 및 고객 응대
• 서비스 개선 및 사용자 경험 향상
• 통계 분석 및 트래픽 모니터링`,
  },
  {
    title: "3. 개인정보 보유 및 이용 기간",
    content: `수집된 개인정보는 목적이 달성된 후 즉시 파기합니다. 단, 관련 법령에 의거하여 보존이 필요한 경우 해당 기간 동안 보관합니다.`,
  },
  {
    title: "4. 쿠키 사용",
    content: `본 블로그는 서비스 개선을 위해 쿠키를 사용할 수 있습니다. 브라우저 설정을 통해 쿠키 사용을 거부할 수 있으나, 일부 서비스 이용이 제한될 수 있습니다.`,
  },
  {
    title: "5. 제3자 서비스",
    content: `본 블로그는 다음과 같은 제3자 서비스를 이용합니다.

• Google AdSense — 광고 서비스 제공
• Supabase — 방문자 수 집계 및 댓글 데이터 저장
• 쿠팡 파트너스 — 제휴 마케팅 링크 제공 (수수료 수취 가능)
• Telegram — 소식 피드 연동

각 서비스의 개인정보 처리방침은 해당 서비스의 정책을 따릅니다.`,
  },
  {
    title: "6. 개인정보 보호 조치",
    content: `수집된 개인정보는 불법적인 접근, 변조, 유출로부터 보호하기 위해 기술적·관리적 보호 조치를 취하고 있습니다.`,
  },
  {
    title: "7. 정보 주체의 권리",
    content: `이용자는 언제든지 수집된 개인정보에 대해 열람, 정정, 삭제, 처리 정지를 요청할 수 있습니다. 요청 사항은 문의 페이지를 통해 접수해 주시기 바랍니다.`,
  },
  {
    title: "8. 방침 변경",
    content: `개인정보 처리방침이 변경될 경우 블로그 내 공지사항을 통해 안내드립니다. 변경된 방침은 공지 후 7일이 경과한 날부터 효력이 발생합니다.`,
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <section className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Privacy Policy</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">최종 업데이트: {LAST_UPDATED}</p>
        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
          StraWeb(이하 "본 블로그")은 이용자의 개인정보를 소중히 여기며, 관련 법령을 준수합니다.
          본 방침은 수집하는 정보의 종류와 이용 방법을 안내합니다.
        </p>
      </section>

      <hr className="border-gray-200 dark:border-slate-700" />

      <div className="space-y-8">
        {sections.map(({ title, content }) => (
          <section key={title} className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
            <div className="text-sm leading-relaxed text-gray-600 dark:text-gray-400 whitespace-pre-line">
              {content}
            </div>
          </section>
        ))}
      </div>

      <hr className="border-gray-200 dark:border-slate-700" />

      <section className="rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-5 space-y-2">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">문의</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          개인정보 처리방침에 관한 문의사항은{" "}
          <a href="/contact" className="text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-800 dark:hover:text-indigo-300">
            문의 페이지
          </a>
          를 통해 접수해 주시기 바랍니다.
        </p>
      </section>
    </div>
  );
}
