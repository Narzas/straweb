"use client";

import { useEffect, useState } from "react";

const LINES = [
  'const me = { blog: "StraWeb", passion: "∞" }',
  'git commit -m "keep building 🚀"',
  'while (alive) { keepCoding() }',
  'SELECT * FROM ideas WHERE good = true',
  'npm run dev   # localhost:3000',
  'def solve(problem): return think(hard=True)',
  '$ docker compose up --build',
  'if (doubt) { try() } else { ship() }',
  'console.log("여전히 디버깅 중... 🐛")',
  '// TODO: sleep()',
  'pip install motivation --upgrade',
  'git push origin master   # 🎉',
  'fmt.Println("빌드 성공")',
  '<Component life="good" />',
  'echo "Hello from $(hostname)"',
  'curl -s https://stragos.xyz | jq .',
  'type Result = Success | KeepTrying',
  'grep -r "passion" ./life --include="*.ts"',
  '$ sudo make me-a-sandwich',
  'rm -rf /regrets   # 후회 없이',
  'SELECT passion FROM soul LIMIT 1',
  'fn main() { println!("Rust가 최고야"); }',
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
        timer = setTimeout(() => setText(target.slice(0, text.length + 1)), 40);
      } else {
        timer = setTimeout(() => setDeleting(true), 1400);
      }
    } else {
      if (text.length > 0) {
        timer = setTimeout(() => setText((t) => t.slice(0, -1)), 16);
      } else {
        setDeleting(false);
        setIdx((i) => (i + 1) % LINES.length);
      }
    }

    return () => clearTimeout(timer);
  }, [text, idx, deleting]);

  return (
    <p className="font-mono text-sm text-emerald-300/70 min-h-[1.5rem]">
      <span className="mr-1.5 select-none text-emerald-400/60">{">"}</span>
      {text}
      <span className="ml-0.5 inline-block h-[13px] w-[7px] translate-y-[1px] rounded-[1px] bg-emerald-300/80 align-middle animate-pulse" />
    </p>
  );
}
