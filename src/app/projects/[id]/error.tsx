'use client';

export default function ProjectError({ reset }: { reset: () => void }) {
  return <main className="route-state" role="alert"><span className="error-mark" aria-hidden="true">!</span><h1>워크스페이스를 열 수 없습니다</h1><p>샘플 데이터를 다시 불러오거나 Cockpit으로 돌아가 주세요.</p><button className="button button--primary" type="button" onClick={reset}>다시 시도</button></main>;
}
