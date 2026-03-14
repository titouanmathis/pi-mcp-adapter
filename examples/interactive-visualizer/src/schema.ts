import { z } from "zod";

const idSchema = z.string().min(1).max(120).regex(/^[A-Za-z][A-Za-z0-9_-]*$/);
const nonEmptyString = z.string().min(1);
const boundedNumber = z.number().finite();
const normalizedCoordinate = z.number().min(0).max(1);
const plainRecord = z.record(z.string(), z.unknown());

const panelContentSchema = z.union([
  nonEmptyString,
  z.object({
    title: nonEmptyString.optional(),
    body: nonEmptyString,
  }),
]);

const annotationConfigSchema = z.object({
  enabled: z.boolean(),
  targetMode: z.enum(["elements", "canvas", "elements-and-canvas"]).optional(),
});

const visualizationPatternSchema = z.enum(["flow", "structure", "explainer", "comparison", "timeline", "metrics"]);
const chromeSchema = z.object({
  panelLayout: z.enum(["side", "bottom"]).optional(),
  density: z.enum(["compact", "comfortable"]).optional(),
});
const initialStateSchema = z.object({
  viewId: idSchema.optional(),
  layerId: idSchema.optional(),
  stepId: idSchema.optional(),
});
const summaryMetricSchema = z.object({
  id: idSchema,
  label: nonEmptyString,
  value: z.string().min(1).max(120),
  tone: z.enum(["neutral", "info", "success", "warning"]).optional(),
});
const segmentedControlOptionSchema = z.object({
  id: idSchema,
  label: nonEmptyString,
  activatesViewId: idSchema.optional(),
  activatesLayerId: idSchema.optional(),
});
const rangeControlStepSchema = z.object({
  value: z.number().finite(),
  label: nonEmptyString,
  activatesStepId: idSchema.optional(),
  activatesViewId: idSchema.optional(),
  activatesLayerId: idSchema.optional(),
});
const visualizationControlSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("segmented"),
    id: idSchema,
    label: nonEmptyString,
    axis: z.enum(["view", "layer"]),
    options: z.array(segmentedControlOptionSchema).min(2),
  }),
  z.object({
    kind: z.literal("range"),
    id: idSchema,
    label: nonEmptyString,
    axis: z.enum(["view", "layer", "step"]),
    steps: z.array(rangeControlStepSchema).min(2),
  }),
]);

const hoverTooltipSchema = z.object({
  tooltip: nonEmptyString.optional(),
});

const clickInteractionSchema = z.object({
  panel: idSchema,
  highlight: z.array(idSchema).optional(),
});

const viewSchema = z.object({
  id: idSchema,
  label: nonEmptyString,
  description: z.string().optional(),
  show: z.array(idSchema).optional(),
  hide: z.array(idSchema).optional(),
  highlight: z.array(idSchema).optional(),
});

const stepSchema = z.object({
  id: idSchema,
  label: nonEmptyString,
  description: z.string().optional(),
  highlight: z.array(idSchema).optional(),
  panel: idSchema.optional(),
});

const baseVisualizationShape = {
  id: idSchema.optional(),
  title: z.string().max(160).optional(),
  subtitle: z.string().max(240).optional(),
  pattern: visualizationPatternSchema.optional(),
  theme: z.enum(["light", "dark", "auto"]).optional(),
  annotations: annotationConfigSchema.optional(),
  chrome: chromeSchema.optional(),
  initialState: initialStateSchema.optional(),
  controls: z.array(visualizationControlSchema).optional(),
};

const mermaidSpecSchemaBase = z.object({
  ...baseVisualizationShape,
  kind: z.literal("mermaid"),
  code: nonEmptyString,
  interactions: z.object({
    hover: z.record(idSchema, z.object({ tooltip: nonEmptyString })).optional(),
    click: z.record(idSchema, clickInteractionSchema).optional(),
    views: z.array(viewSchema).optional(),
    steps: z.array(stepSchema).optional(),
  }).optional(),
  panels: z.record(idSchema, panelContentSchema).optional(),
});

const pointSchema = z.object({
  id: idSchema,
  y: boundedNumber,
  x: z.union([boundedNumber, z.string()]).optional(),
  label: z.string().max(120).optional(),
  color: z.string().max(64).optional(),
});

