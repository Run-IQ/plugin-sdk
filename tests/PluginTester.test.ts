import { describe, it, expect } from 'vitest';
import { PluginTester } from '../src/testing/PluginTester.js';
import { BasePlugin } from '../src/base/BasePlugin.js';
import { BaseModel } from '../src/base/BaseModel.js';
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

  describe('negative tests', () => {
    it('assertDeterminism throws for non-deterministic plugin', async () => {
      let callCount = 0;

      class NonDeterministicPlugin extends BasePlugin {
        readonly name = 'non-deterministic';
        readonly version = '1.0.0';
        readonly models: CalculationModel[] = [];

        override beforeEvaluate(
          input: EvaluationInput,
          rules: ReadonlyArray<Rule>,
        ): { input: EvaluationInput; rules: ReadonlyArray<Rule> } {
          callCount++;
          return {
            input: { ...input, data: { ...input.data, counter: callCount } },
            rules,
          };
        }
      }

      const tester = new PluginTester(new NonDeterministicPlugin());
      await expect(tester.assertDeterminism(input, rules, makeContext())).rejects.toThrow(
        'Determinism violation',
      );
    });

    it('assertNoSideEffects throws for stateful plugin', async () => {
      let state = 0;

      class StatefulPlugin extends BasePlugin {
        readonly name = 'stateful';
        readonly version = '1.0.0';
        readonly models: CalculationModel[] = [];

        override beforeEvaluate(
          input: EvaluationInput,
          rules: ReadonlyArray<Rule>,
        ): { input: EvaluationInput; rules: ReadonlyArray<Rule> } {
          state++;
          return {
            input: { ...input, data: { ...input.data, stateValue: state } },
            rules,
          };
        }
      }

      const tester = new PluginTester(new StatefulPlugin());
      await expect(tester.assertNoSideEffects(input, rules)).rejects.toThrow(
        'Side effects detected',
      );
    });

    it('runAll returns FAIL for non-deterministic plugin', async () => {
      let counter = 0;

      class FailingPlugin extends BasePlugin {
        readonly name = 'failing';
        readonly version = '1.0.0';
        readonly models: CalculationModel[] = [];

        override beforeEvaluate(
          input: EvaluationInput,
          rules: ReadonlyArray<Rule>,
        ): { input: EvaluationInput; rules: ReadonlyArray<Rule> } {
          counter++;
          return {
            input: { ...input, data: { ...input.data, c: counter } },
            rules,
          };
        }
      }

      const tester = new PluginTester(new FailingPlugin());
      const report = await tester.runAll(input, rules, makeContext());
      expect(report.summary).toBe('FAIL');
      expect(report.failed.length).toBeGreaterThan(0);
    });
  });

  describe('BaseModel CalculationOutput return path', () => {
    it('safeCalculate returns CalculationOutput when model returns it', () => {
      class OutputModel extends BaseModel {
        readonly name = 'OUTPUT_MODEL';
        readonly version = '1.0.0';

        validateParams(_p: unknown): ValidationResult {
          return { valid: true };
        }

        calculate(): { value: number; detail: unknown } {
          return { value: 42, detail: { breakdown: 'test' } };
        }
      }

      const model = new OutputModel();
      const rule = { id: 'r', model: 'OUTPUT_MODEL', params: {} } as unknown as Rule;
      const result = model.safeCalculate({ amount: 100 }, rule, {});
      expect(result).toEqual({ value: 42, detail: { breakdown: 'test' } });
    });

    it('safeCalculate throws on invalid params', () => {
      class StrictModel extends BaseModel {
        readonly name = 'STRICT_MODEL';
        readonly version = '1.0.0';

        validateParams(params: unknown): ValidationResult {
          if (params !== null && typeof params === 'object' && 'rate' in params) {
            return { valid: true };
          }
          return { valid: false, errors: ['rate is required'] };
        }

        calculate(): number {
          return 0;
        }
      }

      const model = new StrictModel();
      const rule = { id: 'r', model: 'STRICT_MODEL', params: {} } as unknown as Rule;
      expect(() => model.safeCalculate({}, rule, {})).toThrow(
        'Invalid params for model STRICT_MODEL',
      );
    });
  });

  describe('teardown', () => {
    it('teardown does not throw for default plugin', () => {
      const plugin = new StablePlugin();
      expect(() => plugin.teardown()).not.toThrow();
    });
  });

  describe('assertNoSideEffects with model.calculate', () => {
    it('passes when model.calculate is pure', async () => {
      const tester = new PluginTester(new StablePlugin());
      const ctx = makeContext();
      const ruleForModel: Rule = {
        id: 'r1',
        model: 'STABLE',
        params: {},
        priority: 1,
        condition: { dsl: 'jsonlogic', value: true },
        effectiveDate: new Date('2025-01-01'),
        checksum: 'abc',
      } as unknown as Rule;
      await expect(tester.assertNoSideEffects(input, [ruleForModel], ctx)).resolves.not.toThrow();
    });

    it('throws when model.calculate has side effects', async () => {
      let counter = 0;

      class SideEffectModel implements CalculationModel {
        readonly name = 'SIDE_EFFECT';
        readonly version = '1.0.0';
        validateParams(_p: unknown): ValidationResult {
          return { valid: true };
        }
        calculate(): number {
          counter++;
          return counter;
        }
      }

      class SideEffectPlugin extends BasePlugin {
        readonly name = 'side-effect';
        readonly version = '1.0.0';
        readonly models = [new SideEffectModel()];
      }

      const tester = new PluginTester(new SideEffectPlugin());
      const ctx = makeContext();
      const rule: Rule = {
        id: 'r1',
        model: 'SIDE_EFFECT',
        params: {},
        priority: 1,
        condition: { dsl: 'jsonlogic', value: true },
        effectiveDate: new Date('2025-01-01'),
        checksum: 'abc',
      } as unknown as Rule;
      await expect(tester.assertNoSideEffects(input, [rule], ctx)).rejects.toThrow(
        'Side effects detected in model "SIDE_EFFECT"',
      );
    });
  });

  describe('multiple models registration', () => {
    it('registers all models on onInit', () => {
      class ModelA implements CalculationModel {
        readonly name = 'MODEL_A';
        readonly version = '1.0.0';
        validateParams(): ValidationResult {
          return { valid: true };
        }
        calculate(): number {
          return 1;
        }
      }

      class ModelB implements CalculationModel {
        readonly name = 'MODEL_B';
        readonly version = '1.0.0';
        validateParams(): ValidationResult {
          return { valid: true };
        }
        calculate(): number {
          return 2;
        }
      }

      class ModelC implements CalculationModel {
        readonly name = 'MODEL_C';
        readonly version = '1.0.0';
        validateParams(): ValidationResult {
          return { valid: true };
        }
        calculate(): number {
          return 3;
        }
      }

      class MultiModelPlugin extends BasePlugin {
        readonly name = 'multi-model';
        readonly version = '1.0.0';
        readonly models = [new ModelA(), new ModelB(), new ModelC()];
      }

      const plugin = new MultiModelPlugin();
      const ctx = makeContext();
      plugin.onInit(ctx);

      expect(ctx.modelRegistry.has('MODEL_A')).toBe(true);
      expect(ctx.modelRegistry.has('MODEL_B')).toBe(true);
      expect(ctx.modelRegistry.has('MODEL_C')).toBe(true);
    });
  });
});
