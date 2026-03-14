# Interactive Visualizer Example

This is a local custom MCP server example for `pi-mcp-adapter`. It renders declarative diagrams, charts, and custom explainers inside MCP UI. The model supplies a typed visualization spec, the server validates it, and the app handles local exploration without turning every click into another model round-trip.

The current contract also includes product-level fields like `pattern`, `chrome`, `initialState`, declarative controls, and chart `summaryMetrics`, so the same renderer can produce cleaner explainers without falling back to raw HTML.

The example ships two tools. `show_visualization` is the real one: pass a visualization spec and the app renders it. `show_visualization_gallery` is the self-demo entry point with five trusted examples bundled into the UI.

## Install locally

From `/Users/nicobailon/.pi/agent/extensions/pi-mcp-adapter/examples/interactive-visualizer` run:

```bash
npm install
npm run install-local
```

That builds `dist/server.js`, builds the self-contained UI resource, and installs or updates the matching local-example `interactive-visualizer` entry in `/Users/nicobailon/.pi/agent/mcp.json`.

If an existing `interactive-visualizer` entry points somewhere else, the installer refuses to overwrite it.

The installed config uses `lifecycle: "lazy"` by default.

To remove it later:

```bash
npm run uninstall-local
```

## Try it

Restart Pi after installing so the new MCP entry is loaded.

Open the bundled gallery:

```ts
mcp({ tool: "interactive_visualizer_show_visualization_gallery", args: "{}" })
```

Render a Mermaid diagram:

```ts
mcp({ tool: "interactive_visualizer_show_visualization", args: "{\"spec\":{\"kind\":\"mermaid\",\"title\":\"Request path\",\"code\":\"flowchart LR\\nClient[Client] --> Adapter[Adapter]\\nAdapter --> UI[UI App]\",\"interactions\":{\"click\":{\"Adapter\":{\"panel\":\"adapter_panel\",\"highlight\":[\"Adapter\",\"UI\"]}},\"steps\":[{\"id\":\"flow\",\"label\":\"Follow the call\",\"panel\":\"adapter_panel\",\"highlight\":[\"Adapter\",\"UI\"]}]},\"panels\":{\"adapter_panel\":\"The adapter resolves the UI resource, injects the tool input, and keeps the interaction local until the user submits annotations.\"},\"annotations\":{\"enabled\":true,\"targetMode\":\"elements-and-canvas\"}}}" })
```

Render a chart:

```ts
mcp({ tool: "interactive_visualizer_show_visualization", args: "{\"spec\":{\"kind\":\"chart\",\"title\":\"New users\",\"chartType\":\"line\",\"data\":{\"datasets\":[{\"id\":\"growth\",\"label\":\"Growth\",\"points\":[{\"id\":\"jan\",\"x\":\"Jan\",\"y\":120},{\"id\":\"feb\",\"x\":\"Feb\",\"y\":180},{\"id\":\"mar\",\"x\":\"Mar\",\"y\":240}]}]},\"interactions\":{\"click\":{\"mar\":{\"panel\":\"march_panel\"}},\"views\":[{\"id\":\"default_view\",\"label\":\"Default\"}]},\"panels\":{\"march_panel\":\"March is where the ramp becomes obvious.\"},\"annotations\":{\"enabled\":true,\"targetMode\":\"elements-and-canvas\"}}}" })
```

## Manual verification checklist

1. Run `mcp({ tool: "interactive_visualizer_show_visualization_gallery", args: '{}' })` and confirm the browser opens to the gallery.
2. Click between the five gallery examples and confirm navigation stays local in the app.
3. For the Mermaid example, switch views and steps, then click nodes to open different detail panels.
4. For the stacked revenue chart, switch between absolute and share views and click Q4 bars to open the matching panel.
5. For the custom comparison explainer, switch layers and verify the overlay reveals the comparison cleanly.
6. Turn on annotate mode, add a target note and a free-form region note, then edit both in the annotation panel.
7. Submit the annotations and confirm the agent receives a `visualization_annotations_submitted` handoff message encoded as the canonical `intent` line plus JSON payload.
8. Use `Copy spec` and confirm the clipboard action works.
9. Use `Fullscreen` and confirm the host switches the app into fullscreen display mode.