const datasetSchema = z.object({
  id: idSchema,
  label: nonEmptyString,
  points: z.array(pointSchema).min(1),
  color: z.string().max(64).optional(),
  stack: idSchema.optional(),
});

const chartViewSchema = z.object({
  id: idSchema,
  label: nonEmptyString,
  chartType: z.enum(["bar", "line", "pie", "doughnut", "scatter"]).optional(),
  filled: z.boolean().optional(),
  stacked: z.boolean().optional(),
  percent: z.boolean().optional(),
  sort: z.enum(["none", "asc", "desc"]).optional(),
  visibleDatasetIds: z.array(idSchema).optional(),
  summaryMetrics: z.array(summaryMetricSchema).optional(),
});

const chartSpecSchemaBase = z.object({
  ...baseVisualizationShape,
  kind: z.literal("chart"),
  chartType: z.enum(["bar", "line", "pie", "doughnut", "scatter"]),
  data: z.object({
    datasets: z.array(datasetSchema).min(1),
  }),
  presentation: z.object({
    filled: z.boolean().optional(),
    stacked: z.boolean().optional(),
  }).optional(),
  formatting: z.object({
    valuePrefix: z.string().max(32).optional(),
    valueSuffix: z.string().max(32).optional(),
    percent: z.boolean().optional(),
    decimals: z.number().int().min(0).max(4).optional(),
  }).optional(),
  interactions: z.object({
    hover: z.record(idSchema, hoverTooltipSchema).optional(),
    click: z.record(idSchema, z.object({ panel: idSchema })).optional(),
    views: z.array(chartViewSchema).optional(),
    steps: z.array(stepSchema).optional(),
  }).optional(),
  panels: z.record(idSchema, panelContentSchema).optional(),
  insights: z.array(nonEmptyString).optional(),
  summaryMetrics: z.array(summaryMetricSchema).optional(),
});

const rectElementSchema = z.object({
  kind: z.literal("rect"),
  id: idSchema,
  label: z.string().max(120).optional(),
  x: boundedNumber,
  y: boundedNumber,
  width: z.number().positive(),
  height: z.number().positive(),
  rx: z.number().min(0).optional(),
  fill: z.string().max(64).optional(),
  stroke: z.string().max(64).optional(),
  strokeWidth: z.number().min(0).optional(),
  text: z.string().max(160).optional(),
  textColor: z.string().max(64).optional(),
  fontSize: z.number().positive().optional(),
  layer: idSchema.optional(),
  meta: plainRecord.optional(),
});

const circleElementSchema = z.object({
  kind: z.literal("circle"),
  id: idSchema,
  label: z.string().max(120).optional(),
  cx: boundedNumber,
  cy: boundedNumber,
  r: z.number().positive(),
  fill: z.string().max(64).optional(),
  stroke: z.string().max(64).optional(),
  strokeWidth: z.number().min(0).optional(),
  layer: idSchema.optional(),
  meta: plainRecord.optional(),
});

const lineElementSchema = z.object({
  kind: z.literal("line"),
  id: idSchema,
  label: z.string().max(120).optional(),
  x1: boundedNumber,
  y1: boundedNumber,
  x2: boundedNumber,
  y2: boundedNumber,
  stroke: z.string().max(64).optional(),
  strokeWidth: z.number().positive().optional(),
  dash: z.string().max(64).optional(),
  layer: idSchema.optional(),
  meta: plainRecord.optional(),
});

const textElementSchema = z.object({
  kind: z.literal("text"),
  id: idSchema,
  label: z.string().max(120).optional(),
  x: boundedNumber,
  y: boundedNumber,
  text: nonEmptyString,
  fill: z.string().max(64).optional(),
  fontSize: z.number().positive().optional(),
  fontWeight: z.enum(["normal", "medium", "semibold", "bold"]).optional(),
  align: z.enum(["start", "middle", "end"]).optional(),
  layer: idSchema.optional(),
  meta: plainRecord.optional(),
});

const customSceneElementSchema = z.discriminatedUnion("kind", [
  rectElementSchema,
  circleElementSchema,
  lineElementSchema,
  textElementSchema,
]);

