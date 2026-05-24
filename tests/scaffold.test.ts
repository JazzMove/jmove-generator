import { describe, it, expect } from 'vitest';

describe('@jmove/generator scaffold', () => {
  it('package is importable', async () => {
    const mod = await import('../src/index');
    expect(mod).toBeDefined();
  });
});
