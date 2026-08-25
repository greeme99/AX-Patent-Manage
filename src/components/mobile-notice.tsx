export function MobileNotice() {
  return (
    <aside
      aria-labelledby="pc-only-title"
      className="mobile-notice"
      role="dialog"
    >
      <div className="mobile-notice__mark" aria-hidden="true">PG</div>
      <p className="eyebrow">PATENT GATE</p>
      <h1 id="pc-only-title">PC에서 이용해 주세요</h1>
      <p>이 교육용 워크스페이스는 1024px 이상의 PC 화면에 최적화되어 있습니다.</p>
    </aside>
  );
}
