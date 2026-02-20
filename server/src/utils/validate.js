// server/src/utils/validate.js
function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  return out;
}

function toBool(v) {
  return v === true || v === "true" || v === 1 || v === "1";
}

function toNum(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function sanitizeModules(modules, allowedKeys) {
  if (!isPlainObject(modules)) return null;
  const out = {};
  for (const k of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(modules, k)) out[k] = toBool(modules[k]);
  }
  return out;
}

function sanitizeLimits(limits, allowedKeys) {
  if (!isPlainObject(limits)) return null;
  const out = {};
  for (const k of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(limits, k)) out[k] = Math.max(0, toNum(limits[k], 0));
  }
  return out;
}

function sanitizePolicy(policy) {
  if (!isPlainObject(policy)) return null;
  const out = {
    blockIfSuspended: Object.prototype.hasOwnProperty.call(policy, "blockIfSuspended") ? toBool(policy.blockIfSuspended) : undefined,
    enforceUserLimit: Object.prototype.hasOwnProperty.call(policy, "enforceUserLimit") ? toBool(policy.enforceUserLimit) : undefined,
    enforceDailyEmail: Object.prototype.hasOwnProperty.call(policy, "enforceDailyEmail") ? toBool(policy.enforceDailyEmail) : undefined,
    enforceLeadsMonthly: Object.prototype.hasOwnProperty.call(policy, "enforceLeadsMonthly") ? toBool(policy.enforceLeadsMonthly) : undefined,
    enforceApiCallsDaily: Object.prototype.hasOwnProperty.call(policy, "enforceApiCallsDaily") ? toBool(policy.enforceApiCallsDaily) : undefined,
    strictIntegrations: Object.prototype.hasOwnProperty.call(policy, "strictIntegrations") ? toBool(policy.strictIntegrations) : undefined,
    gracePercent: Object.prototype.hasOwnProperty.call(policy, "gracePercent") ? Math.max(0, Math.min(50, toNum(policy.gracePercent, 10))) : undefined
  };

  // remove undefined keys
  Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
  return out;
}

module.exports = {
  isPlainObject,
  pick,
  sanitizeModules,
  sanitizeLimits,
  sanitizePolicy
};
