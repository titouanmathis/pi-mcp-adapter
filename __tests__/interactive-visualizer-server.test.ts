import { describe, expect, it } from "vitest";
import { registerInteractiveVisualizer } from "../examples/interactive-visualizer/src/server.ts";

type ToolRegistration = {
  name: string;
  config: Record<string, unknown>;
  callback: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

type ResourceRegistration = {
  name: string;
  uri: string;
  config: Record<string, unknown>;
  callback: () => Promise<Record<string, unknown>>;
};

function createFakeServer() {
  const tools: ToolRegistration[] = [];
  const resources: ResourceRegistration[] = [];

  return {
    tools,
    resources,
    server: {
      registerTool(name: string, config: Record<string, unknown>, callback: ToolRegistration["callback"]) {
        tools.push({ name, config, callback });
        return {} as never;
      },
      registerResource(name: string, uri: string, config: Record<string, unknown>, callback: ResourceRegistration["callback"]) {
        resources.push({ name, uri, config, callback });
        return {} as never;
      },
    },
  };
}

describe("interactive visualizer server", () => {
  it("registers a shared UI resource and two app tools", async () => {
    const fake = createFakeServer();
    registerInteractiveVisualizer(fake.server, { uiHtml: "<!doctype html><html><body>bundled ui</body></html>" });

    expect(fake.resources).toHaveLength(1);
    expect(fake.tools.map((entry) => entry.name)).toEqual([
      "show_visualization",
      "show_visualization_gallery",
    ]);

    const resource = fake.resources[0];
    expect(resource.uri).toBe("ui://interactive-visualizer/app.html");
    expect(resource.config).toMatchObject({
      _meta: {
        ui: {
          permissions: {
            clipboardWrite: {},
          },
        },
      },
    });

    const contents = await resource.callback();
    expect(contents).toMatchObject({
      contents: [
        {
          uri: "ui://interactive-visualizer/app.html",
          text: "<!doctype html><html><body>bundled ui</body></html>",
        },
      ],
    });
  });

  it("returns a lightweight summary for show_visualization", async () => {
    const fake = createFakeServer();
    registerInteractiveVisualizer(fake.server, { uiHtml: "<!doctype html><html></html>" });

    const tool = fake.tools.find((entry) => entry.name === "show_visualization");
    expect(tool).toBeDefined();

    expect(tool!.config).toMatchObject({
      _meta: {
        ui: {
          "pi-mcp-adapter.streamMode": "stream-first",
        },
      },
    });

    const result = await tool!.callback({
      spec: {
        kind: "mermaid",
        title: "Flow",
        code: "flowchart LR\nClient[Client] --> Adapter[Adapter]",
      },
    });

    expect(result).toMatchObject({
      content: [
        {
          type: "text",
          text: 'Opened mermaid visualization "Flow". The interactive view is available in MCP UI.',
        },
      ],
      structuredContent: {
        kind: "mermaid",
        title: "Flow",
        "pi-mcp-adapter/stream": {
          frameType: "final",
          phase: "settled",
          status: "ok",
        },
      },
    });
  });

  it("resolves gallery examples locally", async () => {
    const fake = createFakeServer();
    registerInteractiveVisualizer(fake.server, { uiHtml: "<!doctype html><html></html>" });

    const tool = fake.tools.find((entry) => entry.name === "show_visualization_gallery");
    expect(tool).toBeDefined();

    const result = await tool!.callback({ exampleId: "timeline" });
    expect(result).toMatchObject({
      structuredContent: {
        exampleId: "timeline",
        exampleLabel: "Annotation workflow",
      },
    });
  });
});
