// Run the supplied scroll-craft verifier against testing3's custom React scrubber.
// Only the readiness selector differs: this page does not mount the SC runtime.
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../../testing3/scroll-craft/plugins/nateherk-design/skills/scroll-craft/scripts/shoot.mjs', import.meta.url), 'utf8');
const adapted = source
  .replace('page.waitForSelector("html.sc-ready",', 'page.waitForSelector(".cosmic-page",')
  .replace('(v.closest("[data-sc-act]") ?? v).classList.contains("sc-has-clip")', 'v.readyState >= 2 && getComputedStyle(v).opacity === "1"');
await import(`data:text/javascript;base64,${Buffer.from(adapted).toString('base64')}`);
