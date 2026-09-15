export function windowLabel(minutes: number): string {
  if (minutes === 300) return '5-hour limit';
  if (minutes === 10080) return 'Weekly limit';
  if (minutes === 43200) return '30-day limit';
  if (minutes % 1440 === 0) return `${minutes / 1440}-day limit`;
  if (minutes % 60 === 0) return `${minutes / 60}-hour limit`;
  return `${minutes}-minute limit`;
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  plus: 'Plus',
  pro: 'Pro',
  prolite: 'Pro Lite',
  team: 'Team',
  business: 'Business',
  enterprise: 'Enterprise',
  edu: 'Edu',
};

export function codexPlanLabel(planType: string | null | undefined): string | undefined {
  if (!planType) return undefined;
  return PLAN_LABELS[planType] ?? planType.charAt(0).toUpperCase() + planType.slice(1);
}
