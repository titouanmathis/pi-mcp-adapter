import mermaid from "mermaid";
import type { MermaidSpec } from "../schema.js";
import { extractMermaidTargetIds } from "../schema.js";

let initialized = false;

function ensureMermaid(): void {
  if (initialized) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    themeVariables: {
      primaryColor: "#edf3f4",
      primaryTextColor: "#20323b",
      primaryBorderColor: "#5b7d86",
      lineColor: "#6f848b",
      secondaryColor: "#f4f7f8",
      tertiaryColor: "#f8fafb",
      fontFamily: '"Plus Jakarta Sans", sans-serif',
    },
  });
  initialized = true;
}

function normalizeTargetId(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

function resolveTargetElement(root: SVGSVGElement, logicalId: string): SVGGraphicsElement | null {
  const exact = root.querySelector<SVGGraphicsElement>(`#${CSS.escape(logicalId)}`);
  if (exact) return exact;

  const normalizedTarget = normalizeTargetId(logicalId);
  const candidates = Array.from(root.querySelectorAll<SVGGraphicsElement>("[id]"));
  for (const candidate of candidates) {
    const id = candidate.getAttribute("id") ?? "";
    const normalizedCandidate = normalizeTargetId(id);
    if (
      normalizedCandidate === normalizedTarget ||
      normalizedCandidate.endsWith(`-${normalizedTarget}`) ||
      normalizedCandidate.includes(`-${normalizedTarget}-`)
    ) {
      return candidate;
    }
  }

  return null;
}

/**
 * Render a Mermaid spec to SVG and tag interactive targets.
 */
export async function renderMermaidSpec(spec: MermaidSpec, uid: string): Promise<string> {
  ensureMermaid();
  const renderId = `visualizer-mermaid-${uid}`;
  const { svg } = await mermaid.render(renderId, spec.code);
  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = document.querySelector("svg") as SVGSVGElement | null;
  if (!root) {
    throw new Error("Mermaid did not return an SVG root element.");
  }

  for (const targetId of extractMermaidTargetIds(spec.code)) {
    const element = resolveTargetElement(root, targetId);
    if (!element) continue;
    element.setAttribute("data-visualizer-target-id", targetId);
    element.classList.add("viz-target");
    const label = element.querySelector("text")?.textContent?.trim();
    if (label) {
      element.setAttribute("data-visualizer-target-label", label);
    }
  }

  return root.outerHTML;
}
