import { useState } from 'react';
import Image from 'next/image';
import { Check, Copy, ExternalLink } from 'lucide-react';
import type { CoverageTier, DemoAsset, NetworkId } from './demo-data';
import { ENSV2_SEPOLIA } from '@/lib/ensv2-config';
import type { EnsProfile } from '@/lib/ens-profile';

export const NETWORK_LABELS: Record<NetworkId, string> = {
  ethereum: 'Ethereum', sepolia: 'Sepolia', solana: 'Solana', stellar: 'Stellar',
  polygon: 'Polygon', gnosis: 'Gnosis', bitcoin: 'Bitcoin', arbitrum: 'Arbitrum',
  base: 'Base', avalanche: 'Avalanche', bsc: 'BNB Chain', tron: 'Tron',
  provenance: 'Provenance', aptos: 'Aptos',
};

export const COVERAGE_LABELS: Record<CoverageTier, string> = {
  POLICY_VERIFIED: 'Policy-Verified', CONSENSUS_SCORED: 'Consensus-Scored', REGISTERED: 'Registered', REFERENCE: 'Reference',
};

export function AssetLogo({ asset, size = 42 }: { asset: DemoAsset; size?: number }) {
  // Remote logos are real CoinGecko CDN images returned live by the
  // coins/markets API (see /api/market); local paths stay on next/image.
  if (asset.logo.startsWith('http')) {
    return <span className="v-asset-logo" style={{ width: size, height: size }}><img src={asset.logo} alt={`${asset.title} logo`} width={size} height={size} loading="lazy" referrerPolicy="no-referrer" style={{ borderRadius: '50%', objectFit: 'cover' }} /></span>;
  }
  return <span className="v-asset-logo" style={{ width: size, height: size }}><Image src={asset.logo} alt={`${asset.title} logo`} width={size} height={size} sizes={`${size}px`} /></span>;
}

export function EnsLogo({
  size = 14,
  className = '',
  style,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <img
      src="/assets/ens.svg"
      alt="ENS"
      width={size}
      height={size}
      loading="lazy"
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        borderRadius: size >= 16 ? 4 : 3,
        ...style,
      }}
      className={className}
      aria-hidden="true"
    />
  );
}



const CHAIN_ICON_SLUGS: Record<NetworkId, string> = {
  ethereum: 'ethereum',
  // Sepolia has no icon on the CDN — it is Ethereum testnet, so the real
  // Ethereum logo is the honest mark, with the "Sepolia" text label kept.
  sepolia: 'ethereum',
  solana: 'solana',
  stellar: 'stellar',
  polygon: 'polygon',
  gnosis: 'gnosis',
  bitcoin: 'bitcoin',
  arbitrum: 'arbitrum',
  base: 'base',
  avalanche: 'avalanche',
  bsc: 'bsc',
  tron: 'tron',
  provenance: 'provenance',
  aptos: 'aptos',
};

export function NetworkGlyph({ network }: { network: NetworkId }) {
  // Real chain logos served by the DefiLlama icons CDN (verified HTTP 200
  // per slug). No generated placeholders.
  return (
    <img
      src={`https://icons.llamao.fi/icons/chains/rsz_${CHAIN_ICON_SLUGS[network]}.jpg`}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      referrerPolicy="no-referrer"
      style={{ borderRadius: '50%', objectFit: 'cover' }}
      aria-hidden="true"
    />
  );
}

export function NetworkBadges({ networks }: { networks: NetworkId[] }) {
  const label = networks.map((network) => NETWORK_LABELS[network]).join(', ');
  return <span className="v-network-list" aria-label={`Networks: ${label}`}>{networks.map((network) => <span className={`v-chain-badge v-chain-${network}`} key={network} title={NETWORK_LABELS[network]}><NetworkGlyph network={network} /><span>{NETWORK_LABELS[network]}</span></span>)}</span>;
}

export function CoverageBadge({ coverage }: { coverage: CoverageTier }) {
  return <span className={`v-coverage-badge v-coverage-${coverage.toLowerCase().replaceAll('_', '-')}`}>{COVERAGE_LABELS[coverage]}</span>;
}