const customSpecSchemaBase = z.object({
  ...baseVisualizationShape,
  kind: z.literal("custom"),
  svg: z.string().min(1).optional(),
  scene: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    background: z.string().max(64).optional(),
    elements: z.array(customSceneElementSchema).min(1),
  }).optional(),
  interactions: z.object({
    hover: z.record(idSchema, z.object({ tooltip: nonEmptyString })).optional(),
    click: z.record(idSchema, clickInteractionSchema).optional(),
    layers: z.array(z.object({
      id: idSchema,
      label: nonEmptyString,
      show: z.array(idSchema).optional(),
      hide: z.array(idSchema).optional(),
    })).optional(),
    steps: z.array(stepSchema).optional(),
  }).optional(),
  panels: z.record(idSchema, panelContentSchema).optional(),
});

const visualizationSpecSchemaBase = z.discriminatedUnion("kind", [
  mermaidSpecSchemaBase,
  chartSpecSchemaBase,
  customSpecSchemaBase,
]);

/**
 * User-facing annotation configuration for a visualization.
 */
export interface AnnotationConfig {
  enabled: boolean;
  targetMode?: "elements" | "canvas" | "elements-and-canvas";
}

/**
 * Product-language pattern hint for renderer defaults.
 */
export type VisualizationPattern = z.infer<typeof visualizationPatternSchema>;

/**
 * Shared chrome options for the bundled UI shell.
 */
export interface VisualizationChrome {
  panelLayout?: "side" | "bottom";
  density?: "compact" | "comfortable";
}

/**
 * Initial local state applied before the user interacts with the explainer.
 */
export interface VisualizationInitialState {
  viewId?: string;
  layerId?: string;
  stepId?: string;
}

/**
 * Declarative summary metric shown alongside chart explainers.
 */
export type ChartSummaryMetric = z.infer<typeof summaryMetricSchema>;

/**
 * Declarative control surface that aliases one underlying state axis.
 */
export type VisualizationControl = z.infer<typeof visualizationControlSchema>;

/**
 * Shared metadata applied to every visualization kind.
 */
export interface BaseVisualizationSpec {
  id?: string;
  title?: string;
  subtitle?: string;
  kind: "mermaid" | "chart" | "custom";
  pattern?: VisualizationPattern;
  theme?: "light" | "dark" | "auto";
  annotations?: AnnotationConfig;
  chrome?: VisualizationChrome;
  initialState?: VisualizationInitialState;
  controls?: VisualizationControl[];
}

/**
 * Interactive Mermaid diagram input.
 */
export interface MermaidSpec extends BaseVisualizationSpec {
  kind: "mermaid";
  code: string;
  interactions?: z.infer<typeof mermaidSpecSchemaBase>["interactions"];
  panels?: z.infer<typeof mermaidSpecSchemaBase>["panels"];
}

/**
 * Interactive chart input.
 */
export interface ChartSpec extends BaseVisualizationSpec {
  kind: "chart";
  chartType: "bar" | "line" | "pie" | "doughnut" | "scatter";
  data: z.infer<typeof chartSpecSchemaBase>["data"];
  presentation?: z.infer<typeof chartSpecSchemaBase>["presentation"];
  formatting?: z.infer<typeof chartSpecSchemaBase>["formatting"];
  interactions?: z.infer<typeof chartSpecSchemaBase>["interactions"];
  panels?: z.infer<typeof chartSpecSchemaBase>["panels"];
  insights?: string[];
  summaryMetrics?: ChartSummaryMetric[];
}

/**
 * Structured custom visualization input.
 */
export interface CustomSpec extends BaseVisualizationSpec {
  kind: "custom";
  svg?: string;
  scene?: z.infer<typeof customSpecSchemaBase>["scene"];
  interactions?: z.infer<typeof customSpecSchemaBase>["interactions"];
  panels?: z.infer<typeof customSpecSchemaBase>["panels"];
}

/**
 * Top-level visualization union accepted by `show_visualization`.
 */
export type VisualizationSpec = MermaidSpec | ChartSpec | CustomSpec;

/**
 * Batched annotation payload sent back to the agent.
 */
export interface VisualizationAnnotationSubmission {
  visualizationId?: string;
  title?: string;
  viewId?: string;
  stepId?: string;
  streamId?: string;
  sequence?: number;
  annotations: Array<{
    id: string;
    targetId?: string;
    targetLabel?: string;
    kind: "pin" | "highlight" | "region-note";
    text: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }>;
}

/**
 * Output from the SVG sanitization pipeline.
 */
export interface SanitizedSvgResult {
  svg: string;
  ids: string[];
}

