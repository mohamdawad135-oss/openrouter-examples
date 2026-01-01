# Copilot Instructions for OpenRouter Examples

This repository demonstrates OpenRouter features across multiple TypeScript ecosystems using a Bun monorepo. AI coding agents should follow these guidelines for maximum productivity:

## Architecture Overview
- **Monorepo Structure**: All TypeScript examples are organized under `typescript/` using Bun workspaces. Shared code lives in `typescript/shared/`.
- **Ecosystem Workspaces**:
  - `fetch/`: Raw fetch API examples
  - `ai-sdk-v5/`: Vercel AI SDK v5 examples
  - `effect-ai/`: Effect-TS examples
- **Shared Resources**:
  - `shared/src/constants.ts`: Large system prompts and constants
  - `shared/src/types.ts`: Common types for chat, caching, and usage metrics
- **Feature Documentation**: See `docs/prompt-caching.md` for prompt caching details and links to canonical docs.

## Developer Workflows
- **Install dependencies**:
  - From repo root: `make install` (runs Bun install in `typescript/`)
  - Or: `cd typescript && bun install`
- **Run all examples**:
  - From repo root: `make examples`
  - Or: `cd typescript && bun examples`
  - Or: run individual workspace examples (e.g., `cd fetch && bun examples`)
- **Environment**: Requires Bun runtime and `OPENROUTER_API_KEY` set in environment.
- **Clean artifacts**: `make clean` removes all node_modules and lockfiles in TypeScript workspaces.

## Project-Specific Patterns
- **Prompt Caching**:
  - Use `cache_control: {type: "ephemeral"}` on content items for Anthropic caching.
  - Set `stream_options.include_usage = true` in requests to receive usage/caching metrics.
  - Minimum 2048+ tokens required for reliable caching (see `LARGE_SYSTEM_PROMPT`).
  - Usage metrics are returned in OpenAI-compatible format: `usage.prompt_tokens_details.cached_tokens`.
- **Multi-Message Conversations**:
  - System message with cache, followed by user/assistant exchanges, demonstrates cache persistence.
  - See `typescript/fetch/src/prompt-caching/anthropic-multi-message-cache.ts` for a reference implementation.
- **Effect-TS Patterns**:
  - Use `Effect.gen` for generator-based composition and layer-based DI.
  - See `effect-ai/src/prompt-caching/` for examples.
- **AI SDK v5 Patterns**:
  - Set `extraBody.stream_options` for usage metrics.
  - See `ai-sdk-v5/src/prompt-caching/` for examples.

## Integration Points
- **OpenRouter API**: All examples interact with `https://openrouter.ai/api/v1/chat/completions`.
- **Shared Types/Constants**: Import from `@openrouter-examples/shared` for consistency.
- **External Dependencies**: Each workspace lists its dependencies in its own `package.json`.

## Conventions
- **TypeScript only**: All code is written in TypeScript and run via Bun.
- **No duplicate constants/types**: Always import from `shared/`.
- **Documentation links**: For prompt caching, always refer to the canonical OpenRouter docs.

---

For questions or unclear patterns, review the referenced files and documentation, or ask for clarification.
