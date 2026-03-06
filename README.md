# @run-iq/plugin-sdk

SDK for building PPE plugins — provides base classes, parameter validation, and compliance testing utilities.

## Install

```bash
npm install @run-iq/plugin-sdk
```

**Peer dependency:** `@run-iq/core >= 0.1.0`

## Building a plugin

Extend `BasePlugin` and declare your calculation models:

```typescript
import { BasePlugin, BaseModel, SchemaValidator } from '@run-iq/plugin-sdk';
import type { Rule, ValidationResult } from '@run-iq/plugin-sdk';

class MyModel extends BaseModel {
  readonly name = 'MY_MODEL';
  readonly version = '1.0.0';

  validateParams(params: unknown): ValidationResult {
    return SchemaValidator.validate(params, {
      rate: { type: 'number', min: 0, max: 1 },
      base: { type: 'string' },
    });
  }

  calculate(input: Record<string, unknown>, _rule: Readonly<Rule>, params: unknown): number {
    const { rate, base } = params as { rate: number; base: string };
    return (input[base] as number) * rate;
  }
}

export class MyPlugin extends BasePlugin {
  readonly name = 'my-plugin';
  readonly version = '1.0.0';
  readonly models = [new MyModel()];
}
```

`BasePlugin.onInit()` automatically registers all declared models into the engine's `ModelRegistry`.

## Schema validation

`SchemaValidator` validates `params` against a declarative schema:

```typescript
import { SchemaValidator } from '@run-iq/plugin-sdk';

const result = SchemaValidator.validate(params, {
  rate: { type: 'number', min: 0, max: 1 },
  amount: { type: 'number', min: 0 },
  label: { type: 'string' },
});

if (!result.valid) {
  console.log(result.errors);
}
```

## Compliance testing

`PluginTester` verifies that a plugin respects PPE invariants:

```typescript
import { PluginTester } from '@run-iq/plugin-sdk';

const tester = new PluginTester(myPlugin);
const report = await tester.runAll(input, rules, context);

console.log(report.summary); // 'PASS' or 'FAIL'
```

Individual assertions:

| Method | Checks |
|---|---|
| `assertDeterminism()` | Same input x3 produces identical output |
| `assertImmutability()` | Hooks never mutate received data |
| `assertNoSideEffects()` | Consecutive calls produce identical results |
| `assertParamsValidation()` | Model rejects invalid params |

## Exports

| Export | Type | Description |
|---|---|---|
| `BasePlugin` | class | Abstract plugin base with auto model registration |
| `BaseModel` | class | Abstract model base with params validation guard |
| `PluginTester` | class | Compliance test runner |
| `SchemaValidator` | class | Declarative parameter validation |
| All `@run-iq/core` types | re-export | Convenience re-exports |

## Requirements

- Node.js >= 20
- `@run-iq/core` >= 0.1.0

## License

MIT
