/**
 * 본문 HTML을 두 부분으로 나눠 중간 광고를 삽입할 수 있게 합니다.
 * 두 번째 <h2> 태그 직전을 분할 지점으로 사용합니다.
 * h2가 2개 미만이면 전체를 상단에, 하단은 빈 문자열로 반환합니다.
 */
export function splitContentForAd(html: string): [string, string] {
  const marker = "<h2";
  let count = 0;
  let pos = 0;

  while (pos < html.length) {
    const idx = html.indexOf(marker, pos);
    if (idx === -1) break;
    count++;
    if (count === 2) {
      return [html.slice(0, idx), html.slice(idx)];
    }
    pos = idx + marker.length;
  }

  return [html, ""];
}
