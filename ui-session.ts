import { randomUUID } from "node:crypto";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpExtensionState } from "./state.js";
import {
  extractUiPromptText,
  UI_STREAM_HOST_CONTEXT_KEY,
  UI_STREAM_REQUEST_META_KEY,
  UI_STREAM_STRUCTURED_CONTENT_KEY,
  type UiHostContext,
  type UiMessageParams,
  type UiModelContextParams,
  type UiStreamMode,
} from "./types.js";
import { logger } from "./logger.js";
import { startUiServer, type UiServerHandle } from "./ui-server.js";

export interface UiSessionRequest {
  serverName: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  uiResourceUri: string;
  streamMode?: UiStreamMode;
}

export interface UiSessionRuntime {
  serverName: string;
  toolName: string;
  streamId?: string;
  streamToken?: string;
  streamMode?: UiStreamMode;
  requestMeta?: Record<string, unknown>;
  url: string;
  isActive: () => boolean;
  sendToolResult: (result: CallToolResult) => void;
  sendResultPatch: (result: CallToolResult) => void;
  sendToolCancelled: (reason: string) => void;
  close: (reason?: string) => void;
}

const MAX_COMPLETED_SESSIONS = 10;

function withStreamEnvelope(
  result: CallToolResult,
  streamId: string | undefined,
  sequence: number,
): CallToolResult {
  if (!streamId) {
    return result;
  }

  const structuredContent = result.structuredContent && typeof result.structuredContent === "object" && !Array.isArray(result.structuredContent)
    ? { ...result.structuredContent }
    : {};

  const rawEnvelope = structuredContent[UI_STREAM_STRUCTURED_CONTENT_KEY];
  const envelope = rawEnvelope && typeof rawEnvelope === "object" && !Array.isArray(rawEnvelope)
    ? { ...rawEnvelope as Record<string, unknown> }
    : {
        frameType: "final",
        phase: "settled",
        status: result.isError ? "error" : "ok",
      };

  structuredContent[UI_STREAM_STRUCTURED_CONTENT_KEY] = {
    ...envelope,
    streamId,
    sequence,
  };

  return {
    ...result,
    structuredContent,
  };
}

