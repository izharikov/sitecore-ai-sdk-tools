# sitecore-ai-sdk-tools

Vercel AI SDK tools definition for Sitecore Marketplace Application.

APIs and SDKs to used:
- [Vercel AI SDK](https://sdk.vercel.ai/)
- [Sitecore Marketplace SDK](https://www.npmjs.com/package/@sitecore-marketplace-sdk/client)
- [Sitecore Marketplace SDK XMC](https://www.npmjs.com/package/@sitecore-marketplace-sdk/xmc)
- [Agent API](https://api-docs.sitecore.com/sai/agent-api)

## Installation

```bash
npm install sitecore-ai-sdk-tools
```

## Dependencies

This package requires the following dependencies:

- `@sitecore-marketplace-sdk/client`
- `@sitecore-marketplace-sdk/xmc`
- `ai` - Vercel AI SDK v6
- `zod` (comes with Vercel AI SDK)

## Usage

### Server-side

Works for server-side (full-stack) authentication process in Marketplace Application: read more on [custom authorization](https://doc.sitecore.com/mp/en/developers/marketplace/app-architecture-and-authorization-options.html#authorization).

Use `execution: 'server'` when running in a Node.js environment (e.g. Next.js API route or server action), providing a pre-initialized `experimental_XMC` client:

```typescript
import { createSitecoreTools } from "sitecore-ai-sdk-tools";
import { experimental_XMC } from "@sitecore-marketplace-sdk/xmc";
import { generateText } from "ai";

const xmcClient = new experimental_XMC({
  /* your config */
});

const tools = createSitecoreTools({
  execution: "server",
  client: xmcClient,
  sitecoreContextId: "your-context-id",
});

const result = await generateText({
  model: yourModel,
  prompt: "Get the list of sites",
  tools,
});
```


### Client-side

Works for client-side authentication process in Marketplace Application (default).

Use `execution: 'client'` in your `router.ts` file:

```typescript
import { createSitecoreTools, executeSitecoreTool } from "sitecore-ai-sdk-tools";
import { generateText } from "ai";

const tools = createSitecoreTools({ execution: "client" });

const result = await generateText({
  model: yourModel,
  prompt: "List all sites",
  tools,
});
```

Vercel AI SDK support client-side tool execution. This is how:
- define tools in `generateText` (or similar function), but leave `execute` function undefined
- handle tool calls client-side (using `useChat` and `onFinish` callback)

```ts
// define sitecoreContextId
const executeTool = async (toolPart: ToolUIPart) => {
    const toolName = toolPart.type.substring('tool-'.length);
    if (!sitecoreContextId) {
      throw new Error('No sitecore context found');
    }
    try {
      let res = await executeSitecoreTool(
        { client, sitecoreContextId },
        { toolName, input: toolPart.input }
      );
      if (!res.success) {
        res = await executePageBuilderTool(
          { client, sitecoreContextId },
          { toolName, input: toolPart.input }
        );
      }
    } catch (error) {
      console.error('Error executing tool:', error);
    }
}

const chat = useChat({
    transport: ...,
    onFinish: async ({ message, finishReason }) => {
    // if tool was finished because of tool call
        if (finishReason !== 'tool-calls') {
            return;
        }
        for (const part of message.parts) {
            if (!part.type.startsWith('tool')) {
                continue;
            }
            const toolPart = part as ToolUIPart;
            if (toolPart.type.startsWith('tool')) {
                // if input is available - run tool
                if (toolPart.state === 'input-available') {
                    await executeTool(toolPart);
                }
            }
        }
    }
});
```

### Page Builder Tools

`pageBuilderTools` provides tools for navigating and controlling the XM Cloud Page Builder UI (only available client-side):

```typescript
import { pageBuilderTools, executePageBuilderTool } from "sitecore-ai-sdk-tools";

const tools = pageBuilderTools({ needsApproval: false });
```

### Options

`createSitecoreTools` accepts a `needsApproval` option to control whether the AI model must request user confirmation before executing each tool call:

```typescript
type CreateSitecoreToolsOptions =
  | { execution: "client" }
  | { execution: "server"; client: experimental_XMC; sitecoreContextId: string }
  & {
    needsApproval?: NeedsApproval; // from Vercel AI SDK tool()
  };
```

## Available Tools

### `createSitecoreTools`

Returns all XM Cloud tools grouped by domain:

| Group | Tools |
|---|---|
| **Assets** | `get_asset_information`, `search_assets`, `update_asset`, `upload_asset` |
| **Pages** | `get_page`, `create_page`, `get_page_template_by_id`, `get_allowed_components_by_placeholder`, `get_components_on_page`, `add_component_on_page`, `set_component_datasource`, `add_language_to_page`, `search_site`, `get_page_path_by_live_url`, `get_page_screenshot`, `get_page_html`, `get_page_preview_url` |
| **Sites** | `get_sites_list`, `get_site_details`, `get_all_pages_by_site`, `get_site_id_from_item` |
| **Content** | `create_content_item`, `delete_content`, `get_content_item_by_id`, `update_content`, `get_content_item_by_path`, `list_available_insert_options` |
| **Components** | `create_component_datasource`, `search_component_datasources`, `list_components`, `get_component` |
| **Personalization** | `create_personalization_version`, `get_personalization_versions_by_page`, `get_condition_templates`, `get_condition_template_by_id` |
| **Jobs** | `revert_job`, `get_job`, `list_operations` |
| **Environment** | `list_languages` |

### `pageBuilderTools`

Tools for interacting with the XM Cloud Page Builder UI (client-side only):

| Tool | Description |
|---|---|
| `get_current_page_context` | Returns info about the currently open page |
| `get_current_site_context` | Returns info about the currently active site |
| `reload_current_page` | Reloads the Page Builder canvas |
| `navigate_to_another_page` | Navigates to a different page by item ID |
