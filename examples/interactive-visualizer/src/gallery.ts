import type { VisualizationSpec } from "./schema.js";

/**
 * Trusted gallery entry bundled into the local visualizer example.
 */
export interface GalleryEntry {
  id: string;
  label: string;
  description: string;
  spec: VisualizationSpec;
}

const architectureSpec: VisualizationSpec = {
  kind: "mermaid",
  pattern: "flow",
  id: "architecture_review",
  title: "MCP app bridge flow",
  subtitle: "A local walkthrough of tool input, UI hosting, and agent handoff.",
  theme: "auto",
  chrome: { density: "compact" },
  initialState: { viewId: "server-side", stepId: "step-1" },
  controls: [
    {
      kind: "segmented",
      id: "architecture-focus",
      label: "Focus",
      axis: "view",
      options: [
        { id: "focus-server", label: "Server boundary", activatesViewId: "server-side" },
        { id: "focus-handoff", label: "Agent handoff", activatesViewId: "handoff" },
      ],
    },
  ],
  annotations: { enabled: true, targetMode: "elements-and-canvas" },
  code: `flowchart LR
    Agent[Agent turn] --> ToolCall[show_visualization]
    ToolCall --> Adapter[pi-mcp-adapter]
    Adapter --> Host[Local host page]
    Host --> App[UI app iframe]
    App --> Handoff[visualization_annotations_submitted]
    Handoff --> Agent`,
  panels: {
    ToolCall: "The tool call stays small. The model sends one declarative visualization spec, not generated HTML or behavior.",
    Adapter: "The adapter resolves the `ui://...` resource, hosts it in a sandbox, forwards the tool input, and listens for UI messages.",
    App: "The UI app renders locally and handles hover, focus, view switches, and steppers without waking the model.",
    Handoff: "Annotation submission is the only deliberate handoff back to the agent in v1."
  },
  interactions: {
    hover: {
      Agent: { tooltip: "The agent creates the spec and later receives annotation handoff." },
      Adapter: { tooltip: "The adapter injects tool args into the UI host and manages the browser session." },
      App: { tooltip: "The iframe app owns rendering, focus, local state, and annotation drafts." }
    },
    click: {
      ToolCall: { panel: "ToolCall", highlight: ["ToolCall", "Adapter"] },
      Adapter: { panel: "Adapter", highlight: ["Adapter", "Host", "App"] },
      App: { panel: "App", highlight: ["Host", "App"] },
      Handoff: { panel: "Handoff", highlight: ["Handoff", "Agent"] }
    },
    views: [
      {
        id: "server-side",
        label: "Server boundary",
        description: "Focus on the call and hosting path.",
        highlight: ["ToolCall", "Adapter", "Host"]
      },
      {
        id: "handoff",
        label: "Agent handoff",
        description: "Focus on the final annotation message back into chat.",
        highlight: ["App", "Handoff", "Agent"]
      }
    ],
    steps: [
      { id: "step-1", label: "Model prepares spec", panel: "ToolCall", highlight: ["Agent", "ToolCall"] },
      { id: "step-2", label: "Adapter opens app", panel: "Adapter", highlight: ["Adapter", "Host", "App"] },
      { id: "step-3", label: "User annotates and submits", panel: "Handoff", highlight: ["App", "Handoff", "Agent"] }
    ]
  }
};

