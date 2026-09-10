import { DEMO_ASSETS } from '@/components/app/demo-data';
import { ENSV2_SEPOLIA } from '@/lib/ensv2-config';
import { isDemoAssetSubject, runQuartetStream, type QuartetEvent } from '@/lib/agents/runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MARKET_IDS = new Set(DEMO_ASSETS.flatMap((a) => (a.marketId ? [a.marketId] : [])));

function send(controller: ReadableStreamDefaultController, payload: unknown) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`));
}

export async function GET(request: Request) {
  const subject = new URL(request.url).searchParams.get('subject')?.trim() ?? '';
  const isDemo = subject ? isDemoAssetSubject(subject) : false;
  if (!subject || (!isDemo && !MARKET_IDS.has(subject))) {
    return new Response('data: {"kind":"error","label":"Invalid subject"}\n\n', {
      status: 400,
      headers: { 'content-type': 'text/event-stream' },
    });
  }
  const resolved = isDemo ? ENSV2_SEPOLIA.names.asset : subject;

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: Omit<QuartetEvent, 't'>) =>
        send(controller, { ...event, t: new Date().toISOString() });
      try {
        const run = await runQuartetStream(resolved, false, emit);
        send(controller, { kind: 'result', t: new Date().toISOString(), run });
      } catch (error) {
        send(controller, {
          kind: 'error',
          t: new Date().toISOString(),
          label: 'Inspection failed',
          detail: error instanceof Error ? error.message : 'Unknown failure',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    },
  });
}
