import Image from 'next/image';
import type { CoverageTier, DemoAsset, NetworkId } from './demo-data';

const NETWORK_LABELS: Record<NetworkId, string> = {
  ethereum: 'Ethereum', sepolia: 'Sepolia', solana: 'Solana', stellar: 'Stellar',
  polygon: 'Polygon', gnosis: 'Gnosis', bitcoin: 'Bitcoin', arbitrum: 'Arbitrum',
  base: 'Base', avalanche: 'Avalanche', bsc: 'BNB Chain', tron: 'Tron',
  provenance: 'Provenance', aptos: 'Aptos',
};

const COVERAGE_LABELS: Record<CoverageTier, string> = {
  VERIFIED_ONCHAIN: 'Verified onchain', SOURCE_LINKED: 'Source linked', MARKET_REFERENCE: 'Market reference',
};

export function AssetLogo({ asset, size = 42 }: { asset: DemoAsset; size?: number }) {
  // Remote logos are real CoinGecko CDN images returned live by the
  // coins/markets API (see /api/market); local paths stay on next/image.
  if (asset.logo.startsWith('http')) {
    return <span className="v-asset-logo" style={{ width: size, height: size }}><img src={asset.logo} alt={`${asset.title} logo`} width={size} height={size} loading="lazy" referrerPolicy="no-referrer" style={{ borderRadius: '50%', objectFit: 'cover' }} /></span>;
  }
  return <span className="v-asset-logo" style={{ width: size, height: size }}><Image src={asset.logo} alt={`${asset.title} logo`} width={size} height={size} sizes={`${size}px`} /></span>;
}

function NetworkGlyph({ network }: { network: NetworkId }) {
  if (network === 'ethereum' || network === 'sepolia') return <Image src="/assets/ethereum.png" alt="" width={16} height={16} aria-hidden="true" />;
  if (network === 'bitcoin') return <Image src="/assets/bitcoin.png" alt="" width={16} height={16} aria-hidden="true" />;
  if (network === 'solana') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4h11l2 2H6L4 4Zm2 5h11l-2 2H4l2-2Zm-2 5h11l2 2H6l-2-2Z" fill="currentColor" /></svg>;
  if (network === 'polygon') return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.3 6.2 2.7-1.6 2.7 1.6v3.1L10 10.9 7.3 9.3m0 0L4.6 11v3.1l2.7 1.6 2.7-1.6V11m2.7-1.7 2.7-1.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (network === 'stellar') return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M3 13.3 17 6.7M3.8 9.4 16.2 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 13.8 10 3l6 10.8-6 3.2-6-3.2Z" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="m6.8 12.2 3.2-5.7 3.2 5.7-3.2 1.7-3.2-1.7Z" fill="currentColor" opacity=".65" /></svg>;
}

export function NetworkBadges({ networks }: { networks: NetworkId[] }) {
  const label = networks.map((network) => NETWORK_LABELS[network]).join(', ');
  return <span className="v-network-list" aria-label={`Networks: ${label}`}>{networks.map((network) => <span className={`v-chain-badge v-chain-${network}`} key={network} title={NETWORK_LABELS[network]}><NetworkGlyph network={network} /><span>{NETWORK_LABELS[network]}</span></span>)}</span>;
}

export function CoverageBadge({ coverage }: { coverage: CoverageTier }) {
  return <span className={`v-coverage-badge v-coverage-${coverage.toLowerCase().replaceAll('_', '-')}`}>{COVERAGE_LABELS[coverage]}</span>;
}
