"use client";

import { useEffect, useState } from "react";

const LINES = [
  'const developer = { name: "StraWeb" }',
  'git commit -m "keep building"',
  'while (alive) { keepCoding() }',
  'SELECT * FROM ideas WHERE good = true',
  'npm run dev  // localhost:3000',
  'System.out.println("Hello, World!")',
];

export default function HeroTyping() {
  const [text, setText] = useState("");
  const [idx, setIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const target = LINES[idx];
    let timer: ReturnType<typeof setTimeout>;

    if (!deleting) {
      if (text.length < target.length) {
        timer = setTimeout(() => setText(target.slice(0, text.length + 1)), 72);
      } else {
        timer = setTimeout(() => setDeleting(true), 1800);
      }
    } else {
      if (text.length > 0) {
        timer = setTimeout(() => setText((t) => t.slice(0, -1)), 32);
      } else {
        setDeleting(false);
        setIdx((i) => (i + 1) % LINES.length);
      }
    }

    return () => clearTimeout(timer);
  }, [text, idx, deleting]);

  return (
    <p className="font-mono text-sm text-indigo-200/70 min-h-[1.5rem]">
      <span className="mr-1.5 select-none text-indigo-300/50">{">"}</span>
      {text}
      <span className="ml-0.5 inline-block h-[13px] w-[7px] translate-y-[1px] rounded-[1px] bg-indigo-200/80 align-middle animate-pulse" />
    </p>
  );
}
