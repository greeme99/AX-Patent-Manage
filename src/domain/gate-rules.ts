import type {
  ClaimElementCheck,
  DateInput,
  GateStatus,
  Phase,
  Role,
  RiskLevel,
} from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export type GateBlocker =
  | 'CLAIM_ELEMENT_UNKNOWN'
  | 'CLAIM_ELEMENT_EVIDENCE_MISSING'
  | 'LEGAL_STATUS_STALE'
  | 'IP_LEGAL_APPROVAL_REQUIRED'
  | 'TEAM_LEAD_APPROVAL_REQUIRED'
  | 'TEAM_LEAD_APPROVAL_ORDER_INVALID';

export interface GateApproval {
  role: Role;
  approvedAt: DateInput;
}

export interface GateReadinessInput {
  claimElements: readonly ClaimElementCheck[];
  legalStatusCheckedAt?: DateInput;
  risks: readonly { level: RiskLevel }[];
  approvals?: readonly GateApproval[];
  now: Date;
}

export interface GateReadiness {
  canApprove: boolean;
  blockers: GateBlocker[];
}

export function isLegalStatusFresh(checkedAt: DateInput | undefined, now: Date): boolean {
  if (!checkedAt) return false;

  const checkedAtTime = new Date(checkedAt).getTime();
  if (Number.isNaN(checkedAtTime)) return false;

  return now.getTime() - checkedAtTime <= 7 * DAY_MS;
}

export function assessGateReadiness(input: GateReadinessInput): GateReadiness {
  const blockers: GateBlocker[] = [];

  if (input.claimElements.some((element) => element.status === 'UNKNOWN')) {
    blockers.push('CLAIM_ELEMENT_UNKNOWN');
  }

  if (
    input.claimElements.some(
      (element) =>
        (element.status === 'PRESENT' || element.status === 'PARTIAL') &&
        element.evidenceIds.length === 0,
    )
  ) {
    blockers.push('CLAIM_ELEMENT_EVIDENCE_MISSING');
  }

  if (!isLegalStatusFresh(input.legalStatusCheckedAt, input.now)) {
    blockers.push('LEGAL_STATUS_STALE');
  }

  if (input.risks.some((risk) => risk.level === 'CRITICAL' || risk.level === 'HIGH')) {
    const approvals = input.approvals ?? [];
    const legalApprovalTimes = approvals
      .filter((approval) => approval.role === 'IP_LEGAL')
      .map((approval) => new Date(approval.approvedAt).getTime())
      .filter((time) => !Number.isNaN(time));
    const teamLeadApprovalTimes = approvals
      .filter((approval) => approval.role === 'TEAM_LEAD')
      .map((approval) => new Date(approval.approvedAt).getTime())
      .filter((time) => !Number.isNaN(time));

    if (legalApprovalTimes.length === 0) {
      blockers.push('IP_LEGAL_APPROVAL_REQUIRED');
    }
    if (teamLeadApprovalTimes.length === 0) {
      blockers.push('TEAM_LEAD_APPROVAL_REQUIRED');
    } else if (
      legalApprovalTimes.length > 0 &&
      !teamLeadApprovalTimes.some((teamLeadTime) =>
        legalApprovalTimes.some((legalTime) => teamLeadTime > legalTime),
      )
    ) {
      blockers.push('TEAM_LEAD_APPROVAL_ORDER_INVALID');
    }
  }

  return { canApprove: blockers.length === 0, blockers };
}

export type ConditionalApprovalBlocker =
  | 'RISK_LEVEL_NOT_ELIGIBLE'
  | 'CONDITION_DUE_DATE_OUT_OF_RANGE'
  | 'CONDITION_RELEASE_MILESTONE_INVALID'
  | 'CONDITION_AFTER_RELEASE_MILESTONE';

export interface ConditionalApprovalInput {
  riskLevel: RiskLevel;
  dueDate: DateInput;
  productionDate?: DateInput;
  launchDate?: DateInput;
  now: Date;
}

export interface ConditionalApprovalResult {
  allowed: boolean;
  blocker: ConditionalApprovalBlocker | null;
}

export function evaluateConditionalApproval(
  input: ConditionalApprovalInput,
): ConditionalApprovalResult {
  if (input.riskLevel !== 'MEDIUM' && input.riskLevel !== 'LOW') {
    return { allowed: false, blocker: 'RISK_LEVEL_NOT_ELIGIBLE' };
  }

  const dueDate = new Date(input.dueDate);
  const dueTime = dueDate.getTime();
  const daysUntilDue = (dueTime - input.now.getTime()) / DAY_MS;

  if (Number.isNaN(dueTime) || daysUntilDue < 1 || daysUntilDue > 30) {
    return { allowed: false, blocker: 'CONDITION_DUE_DATE_OUT_OF_RANGE' };
  }

  const releaseDates = [input.productionDate, input.launchDate]
    .filter((date): date is DateInput => date !== undefined)
    .map((date) => new Date(date).getTime());

  if (releaseDates.some((date) => Number.isNaN(date))) {
    return { allowed: false, blocker: 'CONDITION_RELEASE_MILESTONE_INVALID' };
  }

  if (releaseDates.some((releaseDate) => dueTime > releaseDate)) {
    return { allowed: false, blocker: 'CONDITION_AFTER_RELEASE_MILESTONE' };
  }

  return { allowed: true, blocker: null };
}

export interface RevisionLinkedGate {
  id: string;
  status: GateStatus;
  linkedRevisionIds: readonly string[];
}

export function markLinkedGatesStale<T extends RevisionLinkedGate>(
  gates: readonly T[],
  changedRevisionId: string,
): T[] {
  return gates.map((gate) =>
    gate.linkedRevisionIds.includes(changedRevisionId)
      ? { ...gate, status: 'STALE' as GateStatus }
      : { ...gate },
  );
}

const phaseOrder: readonly Phase[] = ['PLANNING', 'DESIGN', 'TEST', 'APPROVAL'];

export function canStartPhase(
  phase: Phase,
  gates: readonly Pick<RevisionLinkedGate & { phase: Phase }, 'phase' | 'status'>[],
): boolean {
  const phaseIndex = phaseOrder.indexOf(phase);
  if (phaseIndex === 0) return true;

  const previousPhase = phaseOrder[phaseIndex - 1];
  return gates.some((gate) => gate.phase === previousPhase && gate.status === 'APPROVED');
}
