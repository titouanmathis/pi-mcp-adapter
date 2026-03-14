import { describe, expect, it } from "vitest";
import { buildChartViewModel, getChartPointIdAtIndex } from "../examples/interactive-visualizer/src/renderers/chart.ts";
import { parseVisualizationSpec } from "../examples/interactive-visualizer/src/schema.ts";

describe("interactive visualizer chart renderer", () => {
  const spec = parseVisualizationSpec({
    kind: "chart",
    title: "Segment mix",
    chartType: "bar",
    data: {
      datasets: [
        {
          id: "alpha",
          label: "Alpha",
          points: [
            { id: "alpha_q1", x: "Q1", y: 100 },
            { id: "alpha_q2", x: "Q2", y: 200 },
          ],
        },
        {
          id: "beta",
          label: "Beta",
          points: [
            { id: "beta_q1", x: "Q1", y: 300 },
            { id: "beta_q2", x: "Q2", y: 150 },
          ],
        },
      ],
    },
    interactions: {
      views: [
        {
          id: "beta_only",
          label: "Beta only",
          visibleDatasetIds: ["beta"],
        },
        {
          id: "sorted",
          label: "Sorted",
          sort: "desc",
        },
      ],
    },
  });

  if (spec.kind !== "chart") {
    throw new Error("Expected chart spec in test setup.");
  }

  it("maps filtered datasets to rendered point ids", () => {
    const model = buildChartViewModel(spec, "beta_only");
    expect(model.datasets).toHaveLength(1);
    expect(model.datasets[0].id).toBe("beta");
    expect(getChartPointIdAtIndex(spec, "beta_only", 0, 1)).toBe("beta_q2");
  });

  it("maps sorted labels using rendered order", () => {
    const model = buildChartViewModel(spec, "sorted");
    expect(model.labels).toEqual(["Q1", "Q2"]);
    expect(getChartPointIdAtIndex(spec, "sorted", 1, 0)).toBe("beta_q1");
    expect(getChartPointIdAtIndex(spec, "sorted", 0, 1)).toBe("alpha_q2");
  });
});
