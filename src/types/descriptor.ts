import type { PPEPlugin, DSLEvaluator } from '@run-iq/core';

/**
 * Describes a single field that a plugin adds to the Rule object.
 * Used by tooling (MCP server, CLI, Playground) to dynamically build
 * input schemas and validate rule structures.
 */
export interface RuleFieldDescriptor {
  readonly name: string;
  readonly type: 'string' | 'number' | 'boolean';
  readonly required: boolean;
  readonly description: string;
  readonly enum?: readonly string[];
}

/**
 * Describes an input data variable that a plugin expects in `input.data`.
 * Used by tooling to document available variables for conditions and models.
 */
export interface InputFieldDescriptor {
  readonly name: string;
  readonly type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  readonly description: string;
  readonly examples?: readonly unknown[];
}

/**
 * A complete rule example with optional input data.
 * Used by tooling to show concrete usage patterns to LLMs and users.
 */
export interface RuleExample {
  readonly title: string;
  readonly description: string;
  readonly rule: Record<string, unknown>;
  readonly input?: Record<string, unknown>;
}

/**
 * Self-describing metadata that a plugin provides to tooling layers.
 * This is the contract between a plugin and any consumer that needs
 * to understand the plugin's domain (MCP server, CLI, Playground, etc.).
 *
 * The plugin knows its domain best — it declares what fields it adds
 * to rules, what input variables it expects, what examples illustrate
 * its usage, and what guidelines help an LLM produce correct rules.
 */
export interface PluginDescriptor {
  /** Plugin package name (e.g. "@run-iq/plugin-fiscal") */
  readonly name: string;
  /** Plugin version (e.g. "0.1.0") */
  readonly version: string;
  /** Human-readable description of the plugin's domain and capabilities */
  readonly description: string;
  /** Short domain label used for prompt naming and context (e.g. "fiscal", "social", "payroll") */
  readonly domainLabel: string;
  /** Fields this plugin adds to the Rule object (e.g. jurisdiction, scope, country) */
  readonly ruleExtensions: readonly RuleFieldDescriptor[];
  /** Input data variables the plugin's models expect in input.data */
  readonly inputFields: readonly InputFieldDescriptor[];
  /** Concrete rule examples demonstrating the plugin's models and fields */
  readonly examples: readonly RuleExample[];
  /**
   * Domain-specific guidelines for LLMs and tooling.
   * These help an AI understand how to create correct rules, analyze
   * domain-specific text, and provide expert advice in this domain.
   *
   * Guidelines should be universal (not tied to a specific country/region)
   * and cover: model selection, field usage, best practices, common patterns.
   */
  readonly promptGuidelines: readonly string[];
}

/**
 * A complete plugin package ready for registration.
 * Ties together the runtime plugin, its self-describing metadata,
 * and optional DSL evaluators it depends on.
 */
export interface PluginBundle {
  readonly plugin: PPEPlugin;
  readonly descriptor: PluginDescriptor;
  readonly dsls?: readonly DSLEvaluator[];
}
