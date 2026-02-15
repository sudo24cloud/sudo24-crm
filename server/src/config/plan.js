const PLAN_LIMITS = {
  free: {
    maxUsers: 3,
    maxLeads: 100
  },
  basic: {
    maxUsers: 10,
    maxLeads: 1000
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