/**
 * Zod schema for visualization specs.
 */
export const visualizationSpecSchema = visualizationSpecSchemaBase;

/**
 * Zod schema for annotation submissions.
 */
export const visualizationAnnotationSubmissionSchema = z.object({
  visualizationId: idSchema.optional(),
  title: z.string().max(160).optional(),
  viewId: idSchema.optional(),
  stepId: idSchema.optional(),
  streamId: idSchema.optional(),
  sequence: z.number().int().nonnegative().optional(),
  annotations: z.array(z.object({
    id: idSchema,
    targetId: idSchema.optional(),
    targetLabel: z.string().max(160).optional(),
    kind: z.enum(["pin", "highlight", "region-note"]),
    text: z.string().min(1).max(280),
    x: normalizedCoordinate.optional(),
    y: normalizedCoordinate.optional(),
    width: normalizedCoordinate.optional(),
    height: normalizedCoordinate.optional(),
  })).min(1).max(24),
});

const FORBIDDEN_SVG_PATTERNS = [
  /<\s*script\b/i,
  /<\s*foreignObject\b/i,
  /<\s*(iframe|object|embed|audio|video|canvas|image|use)\b/i,
  /\son[a-z]+\s*=/i,
  /\s(?:href|xlink:href|src)\s*=\s*["'][^"']+/i,
  /javascript:/i,
  /data:/i,
  /<\!DOCTYPE/i,
];

const STRIP_SVG_PATTERNS = [
  /<\?xml[\s\S]*?\?>/gi,
  /<!--([\s\S]*?)-->/g,
];

function panelExists(panels: Record<string, unknown> | undefined, panelId: string): boolean {
  return !!panels && panelId in panels;
}

function pushIssue(issues: string[], message: string): void {
  issues.push(message);
}

function ensureUniqueIds(ids: Iterable<string>, label: string, issues: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      pushIssue(issues, `${label} contains duplicate id "${id}".`);
      continue;
    }
    seen.add(id);
  }
}

function collectChartPointIds(spec: z.infer<typeof chartSpecSchemaBase>): string[] {
  const ids: string[] = [];
  for (const dataset of spec.data.datasets) {
    for (const point of dataset.points) {
      ids.push(point.id);
    }
  }
  return ids;
}

function collectCustomTargetIds(spec: z.infer<typeof customSpecSchemaBase>, sanitizedSvgIds: string[]): string[] {
  const ids = new Set<string>();
  for (const element of spec.scene?.elements ?? []) {
    ids.add(element.id);
  }
  for (const id of sanitizedSvgIds) ids.add(id);
  return [...ids];
}