const revenueSpec: VisualizationSpec = {
  kind: "chart",
  pattern: "metrics",
  id: "segment_revenue",
  title: "Quarterly revenue by segment",
  subtitle: "Absolute dollars and contribution share stay local as alternate views.",
  chrome: { density: "compact" },
  initialState: { viewId: "absolute" },
  controls: [
    {
      kind: "segmented",
      id: "revenue-view",
      label: "Read as",
      axis: "view",
      options: [
        { id: "absolute-option", label: "Absolute", activatesViewId: "absolute" },
        { id: "share-option", label: "Share", activatesViewId: "share" },
        { id: "self-serve-option", label: "Self-serve only", activatesViewId: "self_serve_only" },
      ],
    },
  ],
  annotations: { enabled: true, targetMode: "elements-and-canvas" },
  chartType: "bar",
  data: {
    datasets: [
      {
        id: "self_serve",
        label: "Self-serve",
        color: "#6c8f96",
        points: [
          { id: "self_serve_q1", label: "Q1", x: "Q1", y: 180 },
          { id: "self_serve_q2", label: "Q2", x: "Q2", y: 220 },
          { id: "self_serve_q3", label: "Q3", x: "Q3", y: 265 },
          { id: "self_serve_q4", label: "Q4", x: "Q4", y: 305 }
        ]
      },
      {
        id: "sales_led",
        label: "Sales-led",
        color: "#7e9e7e",
        points: [
          { id: "sales_led_q1", label: "Q1", x: "Q1", y: 320 },
          { id: "sales_led_q2", label: "Q2", x: "Q2", y: 360 },
          { id: "sales_led_q3", label: "Q3", x: "Q3", y: 410 },
          { id: "sales_led_q4", label: "Q4", x: "Q4", y: 480 }
        ]
      },
      {
        id: "expansion",
        label: "Expansion",
        color: "#a9b18f",
        points: [
          { id: "expansion_q1", label: "Q1", x: "Q1", y: 90 },
          { id: "expansion_q2", label: "Q2", x: "Q2", y: 120 },
          { id: "expansion_q3", label: "Q3", x: "Q3", y: 165 },
          { id: "expansion_q4", label: "Q4", x: "Q4", y: 210 }
        ]
      }
    ]
  },
  presentation: { stacked: true },
  formatting: { valuePrefix: "$", valueSuffix: "k", decimals: 0 },
  summaryMetrics: [
    { id: "fy-total", label: "FY total", value: "$3.13M", tone: "info" },
    { id: "q4-total", label: "Q4 total", value: "$995k", tone: "success" },
    { id: "mix-note", label: "Mix shift", value: "Self-serve up 69%", tone: "neutral" },
  ],
  panels: {
    sales_story: "Sales-led still anchors the year, but self-serve widens the mix every quarter and makes Q4 less concentrated than Q1.",
    q4_note: "Q4 is the strongest moment for expansion revenue, which is why the stacked and percent views both matter here."
  },
  interactions: {
    hover: {
      self_serve_q4: { tooltip: "Self-serve finishes at $305k in Q4." },
      sales_led_q4: { tooltip: "Sales-led reaches $480k in Q4." },
      expansion_q4: { tooltip: "Expansion hits $210k in Q4." }
    },
    click: {
      self_serve_q4: { panel: "q4_note" },
      sales_led_q4: { panel: "sales_story" },
      expansion_q4: { panel: "q4_note" }
    },
    views: [
      {
        id: "absolute",
        label: "Absolute",
        stacked: true,
        percent: false,
        sort: "none"
      },
      {
        id: "share",
        label: "Share",
        stacked: true,
        percent: true,
        sort: "none",
        summaryMetrics: [
          { id: "share-q4", label: "Q4 largest share", value: "Sales-led 48%", tone: "info" },
          { id: "share-growth", label: "Self-serve share", value: "31% in Q4", tone: "success" },
          { id: "share-expansion", label: "Expansion share", value: "21% in Q4", tone: "neutral" },
        ]
      },
      {
        id: "self_serve_only",
        label: "Self-serve only",
        visibleDatasetIds: ["self_serve"],
        percent: false,
        sort: "desc",
        summaryMetrics: [
          { id: "ss-q4", label: "Q4 self-serve", value: "$305k", tone: "success" },
          { id: "ss-growth", label: "Year growth", value: "+69%", tone: "info" },
          { id: "ss-rank", label: "Strongest quarter", value: "Q4", tone: "neutral" },
        ]
      }
    ]
  },
  insights: [
    "Self-serve roughly doubles across the year.",
    "Expansion becomes meaningful enough to reshape the mix in the second half."
  ]
};

