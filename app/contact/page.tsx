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
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Contact</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          아래 양식을 통해 문의해 주세요. 최대한 빠르게 답변드리겠습니다.
        </p>
      </section>

      <hr className="border-gray-200 dark:border-slate-700" />

      {/* Contact form */}
      <div className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
        현재 메일 전송 기능은 준비 중입니다. 아래 이메일로 직접 연락해 주세요.
      </div>

      <form className="space-y-6 opacity-50 pointer-events-none" aria-disabled="true">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              이름 <span className="text-red-400">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="name"
              placeholder="홍길동"
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              이메일 <span className="text-red-400">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="hello@example.com"
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 transition"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            제목
          </label>
          <input
            id="subject"
            name="subject"
            type="text"
            placeholder="문의 제목을 입력해 주세요"
            className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 transition"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            메시지 <span className="text-red-400">*</span>
          </label>
          <textarea
            id="message"
            name="message"
            rows={6}
            required
            placeholder="문의 내용을 자세히 작성해 주세요"
            className="w-full resize-none rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 transition"
          />
        </div>

        <button
          type="submit"
          disabled
          className="w-full rounded-lg bg-gray-300 dark:bg-slate-700 px-6 py-3 text-sm font-semibold text-gray-500 dark:text-slate-500 cursor-not-allowed sm:w-auto"
        >
          보내기 (준비 중)
        </button>
      </form>

      <hr className="border-gray-200 dark:border-slate-700" />

      {/* Other contact methods */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "이메일",
            value: "sdj3338@naver.com",
            href: "mailto:sdj3338@naver.com",
            icon: (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            ),
          },
          {
            label: "X (Twitter)",
            value: "@0xStragos",
            href: "https://x.com/0xStragos",
            icon: (
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            ),
          },
        ].map(({ label, value, icon, href }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-4 text-center space-y-1"
          >
            <div className="flex justify-center text-gray-500 dark:text-gray-400 mb-0.5">{icon}</div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</p>
            <a
              href={href}
              target={href.startsWith("mailto") ? undefined : "_blank"}
              rel="noopener noreferrer"
              className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {value}
            </a>
          </div>
        ))}
      </section>
    </div>
  );
}
