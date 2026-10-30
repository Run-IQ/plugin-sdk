# @run-iq/plugin-sdk

Base classes and helpers for writing [Run-IQ](https://github.com/Run-IQ/core) plugins: `BasePlugin`, `BaseModel`, a small params validator, and a test harness that checks a plugin behaves deterministically.

A plugin is how domain logic gets into the engine. [`@run-iq/core`](https://github.com/Run-IQ/core) only knows how to filter, order and run rules; the plugin supplies the calculation models those rules point to. [`@run-iq/plugin-fiscal`](https://github.com/Run-IQ/plugin-fiscal) is a complete example built on this SDK.

## Install

```bash
npm install @run-iq/plugin-sdk @run-iq/core
```

`@run-iq/core` is a peer dependency. Requires Node.js 20 or later.

## Example

```ts
import { BasePlugin, BaseModel, SchemaValidator } from '@run-iq/plugin-sdk';
import type { Rule, ValidationResult } from '@run-iq/plugin-sdk';
import { PPEEngine, computeRuleChecksum } from '@run-iq/core';

// A model: params describe the rule, calculate() returns its contribution
class PerUnitModel extends BaseModel {
  readonly name = 'PER_UNIT';
  readonly version = '1.0.0';

  validateParams(params: unknown): ValidationResult {
    return SchemaValidator.validate(params, {
      field: { type: 'string' },
      amount: { type: 'number', min: 0 },
    });
  }

  calculate(input: Record<string, unknown>, _rule: Readonly<Rule>, params: unknown): number {
    const { field, amount } = params as { field: string; amount: number };
    return Number(input[field] ?? 0) * amount;
  }
}

// A plugin: the models it declares are registered when the engine starts
class ShippingPlugin extends BasePlugin {
  readonly name = 'shipping';
  readonly version = '1.0.0';
  readonly models = [new PerUnitModel()];
}

const engine = new PPEEngine({ plugins: [new ShippingPlugin()], dsls: [] });

const draft = {
  id: 'per-item-fee',
  version: 1,
  model: 'PER_UNIT',
  params: { field: 'itemCount', amount: 2.5 },
  priority: 1,
  effectiveFrom: new Date('2025-01-01'),
  effectiveUntil: null,
  tags: [],
};
const rule = { ...draft, checksum: computeRuleChecksum(draft) };

const input = {
  requestId: 'order-7',
  data: { itemCount: 4 },
  meta: { tenantId: 'acme', effectiveDate: new Date('2025-06-01') },
};
const result = await engine.evaluate([rule], input);

result.value; // 10
```

The engine calls `validateParams` before running a rule. A rule with invalid params is skipped with reason `INVALID_PARAMS`.

## `BasePlugin`

Declare `name`, `version` and `models`. `onInit` registers the models. The hooks below are optional and default to pass-through:

- `beforeEvaluate(input, rules)` returns `{ input, rules, skipped? }`. Use it to rewrite or drop rules before they are filtered.
- `afterEvaluate(input, result)` returns a result. Use it to add domain data, for example in `result.meta`.
- `onError(error, input)` is called when one of the hooks throws. The engine then carries on without that hook's changes.

Hooks must not mutate what they receive. Return new objects instead.

## `BaseModel`

Declare `name`, `version`, `validateParams(params)` and `calculate(input, rule, params)`. `calculate` returns a number, or `{ value, detail }` if you want extra data in the breakdown. An optional `describeParams()` documents the params for tooling.

## `SchemaValidator`

`SchemaValidator.validate(params, schema, { strict? })` checks a flat params object and returns `{ valid, errors? }`.

| Field option | |
|---|---|
| `type` | `'number'`, `'string'`, `'boolean'`, `'array'` or `'object'` |
| `min`, `max` | Bounds for numbers |
| `enum` | Allowed values for strings |
| `required` | Defaults to `true` |

With `strict: true`, keys not in the schema are reported as errors.

## Testing a plugin

`PluginTester` runs a plugin's hooks and models several times on the same input and fails if anything changes between runs or if the input is mutated.

```ts
import { PluginTester } from '@run-iq/plugin-sdk';
import { ModelRegistry, DSLRegistry } from '@run-iq/core';

const context = { modelRegistry: new ModelRegistry(), dslRegistry: new DSLRegistry(), engineVersion: '0.2.8' };
const report = await new PluginTester(new ShippingPlugin()).runAll(input, [rule], context);

report.summary; // 'PASS'
report.failed;  // [{ test, error }] for each failed check
```

`runAll` runs `assertDeterminism`, `assertImmutability` and `assertNoSideEffects`. `assertParamsValidation(modelName, invalidParams, context)` checks that a model rejects each of the given params; give it its own fresh context.

## Describing a plugin to tooling

Tools such as [`@run-iq/mcp-server`](https://github.com/Run-IQ/mcp-server) load a package's default export as a `PluginBundle`:

```ts
export default { plugin: new ShippingPlugin(), descriptor, dsls: [] } satisfies PluginBundle;
```

The `PluginDescriptor` lists the fields the plugin adds to rules, the input fields its models read, example rules, and guidelines used to prompt an LLM. See `src/types/descriptor.ts` for the full shape.

## License

MIT
