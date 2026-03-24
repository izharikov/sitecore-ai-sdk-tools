import { describe, expect, it } from 'vitest';
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
