import type { ChartSummaryMetric } from "../../schema.js";

/**
 * Render a compact strip of chart summary metrics.
 */
export function createMetricStrip(metrics: ChartSummaryMetric[]): HTMLElement | null {
  if (!metrics.length) return null;

  const strip = document.createElement("div");
  strip.className = "viz-metric-strip";

  for (const metric of metrics) {
    const card = document.createElement("article");
    card.className = "viz-metric-card";
    if (metric.tone) {
      card.dataset.tone = metric.tone;
    }

    const label = document.createElement("div");
    label.className = "viz-metric-card__label";
    label.textContent = metric.label;
    card.appendChild(label);

    const value = document.createElement("div");
    value.className = "viz-metric-card__value";
    value.textContent = metric.value;
    card.appendChild(value);

    strip.appendChild(card);
  }

  return strip;
}
