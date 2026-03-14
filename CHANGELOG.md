# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **MCP UI Integration** - Full support for [MCP Apps](https://github.com/modelcontextprotocol/ext-apps) specification. Tools with `_meta.ui.resourceUri` now open interactive browser UIs:
  - Sandboxed iframe rendering with CSP support
  - Bidirectional AppBridge communication (tool calls, messages, context updates)
  - Works with both stdio and HTTP MCP servers
  - User consent management for tool calls from UI (configurable: never/once-per-server/always)
  - Display mode switching (inline/fullscreen/pip)
  - Keyboard shortcuts: Cmd/Ctrl+Enter to complete, Escape to cancel
  - **Bidirectional communication**: UI prompts/intents trigger agent turns via `pi.sendMessage({ triggerTurn: true })`
  - **Non-blocking UI**: Tool returns immediately with MCP result, agent responds to UI interactions as separate turns
  - **Real-time agent responses**: Each prompt/intent from UI triggers a new agent turn immediately
  - **Full action coverage**: Agent notified for prompts, intents, notifications, link opens, and tool calls
  - **`mcp({ action: "ui-messages" })`**: Retrieve accumulated messages from completed UI sessions

- **Logger module** (`logger.ts`) - Centralized logging with:
  - Log levels (debug/info/warn/error)
  - Contextual child loggers (server, session, tool)
  - Enable debug mode via `MCP_UI_DEBUG=1` environment variable

- **Error types** (`errors.ts`) - Structured errors with recovery hints:
  - `ResourceFetchError`, `ResourceParseError` - UI resource loading failures
  - `BridgeConnectionError` - AppBridge communication issues
  - `ConsentError` - Tool call consent required/denied
  - `SessionError`, `ServerError` - Session and server lifecycle errors
  - `wrapError()` helper for consistent error handling

- **Test suite** - 88 unit tests covering:
  - Consent manager modes and state transitions
  - UI resource handler parsing and validation
  - Host HTML template generation and XSS prevention
  - Logger levels, context, and handlers
  - Error types and helper functions

- **Local interactive visualizer example** - Added `examples/interactive-visualizer`, a repo-local custom MCP server example for rich MCP UI rendering:
  - `show_visualization` renders typed Mermaid, chart, and custom explainer specs
  - `show_visualization_gallery` opens five trusted built-in examples
  - Pattern-aware spec fields for `pattern`, `chrome`, `initialState`, declarative controls, and chart `summaryMetrics`
  - Shared self-contained HTML app resource bundled for blob-iframe hosting
  - Local explore/annotate workflow with canonical `visualization_annotations_submitted\n{...}` handoff envelopes
  - `mcp({ action: "ui-messages" })` now normalizes canonical handoff prompts back into structured intent-style details
  - Example-local `install-local` and `uninstall-local` scripts for idempotent config management
  - Stream-first `show_visualization` sessions with adapter-owned intermediate result patches, phased live-build UI updates, checkpoint/final envelopes, and annotation handoff metadata (`streamId`/`sequence`)
  - Focused test coverage for schema validation, server registration, annotation state, runtime defaults, handoff normalization, and streaming transport/runtime behavior

### Technical Notes
- Uses local minified AppBridge bundle (408KB) to avoid CDN Zod bundling issues
- Blob URL iframe approach with null eventSource for cross-origin compatibility
- SSE for real-time tool result streaming to browser

## [2.1.2] - 2026-02-03

### Changed
- Added demo video and `pi.video` field to package.json for pi package browser.

## [2.1.0] - 2026-02-02

### Added
- **Direct tool registration** - Promote specific MCP tools to first-class Pi tools via `directTools` config (per-server or global). Direct tools appear in the agent's tool list alongside builtins, so the LLM uses them without needing to search through the proxy first. Registers from cached metadata at startup — no server connections needed.
- **`/mcp` interactive panel** - New TUI overlay replacing the text-based status dump. Shows server connection status, tool lists with direct/proxy toggles, token cost estimates, inline reconnect, and auth notices. Changes written to config on save.
- **Auto-enriched proxy description** - The `mcp` proxy tool description now includes server names and tool counts from the metadata cache, so the LLM knows what's available without a search call (~30 extra tokens).
- **`MCP_DIRECT_TOOLS` env var** - Subagent processes receive their direct tool configuration via environment variable, keeping subagents lean by default.
- **First-run bootstrap** - Servers with `directTools` configured but no cache entry are connected during `session_start` to populate the cache. Direct tools become available after restart.
- Config provenance tracking for correct write-back to user/project/import sources
- Builtin name collision guard (skips direct tools that would shadow `read`, `write`, etc.)
- Cross-server name deduplication for `prefix: "none"` and `prefix: "short"` modes

## [2.0.1] - 2026-02-01

### Fixed
- Adapt execute signature to pi v0.51.0: add signal, onUpdate, ctx parameters

## [2.0.0] - 2026-01-29

### Changed
- **BREAKING: Lazy startup by default** - All servers now default to `lifecycle: "lazy"` and only connect when a tool call needs them. Previously all servers connected eagerly on session start. Set `lifecycle: "keep-alive"` or `lifecycle: "eager"` to restore the old behavior per-server.
- **Idle timeout** - Connected servers are automatically disconnected after 10 minutes of inactivity (configurable via `settings.idleTimeout` or per-server `idleTimeout`). Cached metadata keeps search/list working after disconnect. Set `idleTimeout: 0` to disable.
- `/mcp reconnect` accepts an optional server name to connect or reconnect a single server

