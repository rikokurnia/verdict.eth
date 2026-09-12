import Image from 'next/image';
import type { CoverageTier, DemoAsset, NetworkId } from './demo-data';

const NETWORK_LABELS: Record<NetworkId, string> = {
  ethereum: 'Ethereum', sepolia: 'Sepolia', solana: 'Solana', stellar: 'Stellar',
  polygon: 'Polygon', gnosis: 'Gnosis', bitcoin: 'Bitcoin', arbitrum: 'Arbitrum',
  base: 'Base', avalanche: 'Avalanche', bsc: 'BNB Chain', tron: 'Tron',
  provenance: 'Provenance', aptos: 'Aptos',
};

const COVERAGE_LABELS: Record<CoverageTier, string> = {
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

function NetworkGlyph({ network }: { network: NetworkId }) {
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
