# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`sitecore-ai-sdk-tools` is an npm package that provides AI SDK-compatible tool definitions for Sitecore XMC (Experience Management Cloud) agent APIs. It wraps Sitecore's marketplace SDK into [Vercel AI SDK](https://sdk.vercel.ai/) `tool()` definitions so they can be used by LLM agents.

## Commands

- **Build:** `npm run build` (uses tsup, outputs ESM to `dist/`)
- **Lint:** `npm run lint` (eslint)

No test suite exists in this project.

## Architecture

The library exposes one main entry point (`src/index.ts`) with two execution modes:

### Execution Modes

- **`server`** — Tools include `execute` functions that call Sitecore APIs directly via `@sitecore-marketplace-sdk/xmc` (`experimental_XMC` client). Used when the agent runs server-side with direct API access.
- **`client`** — Tools are created without `execute` (description + schema only). Execution happens separately via `executeAgentTool()`, which routes tool calls through `@sitecore-marketplace-sdk/client` (`ClientSDK`). Used when the agent runs in a browser/client context (e.g., Sitecore Pages editor).

Both modes share the same tool definitions from `src/tools/agent/definitions.ts`.

### Key Layers

- **`src/tools/agent/definitions.ts`** — Central tool config: descriptions and Zod input schemas for all tools. This is the single source of truth for tool metadata.
- **`src/tools/agent/server/index.ts`** — Server-side implementations using `experimental_XMC` client directly.
- **`src/tools/agent/client/execution.ts`** — Client-side implementations using `ClientSDK` query/mutate pattern.
- **`src/tools/agent/client/index.ts`** — Client-side tool wrappers (schema-only, no execute).
- **`src/tools/agent/client/helpers.ts`** — Shared helpers: `clientQuery`, `clientMutate`, `mutateWithJobId`.
- **`src/tools/page-builder/index.ts`** — Separate set of tools for Page Builder context (navigation, page context, reload). These use `ClientSDK` and have their own `executePageBuilderTool()`.

### Tool Domains

Tools are grouped into: assets, components, content, environment, jobs, pages, personalization, sites.

### Patterns

- Mutating operations use `x-sc-job-id` header (auto-generated UUID) for undo/revert support.
- Read operations use `wrapAgentCall`/`clientQuery`; write operations use `callWithJobId`/`mutateWithJobId`.
- All tools accept `sitecoreContextId` to scope API calls to a specific Sitecore context.
- Tool definitions in `definitions.ts` have an optional `mutation: true` flag to distinguish read vs write tools.
- `needsApproval` + `needsApprovalFor` (`'all'` | `'mutations'`) control which tools require user approval. Default is `'all'`. When set to `'mutations'`, only tools with `mutation: true` in their definition get `needsApproval` applied.

## Tech Stack

- TypeScript (ES2023, ESM-only)
- tsup for bundling with experimental DTS generation
- Zod v4 for input schemas
- Vercel AI SDK (`ai` package) for `tool()` definitions
- Prettier: single quotes, trailing commas (es5), semicolons
