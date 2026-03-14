import { App, PostMessageTransport } from "@modelcontextprotocol/ext-apps";
import type { Chart } from "chart.js/auto";
import {
  getUiStreamHostContext,
  getVisualizationStreamEnvelope,
  uiStreamResultPatchNotificationSchema,
  type VisualizationStreamPhase,
  type VisualizationStreamStatus,
} from "../../../../ui-stream-types.js";
import { galleryEntries, getGalleryEntry } from "../gallery.js";
import { getChartPointIdAtIndex, renderChart } from "../renderers/chart.js";
import { renderCustomScene } from "../renderers/custom.js";
import { renderMermaidSpec } from "../renderers/mermaid.js";
import { parseAnnotationSubmission, parseVisualizationSpec, resolveVisibleTargetIds, type ChartSpec, type CustomSpec, type MermaidSpec, type VisualizationSpec } from "../schema.js";
import { AnnotationState, toNormalizedPoint, toNormalizedRegion } from "./annotation-state.js";
import { createAnnotationPanel } from "./components/annotation-panel.js";
import { createControlRow } from "./components/control-row.js";
import { createMetricStrip } from "./components/metric-strip.js";
import { createSidePanel } from "./components/side-panel.js";
import { createStepper } from "./components/stepper.js";
import { createToolbar } from "./components/toolbar.js";
import {
  hasExplicitControlForAxis,
  mergeStreamDraft,
  reconcileVisualizationState,
  resolveChartSummaryMetrics,
  resolveVisualizationChrome,
  resolveVisualizationInitialState,
  tryParseVisualizationDraft,
} from "./runtime.js";

interface RuntimeState {
  bootMode: "gallery" | "single" | "stream";
  selectedGalleryId?: string;
  spec?: VisualizationSpec;
  streamDraft?: Record<string, unknown>;
  streamId?: string;
  expectedSequence?: number;
  streamPhase?: VisualizationStreamPhase;
  streamStatus?: VisualizationStreamStatus | "cancelled" | "loading";
  streamMessage?: string;
  selectedPanelId?: string;
  activeViewId?: string;
  activeStepId?: string;
  activeLayerId?: string;
  annotateMode: boolean;
  annotationState: AnnotationState;
  chartInstance: Chart | null;
  serverMessage?: string;
  suppressNextClick: boolean;
}

const app = new App(
  { name: "interactive-visualizer", version: "0.1.0" },
  { availableDisplayModes: ["inline", "fullscreen"] },
);

const rootElement = document.getElementById("app");
if (!rootElement) throw new Error("Missing #app root element.");
const root = rootElement;

interface ShellRefs {
  gallery: HTMLElement;
  toolbar: HTMLElement;
  layout: HTMLElement;
  main: HTMLElement;
  controls: HTMLElement;
  metrics: HTMLElement;
  stage: HTMLElement;
  stepper: HTMLElement;
  serverMessage: HTMLElement;
  side: HTMLElement;
  panel: HTMLElement;
  annotation: HTMLElement;
}

let shellRefs: ShellRefs | null = null;
let runtimeState: RuntimeState | null = null;
let dragStart: { clientX: number; clientY: number } | null = null;
let dragPreview: HTMLElement | null = null;
let stageElement: HTMLElement | null = null;
let stageTooltip: HTMLElement | null = null;
let renderVersion = 0;

function cloneVisualizationSpec(spec: VisualizationSpec): VisualizationSpec {
  return JSON.parse(JSON.stringify(spec)) as VisualizationSpec;
}

function flash(message: string, tone: "info" | "error" = "info"): void {
  const banner = document.getElementById("flash");
  if (!banner) return;
  banner.textContent = message;
  banner.dataset.tone = tone;
  banner.classList.add("is-visible");
  window.setTimeout(() => banner.classList.remove("is-visible"), 3200);
}

