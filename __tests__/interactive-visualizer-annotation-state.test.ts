import { describe, expect, it } from "vitest";
import { AnnotationState, toNormalizedPoint, toNormalizedRegion } from "../examples/interactive-visualizer/src/ui/annotation-state.ts";

describe("interactive visualizer annotation state", () => {
  it("stores drafts and builds a batched submission", () => {
    const state = new AnnotationState({ enabled: true, targetMode: "elements-and-canvas" });
    const draft = state.add({ targetId: "adapter", targetLabel: "Adapter", kind: "highlight", text: "Focus here" });
    state.add({ kind: "pin", text: "Also inspect this area", x: 0.25, y: 0.4 });
    state.update(draft.id, { text: "Focus here first" });

    const payload = state.buildSubmission({ visualizationId: "flow", title: "Flow review", viewId: "default" });
    expect(payload).toEqual({
      visualizationId: "flow",
      title: "Flow review",
      viewId: "default",
      stepId: undefined,
      annotations: [
        {
          id: draft.id,
          targetId: "adapter",
          targetLabel: "Adapter",
          kind: "highlight",
          text: "Focus here first",
          x: undefined,
          y: undefined,
          width: undefined,
          height: undefined,
        },
        expect.objectContaining({ kind: "pin", text: "Also inspect this area", x: 0.25, y: 0.4 }),
      ],
    });
  });

  it("normalizes points and regions into 0..1 space", () => {
    const bounds = {
      left: 100,
      top: 200,
      width: 400,
      height: 300,
    } as DOMRect;

    expect(toNormalizedPoint(bounds, 200, 350)).toEqual({ x: 0.25, y: 0.5 });
    expect(
      toNormalizedRegion(bounds, { clientX: 140, clientY: 230 }, { clientX: 340, clientY: 380 })
    ).toEqual({ x: 0.1, y: 0.1, width: 0.5, height: 0.5 });
  });
});
