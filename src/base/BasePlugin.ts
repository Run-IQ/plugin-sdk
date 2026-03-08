import type {
  PPEPlugin,
  PluginContext,
  BeforeEvaluateResult,
  EvaluationInput,
  EvaluationResult,
  Rule,
  CalculationModel,
  PPEError,
} from '@run-iq/core';

export abstract class BasePlugin implements PPEPlugin {
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly models: CalculationModel[];

  onInit(context: PluginContext): void {
    for (const model of this.models) {
      context.modelRegistry.register(model);
    }
  }

  beforeEvaluate(input: EvaluationInput, rules: ReadonlyArray<Rule>): BeforeEvaluateResult {
    return { input, rules };
  }

  afterEvaluate(_input: EvaluationInput, result: EvaluationResult): EvaluationResult {
    return result;
  }

  onError(_error: PPEError, _input: EvaluationInput): void {
    // no-op by default
  }

  teardown(): void {
    // no-op by default
  }
}