function ensureShell(): ShellRefs {
  if (shellRefs) return shellRefs;

  root.innerHTML = "";

  const gallery = document.createElement("div");
  gallery.className = "viz-shell-gallery";

  const toolbar = document.createElement("div");
  const layout = document.createElement("div");
  layout.className = "viz-layout";

  const main = document.createElement("section");
  main.className = "viz-main";

  const controls = document.createElement("div");
  const metrics = document.createElement("div");
  const stage = document.createElement("div");
  const stepper = document.createElement("div");
  const serverMessage = document.createElement("div");

  const side = document.createElement("div");
  side.className = "viz-side";
  const panel = document.createElement("div");
  const annotation = document.createElement("div");

  main.append(controls, metrics, stage, stepper, serverMessage);
  side.append(panel, annotation);
  layout.append(main, side);
  root.append(gallery, toolbar, layout);

  shellRefs = { gallery, toolbar, layout, main, controls, metrics, stage, stepper, serverMessage, side, panel, annotation };
  return shellRefs;
}

function resetShell(): void {
  shellRefs = null;
  root.innerHTML = "";
}

function getDefaultPanel(spec: VisualizationSpec): { title: string; body: string; insights?: string[] } {
  if (spec.kind === "chart" && spec.insights?.length) {
    return {
      title: spec.title ?? "Visualization",
      body: spec.subtitle ?? "Explore the chart locally and open segment notes from the plotted points.",
      insights: spec.insights,
    };
  }

  return {
    title: spec.title ?? "Visualization",
    body: spec.subtitle ?? "Explore the visualization locally. Use the controls to switch views, step through the narrative, or annotate specific targets.",
  };
}

function resolvePanel(spec: VisualizationSpec, panelId: string | undefined): { title: string; body: string; insights?: string[] } {
  if (!panelId || !spec.panels?.[panelId]) {
    return getDefaultPanel(spec);
  }

  const panel = spec.panels[panelId];
  if (typeof panel === "string") {
    return {
      title: panelId.replace(/_/g, " "),
      body: panel,
      insights: spec.kind === "chart" ? spec.insights : undefined,
    };
  }

  return {
    title: panel.title ?? panelId.replace(/_/g, " "),
    body: panel.body,
    insights: spec.kind === "chart" ? spec.insights : undefined,
  };
}

function createRuntimeState(
  mode: "gallery" | "single" | "stream",
  spec?: VisualizationSpec,
  selectedGalleryId?: string,
): RuntimeState {
  const initialState = spec ? resolveVisualizationInitialState(spec) : {};

  return {
    bootMode: mode,
    selectedGalleryId,
    spec,
    selectedPanelId: undefined,
    activeViewId: initialState.activeViewId,
    activeStepId: initialState.activeStepId,
    activeLayerId: initialState.activeLayerId,
    annotateMode: false,
    annotationState: new AnnotationState(spec?.annotations),
    chartInstance: null,
    suppressNextClick: false,
    streamStatus: mode === "stream" ? "loading" : undefined,
  };
}

function bootFromArgs(args: Record<string, unknown>): RuntimeState {
  if (!("spec" in args)) {
    const selected = getGalleryEntry(typeof args.exampleId === "string" ? args.exampleId : undefined) ?? galleryEntries[0];
    return createRuntimeState("gallery", parseVisualizationSpec(cloneVisualizationSpec(selected.spec)), selected.id);
  }

  return createRuntimeState("single", parseVisualizationSpec(args.spec));
}

function bootStreamState(): RuntimeState {
  const streamContext = getUiStreamHostContext(app.getHostContext());
  const state = createRuntimeState("stream");
  state.streamId = streamContext?.streamId;
  state.expectedSequence = 0;
  state.streamStatus = "loading";
  return state;
}

function getActiveSteps(spec: VisualizationSpec): Array<{ id: string; label: string }> {
  return spec.interactions?.steps?.map((step) => ({ id: step.id, label: step.label })) ?? [];
}

function destroyChart(): void {
  runtimeState?.chartInstance?.destroy();
  if (runtimeState) runtimeState.chartInstance = null;
}

function getSvgTargetNodes(rootSvg: SVGSVGElement, id: string): SVGElement[] {
  const nodes = new Set<SVGElement>();
  rootSvg.querySelectorAll<SVGElement>(`[data-visualizer-target-id="${CSS.escape(id)}"]`).forEach((node) => nodes.add(node));
  rootSvg.querySelectorAll<SVGElement>(`#${CSS.escape(id)}`).forEach((node) => nodes.add(node));
  return [...nodes];
}

function getSvgTargetIds(rootSvg: SVGSVGElement): string[] {
  return [...new Set(
    Array.from(rootSvg.querySelectorAll<SVGElement>("[data-visualizer-target-id]"))
      .map((node) => node.getAttribute("data-visualizer-target-id") ?? "")
      .filter(Boolean)
  )];
}

