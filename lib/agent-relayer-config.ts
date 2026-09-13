export function sponsoredMintEnabled(env: Record<string, string | undefined> = process.env) {
  if (env.VERDICT_SPONSORED_MINT_ENABLED === 'false') return false;
  if (!env.VERCEL) return true;
  if ((env.VERDICT_RELAYER_PRIVATE_KEY || '').trim()) return env.VERDICT_SPONSORED_MINT_ENABLED === 'true';
  return env.VERDICT_SPONSORED_MINT_ENABLED === 'true'
    && Boolean(env.VERDICT_RELAYER_KEYSTORE_JSON && env.VERDICT_RELAYER_KEYSTORE_PASSWORD);
}
