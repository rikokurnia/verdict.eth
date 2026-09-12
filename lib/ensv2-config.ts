export const ENSV2_SEPOLIA = {
  chainId: 11155111,
  explorer: 'https://eth-sepolia.blockscout.com',
  contracts: {
    universalResolver: '0xd26f2040d083af1cd2962ba303f4bea0c4faf142',
    ethRegistrar: '0x7d1b7f586a62ac3f54b9a396849757814283270b',
    ethRegistry: '0x1d78834d97c1d7b1a38c1dedbd1a287cfed3971e',
    factory: '0x894bc9cc8ff1ad96b8a288c86a8c71d662c07780',
    mockUsdc: '0xcbfd80f74375c54e545af34788ff465f96f66f05',
  },
  proxies: {
    namespaceResolver: '0xB18cCDb9fFE2A3CB50Dd00c3Ece15e55c98410cE',
    auditorResolver: '0x1C6e26A8f56C8B6C9286Fe217851c1FC9e7dA6e6',
    monitorResolver: '0x6592566d7185bbf811D2508683e4a545297A7C13',
    verdictRegistry: '0x657c1E4573FB8fCE364776aA5478256Bf05c0d97',
    acmeRegistry: '0x49a694BFfcc57DFbdb8347238BB3c40e7A5a6e5d',
    auditorRegistry: '0xc41926ea9855A291F8EdA917B064550f13F9dF08',
    monitorRegistry: '0x97BBD31Ee3B140f601eA7852B647255BCA6048C5',
    rwaRegistry: '0xFD32461986A0914d272d0EA14d008F67EC18f65e',
    agentRegistry: '0xf247E51be1BedcB0782273392e3e99e4C713De69',
  },
  names: {
    asset: 'usd-yield-001.acme.verdict.eth',
    audit: 'legal.agent.verdict.eth',
    observation: 'custody.agent.verdict.eth',
    technical: 'technical.agent.verdict.eth',
    consensus: 'consensus.agent.verdict.eth',
    agent: 'consensus.agent.verdict.eth',
    agents: {
      legal: 'legal.agent.verdict.eth',
      custody: 'custody.agent.verdict.eth',
      technical: 'technical.agent.verdict.eth',
      consensus: 'consensus.agent.verdict.eth',
    },
    aliasParents: ['arb.verdict.eth', 'base.verdict.eth'],
    soulbound: 'kyc-001.acme.verdict.eth',
    forever: 'genesis.acme.verdict.eth',
  },
  actors: {
    auditorWorker: '0xeABF723A3a2985aEB61D5853BfFF7eb8e83e6232',
    monitorWorker: '0x18834e33Cc3164D9b21828A1aB4e40533DF22401',
    auditorAdmin: '0x234114B7589a73d4D0316B6ab480AEB0c0379026',
    monitorAdmin: '0x429a3Ddd334cE659316B195390bee559736987d4',
  },
  transactions: {
    roots: [
      '0xac69f89806acf549b353bc1f898fa707de44f513c9835ea1986a6b5af84d4e42',
      '0xe019f4f4b3474391e8d6696870472c38732a4b9e78cdcf58593a440153274235',
      '0xa870bd0f880f0d4e2d4db36c4bc1037f8304f07197912ef5614202e11724af1a',
    ],
    assetRecords: '0xd60e4983f0ab7182a042f84bd1719bdaaea8f74074a9b3aef22e4787d302d624',
    auditRecords: '0xe3c73b45d8ff6eafd58d35d0e185e92ebbe786dc4125f6843cce9e453717d84c',
    observationRecords: '0xb3bd69e075e06239e26c60b1338d33fda512849e49c946ab6ab0a862c9db9950',
    agentRecords: '0x9f3d48ffb017760b8a053d0a768e3727b15874d57a9c63f0dae460c4b7097358',
    aiAudit: '0x7e578afc2105f65066ecdc70df6fbbd0018bb400d70043944098f89ce7d2ace5',
    aiObservation: '0x22613542f0c3c4582067e1cb0eac94d880e85aef1e5d3c6e456d5bd84e1a4053',
  },
} as const;

export const VERDICT_POLICY = {
  id: 'verdict-demo-policy-v0',
  reviewWindowDays: 14,
  observationFreshnessSeconds: 86_400,
} as const;

/** Official ENS App name deep link (https://app.ens.domains/<name>). */
export function ENS_EXPLORER_NAME_URL(name: string) {
  return `https://app.ens.domains/${encodeURIComponent(name)}`;
}

/** Hackathon deployment explorer — resolver contract deep link. */
export function ENS_RESOLVER_URL(address: string) {
  return `https://hackathon-deployment-portal-app.ens-cf.workers.dev/resolver/${address}`;
}

/** Hackathon deployment explorer — registry contract deep link. */
export function ENS_REGISTRY_URL(address: string) {
  return `https://hackathon-deployment-portal-app.ens-cf.workers.dev/registry/${address}`;
}

const ENS_PORTAL = 'https://hackathon-deployment-portal-app.ens-cf.workers.dev';

/** Onchain activity for a name, as logged by the ENS explorer. */
export function ENS_NAME_HISTORY_URL(name: string) {
  return `${ENS_PORTAL}/names/${encodeURIComponent(name)}/history`;
}

/** Onchain activity for a contract, as logged by the ENS explorer. */
export function ENS_ADDRESS_HISTORY_URL(address: string) {
  return `${ENS_PORTAL}/addr/${address}/history`;
}

export const ENS_APP_NAME_URL = ENS_EXPLORER_NAME_URL;

/** ENS explorer (beta deployment reader) name deep link — for record/contract proof. */
export function ENS_EXPLORER_BETA_NAME_URL(name: string) {
  return `https://explorer.ens.dev/names/${encodeURIComponent(name)}`;
}

/** Hackathon ENS explorer (Sepolia ENSv2 deployment) portal deep link. */
export function ENS_PORTAL_NAME_URL(name: string) {
  return `https://hackathon-deployment-portal-app.ens-cf.workers.dev/names/${encodeURIComponent(name)}`;
}
