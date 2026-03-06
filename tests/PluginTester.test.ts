import { describe, it, expect } from 'vitest';
import { PluginTester } from '../src/testing/PluginTester.js';
import { BasePlugin } from '../src/base/BasePlugin.js';
import type {
  CalculationModel,
  ValidationResult,
  EvaluationInput,
  Rule,
  PluginContext,
} from '@run-iq/core';

class StableModel implements CalculationModel {
  readonly name = 'STABLE';
  readonly version = '1.0.0';
  validateParams(_p: unknown): ValidationResult {
    return { valid: true };
  }
  calculate(): number {
    return 100;
  }
}

class StablePlugin extends BasePlugin {
  readonly name = 'stable';
  readonly version = '1.0.0';
  readonly models = [new StableModel()];
}

class MutatingPlugin extends BasePlugin {
  readonly name = 'mutating';
  readonly version = '1.0.0';
  readonly models: CalculationModel[] = [];

  override beforeEvaluate(input: EvaluationInput, _rules: ReadonlyArray<Rule>): EvaluationInput {
    // Intentional mutation for testing
    (input as { data: Record<string, unknown> }).data['mutated'] = true;
    return input;
  }
}

function makeContext(): PluginContext {
  const models = new Map<string, CalculationModel>();
  return {
    modelRegistry: {
      register: (m: CalculationModel) => {
        models.set(m.name, m);
      },
      get: (n: string) => {
        const m = models.get(n);
        if (!m) throw new Error(`Not found: ${n}`);
        return m;
      },
      has: (n: string) => models.has(n),
      getAll: () => models,
    },
    dslRegistry: {
      register: () => {},
      get: () => undefined,
      has: () => false,
      getAll: () => new Map(),
    },
    engineVersion: '0.1.0',
  } as unknown as PluginContext;
}

describe('PluginTester', () => {
  const input: EvaluationInput = {
    requestId: 'test',
    data: { amount: 1000 },
    meta: { tenantId: 't' },
  };
  const rules: Rule[] = [];

  it('assertDeterminism passes for stable plugin', async () => {
    const tester = new PluginTester(new StablePlugin());
    await expect(tester.assertDeterminism(input, rules, makeContext())).resolves.not.toThrow();
  });

  it('assertImmutability detects mutation', async () => {
    const tester = new PluginTester(new MutatingPlugin());
    await expect(
      tester.assertImmutability({ ...input, data: { amount: 1000 } }, rules),
    ).rejects.toThrow('Immutability violation');
  });

  it('assertImmutability passes for stable plugin', async () => {
    const tester = new PluginTester(new StablePlugin());
    await expect(tester.assertImmutability(input, rules)).resolves.not.toThrow();
  });

  it('assertNoSideEffects passes for stable plugin', async () => {
    const tester = new PluginTester(new StablePlugin());
    await expect(tester.assertNoSideEffects(input, rules)).resolves.not.toThrow();
  });

  it('runAll returns PASS for stable plugin', async () => {
    const tester = new PluginTester(new StablePlugin());
    const report = await tester.runAll(input, rules, makeContext());
    expect(report.summary).toBe('PASS');
    expect(report.passed.length).toBeGreaterThan(0);
    expect(report.failed).toHaveLength(0);
  });
});
