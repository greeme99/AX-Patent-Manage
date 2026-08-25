import Link from 'next/link';

export default function NotFound() {
  return <main className="route-state"><span className="error-mark" aria-hidden="true">404</span><h1>요청한 화면을 찾지 못했습니다</h1><p>프로젝트가 초기화되었거나 주소가 변경되었을 수 있습니다.</p><Link className="button button--primary" href="/">Cockpit으로 이동</Link></main>;
}