function collectMermaidIdsFromCode(code: string): string[] {
  const ids = new Set<string>();
  for (const match of code.matchAll(/\b([A-Za-z][A-Za-z0-9_-]*)\s*(?=[\[{(])/g)) {
    ids.add(match[1]);
  }
  for (const match of code.matchAll(/\b(?:participant|actor|class)\s+([A-Za-z][A-Za-z0-9_-]*)\b/g)) {
    ids.add(match[1]);
  }
  for (const match of code.matchAll(/\bstate\s+"[^"]+"\s+as\s+([A-Za-z][A-Za-z0-9_-]*)\b/g)) {
    ids.add(match[1]);
  }
  for (const match of code.matchAll(/\bstate\s+([A-Za-z][A-Za-z0-9_-]*)\b/g)) {
    ids.add(match[1]);
  }
  for (const match of code.matchAll(/\bsubgraph\s+([A-Za-z][A-Za-z0-9_-]*)\b/g)) {
    ids.add(match[1]);
  }
  return [...ids];
}

function validateTargetReferences(
  issues: string[],
  validIds: Set<string>,
  panels: Record<string, unknown> | undefined,
  interactionGroup: Record<string, z.infer<typeof clickInteractionSchema> | { tooltip?: string }> | undefined,
  groupLabel: string,
): void {
  if (!interactionGroup) return;
  for (const [targetId, config] of Object.entries(interactionGroup)) {
    if (!validIds.has(targetId)) {
      pushIssue(issues, `${groupLabel} references unknown target id "${targetId}".`);
    }
    if ("panel" in config && config.panel && !panelExists(panels, config.panel)) {
      pushIssue(issues, `${groupLabel} target "${targetId}" references missing panel "${config.panel}".`);
    }
    if ("highlight" in config && Array.isArray(config.highlight)) {
      for (const highlightId of config.highlight) {
        if (!validIds.has(highlightId)) {
          pushIssue(issues, `${groupLabel} target "${targetId}" highlights unknown id "${highlightId}".`);
        }
      }
    }
  }
}

function validateViews(
  issues: string[],
  validIds: Set<string>,
  views: Array<z.infer<typeof viewSchema> | z.infer<typeof chartViewSchema>> | undefined,
  validDatasetIds: Set<string> | undefined,
): void {
  if (!views) return;
  ensureUniqueIds(views.map((view) => view.id), "views", issues);
  for (const view of views) {
    if ("show" in view && Array.isArray(view.show)) {
      for (const id of view.show) {
        if (!validIds.has(id)) pushIssue(issues, `View "${view.id}" references unknown show id "${id}".`);
      }
    }
    if ("hide" in view && Array.isArray(view.hide)) {
      for (const id of view.hide) {
        if (!validIds.has(id)) pushIssue(issues, `View "${view.id}" references unknown hide id "${id}".`);
      }
    }
    if ("highlight" in view && Array.isArray(view.highlight)) {
      for (const id of view.highlight) {
        if (!validIds.has(id)) pushIssue(issues, `View "${view.id}" references unknown highlight id "${id}".`);
      }
    }
    if ("visibleDatasetIds" in view && Array.isArray(view.visibleDatasetIds) && validDatasetIds) {
      for (const datasetId of view.visibleDatasetIds) {
        if (!validDatasetIds.has(datasetId)) {
          pushIssue(issues, `View "${view.id}" references unknown dataset id "${datasetId}".`);
        }
      }
    }
  }
}

function validateSteps(
  issues: string[],
  validIds: Set<string>,
  panels: Record<string, unknown> | undefined,
  steps: z.infer<typeof stepSchema>[] | undefined,
): void {
  if (!steps) return;
  ensureUniqueIds(steps.map((step) => step.id), "steps", issues);
  for (const step of steps) {
    if (step.panel && !panelExists(panels, step.panel)) {
      pushIssue(issues, `Step "${step.id}" references missing panel "${step.panel}".`);
    }
    for (const id of step.highlight ?? []) {
      if (!validIds.has(id)) {
        pushIssue(issues, `Step "${step.id}" references unknown highlight id "${id}".`);
      }
    }
  }
}

function validateLayerDefinitions(
  issues: string[],
  validIds: Set<string>,
  layers: Array<{ id: string; label: string; show?: string[]; hide?: string[] }> | undefined,
): void {
  if (!layers) return;
  ensureUniqueIds(layers.map((layer) => layer.id), "layers", issues);
  for (const layer of layers) {
    for (const id of layer.show ?? []) {
      if (!validIds.has(id)) pushIssue(issues, `Layer "${layer.id}" references unknown show id "${id}".`);
    }
    for (const id of layer.hide ?? []) {
      if (!validIds.has(id)) pushIssue(issues, `Layer "${layer.id}" references unknown hide id "${id}".`);
    }
  }
}

function validateElementTargetMode(issues: string[], validIds: Set<string>, annotations: AnnotationConfig | undefined): void {
  const mode = annotations?.targetMode;
  if ((mode === "elements" || mode === "elements-and-canvas") && validIds.size === 0) {
    pushIssue(issues, `Annotation target mode "${mode}" requires at least one semantic target id.`);
  }
}

interface DeclaredStateIds {
  viewIds: Set<string>;
  layerIds: Set<string>;
  stepIds: Set<string>;
}

function validateSummaryMetrics(
  issues: string[],
  metrics: ChartSummaryMetric[] | undefined,
  label: string,
): void {
  if (!metrics) return;
  ensureUniqueIds(metrics.map((metric) => metric.id), `${label} summary metrics`, issues);
}

function validateInitialState(
  issues: string[],
  initialState: VisualizationInitialState | undefined,
  declared: DeclaredStateIds,
): void {
  if (!initialState) return;
  if (initialState.viewId && !declared.viewIds.has(initialState.viewId)) {
    pushIssue(issues, `Initial state references unknown view id "${initialState.viewId}".`);
  }
  if (initialState.layerId && !declared.layerIds.has(initialState.layerId)) {
    pushIssue(issues, `Initial state references unknown layer id "${initialState.layerId}".`);
  }
  if (initialState.stepId && !declared.stepIds.has(initialState.stepId)) {
    pushIssue(issues, `Initial state references unknown step id "${initialState.stepId}".`);
  }
}

function validateControlActivation(
  issues: string[],
  controlId: string,
  axis: "view" | "layer" | "step",
  label: string,
  activation: {
    activatesViewId?: string;
    activatesLayerId?: string;
    activatesStepId?: string;
  },
  declared: DeclaredStateIds,
): void {
  const refs = [
    ["view", activation.activatesViewId],
    ["layer", activation.activatesLayerId],
    ["step", activation.activatesStepId],
  ].filter(([, value]) => !!value) as Array<["view" | "layer" | "step", string]>;

  if (refs.length !== 1) {
    pushIssue(issues, `Control "${controlId}" ${label} must activate exactly one state id.`);
    return;
  }

  const [resolvedAxis, id] = refs[0];
  if (resolvedAxis !== axis) {
    pushIssue(issues, `Control "${controlId}" ${label} targets axis "${resolvedAxis}" but control axis is "${axis}".`);
    return;
  }

  const declaredIds = resolvedAxis === "view"
    ? declared.viewIds
    : resolvedAxis === "layer"
      ? declared.layerIds
      : declared.stepIds;

  if (!declaredIds.has(id)) {
    pushIssue(issues, `Control "${controlId}" ${label} references unknown ${resolvedAxis} id "${id}".`);
  }
}

function validateControls(
  issues: string[],
  controls: VisualizationControl[] | undefined,
  declared: DeclaredStateIds,
): void {
  if (!controls) return;
  ensureUniqueIds(controls.map((control) => control.id), "controls", issues);
  for (const control of controls) {
    if (control.kind === "segmented") {
      ensureUniqueIds(control.options.map((option) => option.id), `control "${control.id}" options`, issues);
      for (const option of control.options) {
        validateControlActivation(issues, control.id, control.axis, `option "${option.id}"`, option, declared);
      }
      continue;
    }

    ensureUniqueIds(control.steps.map((step) => `${step.value}`), `control "${control.id}" step values`, issues);
    for (const step of control.steps) {
      validateControlActivation(issues, control.id, control.axis, `step "${step.label}"`, step, declared);
    }
  }
}

/**
 * Extracts stable Mermaid ids referenced in the source definition.
 */
export function extractMermaidTargetIds(code: string): string[] {
  return collectMermaidIdsFromCode(code);
}

/**
 * Resolve the visible target ids for a view or layer using `show` as a subset filter.
 */
export function resolveVisibleTargetIds(
  targetIds: Iterable<string>,
  show?: string[],
  hide?: string[],
): Set<string> {
  const visible = show?.length ? new Set(show) : new Set(targetIds);
  for (const id of hide ?? []) {
    visible.delete(id);
  }
  return visible;
}

/**
 * Sanitizes SVG input and extracts a trusted id map.
 */
export function sanitizeSvg(svg: string): SanitizedSvgResult {
  let sanitized = svg.trim();
  for (const pattern of FORBIDDEN_SVG_PATTERNS) {
    if (pattern.test(sanitized)) {
      throw new Error("Custom SVG contains forbidden markup or external behavior.");
    }
  }
  for (const pattern of STRIP_SVG_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }
  if (!/^<svg\b/i.test(sanitized) || !/<\/svg>\s*$/i.test(sanitized)) {
    throw new Error("Custom SVG must be a single <svg> document.");
  }
  const ids = [...sanitized.matchAll(/\sid="([A-Za-z][A-Za-z0-9_-]*)"/g)].map((match) => match[1]);
  const duplicateIssues: string[] = [];
  ensureUniqueIds(ids, "svg ids", duplicateIssues);
  if (duplicateIssues.length > 0) {
    throw new Error(duplicateIssues.join(" "));
  }
  return { svg: sanitized, ids };
}

/**
 * Parses and validates an annotation handoff payload.
 */
export function parseAnnotationSubmission(input: unknown): VisualizationAnnotationSubmission {
  const result = visualizationAnnotationSubmissionSchema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues.map((issue) => issue.message).join(" "));
  }
  return result.data;
}

/**
 * Parses and validates a visualization spec with referential integrity checks.
 */
export function parseVisualizationSpec(input: unknown): VisualizationSpec {
  const result = visualizationSpecSchema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues.map((issue) => issue.message).join(" "));
  }

  const spec = result.data;
  const issues: string[] = [];
  let validIds = new Set<string>();

  if (spec.kind === "mermaid") {
    const ids = collectMermaidIdsFromCode(spec.code);
    ensureUniqueIds(ids, "mermaid ids", issues);
    validIds = new Set(ids);
    validateTargetReferences(issues, validIds, spec.panels, spec.interactions?.click, "Mermaid click interactions");
    validateTargetReferences(issues, validIds, spec.panels, spec.interactions?.hover, "Mermaid hover interactions");
    validateViews(issues, validIds, spec.interactions?.views, undefined);
    validateSteps(issues, validIds, spec.panels, spec.interactions?.steps);
    validateElementTargetMode(issues, validIds, spec.annotations);
    const declared: DeclaredStateIds = {
      viewIds: new Set(spec.interactions?.views?.map((view) => view.id) ?? []),
      layerIds: new Set(),
      stepIds: new Set(spec.interactions?.steps?.map((step) => step.id) ?? []),
    };
    validateInitialState(issues, spec.initialState, declared);
    validateControls(issues, spec.controls, declared);
  }

  if (spec.kind === "chart") {
    const pointIds = collectChartPointIds(spec);
    ensureUniqueIds(pointIds, "chart ids", issues);
    validIds = new Set(pointIds);
    const datasetIds = new Set(spec.data.datasets.map((dataset) => dataset.id));
    validateTargetReferences(issues, validIds, spec.panels, spec.interactions?.click, "Chart click interactions");
    validateTargetReferences(issues, validIds, spec.panels, spec.interactions?.hover, "Chart hover interactions");
    validateViews(issues, validIds, spec.interactions?.views, datasetIds);
    validateSteps(issues, validIds, spec.panels, spec.interactions?.steps);
    validateElementTargetMode(issues, validIds, spec.annotations);
    validateSummaryMetrics(issues, spec.summaryMetrics, "chart");
    for (const view of spec.interactions?.views ?? []) {
      validateSummaryMetrics(issues, view.summaryMetrics, `view "${view.id}"`);
    }
    const declared: DeclaredStateIds = {
      viewIds: new Set(spec.interactions?.views?.map((view) => view.id) ?? []),
      layerIds: new Set(),
      stepIds: new Set(spec.interactions?.steps?.map((step) => step.id) ?? []),
    };
    validateInitialState(issues, spec.initialState, declared);
    validateControls(issues, spec.controls, declared);
  }

  if (spec.kind === "custom") {
    if (!spec.scene && !spec.svg) {
      pushIssue(issues, "Custom visualizations require either a structured scene or an SVG document.");
    }
    let sanitizedSvgIds: string[] = [];
    let sanitizedSvg: string | undefined;
    if (spec.svg) {
      const sanitized = sanitizeSvg(spec.svg);
      sanitizedSvg = sanitized.svg;
      sanitizedSvgIds = sanitized.ids;
    }
    const targetIds = collectCustomTargetIds(spec, sanitizedSvgIds);
    ensureUniqueIds(targetIds, "custom target ids", issues);
    validIds = new Set(targetIds);
    validateTargetReferences(issues, validIds, spec.panels, spec.interactions?.click, "Custom click interactions");
    validateTargetReferences(issues, validIds, spec.panels, spec.interactions?.hover, "Custom hover interactions");
    validateLayerDefinitions(issues, validIds, spec.interactions?.layers);
    validateSteps(issues, validIds, spec.panels, spec.interactions?.steps);
    validateElementTargetMode(issues, validIds, spec.annotations);
    const declared: DeclaredStateIds = {
      viewIds: new Set(),
      layerIds: new Set(spec.interactions?.layers?.map((layer) => layer.id) ?? []),
      stepIds: new Set(spec.interactions?.steps?.map((step) => step.id) ?? []),
    };
    validateInitialState(issues, spec.initialState, declared);
    validateControls(issues, spec.controls, declared);
    if (sanitizedSvg) {
      spec.svg = sanitizedSvg;
    }
  }

  if (issues.length > 0) {
    throw new Error(issues.join(" "));
  }

  return spec as VisualizationSpec;
}