function setSvgTargetVisibility(rootSvg: SVGSVGElement, id: string, visible: boolean): void {
  for (const node of getSvgTargetNodes(rootSvg, id)) {
    node.classList.toggle("is-hidden", !visible);
  }
}

function applySvgVisibility(rootSvg: SVGSVGElement, show?: string[], hide?: string[]): void {
  if (!show?.length && !hide?.length) {
    for (const id of getSvgTargetIds(rootSvg)) {
      setSvgTargetVisibility(rootSvg, id, true);
    }
    return;
  }

  const visibleIds = resolveVisibleTargetIds(getSvgTargetIds(rootSvg), show, hide);
  for (const id of getSvgTargetIds(rootSvg)) {
    setSvgTargetVisibility(rootSvg, id, visibleIds.has(id));
  }
}

function applySvgHighlights(rootSvg: SVGSVGElement, ids: string[]): void {
  rootSvg.querySelectorAll(".is-highlighted").forEach((element) => element.classList.remove("is-highlighted"));
  for (const id of ids) {
    for (const node of getSvgTargetNodes(rootSvg, id)) {
      node.classList.add("is-highlighted");
    }
  }
}

function resolveStepHighlight(spec: VisualizationSpec, stepId: string | undefined): string[] {
  if (!stepId) return [];
  const step = spec.interactions?.steps?.find((entry) => entry.id === stepId);
  return step?.highlight ?? [];
}

function updatePanelFromStep(spec: VisualizationSpec): void {
  if (!runtimeState?.activeStepId) return;
  const step = spec.interactions?.steps?.find((entry) => entry.id === runtimeState?.activeStepId);
  if (step?.panel) {
    runtimeState.selectedPanelId = step.panel;
  }
}

function applyResolvedSpec(nextSpec: VisualizationSpec): void {
  if (!runtimeState) return;
  const reconciliation = reconcileVisualizationState(nextSpec, {
    activeViewId: runtimeState.activeViewId,
    activeLayerId: runtimeState.activeLayerId,
    activeStepId: runtimeState.activeStepId,
    selectedPanelId: runtimeState.selectedPanelId,
    annotations: runtimeState.annotationState.list(),
  });

  for (const annotationId of reconciliation.staleAnnotationIds) {
    runtimeState.annotationState.remove(annotationId);
  }

  runtimeState.spec = nextSpec;
  runtimeState.annotationState.setConfig(nextSpec.annotations);
  runtimeState.activeViewId = reconciliation.activeViewId;
  runtimeState.activeLayerId = reconciliation.activeLayerId;
  runtimeState.activeStepId = reconciliation.activeStepId;
  runtimeState.selectedPanelId = reconciliation.selectedPanelId;
}

function handleGallerySelection(id: string): void {
  if (!runtimeState) return;
  const entry = getGalleryEntry(id);
  if (!entry) return;
  destroyChart();
  runtimeState = createRuntimeState("gallery", parseVisualizationSpec(cloneVisualizationSpec(entry.spec)), id);
  renderApp();
}

function createGalleryStrip(): HTMLElement | null {
  if (!runtimeState || runtimeState.bootMode !== "gallery") return null;
  const strip = document.createElement("div");
  strip.className = "viz-gallery-strip";

  for (const entry of galleryEntries) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `viz-gallery-strip__item ${entry.id === runtimeState.selectedGalleryId ? "is-active" : ""}`;
    button.innerHTML = `<strong>${entry.label}</strong><span>${entry.description}</span>`;
    button.addEventListener("click", () => handleGallerySelection(entry.id));
    strip.appendChild(button);
  }

  return strip;
}

function addAnnotationDraft(annotation: Parameters<AnnotationState["add"]>[0]): void {
  if (!runtimeState) return;
  runtimeState.annotationState.add(annotation);
  renderApp();
}

function clearStageTooltip(): void {
  if (!stageTooltip) return;
  stageTooltip.textContent = "";
  stageTooltip.classList.remove("is-visible");
}

function updateStageTooltip(text: string, clientX: number, clientY: number): void {
  if (!stageTooltip || !stageElement) return;
  const bounds = stageElement.getBoundingClientRect();
  stageTooltip.textContent = text;
  stageTooltip.style.left = `${clientX - bounds.left + 14}px`;
  stageTooltip.style.top = `${clientY - bounds.top + 14}px`;
  stageTooltip.classList.add("is-visible");
}

