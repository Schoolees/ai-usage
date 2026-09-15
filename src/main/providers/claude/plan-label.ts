export function claudePlanLabel(subscriptionType?: string | null, rateLimitTier?: string | null): string | undefined {
  if (!subscriptionType) return undefined;
  const base = subscriptionType.charAt(0).toUpperCase() + subscriptionType.slice(1);
  const multiplier = rateLimitTier?.match(/_(\d+x)$/)?.[1];
  return multiplier ? `${base} (${multiplier})` : base;
}
