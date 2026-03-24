import { experimental_XMC } from '@sitecore-marketplace-sdk/xmc';
import { ToolExecutionOptions } from 'ai';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { assetTools, pagesTools, contentTools } from './index';

function createMockClient() {
  return {
    agent: {
      assetsGetAssetInformation: vi.fn().mockResolvedValue({
        data: { id: 'asset-1', name: 'test.png' },
      }),
      assetsSearchAssets: vi.fn().mockResolvedValue({
        data: { items: [] },
      }),
      assetsUpdateAsset: vi.fn().mockResolvedValue({
        data: { success: true },
      }),
      assetsUploadAsset: vi.fn().mockResolvedValue({
        data: { id: 'new-asset' },
      }),
      pagesGetPage: vi.fn().mockResolvedValue({
        data: { id: 'page-1' },
      }),
      pagesGetAllowedComponentsByPlaceholder: vi.fn().mockResolvedValue({
        data: { components: [] },
      }),
      pagesAddComponentOnPage: vi.fn().mockResolvedValue({
        data: { success: true },
      }),
      contentCreateContentItem: vi.fn().mockResolvedValue({
        data: { id: 'item-1' },
      }),
      contentDeleteContent: vi.fn().mockResolvedValue({
        data: { success: true },
      }),
    },
  } as unknown as experimental_XMC;
}

const CTX_ID = 'test-context-id';

const execOptions: ToolExecutionOptions = {
  toolCallId: 'test-call-id',
  messages: [],
};

function mockAgent(client: experimental_XMC) {
  return client.agent as unknown as Record<string, ReturnType<typeof vi.fn>>;
}

describe('server-side tool execution', () => {
  let client: experimental_XMC;

  beforeEach(() => {
    client = createMockClient();
  });

  describe('assetTools', () => {
    it('get_asset_information calls SDK with correct params', async () => {
      const tools = assetTools(client, CTX_ID);
      await tools.get_asset_information.execute!(
        { assetId: 'a-1' },
        execOptions
      );

      expect(mockAgent(client).assetsGetAssetInformation).toHaveBeenCalledWith({
        query: { sitecoreContextId: CTX_ID },
        path: { assetId: 'a-1' },
      });
    });

    it('update_asset calls SDK with job id header', async () => {
      const tools = assetTools(client, CTX_ID);
      await tools.update_asset.execute!(
        {
          assetId: 'a-1',
          fields: {},
          language: 'en',
          name: 'updated',
          altText: 'alt',
        },
        execOptions
      );

      expect(mockAgent(client).assetsUpdateAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { 'x-sc-job-id': expect.any(String) },
          query: { sitecoreContextId: CTX_ID },
          path: { assetId: 'a-1' },
          body: {
            fields: {},
            language: 'en',
            name: 'updated',
            altText: 'alt',
          },
        })
      );
    });

    it('update_asset returns jobId in result', async () => {
      const tools = assetTools(client, CTX_ID);
      const result = await tools.update_asset.execute!(
        {
          assetId: 'a-1',
          fields: {},
          language: 'en',
          name: 'updated',
          altText: 'alt',
        },
        execOptions
      );

      const res = result as { jobId: string };
      expect(res).toHaveProperty('jobId');
      expect(typeof res.jobId).toBe('string');
      expect(res.jobId).toHaveLength(36); // UUID v4
    });

    it('upload_asset fetches file and passes blob to SDK', async () => {
      const mockArrayBuffer = new ArrayBuffer(8);
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      } as unknown as Response);

      const tools = assetTools(client, CTX_ID);
      await tools.upload_asset.execute!(
        {
          fileUrl: 'https://example.com/image.png',
          name: 'image',
          itemPath: '/media/images',
          language: 'en',
          extension: 'png',
          siteName: 'site1',
        },
        execOptions
      );

      expect(fetchSpy).toHaveBeenCalledWith('https://example.com/image.png');

      const call = mockAgent(client).assetsUploadAsset.mock.calls[0][0];
      const blob = call.body.file as Blob;
      expect(blob).toBeInstanceOf(Blob);
      const buffer = await blob.arrayBuffer();
      expect(buffer).toEqual(mockArrayBuffer);

      expect(call.body.upload_request).toBe(
        JSON.stringify({
          name: 'image',
          itemPath: '/media/images',
          language: 'en',
          extension: 'png',
          siteName: 'site1',
        })
      );

      fetchSpy.mockRestore();
    });
  });

  describe('pagesTools - placeholder path fix', () => {
    it('extracts last non-empty segment from placeholder path', async () => {
      const tools = pagesTools(client, CTX_ID);
      await tools.get_allowed_components_by_placeholder.execute!(
        {
          pageId: 'p-1',
          placeholderName: '/main/content/sidebar/',
          language: 'en',
        },
        execOptions
      );

      expect(
        client.agent.pagesGetAllowedComponentsByPlaceholder
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { pageId: 'p-1', placeholderName: 'sidebar' },
        })
      );
    });

    it('handles simple placeholder name', async () => {
      const tools = pagesTools(client, CTX_ID);
      await tools.get_allowed_components_by_placeholder.execute!(
        {
          pageId: 'p-1',
          placeholderName: 'main',
          language: 'en',
        },
        execOptions
      );

      expect(
        client.agent.pagesGetAllowedComponentsByPlaceholder
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { pageId: 'p-1', placeholderName: 'main' },
        })
      );
    });

    it('handles path with multiple segments', async () => {
      const tools = pagesTools(client, CTX_ID);
      await tools.get_allowed_components_by_placeholder.execute!(
        {
          pageId: 'p-1',
          placeholderName: 'header/nav/subnav',
          language: 'en',
        },
        execOptions
      );

      expect(
        client.agent.pagesGetAllowedComponentsByPlaceholder
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { pageId: 'p-1', placeholderName: 'subnav' },
        })
      );
    });
  });

  describe('pagesTools - add_component_on_page', () => {
    it('maps componentId to componentRenderingId in body', async () => {
      const tools = pagesTools(client, CTX_ID);
      await tools.add_component_on_page.execute!(
        {
          pageId: 'p-1',
          componentId: 'comp-1',
          placeholderPath: '/main',
          componentItemName: 'Hero',
          language: 'en',
          fields: { Text: 'Hello' },
        },
        execOptions
      );

      expect(mockAgent(client).pagesAddComponentOnPage).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            componentRenderingId: 'comp-1',
            placeholderPath: '/main',
            componentItemName: 'Hero',
            language: 'en',
            fields: { Text: 'Hello' },
          }),
        })
      );
    });
  });

  describe('error handling', () => {
    it('wrapAgentCall throws on error response', async () => {
      mockAgent(client).assetsGetAssetInformation.mockResolvedValue({
        data: {},
        error: 'Not found',
      });

      const tools = assetTools(client, CTX_ID);
      await expect(
        tools.get_asset_information.execute!({ assetId: 'bad' }, execOptions)
      ).rejects.toBe('Not found');
    });

    it('callWithJobId throws on error response', async () => {
      mockAgent(client).contentDeleteContent.mockResolvedValue({
        data: {},
        error: 'Forbidden',
      });

      const tools = contentTools(client, CTX_ID);
      await expect(
        tools.delete_content.execute!(
          { itemId: 'x', language: 'en' },
          execOptions
        )
      ).rejects.toBe('Forbidden');
    });
  });
});
