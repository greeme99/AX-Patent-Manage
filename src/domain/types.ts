export const ROLES = ['PRACTITIONER', 'RESPONSIBLE', 'TEAM_LEAD', 'IP_LEGAL', 'QA'] as const;
export type Role = (typeof ROLES)[number];

export const PHASES = ['PLANNING', 'DESIGN', 'TEST', 'APPROVAL'] as const;
export type Phase = (typeof PHASES)[number];

export const GATE_STATUSES = [
  'NOT_READY',
  'READY_FOR_REVIEW',
  'IN_REVIEW',
  'CONDITIONAL',
  'APPROVED',
  'REJECTED',
  'STALE',
  'EXPIRED',
] as const;
export type GateStatus = (typeof GATE_STATUSES)[number];

export const RISK_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'CLEARED'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const JOB_STATUSES = ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const CLAIM_ELEMENT_STATUSES = ['PRESENT', 'PARTIAL', 'ABSENT', 'UNKNOWN'] as const;
export type ClaimElementStatus = (typeof CLAIM_ELEMENT_STATUSES)[number];

export type DateInput = Date | string;

export interface ClaimElementCheck {
  status: ClaimElementStatus;
  evidenceIds: readonly string[];
}

export interface Risk {
  id: string;
  level: RiskLevel;
  title: string;
}

export interface PhaseGate {
  id: string;
  phase: Phase;
  status: GateStatus;
  linkedRevisionIds: readonly string[];
}
