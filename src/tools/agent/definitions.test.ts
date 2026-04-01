import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  assetToolsConfig,
  componentsToolsConfig,
  contentToolsConfig,
  environmentToolsConfig,
  jobToolsConfig,
  pagesToolsConfig,
  personalizationToolsConfig,
  sitesToolsConfig,
} from './definitions';

const allConfigs = {
  ...assetToolsConfig,
  ...componentsToolsConfig,
  ...contentToolsConfig,
  ...environmentToolsConfig,
  ...jobToolsConfig,
  ...pagesToolsConfig,
  ...personalizationToolsConfig,
  ...sitesToolsConfig,
};

const expectedMutations = [
  'update_asset',
  'upload_asset',
  'create_personalization_version',
  'revert_job',
  'create_page',
  'add_component_on_page',
  'set_component_datasource',
  'add_language_to_page',
  'create_content_item',
  'delete_content',
  'update_content',
  'create_component_datasource',
];

const expectedQueries = Object.keys(allConfigs).filter(
  (k) => !expectedMutations.includes(k)
);

describe('definitions mutation flags', () => {
  it.each(expectedMutations)('%s should have mutation: true', (toolName) => {
    const config = allConfigs[toolName as keyof typeof allConfigs] as Record<
      string,
      unknown
    >;
    expect(config.mutation).toBe(true);
  });

  it.each(expectedQueries)('%s should not have mutation: true', (toolName) => {
    const config = allConfigs[toolName as keyof typeof allConfigs] as Record<
      string,
      unknown
    >;
    expect(config.mutation).toBeUndefined();
  });

  it('every tool should have a description and inputSchema', () => {
    for (const [name, config] of Object.entries(allConfigs)) {
      expect(config.description, `${name} missing description`).toBeTruthy();
      expect(config.inputSchema, `${name} missing inputSchema`).toBeTruthy();
    }
  });
});

/*
 * LLM Provider Compatibility Tests
 *
 * Validates that tool JSON Schemas stay within the common denominator
 * of features supported by OpenAI, Anthropic, and Google Gemini.
 *
 * Provider constraints:
 *  - OpenAI:    all fields required, additionalProperties:false, no oneOf/allOf/default/const, max 10 nesting / 5000 props
 *  - Anthropic: additionalProperties:false, no oneOf/minimum/maximum/minLength/maxLength, minItems only 0|1
 *  - Gemini:    no oneOf/allOf/default/const/pattern/minLength/maxLength/multipleOf
 *
 * Allowed: format (uuid, uri, email, date-time, etc.), anyOf (non-root), description, enum
 *
 * Warnings (non-blocking):
 *  - propertyNames: emitted by z.record() / AI SDK for record types; redundant for string keys, silently ignored by providers
 *  - pattern: emitted by z.uuid(); supported by OpenAI + Anthropic, silently ignored by Gemini
 */

const ALLOWED_FORMATS = new Set([
  'date-time',
  'time',
  'date',
  'duration',
  'email',
  'hostname',
  'ipv4',
  'ipv6',
  'uuid',
  'uri',
]);

// Keywords that break at least 2 out of 3 major providers
const BANNED_KEYWORDS = new Set([
  'oneOf',
  'allOf',
  'const',
  'not',
  'if',
  'then',
  'else',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minItems',
  'maxItems',
  'uniqueItems',
  'patternProperties',
  'unevaluatedProperties',
  'unevaluatedItems',
]);

// Keywords emitted by Zod/AI SDK that are redundant or silently ignored by providers.
// Not hard errors — tracked separately so we know they exist.
const WARNED_KEYWORDS: Record<string, string> = {
  propertyNames:
    'emitted by z.record() for string keys; redundant in JSON, ignored by providers',
  pattern:
    'emitted by z.uuid(); supported by OpenAI + Anthropic, silently ignored by Gemini',
  default:
    'emitted by z.default(); not supported by OpenAI/Gemini but silently ignored, needed for Zod runtime parsing',
};

type JSONSchema = Record<string, unknown>;

interface SchemaIssue {
  path: string;
  keyword: string;
  severity: 'error' | 'warning';
  message: string;
}

