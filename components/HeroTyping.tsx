"use client";

import { useEffect, useState } from "react";

const LINES = [
  // 개발
  'const me = { blog: "StraWeb", passion: "∞" }',
  'git commit -m "keep building 🚀"',
  'while (alive) { keepCoding() }',
  'npm run dev   # localhost:3000',
  'if (doubt) { try() } else { ship() }',
  'console.log("여전히 디버깅 중... 🐛")',
  '// TODO: sleep()',
  'git push origin master   # 🎉',
  'fmt.Println("빌드 성공")',
  '<Component life="good" />',
  'curl -s https://stragos.xyz | jq .',
  'type Result = Success | KeepTrying',
  'grep -r "passion" ./life --include="*.ts"',
  'rm -rf /regrets   # 후회 없이',
  'SELECT passion FROM soul LIMIT 1',
  'fn main() { println!("Rust가 최고야"); }',
  '$ docker compose up --build',
  'git stash   # 나중에 꼭 pop 한다',
  'npx create-next-app@latest new-idea',
  '// 이 코드는 내일의 내가 이해하겠지',
  'catch (e) { console.log("몰랐던 척"); }',
  'git blame   # 범인은 나였다',
  '404: motivation not found   # 잠깐만',
  'const bug = feature in disguise',
  // 게임
  'SELECT * FROM save_data WHERE cleared = true',
  'while (!bossDefeated) { grind() }',
  '// RG34XX SP — 출퇴근 레트로 필수품',
  'if (hp <= 0) { usePhoenixDown() }',
  'const party = ["Terra","Celes","Locke","Edgar"]',
  'PRESS START   # 인생도 게임처럼',
  '$ ./run_game --no-lag --fullscreen',
  'achievement_unlocked("한 달째 플레이 중")',
  // 투자
  'const portfolio = { risk: "moderate", hope: "∞" }',
  'BUY signal detected   # 아닐 수도 있음',
  'while (market.isOpen()) { watchCandles() }',
  'HODL   # 떨어지면 더 사는 거',
  'try { profit() } catch { DCA() }',
  // 일상
  'console.log("오늘도 커피 ☕ 두 잔")',
  'git stash pop   # 다시 현실로',
  '// 블로그 초안: 머릿속에 있는 중',
  'crontab: 0 9 * * 1 wake_up_motivated.sh',
  'alias life="cd ~/projects && code ."',
  'echo "주말인데 왜 코딩하고 있지"',
  'uptime: 30년째 가동 중, 버그 다수',
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
