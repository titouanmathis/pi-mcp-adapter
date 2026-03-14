import type { CustomSpec } from "../schema.js";

function svgNode<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
  return document.createElementNS("http://www.w3.org/2000/svg", name);
}

/**
 * Render a structured scene into an SVG element.
 */
export function renderCustomScene(spec: CustomSpec): SVGSVGElement {
  if (!spec.scene) {
    const host = document.createElement("div");
    host.innerHTML = spec.svg ?? "";
    const root = host.querySelector("svg");
    if (!root) {
      throw new Error("Custom visualization did not provide renderable SVG content.");
    }
    root.querySelectorAll<SVGElement>("[id]").forEach((element) => {
      element.setAttribute("data-visualizer-target-id", element.getAttribute("id") ?? "");
      element.classList.add("viz-target");
    });
    return root;
  }

  const root = svgNode("svg");
  root.setAttribute("viewBox", `0 0 ${spec.scene.width} ${spec.scene.height}`);
  root.setAttribute("width", "100%");
  root.setAttribute("height", "100%");
  root.setAttribute("role", "img");
  root.setAttribute("aria-label", spec.title ?? "Custom visualization");
  root.style.background = spec.scene.background ?? "transparent";

  for (const element of spec.scene.elements) {
    let node: SVGElement;
    let overlayText: SVGTextElement | null = null;

    if (element.kind === "rect") {
      const rect = svgNode("rect");
      rect.setAttribute("x", String(element.x));
      rect.setAttribute("y", String(element.y));
      rect.setAttribute("width", String(element.width));
      rect.setAttribute("height", String(element.height));
      if (element.rx) rect.setAttribute("rx", String(element.rx));
      if (element.fill) rect.setAttribute("fill", element.fill);
      if (element.stroke) rect.setAttribute("stroke", element.stroke);
      if (element.strokeWidth) rect.setAttribute("stroke-width", String(element.strokeWidth));
      node = rect;

      if (element.text) {
        overlayText = svgNode("text");
        overlayText.setAttribute("x", String(element.x + element.width / 2));
        overlayText.setAttribute("y", String(element.y + element.height / 2 + (element.fontSize ?? 18) / 3));
        overlayText.setAttribute("text-anchor", "middle");
        overlayText.setAttribute("font-family", "Plus Jakarta Sans");
        overlayText.setAttribute("font-size", String(element.fontSize ?? 18));
        overlayText.setAttribute("fill", element.textColor ?? "#27363d");
        overlayText.textContent = element.text;
        overlayText.setAttribute("data-visualizer-target-id", element.id);
        overlayText.setAttribute("data-visualizer-target-label", element.label ?? element.text);
        overlayText.classList.add("viz-target");
        if (element.layer) overlayText.setAttribute("data-layer-id", element.layer);
      }
    } else if (element.kind === "circle") {
      const circle = svgNode("circle");
      circle.setAttribute("cx", String(element.cx));
      circle.setAttribute("cy", String(element.cy));
      circle.setAttribute("r", String(element.r));
      if (element.fill) circle.setAttribute("fill", element.fill);
      if (element.stroke) circle.setAttribute("stroke", element.stroke);
      if (element.strokeWidth) circle.setAttribute("stroke-width", String(element.strokeWidth));
      node = circle;
    } else if (element.kind === "line") {
      const line = svgNode("line");
      line.setAttribute("x1", String(element.x1));
      line.setAttribute("y1", String(element.y1));
      line.setAttribute("x2", String(element.x2));
      line.setAttribute("y2", String(element.y2));
      if (element.stroke) line.setAttribute("stroke", element.stroke);
      if (element.strokeWidth) line.setAttribute("stroke-width", String(element.strokeWidth));
      if (element.dash) line.setAttribute("stroke-dasharray", element.dash);
      node = line;
    } else {
      const text = svgNode("text");
      text.setAttribute("x", String(element.x));
      text.setAttribute("y", String(element.y));
      text.setAttribute("font-family", "Plus Jakarta Sans");
      text.setAttribute("font-size", String(element.fontSize ?? 18));
      text.setAttribute("fill", element.fill ?? "#2c3b42");
      text.setAttribute("text-anchor", element.align ?? "start");
      text.setAttribute("font-weight", element.fontWeight ?? "normal");
      text.textContent = element.text;
      node = text;
    }

    node.setAttribute("id", element.id);
    node.setAttribute("data-visualizer-target-id", element.id);
    if (element.label) node.setAttribute("data-visualizer-target-label", element.label);
    node.classList.add("viz-target");
    if (element.layer) node.setAttribute("data-layer-id", element.layer);
    root.appendChild(node);

    if (overlayText) {
      root.appendChild(overlayText);
    }
  }

  return root;
}
