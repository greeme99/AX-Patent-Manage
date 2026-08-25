import type {
  ClaimElementCheck,
  Phase,
  PhaseGate,
  Risk,
} from '../types';

export interface SyntheticFpcbProject {
  id: string;
  code: string;
  name: string;
  product: string;
  phase: Phase;
  currentRevisionId: string;
  currentRevisionLabel: string;
  productionDate: string;
  launchDate: string;
  legalStatusCheckedAt: string;
  jurisdictions: readonly ['KR', 'US', 'EP', 'PCT'];
  features: readonly {
    code: string;
    title: string;
    description: string;
  }[];
  patents: readonly {
    publicationNumber: string;
    title: string;
    jurisdiction: 'KR' | 'US' | 'EP' | 'PCT';
    legalStatus: string;
    risk: 'HIGH' | 'MEDIUM' | 'LOW';
  }[];
  evidence: readonly {
    label: string;
    source: string;
    quote: string;
    revision: string;
  }[];
  gates: readonly PhaseGate[];
  claimElements: readonly (ClaimElementCheck & {
    label: string;
    claimText: string;
    designResponse: string;
  })[];
  risks: readonly Risk[];
}

/** The only seeded data set used by the public demo. It contains no customer data. */
export const syntheticFpcbProject: SyntheticFpcbProject = {
  id: 'b8e4c4b1-f4c6-4d02-8b44-1206ef4dc001',
  code: 'FPCB-EV-BMS-001',
  name: 'EV 배터리 관리 모듈용 고굴곡 FPCB',
  product: '48V BMS Flexible Printed Circuit Board',
  phase: 'DESIGN',
  currentRevisionId: 'b8e4c4b1-f4c6-4d02-8b44-1206ef4dc002',
  currentRevisionLabel: 'R03',
  productionDate: '2026-10-15T00:00:00.000Z',
  launchDate: '2026-11-03T00:00:00.000Z',
  legalStatusCheckedAt: '2026-08-22T09:00:00.000Z',
  jurisdictions: ['KR', 'US', 'EP', 'PCT'],
  features: [
    { code: 'FT-01', title: '고굴곡 동박 배선', description: '반복 굴곡부 동박 폭과 곡률을 최적화해 피로 파손을 억제' },
    { code: 'FT-02', title: '중립축 이격 적층', description: '배선층을 중립축에서 0.42 mm 이격하고 보강층 재질을 차별화' },
    { code: 'FT-03', title: '레이저 Micro-via', description: 'BMS 신호 전환부의 소형 blind via와 수지 충전 구조' },
    { code: 'FT-04', title: '임피던스 보정 구간', description: '온도 센서 고속 신호부의 배선 간격 연속 보정' },
  ],
  patents: [
    { publicationNumber: 'KR102345678B1', title: '반복 굴곡용 연성 인쇄회로기판', jurisdiction: 'KR', legalStatus: '등록 · 유효', risk: 'HIGH' },
    { publicationNumber: 'US11812574B2', title: 'Flexible circuit neutral-axis structure', jurisdiction: 'US', legalStatus: 'Active', risk: 'MEDIUM' },
    { publicationNumber: 'EP3986421A1', title: 'Reinforced micro-via flexible substrate', jurisdiction: 'EP', legalStatus: 'Application pending', risk: 'MEDIUM' },
    { publicationNumber: 'WO2023198420A1', title: 'High-flex battery interconnect', jurisdiction: 'PCT', legalStatus: 'International phase', risk: 'LOW' },
  ],
  evidence: [
    { label: 'EVBMS_FPCB_R03 단면 A-A', source: '합성 설계도면 · Sheet 4', quote: '동박 중심과 중립축 간 최소 거리 0.42 mm', revision: 'R03' },
    { label: '굴곡 수명 시험 TR-2408', source: '합성 QA 시험성적서', quote: '곡률 R=5 mm, 236,000회 통전 정상', revision: 'R03' },
  ],
  gates: [
    {
      id: 'b8e4c4b1-f4c6-4d02-8b44-1206ef4dc011',
      phase: 'PLANNING',
      status: 'APPROVED',
      linkedRevisionIds: [
        'b8e4c4b1-f4c6-4d02-8b44-1206ef4dc003',
        'b8e4c4b1-f4c6-4d02-8b44-1206ef4dc002',
      ],
    },
    {
      id: 'b8e4c4b1-f4c6-4d02-8b44-1206ef4dc012',
      phase: 'DESIGN',
      status: 'READY_FOR_REVIEW',
      linkedRevisionIds: ['b8e4c4b1-f4c6-4d02-8b44-1206ef4dc002'],
    },
    {
      id: 'b8e4c4b1-f4c6-4d02-8b44-1206ef4dc013',
      phase: 'TEST',
      status: 'NOT_READY',
      linkedRevisionIds: ['b8e4c4b1-f4c6-4d02-8b44-1206ef4dc002'],
    },
    {
      id: 'b8e4c4b1-f4c6-4d02-8b44-1206ef4dc014',
      phase: 'APPROVAL',
      status: 'NOT_READY',
      linkedRevisionIds: ['b8e4c4b1-f4c6-4d02-8b44-1206ef4dc002'],
    },
  ],
  claimElements: [
    { label: '요소 1 · 반복 굴곡 영역', claimText: '반복 굴곡이 발생하는 가요성 기판 영역', designResponse: 'R03 도면 Zone B에 동일 기능 영역 존재', status: 'PRESENT', evidenceIds: ['b8e4c4b1-f4c6-4d02-8b44-1206ef4dc021'] },
    { label: '요소 2 · 중립축 이격 배선', claimText: '중립축으로부터 0.3 mm 이상 이격된 복수 동박 배선', designResponse: '0.42 mm 이격이나 보강층 구성과 배선 형상이 상이', status: 'PARTIAL', evidenceIds: ['b8e4c4b1-f4c6-4d02-8b44-1206ef4dc022'] },
    { label: '요소 3 · 수지 충전 Micro-via', claimText: '굴곡 경계에 배치된 수지 충전 blind via', designResponse: '현재 revision의 위치·충전재 근거 미확인', status: 'UNKNOWN', evidenceIds: [] },
  ],
  risks: [
    {
      id: 'b8e4c4b1-f4c6-4d02-8b44-1206ef4dc031',
      level: 'HIGH',
      title: '고굴곡 동박 배선 청구항 중첩 가능성',
    },
    {
      id: 'b8e4c4b1-f4c6-4d02-8b44-1206ef4dc032',
      level: 'MEDIUM',
      title: 'Micro-via 신뢰성 추가 검증 필요',
    },
  ],
};
