import { describe, it, expect, vi } from 'vitest';
import { BasePlugin } from '../src/base/BasePlugin.js';
import type { CalculationModel, ValidationResult, PluginContext } from '@run-iq/core';

class DummyModel implements CalculationModel {
  readonly name = 'DUMMY';
  readonly version = '1.0.0';
  validateParams(_p: unknown): ValidationResult {
    return { valid: true };
  }
  calculate(): number {
    return 42;
  }
}

class TestPlugin extends BasePlugin {
  readonly name = 'test-plugin';
  readonly version = '1.0.0';
  readonly models = [new DummyModel()];
}

describe('BasePlugin', () => {
  it('auto-registers models on onInit', () => {
    const plugin = new TestPlugin();
    const registerFn = vi.fn();
    const context = {
      modelRegistry: { register: registerFn, get: vi.fn(), has: vi.fn(), getAll: vi.fn() },
      dslRegistry: { register: vi.fn(), get: vi.fn(), has: vi.fn(), getAll: vi.fn() },
      engineVersion: '0.1.0',
    } as unknown as PluginContext;

    plugin.onInit(context);
    expect(registerFn).toHaveBeenCalledTimes(1);
    expect(registerFn).toHaveBeenCalledWith(expect.objectContaining({ name: 'DUMMY' }));
  });

  it('beforeEvaluate returns input unchanged by default', () => {
    const plugin = new TestPlugin();
    const input = { requestId: 'r', data: {}, meta: { tenantId: 't' } };
    const result = plugin.beforeEvaluate(input, []);
    expect(result).toEqual({ input, rules: [] });
  });

  it('afterEvaluate returns result unchanged by default', () => {
    const plugin = new TestPlugin();
    const input = { requestId: 'r', data: {}, meta: { tenantId: 't' } };
    const result = {
      requestId: 'r',
      value: 0,
      breakdown: [],
      appliedRules: [],
      skippedRules: [],
      trace: { steps: [], totalDurationMs: 0 },
      snapshotId: '',
      engineVersion: '0.1.0',
      pluginVersions: {},
      dslVersions: {},
      timestamp: new Date(),
    };
    expect(plugin.afterEvaluate(input, result)).toBe(result);
  });

  it('onError is a no-op by default', () => {
    const plugin = new TestPlugin();
    // Should not throw
    expect(() =>
      plugin.onError(
        { name: 'err', message: 'x', code: 'ERR' } as Parameters<typeof plugin.onError>[0],
        { requestId: 'r', data: {}, meta: { tenantId: 't' } },
      ),
    ).not.toThrow();
  });
});