### Added
- **Metadata cache** - Tool and resource metadata persisted to `~/.pi/agent/mcp-cache.json`. Enables search/list/describe without live connections. Per-server config hashing with 7-day staleness. Multi-session safe via read-merge-write with per-process tmp files.
- **npx binary resolution** - Resolves npx package binaries to direct paths, eliminating the ~143 MB npm parent process per server. Persistent cache at `~/.pi/agent/mcp-npx-cache.json` with 24h TTL.
- **`mcp({ connect: "server-name" })` mode** - Explicitly trigger connection and metadata refresh for a named server
- **Failure backoff** - Servers that fail to connect are skipped for 60 seconds to avoid repeated connection storms
- **In-flight tracking** - Active tool calls prevent idle timeout from shutting down a server mid-request
- **Prefix-match fallback** - Tool calls with unrecognized names try to match a server prefix and lazy-connect the matching server
- Lifecycle options: `lazy` (default), `eager` (connect at startup, no auto-reconnect), `keep-alive` (unchanged)
- Per-server `idleTimeout` override and global `settings.idleTimeout`
- First-run bootstrap: connects all servers on first session to populate the cache

### Fixed
- Connection close race condition: concurrent close + connect no longer orphans server processes
- **Fuzzy tool name matching** - Hyphens and underscores are treated as equivalent during tool lookup. MCP tools like `resolve-library-id` are now found when called as `resolve_library_id`, which LLMs naturally guess since the prefix separator is `_`.
- **Better "tool not found" errors** - When a server is identified (via prefix match or override) but the tool isn't found, the error now lists that server's available tools so the LLM can self-correct immediately instead of needing a separate list call

## [1.6.0] - 2026-01-29

### Added
- **Unified pi tool search** - `mcp({ search: "..." })` now searches both MCP tools and Pi tools (from installed extensions)
- Pi tools appear first in results with `[pi tool]` prefix
- Details object includes `server: "pi"` for pi tools
- Banner image for README

## [1.5.1] - 2026-01-26

### Changed
- Added `pi-package` keyword for npm discoverability (pi v0.50.0 package system)

## [1.5.0] - 2026-01-22

### Changed
- **BREAKING: `args` parameter is now a JSON string** - The `args` parameter which previously accepted an object now accepts a JSON string. This change was required for compatibility with Claude's Vertex AI API (`google-antigravity` provider) which rejects `patternProperties` in JSON schemas (generated by `Type.Record()`).

### Added
- **Type validation for args** - Parsed args are now validated to ensure they're a JSON object (not null, array, or primitive). Clear error messages for invalid input.
- **`isError: true` on error responses** - JSON parse errors and type validation errors now properly set `isError: true` to indicate failure to the LLM.

### Migration
```typescript
// Before (1.4.x)
mcp({ tool: "my_tool", args: { key: "value" } })

// After (1.5.0)
mcp({ tool: "my_tool", args: '{"key": "value"}' })
```

## [1.4.1] - 2026-01-19

### Changed

- Status bar shows server count instead of tool count ("MCP: 5 servers")

## [1.4.0] - 2026-01-19

### Changed

- **Non-blocking startup** - Pi starts immediately, MCP servers connect in background. First MCP call waits only if init isn't done yet.

### Fixed

- Tool metadata now includes `inputSchema` after `/mcp reconnect` (was missing, breaking describe and error hints)

## [1.3.0] - 2026-01-19

### Changed

- **Parallel server connections** - All MCP servers now connect in parallel on startup instead of sequentially, significantly faster with many servers

## [1.2.2] - 2026-01-19

### Fixed

- Installer now downloads from `main` branch (renamed from `master`)

## [1.2.1] - 2026-01-19

### Added

- **npx installer** - Run `npx pi-mcp-adapter` to install (downloads files, installs deps, configures settings.json)

## [1.1.0] - 2026-01-19

### Changed

- **Search includes schemas by default** - Search results now include parameter schemas, reducing tool calls needed (search + call instead of search + describe + call)
- **Space-separated search terms match as OR** - `"navigate screenshot"` finds tools matching either word (like most search engines)
- **Suppress server stderr by default** - MCP server logs no longer clutter terminal on startup
- Use `includeSchemas: false` for compact output without schemas
- Use `debug: true` per-server to show stderr when troubleshooting

## [1.0.0] - 2026-01-19

### Added

- **Single unified `mcp` tool** with token-efficient architecture (~200 tokens vs ~15,000 for individual tools)
- **Five operation modes:**
  - `mcp({})` - Show server status
  - `mcp({ server: "name" })` - List tools from a server
  - `mcp({ search: "query" })` - Search tools by name/description
  - `mcp({ describe: "tool_name" })` - Show tool details and parameter schema
  - `mcp({ tool: "name", args: {...} })` - Call a tool
- **Stdio transport** for local MCP servers (command + args)
- **HTTP transport** with automatic fallback (StreamableHTTP → SSE)
- **Config imports** from Cursor, Claude Code, Claude Desktop, VS Code, Windsurf, Codex
- **Resource tools** - MCP resources exposed as callable tools
- **OAuth support** - Token file-based authentication
- **Bearer token auth** - Static or environment variable tokens
- **Keep-alive connections** with automatic health checks and reconnection
- **Schema on-demand** - Parameter schemas shown in `describe` mode and error responses
- **Commands:**
  - `/mcp` or `/mcp status` - Show server status
  - `/mcp tools` - List all tools
  - `/mcp reconnect` - Force reconnect all servers
  - `/mcp-auth <server>` - Show OAuth setup instructions

### Architecture

- Tools stored in metadata map, not registered individually with Pi
- MCP server validates arguments (no client-side schema conversion)
- Reconnect callback updates metadata after auto-reconnect
- Human-readable schema formatting for LLM consumption