function applyHoverTooltips(spec: MermaidSpec | CustomSpec, rootSvg: SVGSVGElement): void {
  const hoverEntries = spec.interactions?.hover ?? {};
  for (const [targetId, config] of Object.entries(hoverEntries)) {
    if (!config.tooltip) continue;
    for (const node of getSvgTargetNodes(rootSvg, targetId)) {
      node.setAttribute("data-visualizer-tooltip", config.tooltip);
    }
  }
}

function wireSvgTooltip(container: HTMLElement): void {
  container.addEventListener("mousemove", (event) => {
    if (runtimeState?.annotateMode) {
      clearStageTooltip();
      return;
    }
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-visualizer-tooltip]");
    const tooltip = target?.dataset.visualizerTooltip;
    if (!tooltip) {
      clearStageTooltip();
      return;
    }
    updateStageTooltip(tooltip, event.clientX, event.clientY);
  });

  container.addEventListener("mouseleave", clearStageTooltip);
}

function handleSvgClick(event: MouseEvent, spec: MermaidSpec | CustomSpec): void {
  if (!runtimeState || !stageElement) return;
  if (runtimeState.suppressNextClick) {
    runtimeState.suppressNextClick = false;
    return;
  }

  const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-visualizer-target-id]");
  const bounds = stageElement.getBoundingClientRect();

  if (runtimeState.annotateMode) {
    if (target && runtimeState.annotationState.allowsElements()) {
      addAnnotationDraft({
        targetId: target.dataset.visualizerTargetId,
        targetLabel: target.dataset.visualizerTargetLabel,
        kind: "highlight",
        text: "",
      });
      flash("Draft annotation added.");
      return;
    }

    if (runtimeState.annotationState.allowsCanvas()) {
      const point = toNormalizedPoint(bounds, event.clientX, event.clientY);
      addAnnotationDraft({ kind: "pin", text: "", x: point.x, y: point.y });
      flash("Draft pin added.");
      return;
    }
  }

  if (!target) return;
  const targetId = target.dataset.visualizerTargetId ?? "";
  const clickConfig = spec.interactions?.click?.[targetId];
  if (!clickConfig) return;

  runtimeState.selectedPanelId = clickConfig.panel;
  const svg = stageElement.querySelector<SVGSVGElement>("svg");
  if (svg) {
    applySvgHighlights(svg, clickConfig.highlight ?? [targetId]);
  }
  renderApp();
}

function findChartPoint(spec: ChartSpec, pointId: string): { id: string; label?: string } | undefined {
  for (const dataset of spec.data.datasets) {
    const point = dataset.points.find((entry) => entry.id === pointId);
    if (point) return point;
  }
  return undefined;
}

function handleChartClick(event: MouseEvent, spec: ChartSpec): void {
  if (!runtimeState?.chartInstance || !stageElement) return;
  if (runtimeState.suppressNextClick) {
    runtimeState.suppressNextClick = false;
    return;
  }

  const matches = runtimeState.chartInstance.getElementsAtEventForMode(event, "nearest", { intersect: true }, true);
  if (!matches.length) {
    if (runtimeState.annotateMode && runtimeState.annotationState.allowsCanvas()) {
      const point = toNormalizedPoint(stageElement.getBoundingClientRect(), event.clientX, event.clientY);
      addAnnotationDraft({ kind: "pin", text: "", x: point.x, y: point.y });
      flash("Draft pin added.");
    }
    return;
  }

  const match = matches[0];
  const pointId = getChartPointIdAtIndex(spec, runtimeState.activeViewId, match.datasetIndex, match.index);
  const point = pointId ? findChartPoint(spec, pointId) : undefined;

  if (runtimeState.annotateMode) {
    if (pointId && runtimeState.annotationState.allowsElements()) {
      addAnnotationDraft({
        targetId: pointId,
        targetLabel: point?.label ?? pointId,
        kind: "highlight",
        text: "",
      });
      flash("Draft annotation added.");
      return;
    }

    if (runtimeState.annotationState.allowsCanvas()) {
      const pin = toNormalizedPoint(stageElement.getBoundingClientRect(), event.clientX, event.clientY);
      addAnnotationDraft({ kind: "pin", text: "", x: pin.x, y: pin.y });
      flash("Draft pin added.");
      return;
    }
  }

  if (!pointId) return;
  const click = spec.interactions?.click?.[pointId];
  if (click?.panel) {
    runtimeState.selectedPanelId = click.panel;
    renderApp();
  }
}

