import type { AnnotationDraft } from "../annotation-state.js";

/**
 * Annotation panel callbacks.
 */
export interface AnnotationPanelActions {
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}

/**
 * Render the annotation review panel.
 */
export function createAnnotationPanel(
  annotations: AnnotationDraft[],
  actions: AnnotationPanelActions,
): HTMLElement {
  const panel = document.createElement("aside");
  panel.className = "viz-annotation-panel";

  const header = document.createElement("div");
  header.className = "viz-annotation-panel__header";

  const title = document.createElement("h2");
  title.textContent = "Annotations";
  header.appendChild(title);

  const meta = document.createElement("span");
  meta.textContent = `${annotations.length} draft${annotations.length === 1 ? "" : "s"}`;
  header.appendChild(meta);

  panel.appendChild(header);

  const list = document.createElement("div");
  list.className = "viz-annotation-panel__list";

  if (!annotations.length) {
    const empty = document.createElement("p");
    empty.className = "viz-empty";
    empty.textContent = "Click a target or drag a region while annotate mode is on.";
    list.appendChild(empty);
  }

  for (const annotation of annotations) {
    const item = document.createElement("div");
    item.className = "viz-annotation-panel__item";

    const label = document.createElement("div");
    label.className = "viz-annotation-panel__label";
    label.textContent = annotation.targetLabel ?? annotation.targetId ?? annotation.kind;
    item.appendChild(label);

    const textarea = document.createElement("textarea");
    textarea.value = annotation.text;
    textarea.placeholder = "Describe what matters here";
    textarea.addEventListener("input", () => actions.onEdit(annotation.id, textarea.value));
    item.appendChild(textarea);

    const actionsRow = document.createElement("div");
    actionsRow.className = "viz-annotation-panel__actions";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "viz-button";
    remove.textContent = "Delete";
    remove.addEventListener("click", () => actions.onDelete(annotation.id));
    actionsRow.appendChild(remove);

    item.appendChild(actionsRow);
    list.appendChild(item);
  }

  panel.appendChild(list);

  const footer = document.createElement("div");
  footer.className = "viz-annotation-panel__footer";

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "viz-button";
  clear.textContent = "Clear drafts";
  clear.disabled = annotations.length === 0;
  clear.addEventListener("click", actions.onClear);
  footer.appendChild(clear);

  const submit = document.createElement("button");
  submit.type = "button";
  submit.className = "viz-button viz-button--accent";
  submit.textContent = "Send to agent";
  submit.disabled = annotations.length === 0 || annotations.some((annotation) => !annotation.text.trim());
  submit.addEventListener("click", actions.onSubmit);
  footer.appendChild(submit);

  panel.appendChild(footer);
  return panel;
}
