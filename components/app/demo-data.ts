import type { VerdictState } from '@/lib/policy';

export type CoverageTier = 'POLICY_VERIFIED' | 'CONSENSUS_SCORED' | 'REGISTERED' | 'REFERENCE';
export type NetworkId =
  | 'ethereum' | 'sepolia' | 'solana' | 'stellar' | 'polygon' | 'gnosis' | 'bitcoin'
  | 'arbitrum' | 'base' | 'avalanche' | 'bsc' | 'tron' | 'provenance' | 'aptos';

export type DemoAsset = {
  id: string;
  title: string;
  name: string;
  ticker: string;
  assetClass: string;
  issuer: string;
  state: VerdictState;
  coverage: CoverageTier;
  description: string;
  logo: string;
  networks: NetworkId[];
  network: string;
  marketId?: string;
  contracts?: Partial<Record<NetworkId, string>>;
  sourceLabel: string;
  sourceUrl: string;
  snapshot?: string;
  snapshotAsOf?: string;
  auditNote: string;
  riskNote: string;
  heartbeat: string;
};

const LIVE = 'Live market reference · CoinGecko';
const ISSUER_LINKED = 'Issuer attestations linked';
const NO_POLICY = 'No Verdict policy';

/**
 * Real RWA catalog.
 * - `marketId` values are live-verified CoinGecko coin IDs (RWA category).
 * - `logo` URLs are the real CoinGecko CDN images returned by the
 *   `coins/markets` API for each `marketId`; `/api/market` re-fetches them
 *   live and the dashboard prefers the live image with this as fallback.
 * - `networks` reflect each issuer's documented primary chains.
 */
