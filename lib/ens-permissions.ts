import { Contract, Interface, JsonRpcProvider, dnsEncode, isError, keccak256, namehash, toUtf8Bytes } from 'ethers';
import { ENSV2_SEPOLIA } from './ensv2-config.ts';
import { SET_TEXT, SET_TEXT_ADMIN, UPGRADE, evidenceAuthorities, permissionsVerified } from './ens-permission-policy.ts';

export const PERMISSION_ABI = [
  'function setText(bytes name,string key,string value)',
  'function grantSetterRoles(bytes setter,address account) returns(bool)',
  'function decodeSetter(bytes setter) pure returns(bytes arg,uint256 resource,uint256 roleBitmap)',
  'function hasRoles(uint256 resource,uint256 roleBitmap,address account) view returns(bool)',
  'function hasRootRoles(uint256 roleBitmap,address account) view returns(bool)',
];
const TEXT = new Interface(['function text(bytes32 node,string key) view returns(string)']);
const UNIVERSAL_ABI = ['function resolve(bytes name,bytes data) view returns(bytes result,address resolver)'];
const REGISTRY_ABI = ['function getStatus(uint256 anyId) view returns(uint8)', 'function findTokenId(string label) view returns(uint256)', 'function ownerOf(uint256 tokenId) view returns(address)'];

/** Treat an actual EVM revert as denial, never a timeout/RPC outage. No signer is loaded. */
export async function callBlocked(provider: JsonRpcProvider, from: string, to: string, data: string, blockTag: number) {
  try { await provider.call({ from, to, data, blockTag }); return false; }
  catch (error) { if (isError(error, 'CALL_EXCEPTION')) return true; throw error; }
}

export async function verifyAssetPermissions(provider: JsonRpcProvider, assetName: string) {
  const sourceBlock = await provider.getBlockNumber();
  const universal = new Contract(ENSV2_SEPOLIA.contracts.universalResolver, UNIVERSAL_ABI, provider);
  const authorities = evidenceAuthorities(assetName);
  const results = await Promise.all(Object.entries(authorities).map(async ([role, authority]) => {
    const c = new Contract(authority.resolver, PERMISSION_ABI, provider);
    const registry = new Contract(authority.registry, REGISTRY_ABI, provider);
    const label = authority.name.split('.')[0];
    const nameActive = Number(await registry.getStatus(BigInt(keccak256(toUtf8Bytes(label))), { blockTag: sourceBlock })) === 2;
    let owner: string | null = null;
    if (nameActive) owner = String(await registry.ownerOf(await registry.findTokenId(label, { blockTag: sourceBlock }), { blockTag: sourceBlock }));
    const expectedOwner = assetName === ENSV2_SEPOLIA.names.asset ? authority.worker : authority.admin;
    const encoded = dnsEncode(authority.name);
    let resolverMatches = false;
    let subjectMatches = false;
    try {
      const [raw, resolver] = await universal.resolve(encoded,
        TEXT.encodeFunctionData('text', [namehash(authority.name), 'verdict.subject']), { blockTag: sourceBlock });
      resolverMatches = String(resolver).toLowerCase() === authority.resolver.toLowerCase();
      subjectMatches = raw !== '0x' && String(TEXT.decodeFunctionResult('text', raw)[0]) === assetName;
    } catch (error) { if (!isError(error, 'CALL_EXCEPTION')) throw error; }
    const allowed = await Promise.all(authority.keys.map(async (key) => {
      const setter = c.interface.encodeFunctionData('setText', [encoded, key, '']);
      const [, resource, bitmap] = await c.decodeSetter(setter, { blockTag: sourceBlock });
      return bitmap === SET_TEXT && await c.hasRoles(resource, SET_TEXT, authority.worker, { blockTag: sourceBlock });
    }));
    const ownSetter = c.interface.encodeFunctionData('setText', [encoded, authority.keys[0], 'permission-probe']);
    const crossWorker = role === 'auditor' ? authorities.monitor.worker : authorities.auditor.worker;
    const checks = {
      nameActive, ownerMatches: owner?.toLowerCase() === expectedOwner.toLowerCase(), resolverMatches, subjectMatches, allKeysAllowed: allowed.every(Boolean),
      noRootText: !await c.hasRootRoles(SET_TEXT, authority.worker, { blockTag: sourceBlock }),
      noRootTextAdmin: !await c.hasRootRoles(SET_TEXT_ADMIN, authority.worker, { blockTag: sourceBlock }),
      noUpgrade: !await c.hasRootRoles(UPGRADE, authority.worker, { blockTag: sourceBlock }),
      noUpgradeAdmin: !await c.hasRootRoles(UPGRADE << BigInt(128), authority.worker, { blockTag: sourceBlock }),
      allowedWriteVerified: !await callBlocked(provider, authority.worker, authority.resolver, ownSetter, sourceBlock),
      unrelatedWriteBlocked: await callBlocked(provider, authority.worker, authority.resolver,
        c.interface.encodeFunctionData('setText', [encoded, 'verdict.unauthorized.probe', 'must-revert']), sourceBlock),
      issuerWriteBlocked: await callBlocked(provider, ENSV2_SEPOLIA.actors.namespaceOperator, authority.resolver, ownSetter, sourceBlock),
      crossWorkerWriteBlocked: await callBlocked(provider, crossWorker, authority.resolver, ownSetter, sourceBlock),
      workerGrantBlocked: await callBlocked(provider, authority.worker, authority.resolver,
        c.interface.encodeFunctionData('grantSetterRoles', [ownSetter, crossWorker]), sourceBlock),
      recoveryAdminVerified: !await callBlocked(provider, authority.admin, authority.resolver,
        c.interface.encodeFunctionData('grantSetterRoles', [ownSetter, crossWorker]), sourceBlock),
    };
    return [role, { ...authority, owner, checks, verified: permissionsVerified(checks) }] as const;
  }));
  return { assetName, sourceBlock, verified: results.every(([, result]) => result.verified),
    scope: 'Text-key scoped across names using each dedicated resolver; not per-name grants.',
    adminDisclosure: 'Recovery admins can grant roles and upgrade resolvers. Registry and .eth owners can redirect resolution. All demo keys are operated by the Verdict team, not external audit firms.',
    quartetDisclosure: 'Offchain AI analysis; one namespace relayer publishes the quartet summary. Summary records are not independent auditor attestations.',
    authorities: Object.fromEntries(results) };
}
