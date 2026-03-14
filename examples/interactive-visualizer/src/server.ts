import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import {
  SERVER_STREAM_RESULT_PATCH_METHOD,
  UI_STREAM_REQUEST_META_KEY,
  UI_STREAM_STRUCTURED_CONTENT_KEY,
  type ServerStreamResultPatchNotification,
  type UiStreamCallToolResult,
} from "../../../ui-stream-types.js";
import { getGalleryEntry } from "./gallery.js";
import { parseVisualizationSpec, visualizationSpecSchema } from "./schema.js";

const SERVER_NAME = "interactive-visualizer";
const SERVER_VERSION = "0.1.0";
const UI_RESOURCE_URI = "ui://interactive-visualizer/app.html";
const STREAM_DELAY_MS = 120;

/**
 * Configuration overrides used for tests and local builds.
 */
export interface InteractiveVisualizerRegistrationOptions {
  uiHtml?: string;
}

/**
 * Minimal registerable server surface used by the example and tests.
 */
export interface VisualizerServerRegistrationTarget {
  registerTool: McpServer["registerTool"];
  registerResource: McpServer["registerResource"];
}

async function loadBundledUiHtml(): Promise<string> {
  const url = new URL("./app.html", import.meta.url);
  return readFile(url, "utf-8");
}

