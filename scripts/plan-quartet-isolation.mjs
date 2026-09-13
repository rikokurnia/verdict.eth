// Read-only migration preflight. Never decrypts keystores or sends transactions.
import { existsSync, readFileSync } from 'node:fs';
import { Contract, JsonRpcProvider, formatEther, keccak256, toUtf8Bytes } from 'ethers';
import { ENSV2_SEPOLIA as config } from '../lib/ensv2-config.ts';

const ABI = [
  'function getStatus(uint256 anyId) view returns(uint8)',
  'function getResolver(string label) view returns(address)',
  'function findOwner(string label) view returns(address)',
  'function hasRoles(uint256 anyId,uint256 roleBitmap,address account) view returns(bool)',
];

function rpcUrl() {
  if (process.env.SEPOLIA_RPC_URL) return process.env.SEPOLIA_RPC_URL;
  if (!existsSync('.env.local')) throw new Error('SEPOLIA_RPC_URL is required');
  const line = readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .find((value) => /^SEPOLIA_RPC_URL\s*=/.test(value));
  if (!line) throw new Error('SEPOLIA_RPC_URL is required');
  return line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
}

async function main() {
  if (process.argv.includes('--apply')) throw new Error('This command is read-only; it cannot apply a migration.');
  const provider = new JsonRpcProvider(rpcUrl());
  try {
    if (Number((await provider.getNetwork()).chainId) !== config.chainId) throw new Error('RPC must be Ethereum Sepolia');
    const blockTag = await provider.getBlockNumber();
    const registry = new Contract(config.proxies.agentRegistry, ABI, provider);
    const identities = [];
    for (const role of ['legal', 'custody', 'technical', 'consensus']) {
      const id = BigInt(keccak256(toUtf8Bytes(role)));
      const [status, owner, resolver, canSetResolver] = await Promise.all([
        registry.getStatus(id, { blockTag }), registry.findOwner(role, { blockTag }),
        registry.getResolver(role, { blockTag }),
        registry.hasRoles(id, 1n << 24n, config.actors.namespaceOperator, { blockTag }),
      ]);
      identities.push({ role, name: config.names.agents[role], active: Number(status) === 2,
        owner, resolver, namespaceCanSetResolver: canSetResolver });
    }
    const [balance, fees] = await Promise.all([
      provider.getBalance(config.actors.namespaceOperator, blockTag), provider.getFeeData(),
    ]);
    const feeCap = fees.maxFeePerGas || fees.gasPrice;
    if (!feeCap) throw new Error('Sepolia fee data unavailable');
    // Deliberately conservative ceiling, not an estimateGas quote. Actual deployment
    // calldata depends on the new workers' public addresses, which are not created here.
    const conservativeGasUnits = 8_000_000n;
    const budget = conservativeGasUnits * feeCap;
    console.log(JSON.stringify({ mode: 'read-only', chainId: config.chainId, block: blockTag,
      identities, deployer: config.actors.namespaceOperator, deployerBalanceETH: formatEther(balance),
      conservativeGasUnits: conservativeGasUnits.toString(), conservativeBudgetETH: formatEther(budget),
      fundedForConservativeBudget: balance >= budget,
      nextSteps: [
        'Create two distinct encrypted worker keystores, Technical and Consensus, without logging secret material.',
        'Deploy two verified Permissioned Resolver proxies with exact attestation-key grants and no worker root write/admin/upgrade roles.',
        'Retain separate recovery administration; publish the team-operated/admin-redirection limitation.',
        'Verify allowed writes, arbitrary-key denial, issuer denial, and cross-worker denial before switching identity resolver pointers.',
        'Wire Technical inspector reports and Consensus synthesis to their respective signers; never fabricate historical evaluations.',
        'Expose dedicated resolver roles and confirmed publication hashes in the app, then test the Vercel build.',
      ],
      authorizationRequired: 'Explicit encrypted-keystore scripting approval for namespace deployment and the two new workers. ETH funding transfers require separate confirmation.',
      transactionsSent: 0, keystoresDecrypted: 0,
    }, null, 2));
    if (identities.some((identity) => !identity.active || !identity.namespaceCanSetResolver)) {
      throw new Error('An agent identity is inactive or cannot be migrated by the namespace operator; review before signing.');
    }
  } finally { provider.destroy(); }
}

main().catch((error) => {
  // Provider errors can contain credential-bearing RPC URLs. Only our own errors are public.
  console.error(error instanceof Error && !('code' in error)
    ? error.message : 'Quartet preflight failed; check Sepolia RPC availability. No signers loaded or transactions sent.');
  process.exitCode = 1;
});
