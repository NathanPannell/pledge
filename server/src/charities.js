// Monthly charity rotation. October goes to the StormHacks 2026 cause; later
// months go to Canadian charities whose work matches UN SDG 17 targets.
// Proposed only: each charity must agree before it is listed as a recipient.

export const ROTATION = [
  {
    name: "VGH & UBC Hospital Foundation",
    focus: "Care and research at Vancouver's hospitals. This month's StormHacks 2026 cause.",
    target: "SDG 17.17 · Partnerships with civil society",
    registration: "132173063RR0001",
    address: "190-855 West 12th Ave, Vancouver, BC V5Z 1M9",
  },
  {
    name: "Engineers Without Borders Canada",
    focus: "Builds technology and business capacity with ventures in sub-Saharan Africa.",
    target: "SDG 17.8 · Technology for the least developed countries",
  },
  {
    name: "World University Service of Canada",
    focus: "Education and economic opportunity, including student refugee sponsorship at Canadian campuses.",
    target: "SDG 17.9 · Capacity building",
  },
  {
    name: "Cuso International",
    focus: "Partners with local organizations on jobs, skills and economic inclusion.",
    target: "SDG 17.3 · New financial resources for developing countries",
  },
];

// October 2026 is the first month of the rotation.
const START = { year: 2026, month: 9 };

export function charityFor(date = new Date()) {
  const d = new Date(date);
  const months = (d.getUTCFullYear() - START.year) * 12 + (d.getUTCMonth() - START.month);
  const i = ((months % ROTATION.length) + ROTATION.length) % ROTATION.length;
  return ROTATION[i];
}

// The next n months, starting with the current one.
export function schedule(n = 4, from = new Date()) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + k, 1));
    out.push({ month: d.toISOString().slice(0, 7), ...charityFor(d) });
  }
  return out;
}
