import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'public', 'images', 'admin-posts');

// Fixed 5 participants — same order & color across ALL flows
const P = [
  { name: 'User\nApp',  color: '#3B82F6' }, // 0
  { name: 'Server',     color: '#10B981' }, // 1
  { name: 'Analyzer',   color: '#F59E0B' }, // 2
  { name: 'DB',         color: '#0EA5E9' }, // 3
  { name: 'Kaia',       color: '#EF4444' }, // 4
];

const PHASE_C = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#0EA5E9'];

function colX(idx, total, seqW) {
  return (idx + 0.5) * (seqW / total);
}

function buildSVG(participants, steps, seqW) {
  const N = participants.length;
  const colW = seqW / N;
  const stepH = 70;
  const pad = 30;
  const totalH = pad + steps.length * stepH + pad;

  let s = `<svg width="${seqW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg" style="display:block;">`;
  s += `<rect width="${seqW}" height="${totalH}" fill="white"/>`;

  for (let i = 0; i < N; i++) {
    const x = colX(i, N, seqW);
    s += `<line x1="${x}" y1="0" x2="${x}" y2="${totalH}" stroke="#E2E8F0" stroke-width="1.5" stroke-dasharray="5,4"/>`;
  }

  steps.forEach((step, si) => {
    const y = pad + si * stepH + stepH / 2;
    const fx = colX(step.from, N, seqW);
    const tx = colX(step.to, N, seqW);
    const midX = (fx + tx) / 2;
    const isDash = step.type === 'return' || step.type === 'dashed' || step.type === 'async';
    const isSelf = step.from === step.to;
    const lc = isDash ? '#94A3B8' : '#1E293B';
    const numBg = participants[step.from]?.color || P[0].color;
    const da = isDash ? '6,4' : 'none';

    if (isSelf) {
      const lw = Math.min(colW * 0.65, 90);
      const lh = 28;
      const rx = fx + 10;
      s += `<path d="M${fx},${y - lh/2} Q${rx + lw},${y - lh/2} ${rx + lw},${y} Q${rx + lw},${y + lh/2} ${fx},${y + lh/2}" fill="none" stroke="${lc}" stroke-width="1.5" stroke-dasharray="${da}"/>`;
      s += `<polygon points="${fx},${y + lh/2} ${fx - 6},${y + lh/2 - 6} ${fx + 6},${y + lh/2 - 6}" fill="${lc}"/>`;
      const nx = fx + (lw / 2) + 5;
      const ny = y - lh / 2 - 14;
      s += `<circle cx="${nx}" cy="${ny}" r="11" fill="${numBg}"/>`;
      s += `<text x="${nx}" y="${ny + 4}" text-anchor="middle" fill="white" font-size="11" font-weight="bold" font-family="Arial,sans-serif">${si + 1}</text>`;
      const labelParts = step.label.split('\n');
      const labelX = fx + (lw / 2) + 5;
      const labelY = y + lh / 2 + 14;
      labelParts.forEach((ln, li) => {
        s += `<text x="${labelX}" y="${labelY + li * 15}" text-anchor="middle" fill="#475569" font-size="12" font-family="'Malgun Gothic','Apple SD Gothic Neo',sans-serif">${ln}</text>`;
      });
    } else {
      const goLeft = tx < fx;
      s += `<line x1="${fx}" y1="${y}" x2="${tx}" y2="${y}" stroke="${lc}" stroke-width="${isDash ? 1.5 : 2}" stroke-dasharray="${da}"/>`;
      if (goLeft) {
        s += `<polygon points="${tx},${y} ${tx + 10},${y - 5} ${tx + 10},${y + 5}" fill="${lc}"/>`;
      } else {
        s += `<polygon points="${tx},${y} ${tx - 10},${y - 5} ${tx - 10},${y + 5}" fill="${lc}"/>`;
      }
      s += `<circle cx="${midX}" cy="${y - 14}" r="11" fill="${numBg}"/>`;
      s += `<text x="${midX}" y="${y - 10}" text-anchor="middle" fill="white" font-size="11" font-weight="bold" font-family="Arial,sans-serif">${si + 1}</text>`;
      const labelParts = step.label.split('\n');
      labelParts.forEach((ln, li) => {
        s += `<text x="${midX}" y="${y + 14 + li * 15}" text-anchor="middle" fill="#334155" font-size="12" font-family="'Malgun Gothic','Apple SD Gothic Neo',sans-serif">${ln}</text>`;
      });
    }
  });

  s += '</svg>';
  return { svg: s, svgH: totalH };
}

