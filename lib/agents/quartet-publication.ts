import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Interface, Wallet, dnsEncode, keccak256, parseEther, toUtf8Bytes, type JsonRpcProvider } from 'ethers';
import { QUARTET_AUTHORITIES, verifyQuartetAuthorities } from '../quartet-authorities';
import { QUARTET_ROLES, quartetReportKey, type QuartetRole } from '../quartet-authority-policy';
import { validateInspectorReport, validateSynthesis, type QuartetRun } from './types';

export type AgentPublications = Record<QuartetRole, { hash: string; blockNumber: number; name: string; key: string }>;
type PublicationInput = Pick<QuartetRun, 'reports' | 'synthesis' | 'engines' | 'startedAt'>;
const iface = new Interface(['function setText(bytes name,string key,string value)']);

/** Publish actual reports, not four copies of a synthesized decision. Local-only.
 * All grants, calldata and signer budgets are checked before the first write.
 */
export async function publishQuartetReports(provider: JsonRpcProvider, assetName: string, run: PublicationInput, evidenceFingerprint: string): Promise<AgentPublications> {
  if (process.env.VERCEL) throw new Error('Protected quartet writes are local-operator only.');
  if (!run?.reports || !run.engines) throw new Error('Four-worker publication requires original inspector reports and engine provenance.');
  const proof = await verifyQuartetAuthorities(provider, assetName);
  if (!proof.verified) throw new Error('Quartet authority checks failed; no worker reports published.');
  const key = quartetReportKey(assetName);
  const sourceHash = keccak256(toUtf8Bytes(evidenceFingerprint));
  const fees = await provider.getFeeData();
  if (!fees.maxFeePerGas || fees.maxPriorityFeePerGas === null) throw new Error('Quartet publication fee data unavailable.');
  const prepared = [];
  let maximumCost = BigInt(0);
  for (const role of QUARTET_ROLES) {
    const a = QUARTET_AUTHORITIES[role];
    const report = role === 'consensus' ? validateSynthesis(run.synthesis) : validateInspectorReport(role, run.reports[role]);
    const engine = role === 'consensus' ? run.engines.synthesis : run.engines[role];
    const value = JSON.stringify({ schema: 'agent-report/1', subject: assetName, agent: role, worker: a.worker,
      runStartedAt: run.startedAt, sourceHash, engine, report });
    // Bound storage/gas use; never silently truncate an evaluation.
    if (toUtf8Bytes(value).length > 12_000) throw new Error(`${role} report exceeds the onchain publication size limit.`);
    const data = iface.encodeFunctionData('setText', [dnsEncode(a.name), key, value]);
    const tx = { from: a.worker, to: a.resolver, data, value: BigInt(0) };
    await provider.call(tx);
    const gasLimit = (await provider.estimateGas(tx)) * BigInt(12) / BigInt(10);
    const budget = gasLimit * fees.maxFeePerGas;
    if ((await provider.getBalance(a.worker)) < budget) throw new Error(`${role} worker needs Sepolia ETH: ${a.worker}. No quartet reports published.`);
    maximumCost += budget;
    prepared.push({ role, a, data, gasLimit });
  }
  if (maximumCost > parseEther('0.02')) throw new Error('Quartet publication exceeds the 0.02 ETH per-run gas ceiling.');
  const signed = [];
  for (const item of prepared) {
    const wallet = (await Wallet.fromEncryptedJson(readFileSync(join(process.cwd(), '.secrets', item.a.keystore), 'utf8'),
      readFileSync(join(process.cwd(), '.secrets', `${item.a.keystore}.password`), 'utf8').trim())).connect(provider);
    if (wallet.address.toLowerCase() !== item.a.worker.toLowerCase()) throw new Error(`Wrong ${item.role} encrypted worker; no reports published.`);
    signed.push({ ...item, wallet });
  }
  const publications = {} as AgentPublications;
  let pendingHash: string | undefined;
  try {
    for (const item of signed) {
      const tx = await item.wallet.sendTransaction({ to: item.a.resolver, data: item.data, value: BigInt(0),
        gasLimit: item.gasLimit, maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas });
      pendingHash = tx.hash;
      const receipt = await tx.wait(1);
      if (!receipt || receipt.status !== 1) throw new Error('Worker report transaction failed.');
      publications[item.role] = { hash: tx.hash, blockNumber: receipt.blockNumber, name: item.a.name, key };
      pendingHash = undefined;
    }
    return publications;
  } catch {
    throw new Error(`Partial quartet publication. Confirmed: ${JSON.stringify(publications)}. Pending/failed: ${pendingHash || 'none'}. No combined summary published; reconcile explicitly.`);
  }
}
