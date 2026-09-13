import { readFileSync } from 'node:fs';
import { JsonRpcProvider } from 'ethers';
import { ENSV2_SEPOLIA as ENS } from '../lib/ensv2-config.ts';
import { verifyQuartetAuthorities } from '../lib/quartet-authorities.ts';

async function main() {
  const file = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('#') && line.includes('='))
    .map((line) => { const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]; }));
  const url = process.env.SEPOLIA_RPC_URL || file.SEPOLIA_RPC_URL;
  if (!url) throw new Error('SEPOLIA_RPC_URL is required');
  const provider = new JsonRpcProvider(url);
  try {
    if (Number((await provider.getNetwork()).chainId) !== ENS.chainId) throw new Error('RPC must be Sepolia');
    const proof = await verifyQuartetAuthorities(provider, process.argv[2] || 'buidl.rwa.verdict.eth');
    console.log(JSON.stringify(proof, null, 2));
    if (!proof.verified) throw new Error('Quartet live permission verification failed');
  } finally { provider.destroy(); }
}
main().catch((error) => {
  console.error(error instanceof Error && !('code' in error) ? error.message : 'Live quartet verification unavailable; no signer loaded or transactions sent.');
  process.exitCode = 1;
});
