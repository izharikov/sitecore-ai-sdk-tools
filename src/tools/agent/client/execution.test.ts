import { ClientSDK } from '@sitecore-marketplace-sdk/client';
import { describe, expect, it, vi } from 'vitest';
import { executeAgentTool } from './execution';

type MockOverrides = Record<string, () => Promise<unknown>>;

function createMockClientSDK(overrides: MockOverrides = {}) {
  return {
    query: vi.fn().mockImplementation((key: string) => {
      if (overrides[key]) return overrides[key]();
      return Promise.resolve({ isSuccess: true, data: { items: [] } });
    }),
    mutate: vi.fn().mockImplementation((key: string) => {
      if (overrides[key]) return overrides[key]();
      return Promise.resolve({ success: true });
    }),
  } as unknown as ClientSDK;
}

type MockClient = ReturnType<typeof createMockClientSDK> & {
  query: ReturnType<typeof vi.fn>;
  mutate: ReturnType<typeof vi.fn>;
};

const CTX_ID = 'test-ctx';

describe('executeAgentTool', () => {
  it('returns success: false for unknown tool', async () => {
    const client = createMockClientSDK();
    const result = await executeAgentTool(
      { client, sitecoreContextId: CTX_ID },
      { toolName: 'nonexistent_tool', input: {} }
    );

    expect(result).toEqual({
      success: false,
      error: 'Tool nonexistent_tool not found',
    });
  });

  it('executes a query tool and returns result', async () => {
    const client = createMockClientSDK({
      'xmc.agent.sitesGetSitesList': () =>
        Promise.resolve({
          isSuccess: true,
          data: { sites: ['site1', 'site2'] },
        }),
    }) as MockClient;

    const result = await executeAgentTool(
      { client, sitecoreContextId: CTX_ID },
      { toolName: 'get_sites_list', input: {} }
    );

    expect(result.success).toBe(true);
    expect(client.query).toHaveBeenCalledWith(
      'xmc.agent.sitesGetSitesList',
      expect.objectContaining({
        params: { query: { sitecoreContextId: CTX_ID } },
      })
    );
  });

  it('executes a mutation tool via mutate', async () => {
    const client = createMockClientSDK({
      'xmc.agent.contentDeleteContent': () =>
        Promise.resolve({ success: true }),
    }) as MockClient;

    const result = await executeAgentTool(
      { client, sitecoreContextId: CTX_ID },
      {
        toolName: 'delete_content',
        input: { itemId: 'item-1', language: 'en' },
      }
    );

    expect(result.success).toBe(true);
    expect(client.mutate).toHaveBeenCalledWith(
      'xmc.agent.contentDeleteContent',
      expect.objectContaining({
        params: expect.objectContaining({
          path: { itemId: 'item-1' },
          query: { language: 'en', sitecoreContextId: CTX_ID },
        }),
      })
    );
  });

  it('validates input with zod schema', async () => {
    const client = createMockClientSDK();

    await expect(
      executeAgentTool(
        { client, sitecoreContextId: CTX_ID },
        { toolName: 'get_page', input: { pageId: 123 } } // pageId should be string
      )
    ).rejects.toThrow();
  });

  it('fixes placeholder path for get_allowed_components_by_placeholder', async () => {
    const client = createMockClientSDK() as MockClient;

    await executeAgentTool(
      { client, sitecoreContextId: CTX_ID },
      {
        toolName: 'get_allowed_components_by_placeholder',
        input: {
          pageId: 'p-1',
          placeholderName: '/main/content/',
          language: 'en',
        },
      }
    );

    expect(client.query).toHaveBeenCalledWith(
      'xmc.agent.pagesGetAllowedComponentsByPlaceholder',
      expect.objectContaining({
        params: expect.objectContaining({
          path: { pageId: 'p-1', placeholderName: 'content' },
        }),
      })
    );
  });

  it('upload_asset fetches file URL and creates blob', async () => {
    const mockArrayBuffer = new ArrayBuffer(8);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      arrayBuffer: () => Promise.resolve(mockArrayBuffer),
    } as unknown as Response);

    const client = createMockClientSDK({
      'xmc.agent.assetsUploadAsset': () => Promise.resolve({ success: true }),
    }) as MockClient;

    const result = await executeAgentTool(
      { client, sitecoreContextId: CTX_ID },
      {
        toolName: 'upload_asset',
        input: {
          fileUrl: 'https://example.com/photo.jpg',
          name: 'photo',
          itemPath: '/media',
          language: 'en',
          extension: 'jpg',
          siteName: 'site1',
        },
      }
    );

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/photo.jpg');
    expect(client.mutate).toHaveBeenCalledWith(
      'xmc.agent.assetsUploadAsset',
      expect.objectContaining({
        params: expect.objectContaining({
          body: expect.objectContaining({
            file: expect.any(Blob),
            upload_request: expect.stringContaining('"name":"photo"'),
          }),
        }),
      })
    );

    fetchSpy.mockRestore();
  });
});