async function renderMermaidStage(container: HTMLElement, spec: MermaidSpec): Promise<void> {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  container.innerHTML = await renderMermaidSpec(spec, uid);
  const svgRoot = container.querySelector<SVGSVGElement>("svg");
  if (!svgRoot) return;

  applyHoverTooltips(spec, svgRoot);
  const activeView = spec.interactions?.views?.find((view) => view.id === runtimeState?.activeViewId);
  applySvgVisibility(svgRoot, activeView?.show, activeView?.hide);

  const highlight = [
    ...(activeView?.highlight ?? []),
    ...resolveStepHighlight(spec, runtimeState?.activeStepId),
  ];
  if (highlight.length) applySvgHighlights(svgRoot, highlight);

  wireSvgTooltip(container);
}

function renderCustomStage(container: HTMLElement, spec: CustomSpec): void {
  container.innerHTML = "";
  const svg = renderCustomScene(spec);
  applyHoverTooltips(spec, svg);
  container.appendChild(svg);

  const activeLayer = spec.interactions?.layers?.find((layer) => layer.id === runtimeState?.activeLayerId);
  applySvgVisibility(svg, activeLayer?.show, activeLayer?.hide);

  const highlight = resolveStepHighlight(spec, runtimeState?.activeStepId);
  if (highlight.length) applySvgHighlights(svg, highlight);

  wireSvgTooltip(container);
}

function renderChartStage(container: HTMLElement, spec: ChartSpec): void {
  container.innerHTML = "";
  const shell = document.createElement("div");
  shell.className = "viz-chart-shell";
  const canvas = document.createElement("canvas");
  shell.appendChild(canvas);
  container.appendChild(shell);
  destroyChart();
  runtimeState!.chartInstance = renderChart(canvas, spec, runtimeState?.activeViewId);
  canvas.addEventListener("click", (event) => handleChartClick(event, spec));
}

async function renderStage(container: HTMLElement): Promise<void> {
  if (!runtimeState) return;
  const spec = runtimeState.spec;

  container.innerHTML = "";
  stageTooltip = null;

  if (!spec) {
    const shell = document.createElement("div");
    shell.className = "viz-stream-shell";
    shell.innerHTML = `<div class="viz-stream-shell__phase">${runtimeState.streamPhase ?? "shell"}</div><div class="viz-stream-shell__message">${runtimeState.streamMessage ?? "Building visualization…"}</div>`;
    container.appendChild(shell);
    return;
  }

  if (spec.kind === "mermaid") {
    await renderMermaidStage(container, spec);
    stageTooltip = document.createElement("div");
    stageTooltip.className = "viz-stage-tooltip";
    container.appendChild(stageTooltip);
    container.addEventListener("click", (event) => handleSvgClick(event, spec));
    return;
  }

  if (spec.kind === "chart") {
    renderChartStage(container, spec);
    return;
  }

  renderCustomStage(container, spec);
  stageTooltip = document.createElement("div");
  stageTooltip.className = "viz-stage-tooltip";
  container.appendChild(stageTooltip);
  container.addEventListener("click", (event) => handleSvgClick(event, spec));
}

function setActiveAxisState(axis: "view" | "layer" | "step", id: string): void {
  if (!runtimeState) return;
  if (axis === "view") {
    runtimeState.activeViewId = id;
  } else if (axis === "layer") {
    runtimeState.activeLayerId = id;
  } else {
    runtimeState.activeStepId = id;
  }
  renderApp();
}