const spendSpec: VisualizationSpec = {
  kind: "chart",
  pattern: "metrics",
  id: "infra_spend_mix",
  title: "Infrastructure spend mix",
  subtitle: "Segment notes stay attached to semantic point ids, not array position.",
  chrome: { density: "compact" },
  summaryMetrics: [
    { id: "compute-share", label: "Largest bucket", value: "Compute · 44%", tone: "warning" },
    { id: "ops-share", label: "Ops tooling", value: "23%", tone: "info" },
    { id: "non-compute", label: "Everything else", value: "56%", tone: "neutral" },
  ],
  annotations: { enabled: true, targetMode: "elements-and-canvas" },
  chartType: "doughnut",
  data: {
    datasets: [
      {
        id: "spend_2026",
        label: "2026 spend",
        points: [
          { id: "compute_slice", label: "Compute", y: 44, color: "#68838b" },
          { id: "storage_slice", label: "Storage", y: 18, color: "#8fa08d" },
          { id: "network_slice", label: "Network", y: 15, color: "#b4b08c" },
          { id: "ops_slice", label: "Ops tooling", y: 23, color: "#c7cab8" }
        ]
      }
    ]
  },
  formatting: { valueSuffix: "%", percent: true, decimals: 0 },
  panels: {
    compute_panel: "Compute is still the dominant bucket, but it has stopped growing faster than revenue.",
    ops_panel: "Ops tooling looks expensive in isolation, yet it carries the observability and developer workflow overhead that keeps incidents down."
  },
  interactions: {
    hover: {
      compute_slice: { tooltip: "Compute takes 44% of the mix." },
      ops_slice: { tooltip: "Ops tooling is 23% of the mix." }
    },
    click: {
      compute_slice: { panel: "compute_panel" },
      ops_slice: { panel: "ops_panel" }
    }
  }
};

