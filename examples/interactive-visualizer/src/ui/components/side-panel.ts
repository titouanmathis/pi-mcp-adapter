/**
 * Content shown in the right-hand narrative panel.
 */
export interface SidePanelState {
  title: string;
  body: string;
  insights?: string[];
}

/**
 * Render the narrative side panel.
 */
export function createSidePanel(state: SidePanelState): HTMLElement {
  const panel = document.createElement("aside");
  panel.className = "viz-side-panel";

  const title = document.createElement("h2");
  title.className = "viz-side-panel__title";
  title.textContent = state.title;
  panel.appendChild(title);

  const body = document.createElement("div");
  body.className = "viz-side-panel__body";
  for (const paragraph of state.body.split(/\n{2,}/)) {
    const p = document.createElement("p");
    p.textContent = paragraph.trim();
    body.appendChild(p);
  }
  panel.appendChild(body);

  if (state.insights?.length) {
    const insights = document.createElement("div");
    insights.className = "viz-side-panel__insights";

    const label = document.createElement("h3");
    label.textContent = "Key takeaways";
    insights.appendChild(label);

    const list = document.createElement("ul");
    for (const entry of state.insights) {
      const item = document.createElement("li");
      item.textContent = entry;
      list.appendChild(item);
    }
    insights.appendChild(list);
    panel.appendChild(insights);
  }

  return panel;
}
