import type { Page } from "playwright";

import { createRequire } from "node:module";

// A4 width less the 16mm margins on each side, in CSS pixels.
const PRINTABLE_WIDTH = ((210 - 32) / 25.4) * 96;

export async function renderDiagrams(page: Page): Promise<void> {
  if ((await page.locator(".mermaid").count()) === 0) return;

  const require = createRequire(import.meta.url);
  await page.addScriptTag({ path: require.resolve("pele/global") });
  await page.evaluate(async (printableWidth) => {
    await document.fonts.ready;
    for (const [index, element] of [
      ...document.querySelectorAll<HTMLElement>(".mermaid"),
    ].entries()) {
      try {
        const { svg } = pele.render(element.textContent ?? "", {
          idPrefix: `diagram-${index}`,
          fontFamily: getComputedStyle(element).fontFamily,
          maxWidth: Math.min(element.clientWidth, printableWidth),
          autoDirection: false,
        });
        element.innerHTML = svg;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Mermaid diagram ${index + 1} could not be rendered: ${message}`);
      }
    }
  }, PRINTABLE_WIDTH);
}

declare global {
  const pele: {
    render(
      source: string,
      options: { idPrefix: string; fontFamily: string; maxWidth: number; autoDirection: boolean },
    ): { svg: string };
  };
}
