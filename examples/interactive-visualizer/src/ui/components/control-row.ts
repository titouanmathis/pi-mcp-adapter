import type { VisualizationControl } from "../../schema.js";

/**
 * Render-time control state resolver.
 */
export interface ControlRowState {
  controls: VisualizationControl[];
  getActiveStateId: (axis: "view" | "layer" | "step") => string | undefined;
}

/**
 * Control row callbacks.
 */
export interface ControlRowActions {
  onActivate: (axis: "view" | "layer" | "step", id: string) => void;
}

/**
 * Render declarative explainer controls.
 */
export function createControlRow(state: ControlRowState, actions: ControlRowActions): HTMLElement | null {
  if (!state.controls.length) return null;

  const row = document.createElement("div");
  row.className = "viz-control-row";

  for (const control of state.controls) {
    const section = document.createElement("section");
    section.className = "viz-control";

    const label = document.createElement("div");
    label.className = "viz-control__label";
    label.textContent = control.label;
    section.appendChild(label);

    if (control.kind === "segmented") {
      const options = document.createElement("div");
      options.className = "viz-control__segmented";
      const activeStateId = state.getActiveStateId(control.axis);

      for (const option of control.options) {
        const button = document.createElement("button");
        button.type = "button";
        const targetId = control.axis === "view" ? option.activatesViewId : option.activatesLayerId;
        const isActive = targetId === activeStateId;
        button.className = `viz-chip ${isActive ? "is-active" : ""}`;
        button.textContent = option.label;
        button.addEventListener("click", () => {
          if (targetId) actions.onActivate(control.axis, targetId);
        });
        options.appendChild(button);
      }

      section.appendChild(options);
      row.appendChild(section);
      continue;
    }

    const orderedSteps = [...control.steps].sort((left, right) => left.value - right.value);
    const activeStateId = state.getActiveStateId(control.axis);
    const activeIndex = Math.max(0, orderedSteps.findIndex((step) => resolveStepTarget(control.axis, step) === activeStateId));

    const current = document.createElement("div");
    current.className = "viz-control__current";
    current.textContent = orderedSteps[activeIndex]?.label ?? orderedSteps[0]?.label ?? "";
    section.appendChild(current);

    const input = document.createElement("input");
    input.className = "viz-control__range";
    input.type = "range";
    input.min = "0";
    input.max = String(Math.max(0, orderedSteps.length - 1));
    input.step = "1";
    input.value = String(activeIndex);
    input.addEventListener("input", () => {
      const next = orderedSteps[Number(input.value)] ?? orderedSteps[0];
      const targetId = next ? resolveStepTarget(control.axis, next) : undefined;
      current.textContent = next?.label ?? "";
      if (targetId) actions.onActivate(control.axis, targetId);
    });
    section.appendChild(input);

    const ticks = document.createElement("div");
    ticks.className = "viz-control__ticks";
    for (const step of orderedSteps) {
      const tick = document.createElement("span");
      tick.textContent = step.label;
      ticks.appendChild(tick);
    }
    section.appendChild(ticks);

    row.appendChild(section);
  }

  return row;
}

function resolveStepTarget(
  axis: "view" | "layer" | "step",
  step: { activatesViewId?: string; activatesLayerId?: string; activatesStepId?: string },
): string | undefined {
  if (axis === "view") return step.activatesViewId;
  if (axis === "layer") return step.activatesLayerId;
  return step.activatesStepId;
}
