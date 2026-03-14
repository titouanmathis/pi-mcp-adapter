import { describe, expect, it } from "vitest";
import { formatChartTooltipLabel } from "../examples/interactive-visualizer/src/renderers/chart.ts";
import { parseVisualizationSpec } from "../examples/interactive-visualizer/src/schema.ts";

describe("interactive visualizer chart formatting", () => {
  it("does not duplicate percent suffixes in tooltips", () => {
    const spec = parseVisualizationSpec({
      kind: "chart",
      chartType: "doughnut",
      formatting: { percent: true, valueSuffix: "%" },
      data: {
        datasets: [
          {
            id: "spend",
            label: "Spend",
            points: [{ id: "compute", label: "Compute", y: 44 }],
          },
        ],
      },
    });

    if (spec.kind !== "chart") {
      throw new Error("Expected chart spec in test setup.");
    }

    expect(
      formatChartTooltipLabel(spec, {
        id: "default",
        label: "Default",
        chartType: "doughnut",
        filled: false,
        stacked: false,
        percent: true,
        visibleDatasetIds: ["spend"],
        sort: "none",
      }, "Spend", 44)
    ).toBe("Spend: 44%");
  });

  it("drops absolute-value money formatting when a view is percentage-based", () => {
    const spec = parseVisualizationSpec({
      kind: "chart",
      chartType: "bar",
      formatting: { valuePrefix: "$", valueSuffix: "k", decimals: 0 },
      data: {
        datasets: [
          {
            id: "revenue",
            label: "Revenue",
            points: [{ id: "q1", x: "Q1", y: 180 }],
          },
        ],
      },
    });

    if (spec.kind !== "chart") {
      throw new Error("Expected chart spec in test setup.");
    }

    expect(
      formatChartTooltipLabel(spec, {
        id: "share",
        label: "Share",
        chartType: "bar",
        filled: false,
        stacked: true,
        percent: true,
        visibleDatasetIds: ["revenue"],
        sort: "none",
      }, "Revenue", 34)
    ).toBe("Revenue: 34%");
  });
});
