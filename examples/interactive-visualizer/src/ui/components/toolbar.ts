/**
 * Toolbar callbacks used by the visualizer UI.
 */
export interface ToolbarActions {
  onToggleAnnotate: () => void;
  onCopySpec: () => void;
  onRequestFullscreen: () => void;
}

/**
 * Current toolbar state.
 */
export interface ToolbarState {
  title: string;
  subtitle?: string;
  annotateEnabled: boolean;
  annotateActive: boolean;
}

/**
 * Build the primary toolbar.
 */
export function createToolbar(state: ToolbarState, actions: ToolbarActions): HTMLElement {
  const toolbar = document.createElement("div");
  toolbar.className = "viz-toolbar";

  const heading = document.createElement("div");
  heading.className = "viz-toolbar__heading";

  const title = document.createElement("h1");
  title.className = "viz-toolbar__title";
  title.textContent = state.title;
  heading.appendChild(title);

  if (state.subtitle) {
    const subtitle = document.createElement("p");
    subtitle.className = "viz-toolbar__subtitle";
    subtitle.textContent = state.subtitle;
    heading.appendChild(subtitle);
  }

  const controls = document.createElement("div");
  controls.className = "viz-toolbar__controls";

  const annotate = document.createElement("button");
  annotate.type = "button";
  annotate.className = `viz-button ${state.annotateActive ? "is-active" : ""}`;
  annotate.textContent = state.annotateActive ? "Exit annotate" : "Annotate";
  annotate.disabled = !state.annotateEnabled;
  annotate.addEventListener("click", actions.onToggleAnnotate);
  controls.appendChild(annotate);

  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "viz-button";
  copy.textContent = "Copy spec";
  copy.addEventListener("click", actions.onCopySpec);
  controls.appendChild(copy);

  const fullscreen = document.createElement("button");
  fullscreen.type = "button";
  fullscreen.className = "viz-button viz-button--accent";
  fullscreen.textContent = "Fullscreen";
  fullscreen.addEventListener("click", actions.onRequestFullscreen);
  controls.appendChild(fullscreen);

  toolbar.append(heading, controls);
  return toolbar;
}
