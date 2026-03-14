import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerInteractiveVisualizer } from "../examples/interactive-visualizer/src/server.ts";
import {
  UI_STREAM_REQUEST_META_KEY,
  UI_STREAM_STRUCTURED_CONTENT_KEY,
  SERVER_STREAM_RESULT_PATCH_METHOD,
} from "../ui-stream-types.js";

type ToolRegistration = {
  name: string;
  config: Record<string, unknown>;
  callback: (args: Record<string, unknown>, extra?: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

interface SentNotification {
  method: string;
  params: {
    streamToken: string;
    result: {
      content?: unknown[];
      structuredContent?: Record<string, unknown>;
      isError?: boolean;
    };
  };
}

function createFakeServer() {
  const tools: ToolRegistration[] = [];

  return {
    tools,
    server: {
      registerTool(name: string, config: Record<string, unknown>, callback: ToolRegistration["callback"]) {
        tools.push({ name, config, callback });
        return {} as never;
      },
      registerResource() {
        return {} as never;
      },
    },
  };
}

function getTool(fake: ReturnType<typeof createFakeServer>, name: string): ToolRegistration {
  const tool = fake.tools.find((entry) => entry.name === name);
  if (!tool) {
    throw new Error(`Missing tool: ${name}`);
  }
  return tool;
}

describe("interactive visualizer streaming", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function resolveStreamingCall<T>(promise: Promise<T>): Promise<T> {
    await vi.runAllTimersAsync();
    return promise;
  }

  it("sends intermediate stream frames when stream token is present", async () => {
    const fake = createFakeServer();
    registerInteractiveVisualizer(fake.server, { uiHtml: "<!doctype html><html></html>" });

    const tool = getTool(fake, "show_visualization");

    const notifications: SentNotification[] = [];
    const streamToken = "test-stream-token-123";

    const result = await resolveStreamingCall(
      tool.callback(
        {
          spec: {
            kind: "mermaid",
            title: "Streaming Test",
            code: "flowchart LR\nA --> B",
          },
        },
        {
          _meta: { [UI_STREAM_REQUEST_META_KEY]: streamToken },
          sendNotification: async (notification: SentNotification) => {
            notifications.push(notification);
          },
        }
      )
    );

    expect(notifications).toHaveLength(4);

    for (const notification of notifications) {
      expect(notification.method).toBe(SERVER_STREAM_RESULT_PATCH_METHOD);
      expect(notification.params.streamToken).toBe(streamToken);
    }

    const envelopes = notifications.map((notification) =>
      notification.params.result.structuredContent?.[UI_STREAM_STRUCTURED_CONTENT_KEY] as Record<string, unknown> | undefined
    );
    expect(envelopes.map((envelope) => envelope?.frameType)).toEqual([
      "patch",
      "patch",
      "patch",
      "checkpoint",
    ]);
    expect(envelopes.map((envelope) => envelope?.phase)).toEqual([
      "shell",
      "structure",
      "detail",
      "detail",
    ]);

    // Final result should have the complete spec
    expect(result).toMatchObject({
      structuredContent: {
        kind: "mermaid",
        title: "Streaming Test",
        [UI_STREAM_STRUCTURED_CONTENT_KEY]: {
          frameType: "final",
          phase: "settled",
          status: "ok",
        },
      },
    });
  });

  it("does not send notifications without stream token", async () => {
    const fake = createFakeServer();
    registerInteractiveVisualizer(fake.server, { uiHtml: "<!doctype html><html></html>" });

    const tool = getTool(fake, "show_visualization");

    const notifications: SentNotification[] = [];

    // Call without _meta or stream token
    const result = await resolveStreamingCall(
      tool.callback(
        {
          spec: {
            kind: "mermaid",
            title: "No Stream",
            code: "flowchart LR\nA --> B",
          },
        },
        {
          sendNotification: async (notification: SentNotification) => {
            notifications.push(notification);
          },
        }
      )
    );

    // Should not have sent any notifications
    expect(notifications.length).toBe(0);

    // Final result should still have the envelope
    expect(result).toMatchObject({
      structuredContent: {
        kind: "mermaid",
        [UI_STREAM_STRUCTURED_CONTENT_KEY]: {
          frameType: "final",
          phase: "settled",
          status: "ok",
        },
      },
    });
  });

  it("still returns the final result if intermediate notifications fail", async () => {
    const fake = createFakeServer();
    registerInteractiveVisualizer(fake.server, { uiHtml: "<!doctype html><html></html>" });

    const tool = getTool(fake, "show_visualization");

    let attempts = 0;
    const promise = tool.callback(
      {
        spec: {
          kind: "mermaid",
          title: "Resilient",
          code: "flowchart LR\nA --> B",
        },
      },
      {
        _meta: { [UI_STREAM_REQUEST_META_KEY]: "failing-stream-token" },
        sendNotification: async () => {
          attempts += 1;
          throw new Error("stream transport failed");
        },
      }
    );

    await Promise.resolve();
    await Promise.resolve();
    expect(attempts).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
    await expect(promise).resolves.toMatchObject({
      structuredContent: {
        kind: "mermaid",
        title: "Resilient",
        [UI_STREAM_STRUCTURED_CONTENT_KEY]: {
          frameType: "final",
          phase: "settled",
          status: "ok",
        },
      },
    });
  });

  it("does not wait on stream pacing when no stream token is present", async () => {
    const fake = createFakeServer();
    registerInteractiveVisualizer(fake.server, { uiHtml: "<!doctype html><html></html>" });

    const tool = getTool(fake, "show_visualization");

    const promise = tool.callback({
      spec: {
        kind: "mermaid",
        title: "Immediate",
        code: "flowchart LR\nA --> B",
      },
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
    await expect(promise).resolves.toMatchObject({
      structuredContent: {
        kind: "mermaid",
      },
    });
  });

  it("does not add an extra delay after the last streamed frame", async () => {
    const fake = createFakeServer();
    registerInteractiveVisualizer(fake.server, { uiHtml: "<!doctype html><html></html>" });

    const tool = getTool(fake, "show_visualization");

    let settled = false;
    const promise = tool.callback(
      {
        spec: {
          kind: "mermaid",
          title: "Paced",
          code: "flowchart LR\nA --> B",
        },
      },
      {
        _meta: { [UI_STREAM_REQUEST_META_KEY]: "paced-stream-token" },
        sendNotification: async () => {},
      }
    );
    void promise.then(() => {
      settled = true;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersToNextTimerAsync();
    expect(settled).toBe(false);

    await vi.advanceTimersToNextTimerAsync();
    expect(settled).toBe(false);

    await vi.advanceTimersToNextTimerAsync();
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
    expect(settled).toBe(true);
    await expect(promise).resolves.toMatchObject({
      structuredContent: {
        kind: "mermaid",
      },
    });
  });

  it("builds correct frames for chart visualization", async () => {
    const fake = createFakeServer();
    registerInteractiveVisualizer(fake.server, { uiHtml: "<!doctype html><html></html>" });

    const tool = fake.tools.find((entry) => entry.name === "show_visualization");
    const notifications: SentNotification[] = [];
    const streamToken = "chart-stream-token";

    await resolveStreamingCall(
      tool.callback(
        {
          spec: {
            kind: "chart",
            chartType: "bar",
            title: "Sales Data",
            data: {
              datasets: [
                {
                  id: "sales",
                  label: "Sales",
                  points: [
                    { id: "q1", x: "Q1", y: 100 },
                    { id: "q2", x: "Q2", y: 150 },
                  ],
                },
              ],
            },
          },
        },
        {
          _meta: { [UI_STREAM_REQUEST_META_KEY]: streamToken },
          sendNotification: async (notification: SentNotification) => {
            notifications.push(notification);
          },
        }
      )
    );

    // Shell frame should have base metadata
    const shellFrame = notifications.find((n) => {
      const envelope = n.params.result.structuredContent?.[UI_STREAM_STRUCTURED_CONTENT_KEY] as Record<string, unknown> | undefined;
      return envelope?.phase === "shell";
    });
    expect(shellFrame).toBeDefined();
    const shellEnvelope = shellFrame!.params.result.structuredContent?.[UI_STREAM_STRUCTURED_CONTENT_KEY] as Record<string, unknown>;
    expect(shellEnvelope.spec).toMatchObject({ kind: "chart", title: "Sales Data" });

    // Detail frame should have chart-specific data
    const detailFrame = notifications.find((n) => {
      const envelope = n.params.result.structuredContent?.[UI_STREAM_STRUCTURED_CONTENT_KEY] as Record<string, unknown> | undefined;
      return envelope?.phase === "detail" && envelope?.frameType === "patch";
    });
    expect(detailFrame).toBeDefined();
    const detailSpec = (detailFrame!.params.result.structuredContent?.[UI_STREAM_STRUCTURED_CONTENT_KEY] as Record<string, unknown>).spec as Record<string, unknown>;
    expect(detailSpec.chartType).toBe("bar");
    expect(detailSpec.data).toBeDefined();
  });

  it("builds correct frames for custom visualization", async () => {
    const fake = createFakeServer();
    registerInteractiveVisualizer(fake.server, { uiHtml: "<!doctype html><html></html>" });

    const tool = fake.tools.find((entry) => entry.name === "show_visualization");
    const notifications: SentNotification[] = [];
    const streamToken = "custom-stream-token";

    await resolveStreamingCall(
      tool.callback(
        {
          spec: {
            kind: "custom",
            title: "Custom Scene",
            scene: {
              width: 800,
              height: 600,
              elements: [
                { kind: "rect", id: "box1", x: 0, y: 0, width: 100, height: 100 },
              ],
            },
          },
        },
        {
          _meta: { [UI_STREAM_REQUEST_META_KEY]: streamToken },
          sendNotification: async (notification: SentNotification) => {
            notifications.push(notification);
          },
        }
      )
    );

    // Detail frame should have scene data
    const detailFrame = notifications.find((n) => {
      const envelope = n.params.result.structuredContent?.[UI_STREAM_STRUCTURED_CONTENT_KEY] as Record<string, unknown> | undefined;
      return envelope?.phase === "detail" && envelope?.frameType === "patch";
    });
    expect(detailFrame).toBeDefined();
    const detailSpec = (detailFrame!.params.result.structuredContent?.[UI_STREAM_STRUCTURED_CONTENT_KEY] as Record<string, unknown>).spec as Record<string, unknown>;
    expect(detailSpec.scene).toBeDefined();
  });

  it("checkpoint frame contains full spec for recovery", async () => {
    const fake = createFakeServer();
    registerInteractiveVisualizer(fake.server, { uiHtml: "<!doctype html><html></html>" });

    const tool = fake.tools.find((entry) => entry.name === "show_visualization");
    const notifications: SentNotification[] = [];
    const streamToken = "checkpoint-test-token";

    const inputSpec = {
      kind: "mermaid" as const,
      title: "Checkpoint Test",
      code: "flowchart TD\nStart --> End",
      panels: { info: "Test panel" },
    };

    await resolveStreamingCall(
      tool.callback(
        { spec: inputSpec },
        {
          _meta: { [UI_STREAM_REQUEST_META_KEY]: streamToken },
          sendNotification: async (notification: SentNotification) => {
            notifications.push(notification);
          },
        }
      )
    );

    const checkpointFrame = notifications.find((n) => {
      const envelope = n.params.result.structuredContent?.[UI_STREAM_STRUCTURED_CONTENT_KEY] as Record<string, unknown> | undefined;
      return envelope?.frameType === "checkpoint";
    });
    expect(checkpointFrame).toBeDefined();

    const envelope = checkpointFrame!.params.result.structuredContent?.[UI_STREAM_STRUCTURED_CONTENT_KEY] as Record<string, unknown>;
    expect(envelope.checkpoint).toBeDefined();
    
    // Checkpoint should contain the full parsed spec
    const checkpoint = envelope.checkpoint as Record<string, unknown>;
    expect(checkpoint.kind).toBe("mermaid");
    expect(checkpoint.title).toBe("Checkpoint Test");
    expect(checkpoint.code).toBe("flowchart TD\nStart --> End");
  });

  it("gallery tool returns gallery metadata without streaming", async () => {
    const fake = createFakeServer();
    registerInteractiveVisualizer(fake.server, { uiHtml: "<!doctype html><html></html>" });

    const tool = getTool(fake, "show_visualization_gallery");

    // Gallery tool doesn't have stream mode enabled - it just opens the gallery
    // and lets the UI handle example selection locally
    const result = await tool.callback({ exampleId: "timeline" });

    // Result should include gallery metadata
    expect(result).toMatchObject({
      structuredContent: {
        exampleId: "timeline",
        exampleLabel: "Annotation workflow",
      },
    });

    // Verify it's not configured for streaming (no streamMode in _meta)
    const uiMeta = (tool.config._meta as Record<string, unknown>)?.ui as Record<string, unknown> | undefined;
    expect(uiMeta?.["pi-mcp-adapter.streamMode"]).toBeUndefined();
  });
});
