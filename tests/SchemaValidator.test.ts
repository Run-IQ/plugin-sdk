import { describe, it, expect } from 'vitest';
import { SchemaValidator } from '../src/validation/SchemaValidator.js';

describe('SchemaValidator', () => {
  it('validates valid params', () => {
    const result = SchemaValidator.validate(
      { rate: 0.18, base: 'amount' },
      {
        rate: { type: 'number', min: 0, max: 1 },
        base: { type: 'string' },
      },
    );
    expect(result.valid).toBe(true);
  });

  it('rejects missing required field', () => {
    const result = SchemaValidator.validate(
      { base: 'amount' },
      {
        rate: { type: 'number' },
        base: { type: 'string' },
      },
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('"rate" is required');
  });

  it('rejects wrong type', () => {
    const result = SchemaValidator.validate({ rate: 'not_a_number' }, { rate: { type: 'number' } });
    expect(result.valid).toBe(false);
  });

  it('rejects number out of range', () => {
    const result = SchemaValidator.validate({ rate: 1.5 }, { rate: { type: 'number', max: 1 } });
    expect(result.valid).toBe(false);
  });

  it('rejects non-object params', () => {
    const result = SchemaValidator.validate(null, { x: { type: 'string' } });
    expect(result.valid).toBe(false);
  });

  it('validates enum strings', () => {
    const result = SchemaValidator.validate(
      { currency: 'XOF' },
      { currency: { type: 'string', enum: ['XOF', 'EUR'] } },
    );
    expect(result.valid).toBe(true);

    const bad = SchemaValidator.validate(
      { currency: 'USD' },
      { currency: { type: 'string', enum: ['XOF', 'EUR'] } },
    );
    expect(bad.valid).toBe(false);
  });

  describe('static helpers', () => {
    it('number validates correctly', () => {
      expect(SchemaValidator.number(5, { min: 0, max: 10 })).toBe(true);
      expect(SchemaValidator.number(-1, { min: 0 })).toBe(false);
      expect(SchemaValidator.number('nope')).toBe(false);
    });

    it('string validates correctly', () => {
      expect(SchemaValidator.string('hello')).toBe(true);
      expect(SchemaValidator.string(42)).toBe(false);
      expect(SchemaValidator.string('a', { enum: ['a', 'b'] })).toBe(true);
      expect(SchemaValidator.string('c', { enum: ['a', 'b'] })).toBe(false);
    });

    it('positiveNumber validates correctly', () => {
      expect(SchemaValidator.positiveNumber(0)).toBe(true);
      expect(SchemaValidator.positiveNumber(5)).toBe(true);
      expect(SchemaValidator.positiveNumber(-1)).toBe(false);
    });

    it('rate validates correctly', () => {
      expect(SchemaValidator.rate(0.5)).toBe(true);
      expect(SchemaValidator.rate(0)).toBe(true);
      expect(SchemaValidator.rate(1)).toBe(true);
      expect(SchemaValidator.rate(1.1)).toBe(false);
      expect(SchemaValidator.rate(-0.1)).toBe(false);
    });
  });
});
