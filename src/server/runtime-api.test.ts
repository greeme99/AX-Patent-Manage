import { describe, expect, it } from 'vitest';

import { resolveDemoSessionSecret } from './runtime-api';

describe('runtime session secret policy', () => {
  it('rejects missing, placeholder, and short production secrets', () => {
    expect(() => resolveDemoSessionSecret({ NODE_ENV: 'production' })).toThrow('DEMO_SESSION_SECRET');
    expect(() => resolveDemoSessionSecret({ NODE_ENV: 'production', DEMO_SESSION_SECRET: 'local-demo-session-secret-change-in-production' })).toThrow('DEMO_SESSION_SECRET');
    expect(() => resolveDemoSessionSecret({ NODE_ENV: 'production', DEMO_SESSION_SECRET: 'too-short' })).toThrow('DEMO_SESSION_SECRET');
  });

  it('keeps the explicit local default outside production', () => {
    expect(resolveDemoSessionSecret({ NODE_ENV: 'test' })).toBe('local-demo-session-secret-change-in-production');
  });
});
