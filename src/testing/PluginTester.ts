import type {
  PPEPlugin,
  PluginContext,
  BeforeEvaluateResult,
  EvaluationInput,
  Rule,
  CalculationModel,
} from '@run-iq/core';

export interface TestReport {
  readonly passed: string[];
  readonly failed: Array<{ test: string; error: string }>;
  readonly summary: 'PASS' | 'FAIL';
}

export class PluginTester {
  private readonly plugin: PPEPlugin;

  constructor(plugin: PPEPlugin) {
    this.plugin = plugin;
  }

  async assertDeterminism(
    input: EvaluationInput,
    rules: ReadonlyArray<Rule>,
    context: PluginContext,
  ): Promise<void> {
    this.plugin.onInit(context);

    const results: BeforeEvaluateResult[] = [];
    for (let i = 0; i < 3; i++) {
      if (this.plugin.beforeEvaluate) {
        results.push(await this.plugin.beforeEvaluate(input, rules));
      }
    }

    if (results.length === 3) {
      const json0 = JSON.stringify(results[0]);
      const json1 = JSON.stringify(results[1]);
      const json2 = JSON.stringify(results[2]);
      if (json0 !== json1 || json1 !== json2) {
        throw new Error('Determinism violation: different results for same input');
      }
    }
  }

  async assertImmutability(input: EvaluationInput, rules: ReadonlyArray<Rule>): Promise<void> {
    const inputCopy = JSON.parse(JSON.stringify(input)) as EvaluationInput;
    const rulesCopy = JSON.parse(JSON.stringify(rules)) as Rule[];

    if (this.plugin.beforeEvaluate) {
      await this.plugin.beforeEvaluate(input, rules);
    }

    if (JSON.stringify(input) !== JSON.stringify(inputCopy)) {
      throw new Error('Immutability violation: beforeEvaluate mutated input');
    }
    if (JSON.stringify(rules) !== JSON.stringify(rulesCopy)) {
      throw new Error('Immutability violation: beforeEvaluate mutated rules');
    }
  }

  async assertParamsValidation(
    modelName: string,
    invalidParams: unknown[],
    context: PluginContext,
  ): Promise<void> {
    this.plugin.onInit(context);

    const model = this.findModel(modelName, context);
    if (!model) {
      throw new Error(`Model "${modelName}" not found in plugin`);
    }

    for (const params of invalidParams) {
      const result = model.validateParams(params);
      if (result.valid) {
        throw new Error(
          `Expected model "${modelName}" to reject params: ${JSON.stringify(params)}`,
        );
      }
    }
  }

  async assertNoSideEffects(input: EvaluationInput, rules: ReadonlyArray<Rule>): Promise<void> {
    if (this.plugin.beforeEvaluate) {
      const r1 = await this.plugin.beforeEvaluate(input, rules);
      const r2 = await this.plugin.beforeEvaluate(input, rules);

      if (JSON.stringify(r1) !== JSON.stringify(r2)) {
        throw new Error('Side effects detected: different results between calls');
      }
    }
  }

  async runAll(
    input: EvaluationInput,
    rules: ReadonlyArray<Rule>,
    context: PluginContext,
  ): Promise<TestReport> {
    const passed: string[] = [];
    const failed: Array<{ test: string; error: string }> = [];

    const tests = [
      { name: 'determinism', fn: () => this.assertDeterminism(input, rules, context) },
      { name: 'immutability', fn: () => this.assertImmutability(input, rules) },
      { name: 'noSideEffects', fn: () => this.assertNoSideEffects(input, rules) },
    ];

    for (const t of tests) {
      try {
        await t.fn();
        passed.push(t.name);
      } catch (error) {
        failed.push({
          test: t.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      passed,
      failed,
      summary: failed.length === 0 ? 'PASS' : 'FAIL',
    };
  }

  private findModel(name: string, context: PluginContext): CalculationModel | undefined {
    try {
      return context.modelRegistry.get(name);
    } catch {
      return undefined;
    }
  }
}
