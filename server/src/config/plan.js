const PLAN_LIMITS = {
  free: {
    maxUsers: 30,
    maxLeads: 10000
  },
  basic: {
    maxUsers: 100,
    maxLeads: 100000
  },
  pro: {
    maxUsers: Infinity,
    maxLeads: Infinity
  }
};

function getPlanLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}

module.exports = { PLAN_LIMITS, getPlanLimits };
