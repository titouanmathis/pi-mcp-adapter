import type { AnnotationDraft } from "./annotation-state.js";
import { parseVisualizationSpec, type ChartSpec, type ChartSummaryMetric, type VisualizationControl, type VisualizationSpec } from "../schema.js";

/**
 * Concrete chrome settings after pattern defaults are applied.
 */
export interface ResolvedVisualizationChrome {
  panelLayout: "side" | "bottom";
  density: "compact" | "comfortable";
}

/**
 * Local visualization state chosen at boot.
 */
export interface ResolvedVisualizationInitialState {
  activeViewId?: string;
  activeLayerId?: string;
  activeStepId?: string;
}

/**
 * Resolve chrome from explicit config first, then pattern defaults.
 */
export function resolveVisualizationChrome(spec: VisualizationSpec): ResolvedVisualizationChrome {
  return {
    panelLayout: spec.chrome?.panelLayout ?? defaultPanelLayout(spec),
    density: spec.chrome?.density ?? defaultDensity(spec),
  };
}

/**
 * Resolve the initial local state from explicit ids, then declared ordering.
 */
export function resolveVisualizationInitialState(spec: VisualizationSpec): ResolvedVisualizationInitialState {
  return {
    activeViewId: spec.initialState?.viewId ?? firstDeclaredViewId(spec),
    activeLayerId: spec.initialState?.layerId ?? firstDeclaredLayerId(spec),
    activeStepId: spec.initialState?.stepId ?? firstDeclaredStepId(spec),
  };
}

/**
 * Resolve the metric strip for the active chart view.
 */
export function resolveChartSummaryMetrics(spec: ChartSpec, viewId?: string): ChartSummaryMetric[] {
  const activeView = spec.interactions?.views?.find((view) => view.id === viewId);
  return activeView?.summaryMetrics ?? spec.summaryMetrics ?? [];
}

/**
 * Whether a visualization declares a control for the given axis.
 */
export function hasExplicitControlForAxis(
  controls: VisualizationControl[] | undefined,
  axis: "view" | "layer" | "step",
): boolean {
  return (controls ?? []).some((control) => control.axis === axis);
}

function defaultPanelLayout(spec: VisualizationSpec): "side" | "bottom" {
  if (spec.pattern === "comparison" || spec.pattern === "timeline") {
    return "bottom";
  }
  return "side";
}

function defaultDensity(spec: VisualizationSpec): "compact" | "comfortable" {
  if (spec.pattern === "metrics" || spec.pattern === "structure") {
    return "compact";
  }
  return "comfortable";
}

function firstDeclaredViewId(spec: VisualizationSpec): string | undefined {
  return spec.kind === "custom"
    ? undefined
    : spec.interactions?.views?.[0]?.id;
}

function firstDeclaredLayerId(spec: VisualizationSpec): string | undefined {
  return spec.kind === "custom"
    ? spec.interactions?.layers?.[0]?.id
    : undefined;
}

function firstDeclaredStepId(spec: VisualizationSpec): string | undefined {
  return spec.interactions?.steps?.[0]?.id;
}

export function mergeStreamDraft(
  current: Record<string, unknown> | undefined,
  patch: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!patch) {
    return current ? JSON.parse(JSON.stringify(current)) as Record<string, unknown> : {};
  }

  const base = current ? JSON.parse(JSON.stringify(current)) as Record<string, unknown> : {};

  for (const [key, value] of Object.entries(patch)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      base[key] &&
      typeof base[key] === "object" &&
      !Array.isArray(base[key])
    ) {
      base[key] = mergeStreamDraft(base[key] as Record<string, unknown>, value as Record<string, unknown>);
      continue;
    }
    base[key] = value;
  }

  return base;
}

export function tryParseVisualizationDraft(draft: Record<string, unknown> | undefined): VisualizationSpec | undefined {
  if (!draft) return undefined;
  try {
    return parseVisualizationSpec(draft);
  } catch {
    return undefined;
  }
}

export interface ReconciledVisualizationState {
  activeViewId?: string;
  activeLayerId?: string;
  activeStepId?: string;
  selectedPanelId?: string;
  staleAnnotationIds: string[];
}

export function reconcileVisualizationState(
  spec: VisualizationSpec,
  current: {
    activeViewId?: string;
    activeLayerId?: string;
    activeStepId?: string;
    selectedPanelId?: string;
    annotations: AnnotationDraft[];
  },
): ReconciledVisualizationState {
  const initialState = resolveVisualizationInitialState(spec);
  const validViewIds = new Set(spec.kind === "custom" ? [] : (spec.interactions?.views?.map((view) => view.id) ?? []));
  const validLayerIds = new Set(spec.kind === "custom" ? (spec.interactions?.layers?.map((layer) => layer.id) ?? []) : []);
  const validStepIds = new Set(spec.interactions?.steps?.map((step) => step.id) ?? []);
  const validPanelIds = new Set(Object.keys(spec.panels ?? {}));
  const validTargetIds = new Set<string>();

  if (spec.kind === "chart") {
    for (const dataset of spec.data.datasets) {
      for (const point of dataset.points) {
        validTargetIds.add(point.id);
      }
    }
  } else if (spec.kind === "custom") {
    for (const element of spec.scene?.elements ?? []) {
      validTargetIds.add(element.id);
    }
  }

  const staleAnnotationIds = validTargetIds.size === 0
    ? []
    : current.annotations
        .filter((annotation) => annotation.targetId && !validTargetIds.has(annotation.targetId))
        .map((annotation) => annotation.id);

  return {
    activeViewId: current.activeViewId && validViewIds.has(current.activeViewId)
      ? current.activeViewId
      : initialState.activeViewId,
    activeLayerId: current.activeLayerId && validLayerIds.has(current.activeLayerId)
      ? current.activeLayerId
      : initialState.activeLayerId,
    activeStepId: current.activeStepId && validStepIds.has(current.activeStepId)
      ? current.activeStepId
      : initialState.activeStepId,
    selectedPanelId: current.selectedPanelId && validPanelIds.has(current.selectedPanelId)
      ? current.selectedPanelId
      : undefined,
    staleAnnotationIds,
  };
}
