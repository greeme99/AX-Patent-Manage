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
  id: 'project-fpcb-ev-bms-001',
  code: 'FPCB-EV-BMS-001',
  name: 'EV 배터리 관리 모듈용 고굴곡 FPCB',
  product: '48V BMS Flexible Printed Circuit Board',
  phase: 'DESIGN',
  currentRevisionId: 'revision-r03',
  currentRevisionLabel: 'R03',
  productionDate: '2026-10-15T00:00:00.000Z',
  launchDate: '2026-11-03T00:00:00.000Z',
  legalStatusCheckedAt: '2026-08-22T09:00:00.000Z',
  gates: [
    {
      id: 'gate-planning',
      phase: 'PLANNING',
      status: 'APPROVED',
      linkedRevisionIds: ['revision-r02', 'revision-r03'],
    },
    {
      id: 'gate-design',
      phase: 'DESIGN',
      status: 'READY_FOR_REVIEW',
      linkedRevisionIds: ['revision-r03'],
    },
    {
      id: 'gate-test',
      phase: 'TEST',
      status: 'NOT_READY',
      linkedRevisionIds: ['revision-r03'],
    },
    {
      id: 'gate-approval',
      phase: 'APPROVAL',
      status: 'NOT_READY',
      linkedRevisionIds: ['revision-r03'],
    },
  ],
  claimElements: [
    { status: 'PRESENT', evidenceIds: ['evidence-bend-cycle-001'] },
    { status: 'PARTIAL', evidenceIds: ['evidence-impedance-003'] },
    { status: 'UNKNOWN', evidenceIds: [] },
  ],
  risks: [
    { id: 'risk-coverage', level: 'HIGH', title: '고굴곡 동박 배선 청구항 중첩 가능성' },
    { id: 'risk-via', level: 'MEDIUM', title: 'Micro-via 신뢰성 추가 검증 필요' },
  ],
};
