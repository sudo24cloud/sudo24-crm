const express = require("express");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const { authRequired, attachUser } = require("../middleware/auth");

const router = express.Router();

// helper: manager team filter
async function allowedUserIds(req) {
  const base = { companyId: req.dbUser.companyId };

  if (req.dbUser.role === "admin") return null; // all users
  if (req.dbUser.role === "employee") return [req.dbUser._id];

  // manager: self + team employees
  const team = await User.find({ ...base, managerId: req.dbUser._id }).select("_id");
  return [req.dbUser._id, ...team.map(u => u._id)];
}

/**
 * GET /api/reports/attendance
 * query:
 *  - userId? (optional) - filter one user
 *  - granularity=hour|day|week|month (default day)
 *  - from=YYYY-MM-DD (optional)
 *  - to=YYYY-MM-DD (optional)
 *
 * Returns grouped totals:
 *  { key, sessions, workMs, breakMs, netMs }
 */
router.get("/attendance", authRequired, attachUser, async (req, res) => {
  const granularity = String(req.query.granularity || "day");
  const from = req.query.from ? new Date(req.query.from) : null;
  const to = req.query.to ? new Date(req.query.to) : null;
  const userId = req.query.userId ? String(req.query.userId) : null;

  const allow = await allowedUserIds(req);
  if (allow && userId && !allow.map(String).includes(userId)) return res.status(403).json({ message: "Forbidden" });

  const match = { companyId: req.dbUser.companyId };
  if (allow) match.userId = { $in: allow };
  if (userId) match.userId = userId;

  // filter by dateKey (string YYYY-MM-DD)
  if (req.query.from || req.query.to) {
    match.dateKey = {};
    if (req.query.from) match.dateKey.$gte = String(req.query.from);
    if (req.query.to) match.dateKey.$lte = String(req.query.to);
  }

  // build group key
  let keyExpr = "$dateKey"; // default day (already YYYY-MM-DD)

  if (granularity === "month") {
    keyExpr = { $substrBytes: ["$dateKey", 0, 7] }; // YYYY-MM
  }

  if (granularity === "week") {
    // use ISO week from checkInAt (fallback to createdAt)
    keyExpr = {
      $concat: [
        { $toString: { $isoWeekYear: { $ifNull: ["$checkInAt", "$createdAt"] } } },
        "-W",
        { $toString: { $isoWeek: { $ifNull: ["$checkInAt", "$createdAt"] } } }
      ]
    };
  }

  if (granularity === "hour") {
    // YYYY-MM-DD HH:00 based on checkInAt
    keyExpr = {
      $dateToString: {
        format: "%Y-%m-%d %H:00",
        date: { $ifNull: ["$checkInAt", "$createdAt"] },
        timezone: "Asia/Kolkata"
      }
    };
  }

  const pipeline = [
    { $match: match },
    {
      $addFields: {
        // compute breakMs in aggregation
        breakMs: {
          $sum: {
            $map: {
              input: { $ifNull: ["$breaks", []] },
              as: "b",
              in: {
                $max: [
                  0,
                  {
                    $subtract: [
                      { $ifNull: ["$$b.endAt", "$$NOW"] },
                      "$$b.startAt"
                    ]
                  }
                ]
              }
            }
          }
        },
        workMs: {
          $cond: [
            { $and: ["$checkInAt"] },
            {
              $max: [
                0,
                {
                  $subtract: [
                    { $ifNull: ["$checkOutAt", "$$NOW"] },
                    "$checkInAt"
                  ]
                }
              ]
            },
            0
          ]
        }
      }
    },
    {
      $addFields: {
        netMs: { $max: [0, { $subtract: ["$workMs", "$breakMs"] }] }
      }
    },
    {
      $group: {
        _id: keyExpr,
        sessions: { $sum: 1 },
        workMs: { $sum: "$workMs" },
        breakMs: { $sum: "$breakMs" },
        netMs: { $sum: "$netMs" }
      }
    },
    { $sort: { _id: 1 } }
  ];

  const rows = await Attendance.aggregate(pipeline);
  res.json(rows.map(r => ({
    key: r._id,
    sessions: r.sessions,
    workMs: r.workMs,
    breakMs: r.breakMs,
    netMs: r.netMs
  })));
});

module.exports = router;
