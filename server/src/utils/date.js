// server/src/utils/date.js
function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d = new Date()) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function sameMonth(a, b) {
  const aa = new Date(a);
  const bb = new Date(b);
  return aa.getFullYear() === bb.getFullYear() && aa.getMonth() === bb.getMonth();
}

module.exports = { startOfDay, startOfMonth, sameDay, sameMonth };