function html(flow) {
  const { title, subtitle, badge, badgeColor, participants, steps, phases, explanations } = flow;
  const SEQ_W = 980;
  const RIGHT_W = 460;
  const N = participants.length;
  const COL_W = SEQ_W / N;
  const HEAD_H = 72;

  const { svg } = buildSVG(participants, steps, SEQ_W);

  const participantCols = participants.map((p, i) => `
    <div style="position:absolute;left:${i * COL_W}px;width:${COL_W}px;height:${HEAD_H}px;display:flex;align-items:center;justify-content:center;padding:0 6px;box-sizing:border-box;">
      <div style="background:${p.color};color:white;border-radius:10px;padding:8px 10px;font-weight:700;font-size:13px;text-align:center;width:100%;line-height:1.35;white-space:pre-line;">${p.name}</div>
    </div>`).join('');

  const rightPanel = phases.map(ph => `
    <div style="margin-bottom:14px;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
      <div style="background:${ph.color};color:white;padding:9px 14px;font-weight:700;font-size:13px;">${ph.title}</div>
      <div style="background:white;padding:11px 14px;font-size:12.5px;line-height:1.75;color:#334155;white-space:pre-line;">${ph.desc}</div>
    </div>`).join('');

  const cards = explanations.map((exp) => {
    const stepObj = steps[exp.step - 1];
    const numBg = stepObj ? (participants[stepObj.from]?.color || P[0].color) : P[0].color;
    return `
      <div style="background:white;border-radius:10px;padding:13px;box-shadow:0 2px 8px rgba(0,0,0,.07);border:1px solid #E2E8F0;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <div style="background:${numBg};color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;flex-shrink:0;">${exp.step}</div>
          <div style="font-weight:700;font-size:13px;color:#1E293B;">${exp.title}</div>
        </div>
        <div style="font-size:12px;color:#64748B;line-height:1.65;">${exp.desc}</div>
      </div>`;
  }).join('');

  const colsPerRow = explanations.length <= 9 ? 3 : 4;

  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif;background:#F1F5F9;padding:32px;width:${SEQ_W + RIGHT_W + 64 + 24}px;}</style>
</head><body>
<div style="background:#0F172A;border-radius:14px;padding:20px 24px;margin-bottom:20px;">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
    <span style="background:${badgeColor};color:white;border-radius:20px;padding:4px 14px;font-size:12px;font-weight:700;">${badge}</span>
    <span style="font-size:22px;font-weight:800;color:white;">${title}</span>
  </div>
  <p style="font-size:13.5px;color:#94A3B8;line-height:1.6;">${subtitle}</p>
</div>
<div style="display:flex;gap:24px;margin-bottom:20px;">
  <div style="width:${SEQ_W}px;flex-shrink:0;">
    <div style="position:relative;height:${HEAD_H}px;background:#1E293B;border-radius:12px 12px 0 0;overflow:hidden;">${participantCols}</div>
    <div style="border-radius:0 0 12px 12px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.1);">${svg}</div>
  </div>
  <div style="width:${RIGHT_W}px;flex-shrink:0;">
    ${rightPanel}
    <div style="background:white;border-radius:10px;padding:13px 14px;font-size:12px;color:#475569;line-height:1.7;box-shadow:0 2px 8px rgba(0,0,0,.07);border-left:4px solid #F59E0B;">
      <strong style="color:#1E293B;">💡 이 플로우의 핵심</strong><br/>${flow.tip}
    </div>
  </div>
</div>
<div style="background:white;border-radius:12px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,.07);">
  <h2 style="font-size:16px;font-weight:700;color:#0F172A;margin-bottom:16px;">📋 단계별 설명</h2>
  <div style="display:grid;grid-template-columns:repeat(${colsPerRow},1fr);gap:10px;">${cards}</div>
</div>
</body></html>`;
}

// Participants: User/App(0)  Server(1)  Analyzer(2)  DB(3)  Kaia(4)

const flows = [
  // ─── Flow B: User/App → Analyzer QR 직접 요청 ──────────────────────────────
  {
    id: 'b-app-ocr',
    badge: 'Flow B',
    badgeColor: '#8B5CF6',
    title: '앱에서 Analyzer로 QR 직접 요청하는 방식',
    subtitle: '영수증 QR 코드를 스캔하면 앱이 Server를 거치지 않고 Analyzer에 직접 보내 검증합니다. Analyzer가 확인한 결과만 Server로 전달됩니다.',
    tip: '앱이 Analyzer와 직접 통신하므로 Server 부하가 줄어듭니다.\nAnalyzer가 QR을 직접 받기 때문에 위조 여부를 빠르게 판단할 수 있습니다.',
    participants: P,
    steps: [
      { from:0, to:0, type:'self',   label:'영수증 QR 코드 스캔' },
      { from:0, to:2, type:'solid',  label:'QR 정보 직접 전달 (Server 미경유)' },
      { from:2, to:2, type:'self',   label:'QR 유효성 검증\n가게명 · 금액 · 날짜 · 번호 확인' },
      { from:2, to:1, type:'solid',  label:'검증 완료 결과 전달' },
      { from:1, to:1, type:'self',   label:'중복 적립 여부 확인' },
      { from:1, to:3, type:'solid',  label:'DB에 적립 대기 등록' },
      { from:1, to:4, type:'solid',  label:'Kaia에 토큰 지급 요청' },
      { from:4, to:1, type:'return', label:'처리 번호 발급' },
      { from:1, to:0, type:'return', label:'"적립 처리 중..." 화면 안내' },
      { from:4, to:1, type:'return', label:'처리 완료 신호' },
      { from:1, to:3, type:'solid',  label:'DB 완료 기록 업데이트' },
      { from:1, to:0, type:'return', label:'"N토큰 적립 완료!" 알림' },
    ],
    phases: [
      { color:PHASE_C[0], title:'① QR 스캔 & Analyzer 직접 요청 (1~3단계)', desc:'앱으로 QR을 스캔하면 Server를 거치지 않고\n바로 Analyzer로 QR 정보를 전달합니다.\nAnalyzer가 가게명, 금액, 날짜, 번호를 직접 확인합니다.' },
      { color:PHASE_C[1], title:'② Server 전달 & DB 등록 (4~6단계)',          desc:'Analyzer가 검증 결과를 Server로 보냅니다.\nServer는 중복 여부 확인 후 DB에 대기 상태로 등록합니다.' },
      { color:PHASE_C[2], title:'③ Kaia 토큰 발행 (7~10단계)',                desc:'Kaia에 지급을 요청하고 처리 번호를 받습니다.\n완료 신호가 올 때까지 "처리 중" 상태로 표시됩니다.' },
      { color:PHASE_C[3], title:'④ 완료 (11~12단계)',                          desc:'DB에 최종 완료 기록을 저장하고\n앱으로 "N토큰 적립 완료!" 알림을 보냅니다.' },
    ],
    explanations: [
      { step:1,  title:'QR 코드 스캔',                    desc:'앱 카메라로 영수증에 인쇄된 QR 코드를 촬영합니다.' },
      { step:2,  title:'Analyzer에 QR 직접 전달',         desc:'앱이 Server를 거치지 않고 QR 정보를 Analyzer로 바로 보냅니다. 중간 경유 없이 직접 검증 요청합니다.' },
      { step:3,  title:'Analyzer가 QR 검증',              desc:'Analyzer가 QR 안의 가게명, 결제금액, 날짜, 영수증 번호를 확인하고 정상 여부를 판단합니다.' },
      { step:4,  title:'검증 결과 Server로 전달',          desc:'Analyzer가 검증이 완료됐다는 결과를 Server로 보냅니다.' },
      { step:5,  title:'Server 중복 여부 확인',            desc:'같은 영수증으로 이미 적립한 내역이 있는지 확인합니다.' },
      { step:6,  title:'DB에 적립 대기 등록',              desc:'새 영수증임이 확인되면 DB에 "대기" 상태로 등록합니다.' },
      { step:7,  title:'Kaia에 토큰 지급 요청',            desc:'Kaia 블록체인에 적립 요청을 보냅니다.' },
      { step:8,  title:'처리 번호 발급',                   desc:'Kaia가 거래 처리 번호를 발급합니다. 이 번호로 처리 결과를 나중에 확인할 수 있습니다.' },
      { step:9,  title:'"처리 중" 안내 표시',             desc:'앱 화면에 "적립 처리 중..."이 표시됩니다.' },
      { step:10, title:'처리 완료 신호 수신',              desc:'Kaia에서 처리가 끝났다는 신호가 Server로 옵니다.' },
      { step:11, title:'DB 완료 기록 저장',                desc:'DB에 최종 완료 상태를 업데이트합니다.' },
      { step:12, title:'완료 알림 전송',                   desc:'앱으로 "N토큰이 적립됐습니다!" 알림을 보냅니다.' },
    ],
  },

  // ─── Flow D: Hybrid ─────────────────────────────────────────────────────────
  {
    id: 'd-hybrid',
    badge: 'Flow D',
    badgeColor: '#F59E0B',
    title: 'App + Server 이중 확인 방식',
    subtitle: '앱이 먼저 빠르게 읽고 선처리하면서, Server가 Analyzer를 통해 백그라운드에서 다시 한번 정밀하게 검증합니다. 빠른 응답과 정확도를 동시에 잡는 방식입니다.',
    tip: '사용자는 빠른 응답을 받으면서도\nAnalyzer가 백그라운드에서 이중으로 검증하므로 정확도가 높습니다.\n복잡도가 올라가는 단점이 있습니다.',
    participants: P,
    steps: [
      { from:0, to:0, type:'self',   label:'영수증 사진 찍기\n앱 내 1차 빠른 인식' },
      { from:0, to:1, type:'solid',  label:'1차 결과 + 원본 이미지 전달' },
      { from:1, to:1, type:'self',   label:'1차 인식 결과 검토' },
      { from:1, to:3, type:'solid',  label:'DB에 적립 대기 등록' },
      { from:1, to:4, type:'solid',  label:'Kaia 토큰 지급 요청 (먼저 처리)' },
      { from:4, to:1, type:'return', label:'처리 번호 발급' },
      { from:1, to:0, type:'return', label:'"적립 처리 중..." 화면 안내' },
      { from:1, to:2, type:'async',  label:'Analyzer 정밀 재검증 요청\n(백그라운드 진행)' },
      { from:2, to:1, type:'return', label:'재검증 완료 (정확도 92%)' },
      { from:4, to:1, type:'return', label:'처리 완료 신호' },
      { from:1, to:3, type:'solid',  label:'DB 완료 + 이중 검증 기록' },
      { from:1, to:0, type:'return', label:'"N토큰 적립 완료!" 알림' },
    ],
    phases: [
      { color:PHASE_C[0], title:'① 사진 찍고 1차 인식 (1단계)',         desc:'앱이 영수증을 빠르게 1차로 읽습니다.\n정확도가 낮아도 일단 통과시키고 선처리합니다.' },
      { color:PHASE_C[1], title:'② 선처리 & Kaia 지급 (2~7단계)',       desc:'1차 결과와 원본 이미지를 Server에 전달합니다.\nServer는 곧바로 Kaia에 토큰 지급을 시작합니다.\n사용자는 빠르게 응답을 받습니다.' },
      { color:PHASE_C[2], title:'③ Analyzer 백그라운드 검증 (8~9단계)', desc:'Server가 원본 이미지를 Analyzer에 보내 정밀하게 재검증합니다.\n사용자 화면과 무관하게 백그라운드에서 진행됩니다.' },
      { color:PHASE_C[3], title:'④ 완료 (10~12단계)',                    desc:'Kaia 처리 완료 신호를 받고\nAnalyzer 검증 결과까지 DB에 기록한 후 알림을 보냅니다.' },
    ],
    explanations: [
      { step:1,  title:'사진 찍고 앱 1차 인식',          desc:'앱으로 영수증을 촬영하면 내장 AI가 빠르게 1차로 읽습니다. 완벽하지 않아도 일단 진행합니다.' },
      { step:2,  title:'1차 결과 + 이미지 Server 전달',  desc:'앱이 읽은 결과와 영수증 원본 이미지를 함께 Server로 보냅니다.' },
      { step:3,  title:'Server 1차 검토',                desc:'Server가 앱이 읽어준 정보를 간단히 검토합니다.' },
      { step:4,  title:'DB에 적립 대기 등록',            desc:'문제가 없으면 DB에 대기 상태로 등록합니다.' },
      { step:5,  title:'Kaia에 토큰 지급 먼저 요청',     desc:'검증이 완전히 끝나기 전에 Kaia에 토큰 지급을 먼저 요청합니다. 빠른 응답을 위해서입니다.' },
      { step:6,  title:'처리 번호 발급',                  desc:'Kaia가 처리 번호를 발급합니다.' },
      { step:7,  title:'"처리 중" 안내',                 desc:'앱 화면에 "적립 처리 중..."이 표시됩니다.' },
      { step:8,  title:'Analyzer에 백그라운드 재검증',   desc:'Server가 Analyzer에 원본 이미지를 보내 정밀하게 다시 읽게 합니다. 사용자는 이 과정을 알 필요가 없습니다.' },
      { step:9,  title:'Analyzer 재검증 완료',            desc:'Analyzer가 92% 정확도로 확인 완료를 보고합니다.' },
      { step:10, title:'Kaia 처리 완료 신호',             desc:'Kaia에서 처리 완료 신호가 Server로 옵니다.' },
      { step:11, title:'DB 이중 검증 기록 저장',          desc:'DB에 완료 상태와 Analyzer 검증 결과를 함께 기록합니다.' },
      { step:12, title:'완료 알림 전송',                  desc:'앱으로 "N토큰 적립 완료!" 알림을 보냅니다.' },
    ],
  },
];

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=ko-KR'],
  });

  for (const flow of flows) {
    console.log(`Generating: ${flow.id}...`);
    const page = await browser.newPage();
    await page.setContent(html(flow), { waitUntil: 'networkidle0' });
    await page.setViewport({ width: 1640, height: 200, deviceScaleFactor: 2 });
    const bodyH = await page.evaluate(() => document.body.scrollHeight);
    await page.setViewport({ width: 1640, height: bodyH, deviceScaleFactor: 2 });
    const outPath = path.join(OUT_DIR, `receipt-flow-${flow.id}.png`);
    await page.screenshot({ path: outPath, fullPage: true });
    console.log(`  → saved: ${outPath}`);
    await page.close();
  }

  await browser.close();
  console.log('Done.');
})();
