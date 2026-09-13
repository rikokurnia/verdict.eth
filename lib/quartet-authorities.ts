import { Contract, Interface, dnsEncode, isError, keccak256, namehash, toUtf8Bytes, type JsonRpcProvider } from 'ethers';
import { ENSV2_SEPOLIA as ENS } from './ensv2-config.ts';
import { PERMISSION_ABI } from './ens-permissions.ts';
import { SET_TEXT, SET_TEXT_ADMIN, UPGRADE } from './ens-permission-policy.ts';
import { QUARTET_ROLES, QUARTET_DISCLOSURE, quartetReportKey, type QuartetRole } from './quartet-authority-policy.ts';

export const QUARTET_AUTHORITIES = {
  legal: { name: ENS.names.agents.legal, resolver: ENS.proxies.auditorResolver, worker: ENS.actors.auditorWorker, keystore: 'verdict-auditor' },
  custody: { name: ENS.names.agents.custody, resolver: ENS.proxies.monitorResolver, worker: ENS.actors.monitorWorker, keystore: 'verdict-monitor' },
  technical: { name: ENS.names.agents.technical, resolver: ENS.proxies.technicalResolver, worker: ENS.actors.technicalWorker, keystore: 'verdict-technical' },
  consensus: { name: ENS.names.agents.consensus, resolver: ENS.proxies.consensusResolver, worker: ENS.actors.consensusWorker, keystore: 'verdict-consensus' },
} as const;

/** Read-only, block-pinned proof for the exact report key about to be published. */
export async function verifyQuartetAuthorities(provider: JsonRpcProvider, assetName: string) {
  const key = quartetReportKey(assetName);
  const blockTag = await provider.getBlockNumber();
  const registry = new Contract(ENS.proxies.agentRegistry, [
    'function getResolver(string label) view returns(address)',
    'function getStatus(uint256 anyId) view returns(uint8)',
  ], provider);
  const iface = new Interface(PERMISSION_ABI);
  const text = new Interface(['function text(bytes32 node,string key) view returns(string)']);
  const universal = new Contract(ENS.contracts.universalResolver,
    ['function resolve(bytes name,bytes data) view returns(bytes result,address resolver)'], provider);
  const proofs: Partial<Record<QuartetRole, { verified: boolean; name: string; resolver: string; worker: string; checks: Record<string, boolean> }>> = {};
  async function blocked(from: string, to: string, data: string) {
    try { await provider.call({ from, to, data, blockTag }); return false; }
    catch (error) { if (isError(error, 'CALL_EXCEPTION')) return true; throw error; }
  }
  for (const role of QUARTET_ROLES) {
    const a = QUARTET_AUTHORITIES[role];
    const contract = new Contract(a.resolver, PERMISSION_ABI, provider);
    const setter = iface.encodeFunctionData('setText', [dnsEncode(a.name), key, 'read-only-permission-probe']);
    const [, resource] = await contract.decodeSetter(setter, { blockTag });
    const unrelated = iface.encodeFunctionData('setText', [dnsEncode(a.name), 'verdict.unrelated.probe', 'read-only-permission-probe']);
    const [workerRaw, resolvedAddress] = await universal.resolve(dnsEncode(a.name),
      text.encodeFunctionData('text', [namehash(a.name), 'verdict.agent.worker']), { blockTag });
    const checks = {
      nameActive: Number(await registry.getStatus(BigInt(keccak256(toUtf8Bytes(role))), { blockTag })) === 2,
      resolverMatches: String(await registry.getResolver(role, { blockTag })).toLowerCase() === a.resolver.toLowerCase(),
      universalResolverMatches: String(resolvedAddress).toLowerCase() === a.resolver.toLowerCase(),
      workerRecordMatches: String(text.decodeFunctionResult('text', workerRaw)[0]).toLowerCase() === a.worker.toLowerCase(),
      keyAllowed: Boolean(await contract.hasRoles(resource, SET_TEXT, a.worker, { blockTag })),
      allowedWrite: !await blocked(a.worker, a.resolver, setter),
      arbitraryKeyBlocked: await blocked(a.worker, a.resolver, unrelated),
      issuerBlocked: await blocked(ENS.actors.namespaceOperator, a.resolver, setter),
      escalationBlocked: await blocked(a.worker, a.resolver, iface.encodeFunctionData('grantSetterRoles', [unrelated, a.worker])),
      noRootText: !await contract.hasRootRoles(SET_TEXT, a.worker, { blockTag }),
      noRootAdmin: !await contract.hasRootRoles(SET_TEXT_ADMIN, a.worker, { blockTag }),
      noUpgrade: !await contract.hasRootRoles(UPGRADE, a.worker, { blockTag }),
      noUpgradeAdmin: !await contract.hasRootRoles(UPGRADE << BigInt(128), a.worker, { blockTag }),
      noLink: !await contract.hasRootRoles(BigInt(1) << BigInt(28), a.worker, { blockTag }),
      noLinkAdmin: !await contract.hasRootRoles(BigInt(1) << BigInt(156), a.worker, { blockTag }),
      crossWorkersBlocked: true,
    };
    for (const other of QUARTET_ROLES.filter((other) => other !== role)) {
      checks.crossWorkersBlocked &&= await blocked(QUARTET_AUTHORITIES[other].worker, a.resolver, setter);
    }
    proofs[role] = { verified: Object.values(checks).every(Boolean), name: a.name, resolver: a.resolver, worker: a.worker, checks };
  }
  return { verified: QUARTET_ROLES.every((role) => proofs[role]?.verified), block: blockTag, assetName, key,
    authorities: proofs, disclosure: QUARTET_DISCLOSURE };
}