const comparisonSpec: VisualizationSpec = {
  kind: "custom",
  pattern: "comparison",
  id: "space_comparison",
  title: "NBA court vs NFL field",
  subtitle: "A custom explainer with overlays and measurement toggles.",
  chrome: { panelLayout: "bottom" },
  initialState: { layerId: "comparison", stepId: "scene-1" },
  controls: [
    {
      kind: "segmented",
      id: "comparison-layer",
      label: "Show",
      axis: "layer",
      options: [
        { id: "court-only-option", label: "Court", activatesLayerId: "court_only" },
        { id: "field-only-option", label: "Field", activatesLayerId: "field_only" },
        { id: "comparison-option", label: "Compare", activatesLayerId: "comparison" },
        { id: "overlay-option", label: "Overlay", activatesLayerId: "overlay" },
      ],
    },
  ],
  annotations: { enabled: true, targetMode: "elements-and-canvas" },
  scene: {
    width: 980,
    height: 520,
    background: "#f4f6f7",
    elements: [
      { kind: "rect", id: "court_outline", label: "NBA court", x: 80, y: 140, width: 380, height: 190, rx: 18, fill: "#d5e2df", stroke: "#5f7d83", strokeWidth: 3, layer: "court" },
      { kind: "text", id: "court_label", x: 270, y: 380, text: "NBA court · 94 × 50 ft", fill: "#35545a", fontSize: 22, fontWeight: "semibold", align: "middle", layer: "court" },
      { kind: "rect", id: "field_outline", label: "NFL field", x: 520, y: 90, width: 360, height: 290, rx: 26, fill: "#d9e4d2", stroke: "#60795b", strokeWidth: 3, layer: "field" },
      { kind: "text", id: "field_label", x: 700, y: 410, text: "NFL field · 360 × 160 ft", fill: "#42613d", fontSize: 22, fontWeight: "semibold", align: "middle", layer: "field" },
      { kind: "line", id: "width_measure", x1: 80, y1: 110, x2: 460, y2: 110, stroke: "#8c836a", strokeWidth: 2, dash: "10 8", layer: "measurements" },
      { kind: "text", id: "width_measure_label", x: 270, y: 100, text: "94 ft", fill: "#7a7057", fontSize: 16, align: "middle", layer: "measurements" },
      { kind: "line", id: "field_measure", x1: 520, y1: 60, x2: 880, y2: 60, stroke: "#8c836a", strokeWidth: 2, dash: "10 8", layer: "measurements" },
      { kind: "text", id: "field_measure_label", x: 700, y: 50, text: "360 ft", fill: "#7a7057", fontSize: 16, align: "middle", layer: "measurements" },
      { kind: "rect", id: "court_inside_field", label: "Court overlay", x: 570, y: 140, width: 200, height: 105, rx: 16, fill: "rgba(95,125,131,0.16)", stroke: "#5f7d83", strokeWidth: 2, layer: "overlay" },
      { kind: "text", id: "overlay_label", x: 670, y: 270, text: "The court only fills a small slice of the field.", fill: "#4b5d5f", fontSize: 18, align: "middle", layer: "overlay" }
    ]
  },
  panels: {
    court_panel: "The court is much smaller than most people picture because the field dimensions dominate both width and total area.",
    field_panel: "The field is long enough that an NBA court overlay reads more like an inset than a direct substitute.",
    overlay_panel: "Overlay mode is the useful reveal here. It lets the user see the space mismatch immediately without another agent turn."
  },
  interactions: {
    hover: {
      court_outline: { tooltip: "NBA court footprint" },
      field_outline: { tooltip: "NFL field footprint" },
      court_inside_field: { tooltip: "Scaled court overlay inside the field" }
    },
    click: {
      court_outline: { panel: "court_panel", highlight: ["court_outline", "court_label"] },
      field_outline: { panel: "field_panel", highlight: ["field_outline", "field_label"] },
      court_inside_field: { panel: "overlay_panel", highlight: ["court_inside_field", "overlay_label"] }
    },
    layers: [
      { id: "court_only", label: "Court only", show: ["court_outline", "court_label"], hide: ["field_outline", "field_label", "court_inside_field", "overlay_label", "field_measure", "field_measure_label"] },
      { id: "field_only", label: "Field only", show: ["field_outline", "field_label"], hide: ["court_outline", "court_label", "court_inside_field", "overlay_label", "width_measure", "width_measure_label"] },
      { id: "comparison", label: "Comparison", show: ["court_outline", "court_label", "field_outline", "field_label"] },
      { id: "overlay", label: "Overlay", show: ["field_outline", "field_label", "court_inside_field", "overlay_label", "field_measure", "field_measure_label"] }
    ],
    steps: [
      { id: "scene-1", label: "Read the court", panel: "court_panel", highlight: ["court_outline", "court_label"] },
      { id: "scene-2", label: "Read the field", panel: "field_panel", highlight: ["field_outline", "field_label"] },
      { id: "scene-3", label: "Overlay the two", panel: "overlay_panel", highlight: ["court_inside_field", "overlay_label"] }
    ]
  }
};

