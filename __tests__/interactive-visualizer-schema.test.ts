import { describe, expect, it } from "vitest";
import {
  extractMermaidTargetIds,
  parseAnnotationSubmission,
  parseVisualizationSpec,
  resolveVisibleTargetIds,
  sanitizeSvg,
} from "../examples/interactive-visualizer/src/schema.ts";
import { galleryEntries } from "../examples/interactive-visualizer/src/gallery.ts";

describe("interactive visualizer schema", () => {
  it("ships five trusted gallery examples", () => {
    expect(galleryEntries).toHaveLength(5);
    expect(galleryEntries.map((entry) => entry.id)).toEqual([
      "architecture",
      "revenue",
      "spend",
      "comparison",
      "timeline",
    ]);
    expect(() => {
      for (const entry of galleryEntries) {
        parseVisualizationSpec(entry.spec);
      }
    }).not.toThrow();
  });

  it("extracts explicit mermaid ids from source", () => {
    expect(
      extractMermaidTargetIds(`flowchart LR\nAgent[Agent] --> Adapter[Adapter]\nparticipant User`)
    ).toEqual(expect.arrayContaining(["Agent", "Adapter", "User"]));
  });

  it("validates a well-formed chart spec", () => {
    const parsed = parseVisualizationSpec({
      kind: "chart",
      pattern: "metrics",
      title: "Revenue",
      chartType: "bar",
      initialState: { viewId: "default" },
      controls: [
        {
          kind: "segmented",
          id: "view-switch",
          label: "View",
          axis: "view",
          options: [{ id: "default-option", label: "Default", activatesViewId: "default" } , { id: "focus-option", label: "Focus", activatesViewId: "focus" }],
        },
      ],
      annotations: { enabled: true, targetMode: "elements-and-canvas" },
      data: {
        datasets: [
          {
            id: "sales",
            label: "Sales",
            points: [
              { id: "q1", x: "Q1", y: 100 },
              { id: "q2", x: "Q2", y: 140 },
            ],
          },
        ],
      },
      summaryMetrics: [{ id: "fy-total", label: "FY total", value: "$240" }],
      interactions: {
        click: { q2: { panel: "q2_panel" } },
        views: [
          { id: "default", label: "Default", visibleDatasetIds: ["sales"] },
          { id: "focus", label: "Focus", visibleDatasetIds: ["sales"], summaryMetrics: [{ id: "q2-focus", label: "Q2", value: "$140" }] },
        ],
      },
      panels: { q2_panel: "Q2 outperforms Q1." },
    });

    expect(parsed.kind).toBe("chart");
  });

  it("rejects referential mismatches", () => {
    expect(() =>
      parseVisualizationSpec({
        kind: "chart",
        chartType: "bar",
        annotations: { enabled: true, targetMode: "elements-and-canvas" },
        data: {
          datasets: [
            {
              id: "sales",
              label: "Sales",
              points: [{ id: "q1", x: "Q1", y: 100 }],
            },
          ],
        },
        interactions: {
          click: { q1: { panel: "missing_panel" } },
          views: [{ id: "bad_view", label: "Bad", visibleDatasetIds: ["missing_dataset"] }],
        },
      })
    ).toThrow(/missing panel|unknown dataset/i);
  });

  it("rejects ambiguous control mappings and bad initial state", () => {
    expect(() =>
      parseVisualizationSpec({
        kind: "custom",
        initialState: { layerId: "missing-layer" },
        controls: [
          {
            kind: "segmented",
            id: "layer-switch",
            label: "Layer",
            axis: "layer",
            options: [
              { id: "compare", label: "Compare", activatesLayerId: "comparison", activatesViewId: "oops" },
              { id: "overlay", label: "Overlay", activatesLayerId: "overlay" },
            ],
          },
        ],
        scene: {
          width: 100,
          height: 100,
          elements: [{ kind: "text", id: "label", x: 20, y: 20, text: "Scene" }],
        },
        interactions: {
          layers: [
            { id: "comparison", label: "Comparison" },
            { id: "overlay", label: "Overlay" },
          ],
        },
      })
    ).toThrow(/Initial state references unknown layer id|must activate exactly one state id|targets axis/i);
  });

  it("sanitizes safe svg and extracts ids", () => {
    const sanitized = sanitizeSvg(`<?xml version="1.0"?><svg viewBox="0 0 10 10"><rect id="court" width="10" height="10" /></svg>`);
    expect(sanitized.svg).toContain("<svg");
    expect(sanitized.ids).toEqual(["court"]);
  });

  it("rejects unsafe svg markup", () => {
    expect(() => sanitizeSvg(`<svg><script>alert(1)</script></svg>`)).toThrow(/forbidden/i);
  });

  it("rejects duplicate svg ids", () => {
    expect(() =>
      sanitizeSvg(`<svg><rect id="dup" /><circle id="dup" /></svg>`)
    ).toThrow(/duplicate id/i);
  });

  it("treats show as a subset filter and lets hide win", () => {
    expect(
      [...resolveVisibleTargetIds(["court", "field", "overlay"], ["court", "field"], ["field"])]
    ).toEqual(["court"]);
  });

  it("matches the comparison gallery layer subsets", () => {
    const comparison = galleryEntries.find((entry) => entry.id === "comparison");
    expect(comparison?.spec.kind).toBe("custom");
    if (!comparison || comparison.spec.kind !== "custom" || !comparison.spec.scene) {
      throw new Error("Expected custom comparison gallery spec.");
    }

    const targetIds = comparison.spec.scene.elements.map((element) => element.id);
    const comparisonLayer = comparison.spec.interactions?.layers?.find((layer) => layer.id === "comparison");
    const overlayLayer = comparison.spec.interactions?.layers?.find((layer) => layer.id === "overlay");

    expect([...resolveVisibleTargetIds(targetIds, comparisonLayer?.show, comparisonLayer?.hide)]).toEqual([
      "court_outline",
      "court_label",
      "field_outline",
      "field_label",
    ]);

    expect([...resolveVisibleTargetIds(targetIds, overlayLayer?.show, overlayLayer?.hide)]).toEqual([
      "field_outline",
      "field_label",
      "court_inside_field",
      "overlay_label",
      "field_measure",
      "field_measure_label",
    ]);
  });

  it("validates bounded annotation submissions", () => {
    const payload = parseAnnotationSubmission({
      visualizationId: "flow_review",
      annotations: [
        {
          id: "note_1",
          kind: "pin",
          text: "Check this transition",
          x: 0.42,
          y: 0.61,
        },
      ],
    });

    expect(payload.annotations[0].x).toBe(0.42);
  });
});
