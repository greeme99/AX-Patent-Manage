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
  gates: readonly PhaseGate[];
  claimElements: readonly ClaimElementCheck[];
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
    { status: 'PRESENT', evidenceIds: ['b8e4c4b1-f4c6-4d02-8b44-1206ef4dc021'] },
    { status: 'PARTIAL', evidenceIds: ['b8e4c4b1-f4c6-4d02-8b44-1206ef4dc022'] },
    { status: 'UNKNOWN', evidenceIds: [] },
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