function summarizeVisualization(kind: string, title?: string): string {
  const label = title ? ` \"${title}\"` : "";
  return `Opened ${kind} visualization${label}. The interactive view is available in MCP UI.`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStreamToken(extra?: { _meta?: Record<string, unknown> }): string | undefined {
  const token = extra?._meta?.[UI_STREAM_REQUEST_META_KEY];
  return typeof token === "string" ? token : undefined;
}

function buildStreamResult(frame: Record<string, unknown>): UiStreamCallToolResult {
  return {
    content: typeof frame.message === "string"
      ? [{ type: "text", text: frame.message }]
      : undefined,
    structuredContent: {
      [UI_STREAM_STRUCTURED_CONTENT_KEY]: frame,
    },
    isError: frame.status === "error",
  };
}

async function sendStreamFrame(
  streamToken: string | undefined,
  sendNotification: ((notification: ServerStreamResultPatchNotification) => Promise<void>) | undefined,
  frame: Record<string, unknown>,
): Promise<boolean> {
  if (!streamToken || typeof sendNotification !== "function") return false;

  try {
    await sendNotification({
      method: SERVER_STREAM_RESULT_PATCH_METHOD,
      params: {
        streamToken,
        result: buildStreamResult(frame),
      },
    });
    return true;
  } catch {
    return false;
  }
}

function buildVisualizationStreamFrames(spec: ReturnType<typeof parseVisualizationSpec>): Array<Record<string, unknown>> {
  const basePatch = {
    kind: spec.kind,
    id: spec.id,
    title: spec.title,
    subtitle: spec.subtitle,
    pattern: spec.pattern,
    theme: spec.theme,
    annotations: spec.annotations,
    chrome: spec.chrome,
    initialState: spec.initialState,
  };

  const narrativePatch = {
    panels: spec.panels,
    controls: spec.controls,
    interactions: spec.interactions,
  };

  const detailPatch = spec.kind === "chart"
    ? {
        chartType: spec.chartType,
        data: spec.data,
        presentation: spec.presentation,
        formatting: spec.formatting,
        insights: spec.insights,
        summaryMetrics: spec.summaryMetrics,
      }
    : spec.kind === "mermaid"
      ? {
          code: spec.code,
        }
      : {
          svg: spec.svg,
          scene: spec.scene,
        };

  return [
    {
      frameType: "patch",
      phase: "shell",
      status: "ok",
      message: "Preparing visualization shell.",
      spec: basePatch,
    },
    {
      frameType: "patch",
      phase: "structure",
      status: "ok",
      message: "Adding narrative structure.",
      spec: narrativePatch,
    },
    {
      frameType: "patch",
      phase: "detail",
      status: "ok",
      message: "Rendering visualization details.",
      spec: detailPatch,
    },
    {
      frameType: "checkpoint",
      phase: "detail",
      status: "ok",
      message: "Checkpoint ready.",
      checkpoint: spec,
    },
  ];
}

/**
 * Register the visualizer tools and shared UI resource on an MCP server.
 */
export function registerInteractiveVisualizer(
  server: VisualizerServerRegistrationTarget,
  options: InteractiveVisualizerRegistrationOptions = {},
): void {
  registerAppResource(
    server,
    "Interactive visualizer app",
    UI_RESOURCE_URI,
    {
      description: "Self-contained interactive visualizer UI",
      mimeType: RESOURCE_MIME_TYPE,
      _meta: {
        ui: {
          permissions: {
            clipboardWrite: {},
          },
        },
      },
    },
    async () => ({
      contents: [
        {
          uri: UI_RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: options.uiHtml ?? await loadBundledUiHtml(),
          _meta: {
            ui: {
              permissions: {
                clipboardWrite: {},
              },
            },
          },
        },
      ],
    }),
  );

  registerAppTool(
    server,
    "show_visualization",
    {
      title: "Show visualization",
      description: "Render a declarative visualization spec as a rich interactive MCP UI.",
      inputSchema: {
        spec: visualizationSpecSchema,
      },
      _meta: {
        ui: {
          resourceUri: UI_RESOURCE_URI,
          "pi-mcp-adapter.streamMode": "stream-first",
        },
      },
    },
    async ({ spec }, extra) => {
      try {
        const parsed = parseVisualizationSpec(spec);
        const streamToken = getStreamToken(extra);
        const sendNotification = extra?.sendNotification;

        if (streamToken && typeof sendNotification === "function") {
          const frames = buildVisualizationStreamFrames(parsed);
          for (const [index, frame] of frames.entries()) {
            const sent = await sendStreamFrame(streamToken, sendNotification, frame);
            if (!sent) {
              break;
            }
            if (index < frames.length - 1) {
              await sleep(STREAM_DELAY_MS);
            }
          }
        }

        return {
          content: [
            {
              type: "text",
              text: summarizeVisualization(parsed.kind, parsed.title),
            },
          ],
          structuredContent: {
            kind: parsed.kind,
            title: parsed.title,
            hasAnnotations: !!parsed.annotations?.enabled,
            [UI_STREAM_STRUCTURED_CONTENT_KEY]: {
              frameType: "final",
              phase: "settled",
              status: "ok",
              message: summarizeVisualization(parsed.kind, parsed.title),
              checkpoint: parsed,
            },
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await sendStreamFrame(getStreamToken(extra), extra?.sendNotification, {
          frameType: "final",
          phase: "settled",
          status: "error",
          message,
        });
        throw error;
      }
    },
  );

  registerAppTool(
    server,
    "show_visualization_gallery",
    {
      title: "Show visualization gallery",
      description: "Open the local gallery of trusted interactive visualization examples.",
      inputSchema: {
        exampleId: z.string().optional(),
      },
      _meta: {
        ui: {
          resourceUri: UI_RESOURCE_URI,
        },
      },
    },
    async ({ exampleId }) => {
      const example = getGalleryEntry(exampleId);
      return {
        content: [
          {
            type: "text",
            text: example
              ? `Opened the interactive visualizer gallery at \"${example.label}\".`
              : "Opened the interactive visualizer gallery.",
          },
        ],
        structuredContent: {
          exampleId: example?.id,
          exampleLabel: example?.label,
        },
      };
    },
  );
}

/**
 * Create the interactive visualizer MCP server instance.
 */
export function createInteractiveVisualizerServer(
  options: InteractiveVisualizerRegistrationOptions = {},
): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerInteractiveVisualizer(server, options);
  return server;
}

/**
 * Start the stdio MCP server used by `install-local`.
 */
export async function main(): Promise<void> {
  const server = createInteractiveVisualizerServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void main();
}