function createFallbackAxisControls(axis: "view" | "layer"): HTMLElement | null {
  if (!runtimeState?.spec) return null;
  const options = axis === "layer" && runtimeState.spec.kind === "custom"
    ? runtimeState.spec.interactions?.layers?.map((layer) => ({ id: layer.id, label: layer.label })) ?? []
    : axis === "view" && runtimeState.spec.kind !== "custom"
      ? runtimeState.spec.interactions?.views?.map((view) => ({ id: view.id, label: view.label })) ?? []
      : [];
  if (!options.length) return null;

  const row = document.createElement("div");
  row.className = "viz-chip-row";

  for (const option of options) {
    const button = document.createElement("button");
    button.type = "button";
    const isActive = axis === "layer"
      ? runtimeState.activeLayerId === option.id
      : runtimeState.activeViewId === option.id;
    button.className = `viz-chip ${isActive ? "is-active" : ""}`;
    button.textContent = option.label;
    button.addEventListener("click", () => setActiveAxisState(axis, option.id));
    row.appendChild(button);
  }

  return row;
}

function createControlsSection(): HTMLElement | null {
  if (!runtimeState?.spec) return null;

  const container = document.createElement("div");
  container.className = "viz-controls-stack";
  let hasContent = false;

  const declarativeControls = createControlRow(
    {
      controls: runtimeState.spec.controls ?? [],
      getActiveStateId: (axis) => axis === "view"
        ? runtimeState?.activeViewId
        : axis === "layer"
          ? runtimeState?.activeLayerId
          : runtimeState?.activeStepId,
    },
    {
      onActivate: (axis, id) => setActiveAxisState(axis, id),
    },
  );
  if (declarativeControls) {
    container.appendChild(declarativeControls);
    hasContent = true;
  }

  if (runtimeState.spec.kind === "custom") {
    if (!hasExplicitControlForAxis(runtimeState.spec.controls, "layer")) {
      const fallback = createFallbackAxisControls("layer");
      if (fallback) {
        container.appendChild(fallback);
        hasContent = true;
      }
    }
  } else if (!hasExplicitControlForAxis(runtimeState.spec.controls, "view")) {
    const fallback = createFallbackAxisControls("view");
    if (fallback) {
      container.appendChild(fallback);
      hasContent = true;
    }
  }

  return hasContent ? container : null;
}

function createAnnotationRegionPreview(): HTMLElement {
  const preview = document.createElement("div");
  preview.className = "viz-region-preview";
  return preview;
}

function wireAnnotationGestures(container: HTMLElement): void {
  container.addEventListener("pointerdown", (event) => {
    if (!runtimeState?.annotateMode || !runtimeState.annotationState.allowsCanvas()) return;
    dragStart = { clientX: event.clientX, clientY: event.clientY };
    dragPreview = createAnnotationRegionPreview();
    container.appendChild(dragPreview);
  });

  container.addEventListener("pointermove", (event) => {
    if (!dragStart || !dragPreview) return;
    const bounds = container.getBoundingClientRect();
    const left = Math.min(dragStart.clientX, event.clientX) - bounds.left;
    const top = Math.min(dragStart.clientY, event.clientY) - bounds.top;
    const width = Math.abs(event.clientX - dragStart.clientX);
    const height = Math.abs(event.clientY - dragStart.clientY);
    Object.assign(dragPreview.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    });
  });

  container.addEventListener("pointerup", (event) => {
    if (!dragStart) return;
    const bounds = container.getBoundingClientRect();
    const width = Math.abs(event.clientX - dragStart.clientX);
    const height = Math.abs(event.clientY - dragStart.clientY);
    dragPreview?.remove();
    dragPreview = null;

    if (runtimeState?.annotateMode && (width > 18 || height > 18)) {
      const region = toNormalizedRegion(bounds, dragStart, { clientX: event.clientX, clientY: event.clientY });
      runtimeState.suppressNextClick = true;
      window.setTimeout(() => {
        if (runtimeState) runtimeState.suppressNextClick = false;
      }, 0);
      addAnnotationDraft({ kind: "region-note", text: "", ...region });
      flash("Draft region added.");
    }

    dragStart = null;
  });

  container.addEventListener("pointerleave", () => {
    dragPreview?.remove();
    dragPreview = null;
    dragStart = null;
    clearStageTooltip();
  });
}

async function copySpec(): Promise<void> {
  if (!runtimeState?.spec) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(runtimeState.spec, null, 2));
    flash("Spec copied to clipboard.");
  } catch (error) {
    flash(error instanceof Error ? error.message : "Clipboard write failed.", "error");
  }
}

async function requestFullscreen(): Promise<void> {
  await app.requestDisplayMode({ mode: "fullscreen" }).catch(() => {
    flash("Fullscreen request failed.", "error");
  });
}

