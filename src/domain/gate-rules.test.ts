import { describe, expect, it } from 'vitest';

import {
  assessGateReadiness,
  canStartPhase,
  evaluateConditionalApproval,
  isLegalStatusFresh,
  markLinkedGatesStale,
} from './index';

const now = new Date('2026-08-25T00:00:00.000Z');

describe('gate readiness', () => {
  it('blocks final approval when a claim element is UNKNOWN', () => {
    const result = assessGateReadiness({
      claimElements: [{ status: 'UNKNOWN', evidenceIds: [] }],
      legalStatusCheckedAt: '2026-08-20T00:00:00.000Z',
      risks: [],
      now,
    });

    expect(result.canApprove).toBe(false);
    expect(result.blockers).toContain('CLAIM_ELEMENT_UNKNOWN');
  });

  it.each(['PRESENT', 'PARTIAL'] as const)(
    'blocks a %s claim element without evidence',
    (status) => {
      const result = assessGateReadiness({
        claimElements: [{ status, evidenceIds: [] }],
        legalStatusCheckedAt: '2026-08-20T00:00:00.000Z',
        risks: [],
        now,
      });

      expect(result.canApprove).toBe(false);
      expect(result.blockers).toContain('CLAIM_ELEMENT_EVIDENCE_MISSING');
    },
  );

  it('blocks final approval when legal status is older than seven days', () => {
    const result = assessGateReadiness({
      claimElements: [{ status: 'PRESENT', evidenceIds: ['evidence-1'] }],
      legalStatusCheckedAt: '2026-08-17T23:59:59.999Z',
      risks: [],
      now,
    });

    expect(result.canApprove).toBe(false);
    expect(result.blockers).toContain('LEGAL_STATUS_STALE');
  });

  it('allows approval when all mandatory evidence is present and legal status is exactly seven days old', () => {
    const result = assessGateReadiness({
      claimElements: [{ status: 'PRESENT', evidenceIds: ['evidence-1'] }],
      legalStatusCheckedAt: '2026-08-18T00:00:00.000Z',
      risks: [],
      now,
    });

    expect(result).toEqual({ canApprove: true, blockers: [] });
  });
});

describe('conditional approval', () => {
  it.each(['CRITICAL', 'HIGH'] as const)(
    'rejects conditional approval for %s risk',
    (level) => {
      const result = evaluateConditionalApproval({
        riskLevel: level,
        dueDate: '2026-08-30T00:00:00.000Z',
        now,
      });

      expect(result).toEqual({ allowed: false, blocker: 'RISK_LEVEL_NOT_ELIGIBLE' });
    },
  );

  it('allows a medium-risk condition due within 30 days and before production', () => {
    const result = evaluateConditionalApproval({
      riskLevel: 'MEDIUM',
      dueDate: '2026-09-20T00:00:00.000Z',
      productionDate: '2026-09-25T00:00:00.000Z',
      launchDate: '2026-09-30T00:00:00.000Z',
      now,
    });

    expect(result).toEqual({ allowed: true, blocker: null });
  });

  it('rejects a low-risk condition after the production date', () => {
    const result = evaluateConditionalApproval({
      riskLevel: 'LOW',
      dueDate: '2026-09-05T00:00:00.000Z',
      productionDate: '2026-09-01T00:00:00.000Z',
      now,
    });

    expect(result).toEqual({ allowed: false, blocker: 'CONDITION_AFTER_RELEASE_MILESTONE' });
  });

  it('rejects a condition that is not due within 1 to 30 days', () => {
    const result = evaluateConditionalApproval({
      riskLevel: 'LOW',
      dueDate: '2026-09-25T00:00:00.001Z',
      now,
    });

    expect(result).toEqual({ allowed: false, blocker: 'CONDITION_DUE_DATE_OUT_OF_RANGE' });
  });
});

describe('legal-status freshness', () => {
  it('treats a future legal-status check as fresh', () => {
    expect(isLegalStatusFresh('2026-08-26T00:00:00.000Z', now)).toBe(true);
  });
});

describe('revision impact', () => {
  it('marks only gates linked to the changed revision as STALE', () => {
    const gates = markLinkedGatesStale(
      [
        { id: 'planning-gate', status: 'APPROVED', linkedRevisionIds: ['revision-1'] },
        { id: 'design-gate', status: 'APPROVED', linkedRevisionIds: ['revision-2'] },
      ],
      'revision-1',
    );

    expect(gates).toEqual([
      { id: 'planning-gate', status: 'STALE', linkedRevisionIds: ['revision-1'] },
      { id: 'design-gate', status: 'APPROVED', linkedRevisionIds: ['revision-2'] },
    ]);
  });
});

describe('phase sequencing', () => {
  it('allows a phase only after the immediately previous gate is APPROVED', () => {
    expect(
      canStartPhase('DESIGN', [{ phase: 'PLANNING', status: 'READY_FOR_REVIEW' }]),
    ).toBe(false);
    expect(
      canStartPhase('DESIGN', [{ phase: 'PLANNING', status: 'APPROVED' }]),
    ).toBe(true);
    expect(canStartPhase('PLANNING', [])).toBe(true);
  });
});
