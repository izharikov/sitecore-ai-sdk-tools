import { experimental_XMC } from '@sitecore-marketplace-sdk/xmc';
import { Tool } from 'ai';
import { describe, expect, it } from 'vitest';
import { createAgentTools } from '@/index';

function mockXmcClient(): experimental_XMC {
  return {
    agent: new Proxy(
      {},
      {
        get: () => () => Promise.resolve({ data: {} }),
      }
    ),
  } as unknown as experimental_XMC;
}

function getToolApproval(tool: Tool) {
  return tool.needsApproval;
}

describe('needsApproval', () => {
  describe('server-side', () => {
    it('applies needsApproval to all tools by default', () => {
      const tools = createAgentTools({
        execution: 'server',
        client: mockXmcClient(),
        sitecoreContextId: 'ctx',
        needsApproval: true,
      });

      for (const [, tool] of Object.entries(tools)) {
        expect(getToolApproval(tool)).toBe(true);
      }
    });

    it('applies needsApproval only to mutation tools when needsApprovalFor is "mutations"', () => {
      const tools = createAgentTools({
        execution: 'server',
        client: mockXmcClient(),
        sitecoreContextId: 'ctx',
        needsApproval: true,
        needsApprovalFor: 'mutations',
      });

      const mutationTools = [
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

      for (const [name, tool] of Object.entries(tools)) {
        if (mutationTools.includes(name)) {
          expect(getToolApproval(tool), `${name} should need approval`).toBe(
            true
          );
        } else {
          expect(
            getToolApproval(tool),
            `${name} should NOT need approval`
          ).toBeUndefined();
        }
      }
    });

    it('does not set needsApproval when not provided', () => {
      const tools = createAgentTools({
        execution: 'server',
        client: mockXmcClient(),
        sitecoreContextId: 'ctx',
      });

      for (const [, tool] of Object.entries(tools)) {
        expect(getToolApproval(tool)).toBeUndefined();
      }
    });
  });

  describe('client-side', () => {
    it('applies needsApproval to all tools by default', () => {
      const tools = createAgentTools({
        execution: 'client',
        needsApproval: true,
      });

      for (const [, tool] of Object.entries(tools)) {
        expect(getToolApproval(tool)).toBe(true);
      }
    });

    it('applies needsApproval only to mutation tools when needsApprovalFor is "mutations"', () => {
      const tools = createAgentTools({
        execution: 'client',
        needsApproval: true,
        needsApprovalFor: 'mutations',
      });

      const queryTools = [
        'get_asset_information',
        'search_assets',
        'list_languages',
        'get_sites_list',
        'get_site_details',
        'get_page',
      ];

      for (const [name, tool] of Object.entries(tools)) {
        if (queryTools.includes(name)) {
          expect(
            getToolApproval(tool),
            `${name} should NOT need approval`
          ).toBeUndefined();
        }
      }
    });
  });
});
