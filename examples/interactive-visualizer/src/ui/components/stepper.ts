/**
 * Stepper item shown under the visualization.
 */
export interface StepperItem {
  id: string;
  label: string;
}

/**
 * Render a local stepper control.
 */
export function createStepper(
  items: StepperItem[],
  activeId: string | undefined,
  onSelect: (id: string) => void,
): HTMLElement | null {
  if (!items.length) return null;

  const wrapper = document.createElement("div");
  wrapper.className = "viz-stepper";

  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `viz-stepper__button ${item.id === activeId ? "is-active" : ""}`;
    button.textContent = item.label;
    button.addEventListener("click", () => onSelect(item.id));
    wrapper.appendChild(button);
  }

  return wrapper;
}
