/**
 * Operator-curated identity facts for the 20-asset RWA catalog.
 * These are stable public facts (legal entity names, registration status)
 * entered by the operator — agents MUST treat them as `curated` grounding,
 * never as live-verified, and must emit `unknown` for anything not listed.
 * `asOf` stamps the curation date so staleness is visible.
 */
export type CuratedFacts = {
  entity?: string;
  administrator?: string;
  domicile?: string;
  framework?: string;
  eligibility?: string;
  custodian?: string;
};

const AS_OF = '2026-09';
const RESTRICTED = 'Transfer-restricted; eligibility per issuer docs (typically accredited / qualified purchasers, KYC required)';

export const CURATED_REGISTRY: Record<string, CuratedFacts> = {
  'blackrock-usd-institutional-digital-liquidity-fund': { entity: 'BlackRock', administrator: 'Securitize', eligibility: RESTRICTED },
  'hashnote-usyc': { entity: 'Circle (Hashnote)', eligibility: RESTRICTED },
  'ondo-us-dollar-yield': { entity: 'Ondo Finance', eligibility: RESTRICTED },
  ousg: { entity: 'Ondo Finance', eligibility: RESTRICTED },
  'franklin-templeton-benji': {
    entity: 'Franklin Templeton',
    domicile: 'United States',
    framework: 'US-registered mutual fund (FOBXX, Investment Company Act of 1940)',
    eligibility: 'KYC via Benji platform; 1 BENJI = 1 fund share',
  },
  'superstate-short-duration-us-government-securities-fund-ustb': { entity: 'Superstate', eligibility: RESTRICTED },
  'janus-henderson-anemoy-treasury-fund': { entity: 'Janus Henderson / Anemoy', administrator: 'Centrifuge', eligibility: RESTRICTED },
  eutbl: { entity: 'Spiko', eligibility: 'Eligible European investors; see issuer docs' },
  'spiko-amundi-overnight-swap-fund-eur': { entity: 'Spiko / Amundi', eligibility: 'Eligible European investors; see issuer docs' },
  'janus-henderson-anemoy-aaa-clo-fund': { entity: 'Janus Henderson / Anemoy', administrator: 'Centrifuge', eligibility: RESTRICTED },
  ylds: { entity: 'Figure', domicile: 'United States', framework: 'SEC-registered yield-bearing stablecoin', eligibility: 'KYC; see issuer docs' },
  'tether-gold': { entity: 'Tether', eligibility: 'Generally permissionless ERC-20/TRC-20; 1 XAUT tracks one troy ounce' },
  'pax-gold': {
    entity: 'Paxos Trust Company',
    domicile: 'New York, United States',
    framework: 'NY limited-purpose trust company; regulated ERC-20',
    eligibility: 'Generally permissionless ERC-20; 1 PAXG = 1 troy ounce allocated gold',
  },
  'kinesis-gold': { entity: 'Kinesis', eligibility: 'See issuer docs' },
  'nvidia-xstock': { entity: 'Backed Assets (JE) Limited', domicile: 'Jersey', framework: 'Tracker certificate (ISIN-prospected); 1:1 collateralized', eligibility: 'Non-US eligible investors only; not the underlying share' },
  'tesla-xstock': { entity: 'Backed Assets (JE) Limited', domicile: 'Jersey', framework: 'Tracker certificate (ISIN-prospected); 1:1 collateralized', eligibility: 'Non-US eligible investors only; not the underlying share' },
  syrup: { entity: 'Maple Finance', eligibility: 'Protocol governance token; permissionless' },
  'figure-heloc': { entity: 'Figure', eligibility: RESTRICTED },
  'blockchain-capital': { entity: 'Blockchain Capital', eligibility: RESTRICTED },
  onyc: { entity: 'OnRe', eligibility: 'See issuer docs' },
};

export function curatedFacts(marketId: string): CuratedFacts & { asOf: string } {
  return { asOf: AS_OF, ...(CURATED_REGISTRY[marketId] ?? {}) };
}
