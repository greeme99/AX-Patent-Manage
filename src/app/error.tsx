'use client';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="route-state" role="alert"><span className="error-mark" aria-hidden="true">!</span><h1>데모 화면을 불러오지 못했습니다</h1><p>안전한 합성 샘플 모드로 다시 시작할 수 있습니다.</p><button type="button" className="button button--primary" onClick={reset}>다시 시도</button></main>;
}
