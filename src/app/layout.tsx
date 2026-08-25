import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: '기술특허 개발게이트 데모',
  description: '합성 FPCB 프로젝트를 위한 기술특허 개발게이트 교육용 데모',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