async function submitAnnotations(): Promise<void> {
  if (!runtimeState?.spec) return;
  const payload = runtimeState.annotationState.buildSubmission({
    visualizationId: runtimeState.spec.id,
    title: runtimeState.spec.title,
    viewId: runtimeState.spec.kind === "custom" ? runtimeState.activeLayerId : runtimeState.activeViewId,
    stepId: runtimeState.activeStepId,
  }) as unknown as Record<string, unknown>;

  if (runtimeState.streamId && typeof runtimeState.expectedSequence === "number") {
    payload.streamId = runtimeState.streamId;
    payload.sequence = Math.max(0, runtimeState.expectedSequence - 1);
  }

  parseAnnotationSubmission(payload);
  const result = await app.sendMessage({
    role: "user",
    content: [
      {
        type: "text",
        text: `visualization_annotations_submitted\n${JSON.stringify(payload)}`,
      },
    ],
  }).catch((error) => ({ isError: true, error: error instanceof Error ? error.message : String(error) }));

  if (result?.isError) {
    const errorMessage = typeof result.error === "string" ? result.error : "Failed to send annotations to the agent.";
    flash(errorMessage, "error");
    return;
  }

  flash("Annotations sent to the agent.");
  runtimeState.annotateMode = false;
  runtimeState.annotationState.clear();
  renderApp();
}

async function renderApp(): Promise<void> {
  if (!runtimeState) return;
  const currentRenderVersion = ++renderVersion;
  clearStageTooltip();

  const shell = ensureShell();
  const spec = runtimeState.spec;
  const chrome = spec ? resolveVisualizationChrome(spec) : { panelLayout: "side", density: "comfortable" };
  if (spec) {
    updatePanelFromStep(spec);
  }

  root.dataset.density = chrome.density;
  root.dataset.panelLayout = chrome.panelLayout;
  shell.layout.className = `viz-layout viz-layout--${chrome.panelLayout}`;

  const gallery = createGalleryStrip();
  shell.gallery.replaceChildren(...(gallery ? [gallery] : []));

  shell.toolbar.replaceChildren(createToolbar(
    {
      title: spec?.title ?? "Interactive visualizer",
      subtitle: spec?.subtitle ?? runtimeState.streamMessage,
      annotateEnabled: !!spec && runtimeState.annotationState.isEnabled(),
      annotateActive: runtimeState.annotateMode,
    },
    {
      onToggleAnnotate: () => {
        if (!runtimeState?.spec) return;
        runtimeState.annotateMode = !runtimeState.annotateMode;
        renderApp();
      },
      onCopySpec: () => void copySpec(),
      onRequestFullscreen: () => void requestFullscreen(),
    },
  ));

  const controls = createControlsSection();
  shell.controls.replaceChildren(...(controls ? [controls] : []));

  const metrics = spec?.kind === "chart"
    ? createMetricStrip(resolveChartSummaryMetrics(spec, runtimeState.activeViewId))
    : null;
  shell.metrics.replaceChildren(...(metrics ? [metrics] : []));

  stageElement = shell.stage;
  stageElement.className = `viz-stage ${runtimeState.annotateMode ? "is-annotating" : ""}`;
  if (stageElement.dataset.annotationGestures !== "true") {
    wireAnnotationGestures(stageElement);
    stageElement.dataset.annotationGestures = "true";
  }

  if (!spec || spec.kind !== "chart") {
    destroyChart();
  }

  await renderStage(stageElement);
  if (currentRenderVersion !== renderVersion) {
    return;
  }

  const steps = spec && !hasExplicitControlForAxis(spec.controls, "step")
    ? createStepper(getActiveSteps(spec), runtimeState.activeStepId, (id) => {
        setActiveAxisState("step", id);
      })
    : null;
  shell.stepper.replaceChildren(...(steps ? [steps] : []));

  const messageText = runtimeState.serverMessage ?? runtimeState.streamMessage;
  if (messageText) {
    const serverMessage = document.createElement("div");
    serverMessage.className = "viz-server-message";
    serverMessage.textContent = messageText;
    shell.serverMessage.replaceChildren(serverMessage);
  } else {
    shell.serverMessage.replaceChildren();
  }

  const sidePanel = createSidePanel(spec
    ? resolvePanel(spec, runtimeState.selectedPanelId)
    : {
        title: runtimeState.streamPhase ? `Phase: ${runtimeState.streamPhase}` : "Preparing visualization",
        body: runtimeState.streamMessage ?? "Waiting for streamed visualization data.",
      });
  shell.panel.replaceChildren(sidePanel);
  shell.annotation.replaceChildren(createAnnotationPanel(runtimeState.annotationState.list(), {
    onEdit: (id, text) => {
      runtimeState?.annotationState.update(id, { text });
    },
    onDelete: (id) => {
      runtimeState?.annotationState.remove(id);
      renderApp();
    },
    onSubmit: () => { void submitAnnotations(); },
    onClear: () => {
      runtimeState?.annotationState.clear();
      renderApp();
    },
  }));
}