export async function maybeStartUiSession(
  state: McpExtensionState,
  request: UiSessionRequest,
): Promise<UiSessionRuntime | null> {
  const log = logger.child({
    component: "UiSession",
    server: request.serverName,
    tool: request.toolName,
  });

  try {
    const resource = await state.uiResourceHandler.readUiResource(request.serverName, request.uiResourceUri);

    if (state.uiServer) {
      state.uiServer.close("replaced");
      state.uiServer = null;
    }

    const streamMode = request.streamMode;
    const streamId = streamMode ? randomUUID() : undefined;
    const streamToken = streamMode ? randomUUID() : undefined;
    const hostContext: UiHostContext | undefined = streamMode && streamId
      ? {
          [UI_STREAM_HOST_CONTEXT_KEY]: {
            mode: streamMode,
            streamId,
            intermediateResultPatches: streamMode === "stream-first",
            partialInput: false,
          },
        }
      : undefined;

    let active = true;
    let nextStreamSequence = 0;
    let handle: UiServerHandle | null = null;

    const cleanupStreamListener = () => {
      if (streamToken) {
        state.manager.removeUiStreamListener(streamToken);
      }
    };

    handle = await startUiServer({
      serverName: request.serverName,
      toolName: request.toolName,
      toolArgs: streamMode === "stream-first" ? {} : request.toolArgs,
      resource,
      manager: state.manager,
      consentManager: state.consentManager,
      hostContext,

      onMessage: (params: UiMessageParams) => {
        const prompt = extractUiPromptText(params);
        if (prompt) {
          if (state.sendMessage) {
            state.sendMessage(
              {
                customType: "mcp-ui-prompt",
                content: [{ type: "text", text: `User sent prompt from ${request.serverName} UI: "${prompt}"` }],
                display: `💬 UI Prompt: ${prompt}`,
                details: { server: request.serverName, tool: request.toolName, prompt },
              },
              { triggerTurn: true },
            );
            log.info("Triggered agent turn for UI prompt", { prompt: prompt.slice(0, 50) });
          }
        } else if (params.type === "intent" || params.intent) {
          const intent = params.intent ?? "";
          const intentParams = params.params;
          if (intent && state.sendMessage) {
            const paramsStr = intentParams ? ` ${JSON.stringify(intentParams)}` : "";
            state.sendMessage(
              {
                customType: "mcp-ui-intent",
                content: [{ type: "text", text: `User triggered intent from ${request.serverName} UI: ${intent}${paramsStr}` }],
                display: `🎯 UI Intent: ${intent}`,
                details: { server: request.serverName, tool: request.toolName, intent, params: intentParams },
              },
              { triggerTurn: true },
            );
            log.info("Triggered agent turn for UI intent", { intent });
          }
        } else if (params.type === "notify" || params.message) {
          const text = params.message ?? "";
          if (text && state.ui) {
            state.ui.notify(`[${request.serverName}] ${text}`, "info");
          }
        }
      },

      onContextUpdate: (params: UiModelContextParams) => {
        log.debug("Model context update from UI", {
          hasContent: !!params.content,
          hasStructured: !!params.structuredContent,
        });
      },

      onComplete: (reason: string) => {
        active = false;
        cleanupStreamListener();

        if (state.uiServer === handle) {
          const messages = handle.getSessionMessages();
          const stream = handle.getStreamSummary();
          const hasContent =
            messages.prompts.length > 0 ||
            messages.intents.length > 0 ||
            messages.notifications.length > 0 ||
            !!stream;

          if (hasContent) {
            state.completedUiSessions.push({
              serverName: handle.serverName,
              toolName: handle.toolName,
              completedAt: new Date(),
              reason,
              messages,
              stream,
            });

            while (state.completedUiSessions.length > MAX_COMPLETED_SESSIONS) {
              state.completedUiSessions.shift();
            }

            log.info("Session completed", {
              reason,
              prompts: messages.prompts.length,
              intents: messages.intents.length,
              notifications: messages.notifications.length,
              streamFrames: stream?.frames ?? 0,
            });
          }

          state.uiServer = null;
        }
      },
    });

    if (streamToken) {
      state.manager.registerUiStreamListener(streamToken, (serverName, notification) => {
        if (!active || state.uiServer !== handle) return;
        if (serverName !== request.serverName) return;
        nextStreamSequence += 1;
        handle.sendResultPatch(withStreamEnvelope(notification.result as CallToolResult, streamId, nextStreamSequence));
      });
    }

    state.uiServer = handle;

    try {
      await state.openBrowser(handle.url);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.ui?.notify(`MCP UI browser open failed: ${message}`, "warning");
      state.ui?.notify(`Open manually: ${handle.url}`, "info");
    }

    return {
      serverName: request.serverName,
      toolName: request.toolName,
      streamId,
      streamToken,
      streamMode,
      requestMeta: streamToken ? { [UI_STREAM_REQUEST_META_KEY]: streamToken } : undefined,
      url: handle.url,
      isActive: () => active && state.uiServer === handle,
      sendToolResult: (result: CallToolResult) => {
        if (!active || state.uiServer !== handle) return;
        nextStreamSequence += 1;
        handle.sendToolResult(withStreamEnvelope(result, streamId, nextStreamSequence));
      },
      sendResultPatch: (result: CallToolResult) => {
        if (!active || state.uiServer !== handle) return;
        nextStreamSequence += 1;
        handle.sendResultPatch(withStreamEnvelope(result, streamId, nextStreamSequence));
      },
      sendToolCancelled: (reason: string) => {
        if (!active || state.uiServer !== handle) return;
        handle.sendToolCancelled(reason);
      },
      close: (reason?: string) => {
        active = false;
        cleanupStreamListener();
        handle.close(reason);
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error("Failed to start UI session", error instanceof Error ? error : undefined);
    state.ui?.notify(
      `MCP UI unavailable for ${request.toolName} (${request.serverName}): ${message}`,
      "warning",
    );
    return null;
  }
}
