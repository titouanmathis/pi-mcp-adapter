import type { AnnotationConfig, VisualizationAnnotationSubmission } from "../schema.js";

/**
 * Local annotation draft stored inside the UI before submission.
 */
export interface AnnotationDraft {
  id: string;
  targetId?: string;
  targetLabel?: string;
  kind: "pin" | "highlight" | "region-note";
  text: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/**
 * Local annotation state manager for the visualizer UI.
 */
export class AnnotationState {
  private annotations = new Map<string, AnnotationDraft>();

  constructor(private config: AnnotationConfig | undefined) {}

  setConfig(config: AnnotationConfig | undefined): void {
    this.config = config;
  }

  isEnabled(): boolean {
    return !!this.config?.enabled;
  }

  allowsCanvas(): boolean {
    return this.config?.targetMode === "canvas" || this.config?.targetMode === "elements-and-canvas" || !this.config?.targetMode;
  }

  allowsElements(): boolean {
    return this.config?.targetMode === "elements" || this.config?.targetMode === "elements-and-canvas" || !this.config?.targetMode;
  }

  list(): AnnotationDraft[] {
    return [...this.annotations.values()];
  }

  add(draft: Omit<AnnotationDraft, "id"> & { id?: string }): AnnotationDraft {
    const id = draft.id ?? `annotation_${Math.random().toString(36).slice(2, 10)}`;
    const entry: AnnotationDraft = { ...draft, id };
    this.annotations.set(id, entry);
    return entry;
  }

  update(id: string, patch: Partial<AnnotationDraft>): AnnotationDraft | undefined {
    const current = this.annotations.get(id);
    if (!current) return undefined;
    const next = { ...current, ...patch, id };
    this.annotations.set(id, next);
    return next;
  }

  remove(id: string): void {
    this.annotations.delete(id);
  }

  clear(): void {
    this.annotations.clear();
  }

  buildSubmission(meta: { visualizationId?: string; title?: string; viewId?: string; stepId?: string }): VisualizationAnnotationSubmission {
    return {
      visualizationId: meta.visualizationId,
      title: meta.title,
      viewId: meta.viewId,
      stepId: meta.stepId,
      annotations: this.list().map((annotation) => ({
        id: annotation.id,
        targetId: annotation.targetId,
        targetLabel: annotation.targetLabel,
        kind: annotation.kind,
        text: annotation.text,
        x: annotation.x,
        y: annotation.y,
        width: annotation.width,
        height: annotation.height,
      })),
    };
  }
}

/**
 * Convert a pointer location into normalized 0..1 coordinates.
 */
export function toNormalizedPoint(bounds: DOMRect, clientX: number, clientY: number): { x: number; y: number } {
  const x = bounds.width > 0 ? (clientX - bounds.left) / bounds.width : 0;
  const y = bounds.height > 0 ? (clientY - bounds.top) / bounds.height : 0;
  return {
    x: Math.max(0, Math.min(1, Number(x.toFixed(4)))),
    y: Math.max(0, Math.min(1, Number(y.toFixed(4)))),
  };
}

/**
 * Convert a dragged region into normalized 0..1 coordinates.
 */
export function toNormalizedRegion(
  bounds: DOMRect,
  start: { clientX: number; clientY: number },
  end: { clientX: number; clientY: number },
): { x: number; y: number; width: number; height: number } {
  const left = Math.min(start.clientX, end.clientX);
  const top = Math.min(start.clientY, end.clientY);
  const right = Math.max(start.clientX, end.clientX);
  const bottom = Math.max(start.clientY, end.clientY);
  const p1 = toNormalizedPoint(bounds, left, top);
  const p2 = toNormalizedPoint(bounds, right, bottom);
  return {
    x: p1.x,
    y: p1.y,
    width: Number(Math.max(0, p2.x - p1.x).toFixed(4)),
    height: Number(Math.max(0, p2.y - p1.y).toFixed(4)),
  };
}
