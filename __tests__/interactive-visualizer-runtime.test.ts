import { describe, expect, it } from "vitest";
import {
  mergeStreamDraft,
  reconcileVisualizationState,
  resolveChartSummaryMetrics,
  resolveVisualizationChrome,
  resolveVisualizationInitialState,
  tryParseVisualizationDraft,
} from "../examples/interactive-visualizer/src/ui/runtime.ts";

describe("interactive visualizer runtime helpers", () => {
  it("prefers explicit initial state over declaration order", () => {
    const state = resolveVisualizationInitialState({
      kind: "chart",
      initialState: { viewId: "share", stepId: "step-2" },
      chartType: "bar",
      data: {
        datasets: [
          { id: "sales", label: "Sales", points: [{ id: "q1", x: "Q1", y: 10 }] },
        ],
      },
      interactions: {
        views: [
          { id: "absolute", label: "Absolute" },
          { id: "share", label: "Share" },
        ],
        steps: [
          { id: "step-1", label: "One" },
          { id: "step-2", label: "Two" },
        ],
      },
    });

    expect(state).toEqual({ activeViewId: "share", activeLayerId: undefined, activeStepId: "step-2" });
  });

  it("falls back to pattern defaults for chrome", () => {
    expect(resolveVisualizationChrome({ kind: "custom", pattern: "timeline", scene: { width: 100, height: 100, elements: [{ kind: "text", id: "label", x: 10, y: 20, text: "Timeline" }] } })).toEqual({
      panelLayout: "bottom",
      density: "comfortable",
    });

    expect(resolveVisualizationChrome({ kind: "chart", pattern: "metrics", chartType: "bar", data: { datasets: [{ id: "sales", label: "Sales", points: [{ id: "q1", x: "Q1", y: 10 }] }] } })).toEqual({
      panelLayout: "side",
      density: "compact",
    });
  });

  it("replaces base chart metrics with view metrics when present", () => {
    const spec = {
      kind: "chart" as const,
      chartType: "bar" as const,
      data: {
        datasets: [
          { id: "sales", label: "Sales", points: [{ id: "q1", x: "Q1", y: 10 }] },
        ],
      },
      summaryMetrics: [{ id: "base", label: "Base", value: "$10" }],
      interactions: {
        views: [
          { id: "absolute", label: "Absolute" },
          { id: "share", label: "Share", summaryMetrics: [{ id: "share", label: "Share", value: "100%" }] },
        ],
      },
    };

    expect(resolveChartSummaryMetrics(spec, "absolute")).toEqual([{ id: "base", label: "Base", value: "$10" }]);
    expect(resolveChartSummaryMetrics(spec, "share")).toEqual([{ id: "share", label: "Share", value: "100%" }]);
  });

  it("merges stream draft patches into a parseable visualization spec", () => {
    const draft = mergeStreamDraft(undefined, {
      kind: "mermaid",
      title: "Streaming flow",
    });
    const merged = mergeStreamDraft(draft, {
      code: "flowchart LR\nClient[Client] --> Adapter[Adapter]",
    });

    expect(tryParseVisualizationDraft(draft)).toBeUndefined();
    expect(tryParseVisualizationDraft(merged)).toMatchObject({
      kind: "mermaid",
      title: "Streaming flow",
    });
  });

  it("reconciles invalid selections and stale annotations after streamed updates", () => {
    const spec = {
      kind: "chart" as const,
      chartType: "bar" as const,
      data: {
        datasets: [
          { id: "sales", label: "Sales", points: [{ id: "q2", x: "Q2", y: 20 }] },
        ],
      },
      interactions: {
        views: [{ id: "absolute", label: "Absolute" }],
        steps: [{ id: "step-1", label: "Step 1" }],
      },
      panels: {
        summary: "Summary",
      },
    };

    expect(reconcileVisualizationState(spec, {
      activeViewId: "missing-view",
      activeLayerId: undefined,
      activeStepId: "missing-step",
      selectedPanelId: "missing-panel",
      annotations: [
        { id: "annotation-1", kind: "highlight", text: "", targetId: "q1" },
        { id: "annotation-2", kind: "highlight", text: "", targetId: "q2" },
      ],
    })).toEqual({
      activeViewId: "absolute",
      activeLayerId: undefined,
      activeStepId: "step-1",
      selectedPanelId: undefined,
      staleAnnotationIds: ["annotation-1"],
    });
  });
});