function collectIssues(
  schema: JSONSchema,
  path: string,
  depth: number
): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  // Check nesting depth (OpenAI: max 10)
  if (depth > 10) {
    issues.push({
      path,
      keyword: 'nesting',
      severity: 'error',
      message: 'exceeds max nesting depth of 10',
    });
  }

  // Check banned keywords (errors)
  for (const key of BANNED_KEYWORDS) {
    if (key in schema) {
      issues.push({
        path,
        keyword: key,
        severity: 'error',
        message: `contains banned keyword "${key}"`,
      });
    }
  }

  // Check warned keywords
  for (const [key, reason] of Object.entries(WARNED_KEYWORDS)) {
    if (key in schema) {
      issues.push({
        path,
        keyword: key,
        severity: 'warning',
        message: `contains "${key}" (${reason})`,
      });
    }
  }

  // Check format values
  if (
    typeof schema.format === 'string' &&
    !ALLOWED_FORMATS.has(schema.format)
  ) {
    issues.push({
      path,
      keyword: 'format',
      severity: 'error',
      message: `unsupported format "${schema.format}"`,
    });
  }

  if (schema.type === 'object') {
    const properties = schema.properties as
      | Record<string, JSONSchema>
      | undefined;
    const required = schema.required as string[] | undefined;

    // additionalProperties must be false (OpenAI + Anthropic)
    if (properties && Object.keys(properties).length > 0) {
      if (schema.additionalProperties !== false) {
        issues.push({
          path,
          keyword: 'additionalProperties',
          severity: 'error',
          message: 'missing "additionalProperties: false" on object',
        });
      }
    }

    // All properties must be required (OpenAI)
    if (properties) {
      const propNames = Object.keys(properties);
      const requiredSet = new Set(required ?? []);
      for (const prop of propNames) {
        if (!requiredSet.has(prop)) {
          issues.push({
            path: `${path}.${prop}`,
            keyword: 'required',
            severity: 'error',
            message:
              'property is not required (OpenAI requires all fields in "required")',
          });
        }
      }

      // Every property should have a description
      for (const [prop, propSchema] of Object.entries(properties)) {
        if (!propSchema.description) {
          issues.push({
            path: `${path}.${prop}`,
            keyword: 'description',
            severity: 'error',
            message: 'missing "description"',
          });
        }
        issues.push(
          ...collectIssues(propSchema, `${path}.${prop}`, depth + 1)
        );
      }
    }
  }

  // Recurse into array items
  if (schema.type === 'array' && schema.items) {
    issues.push(
      ...collectIssues(schema.items as JSONSchema, `${path}[]`, depth + 1)
    );
  }

  // Recurse into anyOf branches
  if (Array.isArray(schema.anyOf)) {
    (schema.anyOf as JSONSchema[]).forEach((branch, i) => {
      issues.push(
        ...collectIssues(branch, `${path}.anyOf[${i}]`, depth + 1)
      );
    });
  }

  // Recurse into additionalProperties when it's a schema (for z.record())
  if (
    schema.additionalProperties &&
    typeof schema.additionalProperties === 'object'
  ) {
    issues.push(
      ...collectIssues(
        schema.additionalProperties as JSONSchema,
        `${path}[additionalProperties]`,
        depth + 1
      )
    );
  }

  return issues;
}

describe('LLM provider schema compatibility', () => {
  const toolEntries = Object.entries(allConfigs);

  it.each(toolEntries)(
    '%s schema is LLM-compatible',
    (_toolName, config) => {
      const jsonSchema = z.toJSONSchema(config.inputSchema, {
        target: 'draft-7',
      }) as JSONSchema;

      // Root must be object
      expect(jsonSchema.type).toBe('object');

      // Root must not be anyOf
      expect(jsonSchema.anyOf).toBeUndefined();

      const issues = collectIssues(jsonSchema, '', 0);
      const errors = issues.filter((i) => i.severity === 'error');

      expect(errors.map((e) => `${e.path}: ${e.message}`)).toEqual([]);
    }
  );

  it('total property count is within OpenAI limit of 5000', () => {
    let totalProps = 0;

    for (const config of Object.values(allConfigs)) {
      const jsonSchema = z.toJSONSchema(config.inputSchema, {
        target: 'draft-7',
      }) as JSONSchema;

      const countProps = (s: JSONSchema): number => {
        let count = 0;
        if (s.properties) {
          const props = s.properties as Record<string, JSONSchema>;
          count += Object.keys(props).length;
          for (const propSchema of Object.values(props)) {
            count += countProps(propSchema);
          }
        }
        if (s.type === 'array' && s.items) {
          count += countProps(s.items as JSONSchema);
        }
        return count;
      };

      totalProps += countProps(jsonSchema);
    }

    expect(totalProps).toBeLessThanOrEqual(5000);
  });
});
