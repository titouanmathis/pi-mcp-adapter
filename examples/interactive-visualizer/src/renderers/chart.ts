import Chart from "chart.js/auto";
import type { ChartSpec } from "../schema.js";

/**
 * Runtime view description for chart rendering.
 */
export interface ChartRuntimeView {
  id: string;
  label: string;
  chartType: ChartSpec["chartType"];
  filled: boolean;
  stacked: boolean;
  percent: boolean;
  visibleDatasetIds: string[];
  sort: "none" | "asc" | "desc";
}

/**
 * Normalized point metadata used for hit testing and panels.
 */
export interface ChartPointMeta {
  id: string;
  datasetId: string;
  datasetLabel: string;
  label: string;
  x?: number | string;
  y: number;
  color?: string;
}

/**
 * Derived chart model for local rendering.
 */
export interface ChartViewModel {
  runtimeView: ChartRuntimeView;
  labels: string[];
  pointsById: Record<string, ChartPointMeta>;
  datasets: Array<{
    id: string;
    label: string;
    color?: string;
    data: Array<{ x: number | string | undefined; y: number; id: string; label: string }>;
  }>;
}

function defaultView(spec: ChartSpec): ChartRuntimeView {
  return {
    id: "default",
    label: "Default",
    chartType: spec.chartType,
    filled: !!spec.presentation?.filled,
    stacked: !!spec.presentation?.stacked,
    percent: !!spec.formatting?.percent,
    visibleDatasetIds: spec.data.datasets.map((dataset) => dataset.id),
    sort: "none",
  };
}

function resolveRuntimeView(spec: ChartSpec, viewId?: string): ChartRuntimeView {
  const fallback = defaultView(spec);
  const view = spec.interactions?.views?.find((entry) => entry.id === viewId);
  if (!view) return fallback;

  return {
    ...fallback,
    ...view,
    visibleDatasetIds: view.visibleDatasetIds ?? fallback.visibleDatasetIds,
    chartType: view.chartType ?? fallback.chartType,
    filled: view.filled ?? fallback.filled,
    stacked: view.stacked ?? fallback.stacked,
    percent: view.percent ?? fallback.percent,
    sort: view.sort ?? fallback.sort,
  };
}

function pointBucket(point: { x?: number | string; label?: string; id: string }): string {
  return String(point.x ?? point.label ?? point.id);
}

function sumForLabel(spec: ChartSpec, label: string): number {
  let total = 0;
  for (const dataset of spec.data.datasets) {
    const point = dataset.points.find((entry) => pointBucket(entry) === label);
    total += point?.y ?? 0;
  }
  return total;
}

function sortedLabels(spec: ChartSpec, sort: ChartRuntimeView["sort"]): string[] {
  const labels = [...new Set(
    spec.data.datasets.flatMap((dataset) => dataset.points.map((point) => pointBucket(point)))
  )];
  if (sort === "none") return labels;
  return labels.sort((left, right) => {
    const diff = sumForLabel(spec, left) - sumForLabel(spec, right);
    return sort === "asc" ? diff : -diff;
  });
}

function toPercentData(spec: ChartSpec, point: { x: number | string | undefined; y: number; label: string }): number {
  if (typeof point.x === "number") return point.y;
  const label = String(point.x ?? point.label);
  const total = sumForLabel(spec, label);
  if (!total) return 0;
  return (point.y / total) * 100;
}

/**
 * Build the runtime chart model for a given spec and active view.
 */