export const DEMO_ASSETS: DemoAsset[] = [
  {
    id: 'verdict-usdy-001', title: 'USD Yield 001', name: 'usd-yield-001.acme.verdict.eth', ticker: 'USDY-001',
    assetClass: 'ENS Verified', issuer: 'ACME demo issuer', state: 'POLICY_PASS', coverage: 'POLICY_VERIFIED',
    description: 'Fictional Sepolia asset used to prove independent issuer, AI auditor, and risk-monitor permissions end to end.',
    logo: '/icon.svg', networks: ['sepolia'], network: 'Ethereum Sepolia',
    contracts: { sepolia: '0xcbfd80f74375c54e545af34788ff465f96f66f05' },
    sourceLabel: 'ENSv2 evidence graph', sourceUrl: 'https://eth-sepolia.blockscout.com/address/0xB18cCDb9fFE2A3CB50Dd00c3Ece15e55c98410cE',
    snapshot: 'AI evidence verified', snapshotAsOf: 'Live Sepolia state', auditNote: 'Active', riskNote: 'Fresh', heartbeat: 'Resolving…',
  },
  {
    id: 'blackrock-buidl', title: 'BlackRock USD Institutional Digital Liquidity Fund', name: 'buidl.rwa.verdict.eth', ticker: 'BUIDL',
    assetClass: 'Treasury', issuer: 'BlackRock / Securitize', state: 'UNAVAILABLE', coverage: 'CONSENSUS_SCORED',
    description: "BlackRock's tokenized short-term Treasury liquidity fund for qualified purchasers, administered by Securitize with a $1 NAV target.",
    logo: 'https://coin-images.coingecko.com/coins/images/36291/large/blackrock.png?1711013223',
    networks: ['ethereum', 'solana', 'polygon'], network: 'Ethereum + 8 networks', marketId: 'blackrock-usd-institutional-digital-liquidity-fund',
    contracts: {
      ethereum: '0x7712c34205737192402172409a8f7ccef8aa2aec',
      solana: 'GyWgeqpy5GueU2YbkE8xqUeVEokCMMCEeUrfbtMw6phr',
      polygon: '0x2893ef551b6dd69f661ac00f11d93e5dc5dc0e99',
    },
    sourceLabel: 'Securitize issuer platform', sourceUrl: 'https://securitize.io/',
    snapshot: '$1 NAV target · short-term U.S. Treasury exposure', snapshotAsOf: LIVE,
    auditNote: ISSUER_LINKED, riskNote: NO_POLICY, heartbeat: 'Market feed',
  },
  {
    id: 'circle-usyc', title: 'Circle USYC', name: 'usyc.rwa.verdict.eth', ticker: 'USYC',
    assetClass: 'Treasury', issuer: 'Circle (Hashnote)', state: 'UNAVAILABLE', coverage: 'CONSENSUS_SCORED',
    description: "Circle's tokenized money-market fund share backed by short-term U.S. government securities.",
    logo: 'https://coin-images.coingecko.com/coins/images/51054/large/Hashnote_SDYC_200x200.png?1730370965',
    networks: ['ethereum', 'solana'], network: 'Ethereum + Solana', marketId: 'hashnote-usyc',
    contracts: {
      ethereum: '0x136471a34f6ef19fe571effc1ca711fdb8e49f2b',
      solana: '7LWanZteUKtvFjv4MHYgKXXdAuCQYFPJysL9pxxdRQGn',
    },
    sourceLabel: 'Hashnote issuer disclosures', sourceUrl: 'https://usyc.hashnote.com/',
    snapshot: 'Money-market fund share · T-bill collateral', snapshotAsOf: LIVE,
    auditNote: ISSUER_LINKED, riskNote: NO_POLICY, heartbeat: 'Market feed',
  },
  {
    id: 'ondo-usdy', title: 'Ondo US Dollar Yield', name: 'usdy.rwa.verdict.eth', ticker: 'USDY',
    assetClass: 'Treasury', issuer: 'Ondo', state: 'UNAVAILABLE', coverage: 'CONSENSUS_SCORED',
    description: 'A yield-bearing token secured by bank deposits and short-term US Treasuries, offered subject to eligibility restrictions.',
    logo: 'https://coin-images.coingecko.com/coins/images/31700/large/usdy_%281%29.png?1696530524',
    networks: ['ethereum', 'solana', 'arbitrum'], network: 'Ethereum + Solana + Arbitrum', marketId: 'ondo-us-dollar-yield',
    contracts: {
      ethereum: '0x96f6ef951840721adbf46ac996b59e0235cb985c',
      solana: 'A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6',
      arbitrum: '0x35e050d3c0ec2d29d269a8ecea763a183bdf9a9d',
    },
    sourceLabel: 'Ondo issuer disclosures', sourceUrl: 'https://ondo.finance/',
    snapshot: 'Yield-bearing dollar token · T-bill and deposit collateral', snapshotAsOf: LIVE,
    auditNote: ISSUER_LINKED, riskNote: NO_POLICY, heartbeat: 'Market feed',
  },
  {
    id: 'ondo-ousg', title: 'Ondo Short-Term U.S. Government Bond Fund', name: 'ousg.rwa.verdict.eth', ticker: 'OUSG',
    assetClass: 'Treasury', issuer: 'Ondo', state: 'UNAVAILABLE', coverage: 'CONSENSUS_SCORED',
    description: "Ondo's tokenized short-term U.S. government bond fund with daily liquidity windows for qualified holders.",
    logo: 'https://coin-images.coingecko.com/coins/images/29023/large/OUSG.png?1696527993',
    networks: ['ethereum', 'polygon', 'solana'], network: 'Ethereum + Polygon + Solana', marketId: 'ousg',
    contracts: {
      ethereum: '0x1b19c19393e2d034d8ff31ff34c81252fcbbee92',
      polygon: '0xbA11C5effA33c4D6F8f593C589b2584643B0610B',
      solana: 'i7u4r16TcsJTgq1kAG8opmVZyVnAKBwLKu6ZPMwzxNc',
    },
    sourceLabel: 'Ondo issuer disclosures', sourceUrl: 'https://ondo.finance/',
    snapshot: 'Short-duration government bond exposure', snapshotAsOf: LIVE,
    auditNote: ISSUER_LINKED, riskNote: NO_POLICY, heartbeat: 'Market feed',
  },
  {
    id: 'franklin-benji', title: 'Franklin Templeton BENJI', name: 'benji.rwa.verdict.eth', ticker: 'BENJI',
    assetClass: 'Money Market', issuer: 'Franklin Templeton', state: 'UNAVAILABLE', coverage: 'CONSENSUS_SCORED',
    description: 'Shares of the U.S.-registered Franklin OnChain U.S. Government Money Fund (FOBXX) with onchain share records; 1 BENJI = 1 fund share.',
    logo: 'https://coin-images.coingecko.com/coins/images/66409/large/Benji_Logo.png?1749371083',
    networks: ['stellar', 'polygon', 'ethereum'], network: 'Stellar + Polygon + 7 more', marketId: 'franklin-templeton-benji',
    contracts: {
      stellar: 'GCJG6A6LJZQYEPGBCMUTYYMIH6OSUOUMGRMC633PX7FWLL2PX5ZX3OKF',
      ethereum: '0x3ddc84940ab509c11b20b76b466933f40b750dc9',
      polygon: '0x446d3e75e9b897008cfbf68a1f81395df3d2e5ff',
    },
    sourceLabel: 'Franklin Templeton source', sourceUrl: 'https://digitalassets.franklintempleton.com/benji/',
    snapshot: '$1 stable NAV target · government securities', snapshotAsOf: LIVE,
    auditNote: ISSUER_LINKED, riskNote: NO_POLICY, heartbeat: 'Market feed',
  },
  {
    id: 'superstate-ustb', title: 'Invesco Short Duration US Government Securities Fund', name: 'ustb.rwa.verdict.eth', ticker: 'USTB',
    assetClass: 'Treasury', issuer: 'Superstate / Invesco', state: 'UNAVAILABLE', coverage: 'CONSENSUS_SCORED',
    description: 'Superstate short-duration U.S. government securities fund with onchain share records for qualified holders.',
    logo: 'https://coin-images.coingecko.com/coins/images/35012/large/Invesco_icon_lg.png?1780816895',
    networks: ['ethereum'], network: 'Ethereum', marketId: 'superstate-short-duration-us-government-securities-fund-ustb',
    contracts: { ethereum: '0x43415eb6ff9db7e26a15b704e7a3edce97d31c4e' },
    sourceLabel: 'Superstate issuer platform', sourceUrl: 'https://superstate.co/',
    snapshot: 'Short-duration government securities exposure', snapshotAsOf: LIVE,
    auditNote: ISSUER_LINKED, riskNote: NO_POLICY, heartbeat: 'Market feed',
  },
  {
    id: 'anemoy-jtrsy', title: 'Janus Henderson Anemoy Treasury Fund', name: 'jtrsy.rwa.verdict.eth', ticker: 'JTRSY',
    assetClass: 'Treasury', issuer: 'Janus Henderson / Anemoy', state: 'UNAVAILABLE', coverage: 'CONSENSUS_SCORED',
    description: 'Janus Henderson–Anemoy tokenized short-term Treasury fund issued via Centrifuge for qualified holders.',
    logo: 'https://coin-images.coingecko.com/coins/images/70445/large/JTRSY.png?1762078582',
    networks: ['ethereum'], network: 'Ethereum (Centrifuge)', marketId: 'janus-henderson-anemoy-treasury-fund',
    contracts: { ethereum: '0x8c213ee79581ff4984583c6a801e5263418c4b86' },
    sourceLabel: 'Centrifuge issuer protocol', sourceUrl: 'https://centrifuge.io/',
    snapshot: 'Short-term Treasury fund exposure', snapshotAsOf: LIVE,
    auditNote: ISSUER_LINKED, riskNote: NO_POLICY, heartbeat: 'Market feed',
  },
  {
    id: 'spiko-eutbl', title: 'Spiko EU T-Bills Money Market Fund', name: 'eutbl.rwa.verdict.eth', ticker: 'EUTBL',
    assetClass: 'Money Market', issuer: 'Spiko', state: 'UNAVAILABLE', coverage: 'CONSENSUS_SCORED',
    description: "Spiko's euro money-market token backed by EU Treasury bills for eligible European investors.",
    logo: 'https://coin-images.coingecko.com/coins/images/39657/large/EUTBL.png?1723517425',
    networks: ['ethereum'], network: 'Ethereum', marketId: 'eutbl',
    contracts: { ethereum: '0xa0769f7a8fc65e47de93797b4e21c073c117fc80' },
    sourceLabel: 'CoinGecko market data', sourceUrl: 'https://www.coingecko.com/en/coins/eutbl',
    snapshot: 'Euro T-bill money-market exposure', snapshotAsOf: LIVE,
    auditNote: ISSUER_LINKED, riskNote: NO_POLICY, heartbeat: 'Market feed',
  },
  {
    id: 'spiko-eur', title: 'Spiko Amundi Overnight Swap Fund (EUR)', name: 'spiko-eur.rwa.verdict.eth', ticker: 'EURSAFO',
    assetClass: 'Money Market', issuer: 'Spiko / Amundi', state: 'UNAVAILABLE', coverage: 'CONSENSUS_SCORED',
    description: "Spiko–Amundi euro overnight money-market token for onchain euro cash management.",
    logo: 'https://coin-images.coingecko.com/coins/images/102172591/large/Fund_eurSAF0.png?1774104814',
    networks: ['ethereum'], network: 'Ethereum', marketId: 'spiko-amundi-overnight-swap-fund-eur',
    contracts: { ethereum: '0x0990b149e915cb08e2143a5c6f669c907eddc8b0' },
    sourceLabel: 'CoinGecko market data', sourceUrl: 'https://www.coingecko.com/en/coins/spiko-amundi-overnight-swap-fund-eur',
    snapshot: 'Euro overnight money-market exposure', snapshotAsOf: LIVE,
    auditNote: ISSUER_LINKED, riskNote: NO_POLICY, heartbeat: 'Market feed',
  },
  {
    id: 'anemoy-jaaa', title: 'Janus Henderson Anemoy AAA CLO Fund', name: 'jaaa.rwa.verdict.eth', ticker: 'JAAA',
    assetClass: 'Private Credit', issuer: 'Janus Henderson / Anemoy', state: 'UNAVAILABLE', coverage: 'CONSENSUS_SCORED',
    description: 'Janus Henderson–Anemoy tokenized AAA CLO fund issued via Centrifuge for qualified holders.',
    logo: 'https://coin-images.coingecko.com/coins/images/70446/large/jaaa.png?1762078666',
    networks: ['ethereum'], network: 'Ethereum (Centrifuge)', marketId: 'janus-henderson-anemoy-aaa-clo-fund',
    contracts: { ethereum: '0x5a0f93d040de44e78f251b03c43be9cf317dcf64' },
    sourceLabel: 'Centrifuge issuer protocol', sourceUrl: 'https://centrifuge.io/',
    snapshot: 'AAA collateralized-loan-obligation exposure', snapshotAsOf: LIVE,
    auditNote: ISSUER_LINKED, riskNote: NO_POLICY, heartbeat: 'Market feed',
  },
  {
    id: 'figure-ylds', title: 'YLDS', name: 'ylds.rwa.verdict.eth', ticker: 'YLDS',
    assetClass: 'Money Market', issuer: 'Figure', state: 'UNAVAILABLE', coverage: 'CONSENSUS_SCORED',
    description: "Figure's SEC-registered yield-bearing stablecoin accruing interest on Provenance Blockchain.",
    logo: 'https://coin-images.coingecko.com/coins/images/66486/large/YLDS.png?1772560579',
    networks: ['provenance'], network: 'Provenance', marketId: 'ylds',
    contracts: {},
    sourceLabel: 'Figure issuer platform', sourceUrl: 'https://figure.com/',
    snapshot: '$1 reference token value · yield-bearing stablecoin', snapshotAsOf: LIVE,
    auditNote: ISSUER_LINKED, riskNote: NO_POLICY, heartbeat: 'Market feed',
  },
  {
    id: 'tether-xaut', title: 'Tether Gold', name: 'xaut.rwa.verdict.eth', ticker: 'XAUT',
    assetClass: 'Gold', issuer: 'Tether', state: 'UNAVAILABLE', coverage: 'CONSENSUS_SCORED',
    description: 'Fungible token backed by allocated physical gold held in Swiss vaults; 1 XAUT tracks one troy ounce of gold.',
    logo: 'https://coin-images.coingecko.com/coins/images/10481/large/logo.png?1774627372',
    networks: ['ethereum', 'tron'], network: 'Ethereum + Tron', marketId: 'tether-gold',
    contracts: { ethereum: '0x68749665ff8d2d112Fa859AA293F07A622782F38' },
    sourceLabel: 'Tether Gold disclosures', sourceUrl: 'https://tether.to/',
    snapshot: 'Allocated-gold backing · per-ounce pricing', snapshotAsOf: LIVE,
    auditNote: ISSUER_LINKED, riskNote: NO_POLICY, heartbeat: 'Market feed',
  },
  {
    id: 'paxos-paxg', title: 'PAX Gold', name: 'paxg.rwa.verdict.eth', ticker: 'PAXG',
    assetClass: 'Gold', issuer: 'Paxos', state: 'UNAVAILABLE', coverage: 'CONSENSUS_SCORED',
    description: 'Regulated ERC-20 backed 1:1 by allocated London Good Delivery gold bars held in custody.',
    logo: 'https://coin-images.coingecko.com/coins/images/9519/large/asset-paxg.png?1785284785',
    networks: ['ethereum'], network: 'Ethereum', marketId: 'pax-gold',
    contracts: { ethereum: '0x45804880De22913dAFE09f4980848ECE6EcbAf78' },
    sourceLabel: 'Paxos product source', sourceUrl: 'https://paxos.com/',
    snapshot: 'Allocated-gold backing · per-ounce pricing', snapshotAsOf: LIVE,
    auditNote: ISSUER_LINKED, riskNote: NO_POLICY, heartbeat: 'Market feed',
  },
  {
    id: 'kinesis-kau', title: 'Kinesis Gold', name: 'kau.rwa.verdict.eth', ticker: 'KAU',
    assetClass: 'Gold', issuer: 'Kinesis', state: 'UNAVAILABLE', coverage: 'CONSENSUS_SCORED',
    description: 'Kinesis gold token backed 1:1 by allocated physical bullion with yield-share mechanics for holders.',
    logo: 'https://coin-images.coingecko.com/coins/images/29788/large/kau-currency-ticker.png?1696528718',
    networks: ['ethereum'], network: 'Ethereum', marketId: 'kinesis-gold',
    contracts: { ethereum: '0x14dab79fd7b7b3f748d434812fd6a9aac460ea52' },
    sourceLabel: 'Kinesis issuer platform', sourceUrl: 'https://kinesis.money/',
    snapshot: 'Allocated-gold backing · per-gram pricing', snapshotAsOf: LIVE,
    auditNote: ISSUER_LINKED, riskNote: NO_POLICY, heartbeat: 'Market feed',
  },
  {
    id: 'nvidia-xstock', title: 'NVIDIA xStock', name: 'nvdax.rwa.verdict.eth', ticker: 'NVDAX',
    assetClass: 'Tokenized Stock', issuer: 'Backed / xStocks', state: 'UNAVAILABLE', coverage: 'CONSENSUS_SCORED',
    description: 'A tokenized tracker certificate for NVIDIA equity exposure, fully collateralized 1:1. It is not the underlying NVIDIA share itself.',
    logo: 'https://coin-images.coingecko.com/coins/images/55633/large/Ticker_NVDA__Company_Name_NVIDIA_Corp__size_200x200_2x.png?1746862704',
    networks: ['ethereum', 'solana'], network: 'Ethereum + Solana', marketId: 'nvidia-xstock',
    contracts: {
      ethereum: '0xc845b2894dbddd03858fd2d643b4ef725fe0849d',
      solana: 'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh',
    },
    sourceLabel: 'xStocks product catalog', sourceUrl: 'https://xstocks.fi/',
    snapshot: 'Tokenized equity exposure · 1:1 collateralized tracker', snapshotAsOf: LIVE,
    auditNote: ISSUER_LINKED, riskNote: NO_POLICY, heartbeat: 'Market feed',
  },
  {
    id: 'tesla-xstock', title: 'Tesla xStock', name: 'tslax.rwa.verdict.eth', ticker: 'TSLAX',
    assetClass: 'Tokenized Stock', issuer: 'Backed / xStocks', state: 'UNAVAILABLE', coverage: 'CONSENSUS_SCORED',
    description: 'A tokenized tracker certificate for Tesla equity exposure, fully collateralized 1:1. It is not the underlying Tesla share itself.',
    logo: 'https://coin-images.coingecko.com/coins/images/55638/large/Ticker_TSLA__Company_Name_Tesla_Inc.__size_200x200_2x.png?1746863299',
    networks: ['ethereum', 'solana'], network: 'Ethereum + Solana', marketId: 'tesla-xstock',
    contracts: {
      ethereum: '0x8ad3c73f833d3f9a523ab01476625f269aeb7cf0',
      solana: 'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB',
    },
    sourceLabel: 'xStocks product catalog', sourceUrl: 'https://xstocks.fi/',
    snapshot: 'Tokenized equity exposure · 1:1 collateralized tracker', snapshotAsOf: LIVE,
    auditNote: ISSUER_LINKED, riskNote: NO_POLICY, heartbeat: 'Market feed',
  },
  {
    id: 'maple-syrup', title: 'Maple Finance', name: 'syrup.rwa.verdict.eth', ticker: 'SYRUP',
    assetClass: 'Private Credit', issuer: 'Maple Finance', state: 'UNAVAILABLE', coverage: 'CONSENSUS_SCORED',
    description: "Ecosystem token for Maple's onchain private-credit marketplace connecting institutional borrowers and lenders.",
    logo: 'https://coin-images.coingecko.com/coins/images/51232/large/_syrup_token_logo.png?1747292046',
    networks: ['ethereum', 'solana'], network: 'Ethereum + Solana', marketId: 'syrup',
    contracts: {
      ethereum: '0x643c4e15d7d62ad0abec4a9bd4b001aa3ef52d66',
      solana: '5im1F5BRESgYpiNrR7qbemnCQX6gWnBCnF6AnCTCUgJP',
    },
    sourceLabel: 'Maple issuer protocol', sourceUrl: 'https://maple.finance/',
    snapshot: 'Onchain private-credit marketplace token', snapshotAsOf: LIVE,
    auditNote: ISSUER_LINKED, riskNote: NO_POLICY, heartbeat: 'Market feed',
  },
  {
    id: 'figure-heloc', title: 'Figure Heloc', name: 'figr-heloc.rwa.verdict.eth', ticker: 'FIGR_HELOC',
    assetClass: 'Private Credit', issuer: 'Figure', state: 'UNAVAILABLE', coverage: 'CONSENSUS_SCORED',
    description: "Figure's tokenized home-equity line-of-credit exposure recorded on Provenance Blockchain.",
    logo: 'https://coin-images.coingecko.com/coins/images/68480/large/figure.png?1755863954',
    networks: ['provenance'], network: 'Provenance', marketId: 'figure-heloc',
    contracts: {},
    sourceLabel: 'Figure issuer platform', sourceUrl: 'https://figure.com/',
    snapshot: 'Home-equity credit exposure', snapshotAsOf: LIVE,
    auditNote: ISSUER_LINKED, riskNote: NO_POLICY, heartbeat: 'Market feed',
  },
  {
    id: 'blockchain-bcap', title: 'Blockchain Capital', name: 'bcap.rwa.verdict.eth', ticker: 'BCAP',
    assetClass: 'Private Equity', issuer: 'Blockchain Capital', state: 'UNAVAILABLE', coverage: 'CONSENSUS_SCORED',
    description: "Blockchain Capital's tokenized venture fund share — one of the first security tokens ever issued.",
    logo: 'https://coin-images.coingecko.com/coins/images/56040/large/bcap_logo_200.png?1748088291',
    networks: ['ethereum'], network: 'Ethereum', marketId: 'blockchain-capital',
    contracts: { ethereum: '0x8347fffb3abeb2fae5c21b09e983bdefa1a047dc' },
    sourceLabel: 'Blockchain Capital disclosures', sourceUrl: 'https://blockchain.capital/',
    snapshot: 'Tokenized venture-fund exposure', snapshotAsOf: LIVE,
    auditNote: ISSUER_LINKED, riskNote: NO_POLICY, heartbeat: 'Market feed',
  },
  {
    id: 'onre-onyc', title: 'OnRe Tokenized Reinsurance', name: 'onyc.rwa.verdict.eth', ticker: 'ONYC',
    assetClass: 'Insurance', issuer: 'OnRe', state: 'UNAVAILABLE', coverage: 'CONSENSUS_SCORED',
    description: "OnRe's tokenized reinsurance pool token targeting underwriting-linked returns on Solana.",
    logo: 'https://coin-images.coingecko.com/coins/images/67072/large/3D_ONYC.png?1779524172',
    networks: ['solana'], network: 'Solana', marketId: 'onyc',
    contracts: {
      solana: '5Y8NV33Vv7WbnLfq3zBcKSdYPrk7g2KoiQoe7M2tcxp5',
    },
    sourceLabel: 'CoinGecko market data', sourceUrl: 'https://www.coingecko.com/en/coins/onyc',
    snapshot: 'Reinsurance-linked pool token', snapshotAsOf: LIVE,
    auditNote: ISSUER_LINKED, riskNote: NO_POLICY, heartbeat: 'Market feed',
  },
  {
    id: 'bitcoin', title: 'Bitcoin', name: 'bitcoin', ticker: 'BTC', assetClass: 'Crypto',
    issuer: 'Decentralized network', state: 'UNAVAILABLE', coverage: 'REFERENCE',
    description: 'Native Bitcoin used as a liquid market benchmark. No issuer or RWA evidence is implied.',
    logo: 'https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png?1696501400',
    networks: ['bitcoin'], network: 'Bitcoin', marketId: 'bitcoin',
    contracts: {},
    sourceLabel: 'CoinGecko market data', sourceUrl: 'https://www.coingecko.com/en/coins/bitcoin',
    snapshot: 'Market benchmark', snapshotAsOf: LIVE, auditNote: 'Not an RWA', riskNote: 'Market data only', heartbeat: 'Market feed',
  },
  {
    id: 'ethereum', title: 'Ethereum', name: 'ethereum', ticker: 'ETH', assetClass: 'Crypto',
    issuer: 'Decentralized network', state: 'UNAVAILABLE', coverage: 'REFERENCE',
    description: 'Native Ethereum used as the settlement-network benchmark for Verdict and tokenized assets.',
    logo: 'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png?1696501628',
    networks: ['ethereum'], network: 'Ethereum', marketId: 'ethereum',
    contracts: {},
    sourceLabel: 'CoinGecko market data', sourceUrl: 'https://www.coingecko.com/en/coins/ethereum',
    snapshot: 'Settlement benchmark', snapshotAsOf: LIVE, auditNote: 'Not an RWA', riskNote: 'Market data only', heartbeat: 'Market feed',
  },
];

export const DEMO_ACTIVITY = [
  { label: 'AI AUDIT WRITTEN', text: 'Gemini result committed by the scoped auditor wallet', time: 'Sepolia block 11667477', tx: '0x7e578…ace5' },
  { label: 'RISK UPDATED', text: 'Independent monitor wrote the latest reason code', time: 'Sepolia block 11667479', tx: '0x22613…4053' },
  { label: 'ACCESS VERIFIED', text: 'Unauthorized text-key writes revert on both resolvers', time: 'Latest permission audit', tx: 'EAC proof' },
];
