import { describe, it, expect } from 'vitest';
import { BaseModel } from '../src/base/BaseModel.js';
import type { ValidationResult, Rule } from '@run-iq/core';

class TestModel extends BaseModel {
  readonly name = 'TEST_MODEL';
  readonly version = '1.0.0';

  validateParams(params: unknown): ValidationResult {
    if (params !== null && typeof params === 'object' && 'rate' in params) {
      return { valid: true };
    }
    return { valid: false, errors: ['rate is required'] };
  }

  calculate(input: Record<string, unknown>, _matchedRule: Readonly<Rule>, params: unknown): number {
    const p = params as { rate: number; base: string };
    return (input[p.base] as number) * p.rate;
  }
}

describe('BaseModel', () => {
  const model = new TestModel();

  it('has name and version', () => {
    expect(model.name).toBe('TEST_MODEL');
    expect(model.version).toBe('1.0.0');
  });

  it('validates params correctly', () => {
    expect(model.validateParams({ rate: 0.1 }).valid).toBe(true);
    expect(model.validateParams({}).valid).toBe(false);
  });

  it('calculates correctly', () => {
    const input = { amount: 1000 };
    const rule = { id: 'r', model: 'TEST_MODEL', params: {} } as unknown as Rule;
    expect(model.calculate(input, rule, { rate: 0.18, base: 'amount' })).toBe(180);
  });
});
