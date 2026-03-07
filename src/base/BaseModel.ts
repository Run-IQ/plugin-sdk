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
}
