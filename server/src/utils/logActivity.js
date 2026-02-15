const Activity = require("../models/Activity");

async function logActivity({ companyId, actorId, entityType, entityId, action, meta }) {
  try {
    await Activity.create({ companyId, actorId, entityType, entityId, action, meta: meta || {} });
  } catch (e) {
    // don't break main flow
  }
}

module.exports = { logActivity };
