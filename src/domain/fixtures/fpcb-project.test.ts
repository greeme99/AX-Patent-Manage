import { describe, expect, it } from 'vitest';

import { syntheticFpcbProject } from '../index';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('synthetic FPCB fixture', () => {
  it('uses deterministic UUIDs for every persisted domain identifier', () => {
    const ids = [
      syntheticFpcbProject.id,
      syntheticFpcbProject.currentRevisionId,
      ...syntheticFpcbProject.gates.flatMap((gate) => [gate.id, ...gate.linkedRevisionIds]),
      ...syntheticFpcbProject.claimElements.flatMap((element) => element.evidenceIds),
      ...syntheticFpcbProject.risks.map((risk) => risk.id),
    ];

    expect(ids).toHaveLength(15);
    expect(new Set(ids)).toHaveLength(11);
    for (const id of ids) expect(id).toMatch(uuidPattern);
  });

  it('provides the single UI source for jurisdictions, features, patents, and evidence', () => {
    expect(syntheticFpcbProject.jurisdictions).toEqual(['KR', 'US', 'EP', 'PCT']);
    expect(syntheticFpcbProject.features).toHaveLength(4);
    expect(syntheticFpcbProject.patents.map((patent) => patent.publicationNumber)).toContain('KR102345678B1');
    expect(syntheticFpcbProject.evidence).toHaveLength(2);
    expect(syntheticFpcbProject.claimElements.every((element) => element.label.length > 0)).toBe(true);
  });
});
