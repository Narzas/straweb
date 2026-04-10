import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description: "StraWeb 운영자에게 문의하세요.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <section className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">Contact</h1>
        <p className="text-lg text-gray-600">
          아래 양식을 통해 문의해 주세요. 최대한 빠르게 답변드리겠습니다.
        </p>
      </section>

      <hr className="border-gray-200" />

      {/* Contact form */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        현재 메일 전송 기능은 준비 중입니다. 아래 이메일로 직접 연락해 주세요.
      </div>

      <form className="space-y-6 opacity-50 pointer-events-none" aria-disabled="true">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              이름 <span className="text-red-400">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="홍길동"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              이메일 <span className="text-red-400">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="hello@example.com"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="subject" className="block text-sm font-medium text-gray-700">
            제목
          </label>
          <input
            id="subject"
            name="subject"
            type="text"
            placeholder="문의 제목을 입력해 주세요"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="message" className="block text-sm font-medium text-gray-700">
            메시지 <span className="text-red-400">*</span>
          </label>
          <textarea
            id="message"
            name="message"
            rows={6}
            required
            placeholder="문의 내용을 자세히 작성해 주세요"
            className="w-full resize-none rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
          />
        </div>

        <button
          type="submit"
          disabled
          className="w-full rounded-lg bg-gray-300 px-6 py-3 text-sm font-semibold text-gray-500 cursor-not-allowed sm:w-auto"
        >
          보내기 (준비 중)
        </button>
      </form>

      <hr className="border-gray-200" />

      {/* Other contact methods */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "이메일", value: "sdj3338@naver.com", icon: "✉️", href: "mailto:sdj3338@naver.com" },
          { label: "Twitter", value: "@0xStragos", icon: "🐦", href: "https://x.com/0xStragos" },
        ].map(({ label, value, icon, href }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center space-y-1"
          >
            <div className="text-2xl">{icon}</div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
            <a
              href={href}
              target={href.startsWith("mailto") ? undefined : "_blank"}
              rel="noopener noreferrer"
              className="text-sm font-medium text-indigo-600 hover:underline"
            >
              {value}
            </a>
          </div>
        ))}
      </section>
    </div>
  );
}
