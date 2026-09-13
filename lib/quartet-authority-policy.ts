/** Each report is stored on its agent identity, under an asset-specific text key.
 * Resolver grants are key-scoped, not name-scoped. No extra registries/names needed.
 */
export const QUARTET_ROLES = ['legal', 'custody', 'technical', 'consensus'] as const;
export type QuartetRole = typeof QUARTET_ROLES[number];
export const QUARTET_ASSET_LABELS = [
  'buidl', 'usyc', 'usdy', 'ousg', 'benji', 'ustb', 'jtrsy', 'eutbl', 'spiko-eur',
  'jaaa', 'ylds', 'xaut', 'paxg', 'kau', 'nvdax', 'tslax', 'syrup', 'figr-heloc', 'bcap', 'onyc',
] as const;
export function quartetReportKey(assetName: string) {
  if (assetName === 'usd-yield-001.acme.verdict.eth') return 'verdict.agent.report.demo';
  const label = assetName.replace(/\.rwa\.verdict\.eth$/, '');
  if (!QUARTET_ASSET_LABELS.some((allowed) => allowed === label) || label === assetName) {
    throw new Error('Quartet report requires a supported canonical asset name.');
  }
  return `verdict.agent.report.${label}`;
}
export const QUARTET_REPORT_KEYS = [
  'verdict.agent.report.demo', ...QUARTET_ASSET_LABELS.map((label) => `verdict.agent.report.${label}`),
];
export const QUARTET_METADATA_KEYS = [
  'verdict.schema', 'verdict.agent.role', 'verdict.agent.worker', 'verdict.agent.publicationMode',
] as const;
export const QUARTET_DISCLOSURE = 'AI runs offchain. Four team-operated worker wallets publish separate reports. Recovery admins can grant writes/upgrade resolvers, and registry owners retain resolver-redirection powers. This is not externally independent institutional auditing.';
