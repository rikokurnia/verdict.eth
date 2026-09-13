export function sponsoredMintEnabled(env: Record<string, string | undefined> = process.env) {
  if (env.VERDICT_SPONSORED_MINT_ENABLED === 'false') return false;
  if (!env.VERCEL) return true;
  return env.VERDICT_SPONSORED_MINT_ENABLED === 'true'
    && Boolean(env.VERDICT_RELAYER_KEYSTORE_JSON && env.VERDICT_RELAYER_KEYSTORE_PASSWORD);
}
