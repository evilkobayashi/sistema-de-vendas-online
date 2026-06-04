export type FeatureFlags = {
  patients_v2: boolean;
  eligibility_guard: boolean;
  communications: boolean;
};

function envBool(name: string, defaultValue: boolean) {
  const raw = process.env[name];
  if (raw == null) return defaultValue;
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

export function getFeatureFlags(): FeatureFlags {
  return {
    patients_v2: envBool('FEATURE_PATIENTS_V2', true),
    eligibility_guard: envBool('FEATURE_ELIGIBILITY_GUARD', true),
    communications: envBool('FEATURE_COMMUNICATIONS', true)
  };
}