function readTextContent(content: unknown[] | undefined): string {
  return (content ?? [])
    .map((entry: unknown) => (entry && typeof entry === "object" && "text" in entry ? String((entry as { text?: string }).text ?? "") : ""))
    .filter(Boolean)
    .join("\n");
}

function applyStreamResult(result: { content?: unknown[]; structuredContent?: Record<string, unknown>; isError?: boolean }): void {
  if (!runtimeState) return;
  const envelope = getVisualizationStreamEnvelope(result.structuredContent);
  const text = readTextContent(result.content);

  if (text) {
    runtimeState.serverMessage = text;
  }

  if (!envelope) {
    if (result.isError && text) {
      flash(text, "error");
    }
    void renderApp();
    return;
  }

  if (runtimeState.streamId && envelope.streamId !== runtimeState.streamId) {
    return;
  }
  if (!runtimeState.streamId) {
    runtimeState.streamId = envelope.streamId;
  }

  const expectedSequence = runtimeState.expectedSequence ?? 0;
  if (envelope.sequence < expectedSequence) {
    return;
  }
  if (envelope.sequence > expectedSequence && envelope.frameType === "patch") {
    runtimeState.streamStatus = "loading";
    runtimeState.streamMessage = "Stream gap detected. Waiting for recovery frame.";
    void renderApp();
    return;
  }

  runtimeState.expectedSequence = envelope.sequence + 1;
  runtimeState.streamPhase = envelope.phase;
  runtimeState.streamStatus = envelope.status;
  runtimeState.streamMessage = (envelope.message ?? text) || runtimeState.streamMessage;

  if (envelope.checkpoint) {
    runtimeState.streamDraft = mergeStreamDraft(undefined, envelope.checkpoint);
  } else if (envelope.spec) {
    runtimeState.streamDraft = mergeStreamDraft(runtimeState.streamDraft, envelope.spec);
  }

  const parsedSpec = tryParseVisualizationDraft(runtimeState.streamDraft);
  if (parsedSpec) {
    applyResolvedSpec(parsedSpec);
  }

  if (envelope.status === "error" && runtimeState.streamMessage) {
    flash(runtimeState.streamMessage, "error");
  }

  void renderApp();
}

app.ontoolinput = async ({ arguments: args }) => {
  console.log("[visualizer] ontoolinput received:", args);
  try {
    const streamContext = getUiStreamHostContext(app.getHostContext());
    runtimeState = streamContext?.mode === "stream-first"
      ? bootStreamState()
      : bootFromArgs(args ?? {});
    await renderApp();
  } catch (error) {
    console.error("[visualizer] ontoolinput error:", error);
    flash(error instanceof Error ? error.message : String(error), "error");
  }
};

app.setNotificationHandler(uiStreamResultPatchNotificationSchema, (notification) => {
  applyStreamResult(notification.params);
});

app.ontoolresult = (result) => {
  applyStreamResult(result);
};

app.ontoolcancelled = ({ reason }) => {
  if (!runtimeState) return;
  const message = reason || "Streaming was cancelled.";
  runtimeState.streamStatus = "cancelled";
  runtimeState.streamMessage = message;
  flash(message, "error");
  void renderApp();
};

void app.connect(new PostMessageTransport(window.parent, window.parent)).then(() => {
  console.log("[visualizer] Connected to host");
  if (!runtimeState && getUiStreamHostContext(app.getHostContext())?.mode === "stream-first") {
    runtimeState = bootStreamState();
    return renderApp();
  }
  return undefined;
}).catch((err) => {
  console.error("[visualizer] Connection failed:", err);
});