export function buildChartViewModel(spec: ChartSpec, viewId?: string): ChartViewModel {
  const runtimeView = resolveRuntimeView(spec, viewId);
  const labels = sortedLabels(spec, runtimeView.sort);
  const pointsById: Record<string, ChartPointMeta> = {};

  const datasets = spec.data.datasets
    .filter((dataset) => runtimeView.visibleDatasetIds.includes(dataset.id))
    .map((dataset) => ({
      id: dataset.id,
      label: dataset.label,
      color: dataset.color,
      data: labels
        .map((label) => ({
          point: dataset.points.find((entry) => pointBucket(entry) === label),
          label,
        }))
        .filter((entry): entry is { point: NonNullable<typeof entry.point>; label: string } => !!entry.point)
        .map(({ point, label }) => {
          pointsById[point.id] = {
            id: point.id,
            datasetId: dataset.id,
            datasetLabel: dataset.label,
            label: point.label ?? String(point.x ?? point.id),
            x: point.x,
            y: point.y,
            color: point.color ?? dataset.color,
          };
          return {
            x: point.x,
            y: runtimeView.percent ? toPercentData(spec, { x: point.x, y: point.y, label: point.label ?? label }) : point.y,
            id: point.id,
            label: point.label ?? label,
          };
        }),
    }));

  return {
    runtimeView,
    labels,
    pointsById,
    datasets,
  };
}

/**
 * Resolve the semantic point id for a clicked chart element.
 */
export function getChartPointIdAtIndex(spec: ChartSpec, viewId: string | undefined, datasetIndex: number, pointIndex: number): string | undefined {
  const model = buildChartViewModel(spec, viewId);
  return model.datasets[datasetIndex]?.data[pointIndex]?.id;
}

/**
 * Format one chart tooltip line without duplicating percent suffixes.
 */
export function formatChartTooltipLabel(
  spec: ChartSpec,
  runtimeView: ChartRuntimeView,
  datasetLabel: string,
  value: number,
): string {
  const decimals = spec.formatting?.decimals ?? 0;
  const formatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const prefix = runtimeView.percent ? "" : (spec.formatting?.valuePrefix ?? "");
  const suffix = runtimeView.percent ? "%" : (spec.formatting?.valueSuffix ?? "");
  return `${datasetLabel}: ${prefix}${formatter.format(value)}${suffix}`;
}

/**
 * Render a Chart.js chart into the given canvas and return the instance.
 */
export function renderChart(canvas: HTMLCanvasElement, spec: ChartSpec, viewId?: string): Chart {
  const model = buildChartViewModel(spec, viewId);

  return new Chart(canvas, {
    type: model.runtimeView.chartType,
    data: {
      labels: model.labels,
      datasets: model.datasets.map((dataset) => ({
        label: dataset.label,
        data: dataset.data.map((point) => point.y),
        borderColor: dataset.color ?? "#5f7d83",
        backgroundColor: dataset.data.map((point) => model.pointsById[point.id].color ?? dataset.color ?? "#88a1a6"),
        fill: model.runtimeView.filled,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            boxWidth: 14,
            color: "#33434a",
            font: { family: "Plus Jakarta Sans" },
          },
        },
        tooltip: {
          callbacks: {
            label(context) {
              const value = typeof context.raw === "number" ? context.raw : Number(context.raw ?? 0);
              const pointId = model.datasets[context.datasetIndex]?.data[context.dataIndex]?.id;
              const hoverText = pointId ? spec.interactions?.hover?.[pointId]?.tooltip : undefined;
              const primary = formatChartTooltipLabel(spec, model.runtimeView, context.dataset.label ?? "", value);
              return hoverText ? [primary, hoverText] : primary;
            },
          },
        },
      },
      scales: model.runtimeView.chartType === "pie" || model.runtimeView.chartType === "doughnut"
        ? undefined
        : {
            x: {
              stacked: model.runtimeView.stacked,
              ticks: { color: "#55656b", font: { family: "Plus Jakarta Sans" } },
              grid: { color: "rgba(84, 98, 103, 0.12)" },
            },
            y: {
              stacked: model.runtimeView.stacked,
              ticks: { color: "#55656b", font: { family: "Plus Jakarta Sans" } },
              grid: { color: "rgba(84, 98, 103, 0.12)" },
            },
          },
    },
  });
}
