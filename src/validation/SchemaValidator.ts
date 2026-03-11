import type { ValidationResult } from '@run-iq/core';

export interface SchemaFieldDef {
  readonly type: 'number' | 'string' | 'boolean' | 'array' | 'object';
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  readonly enum?: readonly string[] | undefined;
  readonly required?: boolean | undefined;
}

export type SchemaDefinition = Record<string, SchemaFieldDef>;

export interface ValidateOptions {
  readonly strict?: boolean | undefined;
}

export class SchemaValidator {
  static validate(
    params: unknown,
    schema: SchemaDefinition,
    options?: ValidateOptions,
  ): ValidationResult {
    const errors: string[] = [];

    if (params === null || typeof params !== 'object') {
      return { valid: false, errors: ['params must be a non-null object'] };
    }

    const obj = params as Record<string, unknown>;

    if (options?.strict === true) {
      for (const key of Object.keys(obj)) {
        if (!(key in schema)) {
          errors.push(`unexpected key "${key}"`);
        }
      }
    }

    for (const [key, def] of Object.entries(schema)) {
      const value = obj[key];
      const isRequired = def.required !== false;

      if (value === undefined || value === null) {
        if (isRequired) {
          errors.push(`"${key}" is required`);
        }
        continue;
      }

      if (def.type === 'number') {
        if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
          errors.push(`"${key}" must be a number`);
          continue;
        }
        if (def.min !== undefined && value < def.min) {
          errors.push(`"${key}" must be >= ${def.min}`);
        }
        if (def.max !== undefined && value > def.max) {
          errors.push(`"${key}" must be <= ${def.max}`);
        }
      } else if (def.type === 'string') {
        if (typeof value !== 'string') {
          errors.push(`"${key}" must be a string`);
          continue;
        }
        if (def.enum && !def.enum.includes(value)) {
          errors.push(`"${key}" must be one of: ${def.enum.join(', ')}`);
        }
      } else if (def.type === 'boolean') {
        if (typeof value !== 'boolean') {
          errors.push(`"${key}" must be a boolean`);
        }
      } else if (def.type === 'array') {
        if (!Array.isArray(value)) {
          errors.push(`"${key}" must be an array`);
        }
      } else if (def.type === 'object') {
        if (typeof value !== 'object' || Array.isArray(value)) {
          errors.push(`"${key}" must be an object`);
        }
      }
    }

    return errors.length > 0 ? { valid: false, errors } : { valid: true };
  }

  static number(value: unknown, opts?: { min?: number; max?: number }): boolean {
    if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) return false;
    if (opts?.min !== undefined && value < opts.min) return false;
    if (opts?.max !== undefined && value > opts.max) return false;
    return true;
  }

  static string(value: unknown, opts?: { enum?: readonly string[] }): boolean {
    if (typeof value !== 'string') return false;
    if (opts?.enum && !opts.enum.includes(value)) return false;
    return true;
  }

  static positiveNumber(value: unknown): boolean {
    return SchemaValidator.number(value, { min: 0 });
  }

  static rate(value: unknown): boolean {
    return SchemaValidator.number(value, { min: 0, max: 1 });
  }
}