const timelineSpec: VisualizationSpec = {
  kind: "custom",
  pattern: "timeline",
  id: "annotation_workflow",
  title: "Annotation handoff workflow",
  subtitle: "A stepper view of how exploratory UI work returns to the chat thread.",
  chrome: { panelLayout: "bottom" },
  initialState: { stepId: "draft" },
  controls: [
    {
      kind: "range",
      id: "workflow-progress",
      label: "Progress",
      axis: "step",
      steps: [
        { value: 0, label: "Draft", activatesStepId: "draft" },
        { value: 1, label: "Review", activatesStepId: "review" },
        { value: 2, label: "Submit", activatesStepId: "submit" },
        { value: 3, label: "Respond", activatesStepId: "respond" },
      ],
    },
  ],
  annotations: { enabled: true, targetMode: "elements-and-canvas" },
  scene: {
    width: 920,
    height: 360,
    background: "#f4f6f7",
    elements: [
      { kind: "circle", id: "draft_step", label: "Draft", cx: 150, cy: 180, r: 58, fill: "#d7e4df", stroke: "#59767d", strokeWidth: 3 },
      { kind: "circle", id: "review_step", label: "Review", cx: 390, cy: 180, r: 58, fill: "#dde7d4", stroke: "#627b5e", strokeWidth: 3 },
      { kind: "circle", id: "submit_step", label: "Submit", cx: 630, cy: 180, r: 58, fill: "#e7e0c7", stroke: "#8a7b4f", strokeWidth: 3 },
      { kind: "circle", id: "agent_step", label: "Agent", cx: 810, cy: 180, r: 42, fill: "#e0ddd2", stroke: "#786f61", strokeWidth: 3 },
      { kind: "line", id: "line_1", x1: 208, y1: 180, x2: 332, y2: 180, stroke: "#8c836a", strokeWidth: 3, dash: "12 10" },
      { kind: "line", id: "line_2", x1: 448, y1: 180, x2: 572, y2: 180, stroke: "#8c836a", strokeWidth: 3, dash: "12 10" },
      { kind: "line", id: "line_3", x1: 688, y1: 180, x2: 768, y2: 180, stroke: "#8c836a", strokeWidth: 3, dash: "12 10" },
      { kind: "text", id: "draft_label", x: 150, y: 188, text: "Draft", fill: "#35545a", fontSize: 20, fontWeight: "semibold", align: "middle" },
      { kind: "text", id: "review_label", x: 390, y: 188, text: "Review", fill: "#42613d", fontSize: 20, fontWeight: "semibold", align: "middle" },
      { kind: "text", id: "submit_label", x: 630, y: 188, text: "Submit", fill: "#7a704d", fontSize: 20, fontWeight: "semibold", align: "middle" },
      { kind: "text", id: "agent_label", x: 810, y: 188, text: "Agent", fill: "#5d5547", fontSize: 18, fontWeight: "semibold", align: "middle" }
    ]
  },
  panels: {
    draft_panel: "Annotation mode stays local while the user adds notes and targets the right elements.",
    review_panel: "The user edits and trims the payload before anything wakes the agent.",
    submit_panel: "Only the final submit action emits the `visualization_annotations_submitted` handoff message.",
    agent_panel: "The next response is a new chat turn or a fresh visualization call, not a live mutation of the existing app."
  },
  interactions: {
    click: {
      draft_step: { panel: "draft_panel", highlight: ["draft_step", "draft_label"] },
      review_step: { panel: "review_panel", highlight: ["review_step", "review_label"] },
      submit_step: { panel: "submit_panel", highlight: ["submit_step", "submit_label"] },
      agent_step: { panel: "agent_panel", highlight: ["agent_step", "agent_label"] }
    },
    hover: {
      draft_step: { tooltip: "Create local notes without sending them yet." },
      submit_step: { tooltip: "Emit one final structured handoff message back to the agent." }
    },
    steps: [
      { id: "draft", label: "Draft annotations", panel: "draft_panel", highlight: ["draft_step", "draft_label"] },
      { id: "review", label: "Review payload", panel: "review_panel", highlight: ["review_step", "review_label"] },
      { id: "submit", label: "Send handoff", panel: "submit_panel", highlight: ["submit_step", "submit_label"] },
      { id: "respond", label: "Agent follows up", panel: "agent_panel", highlight: ["agent_step", "agent_label"] }
    ]
  }
};

/**
 * Default gallery examples packaged into the example UI.
 */
export const galleryEntries: GalleryEntry[] = [
  {
    id: "architecture",
    label: "Architecture diagram",
    description: "Mermaid walkthrough with views, steps, and hover details.",
    spec: architectureSpec,
  },
  {
    id: "revenue",
    label: "Stacked revenue chart",
    description: "Bar chart with absolute, share, and filtered views.",
    spec: revenueSpec,
  },
  {
    id: "spend",
    label: "Spend mix donut",
    description: "Segment explanations on a donut chart with semantic slice ids.",
    spec: spendSpec,
  },
  {
    id: "comparison",
    label: "Court vs field explainer",
    description: "Custom scene with overlays, measurements, and focus panels.",
    spec: comparisonSpec,
  },
  {
    id: "timeline",
    label: "Annotation workflow",
    description: "Narrative stepper that shows the handoff lifecycle.",
    spec: timelineSpec,
  }
];

/**
 * Resolve a gallery example by id.
 */
export function getGalleryEntry(id: string | undefined): GalleryEntry | undefined {
  if (!id) return undefined;
  return galleryEntries.find((entry) => entry.id === id);
}
