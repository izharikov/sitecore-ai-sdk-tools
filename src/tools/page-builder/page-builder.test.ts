import { ClientSDK } from '@sitecore-marketplace-sdk/client';
import { describe, expect, it, vi } from 'vitest';
import { executePageBuilderTool, pageBuilderTools } from './index';

function createMockClient() {
  return {
    query: vi.fn(),
    mutate: vi.fn(),
  } as unknown as ClientSDK;
}

type MockClient = ReturnType<typeof createMockClient> & {
  query: ReturnType<typeof vi.fn>;
  mutate: ReturnType<typeof vi.fn>;
};

describe('pageBuilderTools', () => {
  it('returns expected tool names', () => {
    const tools = pageBuilderTools({});
    expect(Object.keys(tools).sort()).toEqual([
      'get_current_page_context',
      'navigate_to_another_page',
      'reload_current_page',
    ]);
  });
});

describe('executePageBuilderTool', () => {
  it('returns error for unknown tool', async () => {
    const client = createMockClient();
    const result = await executePageBuilderTool(
      { client, sitecoreContextId: 'ctx' },
      { toolName: 'unknown_tool', input: {} }
    );

    expect(result).toEqual({ success: false, error: 'Tool not found' });
  });

  it('executes get_current_page_context', async () => {
    const client = createMockClient() as MockClient;
    client.query.mockResolvedValue({
      isError: false,
      data: { pageInfo: { id: 'page-1', name: 'Home' } },
    });

    const result = await executePageBuilderTool(
      { client, sitecoreContextId: 'ctx' },
      { toolName: 'get_current_page_context', input: {} }
    );

    expect(result.success).toBe(true);
    expect(result.result).toEqual({ id: 'page-1', name: 'Home' });
    expect(client.query).toHaveBeenCalledWith('pages.context');
  });

  it('executes navigate_to_another_page', async () => {
    const client = createMockClient() as MockClient;
    client.mutate.mockResolvedValue({});

    const result = await executePageBuilderTool(
      { client, sitecoreContextId: 'ctx' },
      { toolName: 'navigate_to_another_page', input: { itemId: 'page-2' } }
    );

    expect(result.success).toBe(true);
    expect(result.result).toBe('Navigated to item: page-2');
    expect(client.mutate).toHaveBeenCalledWith('pages.context', {
      params: { itemId: 'page-2' },
    });
  });

  it('executes reload_current_page', async () => {
    const client = createMockClient() as MockClient;
    client.query.mockResolvedValue({
      isError: false,
      data: { pageInfo: { id: 'page-1' } },
    });
    client.mutate.mockResolvedValue({});

    const result = await executePageBuilderTool(
      { client, sitecoreContextId: 'ctx' },
      { toolName: 'reload_current_page', input: {} }
    );

    expect(result.success).toBe(true);
    expect(result.result).toBe('Reloaded current page');
    expect(client.mutate).toHaveBeenCalledWith('pages.context', {
      params: { itemId: 'page-1' },
    });
  });

  it('throws when page context query fails', async () => {
    const client = createMockClient() as MockClient;
    client.query.mockResolvedValue({
      isError: true,
      data: null,
      error: 'No page',
    });

    await expect(
      executePageBuilderTool(
        { client, sitecoreContextId: 'ctx' },
        { toolName: 'get_current_page_context', input: {} }
      )
    ).rejects.toBe('No page');
  });
});