export function truncateAddress(addr: string): string {
  if (!addr) return 'TBD onchain';
  if (addr.length <= 13) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function getExplorerAddressUrl(network: NetworkId, address: string): string | null {
  if (!address || address === 'TBD onchain') return null;
  switch (network) {
    case 'ethereum':
      return `https://etherscan.io/address/${address}`;
    case 'sepolia':
      return `https://sepolia.etherscan.io/address/${address}`;
    case 'polygon':
      return `https://polygonscan.com/address/${address}`;
    case 'arbitrum':
      return `https://arbiscan.io/address/${address}`;
    case 'base':
      return `https://basescan.org/address/${address}`;
    case 'solana':
      return `https://solscan.io/token/${address}`;
    case 'stellar':
      return `https://stellar.expert/explorer/public/account/${address}`;
    case 'gnosis':
      return `https://gnosisscan.io/address/${address}`;
    case 'avalanche':
      return `https://snowtrace.io/address/${address}`;
    case 'bsc':
      return `https://bscscan.com/address/${address}`;
    case 'tron':
      return `https://tronscan.org/#/address/${address}`;
    case 'provenance':
      return `https://explorer.provenance.io/accounts/${address}`;
    case 'aptos':
      return `https://explorer.aptoslabs.com/account/${address}`;
    case 'bitcoin':
      return `https://mempool.space/address/${address}`;
    default:
      return null;
  }
}

export function resolveNetworkContract(
  asset: DemoAsset,
  network: NetworkId,
  profile?: EnsProfile | null,
  liveDeployment?: string | null,
): string | null {
  // 1. Sepolia demo asset or live deployment
  if (network === 'sepolia') {
    if (liveDeployment && liveDeployment.startsWith('0x')) return liveDeployment;
    if (asset.id === 'verdict-usdy-001' || asset.name === 'usd-yield-001.acme.verdict.eth') {
      return ENSV2_SEPOLIA.contracts.mockUsdc;
    }
  }

  // 2. Read from live ENS profile records (e.g. contract.ethereum, contract.polygon, etc.)
  const ensVal = profile?.records?.[`contract.${network}`]?.trim();
  if (ensVal && ensVal !== '') return ensVal;

  // 3. Fallback to asset.contracts defined in demo-data
  const fallback = asset.contracts?.[network]?.trim();
  if (fallback && fallback !== '') return fallback;

  // 4. If network is ethereum and profile has contract.ethereum
  if (network === 'ethereum' && profile?.records?.['contract.ethereum']) {
    const ethVal = profile.records['contract.ethereum'].trim();
    if (ethVal) return ethVal;
  }

  return null;
}

export function OfficialDeployments({
  asset,
  profile,
  liveDeployment,
  onCopyToast,
}: {
  asset: DemoAsset;
  profile?: EnsProfile | null;
  liveDeployment?: string | null;
  onCopyToast?: (networkLabel: string, address: string) => void;
}) {
  const [copiedNet, setCopiedNet] = useState<string | null>(null);

  async function handleCopy(network: NetworkId, address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedNet(network);
      setTimeout(() => setCopiedNet(null), 1500);
      onCopyToast?.(NETWORK_LABELS[network], address);
    } catch { /* clipboard optional */ }
  }

  return (
    <div className="v-deployments-list" role="list" aria-label="Official deployments">
      {asset.networks.map((network) => {
        const address = resolveNetworkContract(asset, network, profile, liveDeployment);
        const hasAddress = Boolean(address);
        const explorerUrl = address ? getExplorerAddressUrl(network, address) : null;
        const netLabel = NETWORK_LABELS[network];

        return (
          <div className="v-deployment-item" key={network} role="listitem">
            <div className="v-deployment-network">
              <span className={`v-chain-badge v-chain-${network}`} title={netLabel}>
                <NetworkGlyph network={network} />
                <span>{netLabel}</span>
              </span>
            </div>
            <div className="v-deployment-meta">
              {hasAddress && address ? (
                <>
                  <span className="v-deployment-addr" title={address}>
                    {truncateAddress(address)}
                  </span>
                  <button
                    type="button"
                    className="v-deployment-action-btn"
                    onClick={() => handleCopy(network, address)}
                    aria-label={`Copy ${netLabel} address`}
                    title={`Copy ${address}`}
                  >
                    {copiedNet === network ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                  </button>
                  {explorerUrl && (
                    <a
                      className="v-deployment-action-btn"
                      href={explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`View on ${netLabel} explorer`}
                      title={`Open on block explorer`}
                    >
                      <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  )}
                </>
              ) : (
                <span className="v-deployment-tbd">TBD onchain</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
