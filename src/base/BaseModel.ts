import type { CalculationModel, CalculationOutput, ValidationResult, Rule } from '@run-iq/core';

export abstract class BaseModel implements CalculationModel {
  abstract readonly name: string;
  abstract readonly version: string;

  abstract validateParams(params: unknown): ValidationResult;

  abstract calculate(
    input: Record<string, unknown>,
    matchedRule: Readonly<Rule>,
    params: unknown,
  ): number | CalculationOutput;

  safeCalculate(
    input: Record<string, unknown>,
    matchedRule: Readonly<Rule>,
    params: unknown,
  ): number | CalculationOutput {
    const validation = this.validateParams(params);
    if (!validation.valid) {
      throw new Error(
        `Invalid params for model ${this.name}: ${validation.errors?.join(', ') ?? 'unknown error'}`,
      );
    }
    return this.calculate(input, matchedRule, params);
  }
}
