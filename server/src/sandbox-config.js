// Builds a Plaid Sandbox custom user: a business credit card with three
// months of realistic charges, a mix of AI vendors and ordinary expenses.
// Run directly to print the JSON for Plaid's Sandbox Studio.
import { fileURLToPath } from "node:url";

const MONTHLY = [
  // [day, description, amount]
  [2, "ANTHROPIC, PBC API CREDITS", 2400],
  [3, "OPENAI *API USAGE", 1850.4],
  [3, "GOOGLE *WORKSPACE", 216],
  [5, "CURSOR, INC. TEAMS", 640],
  [6, "GITHUB COPILOT BUSINESS", 342],
  [8, "WEWORK VANCOUVER", 1450],
  [9, "ANTHROPIC, PBC API CREDITS", 3000],
  [11, "SLACK TECHNOLOGIES", 187.5],
  [12, "OPENAI *CHATGPT TEAM", 300],
  [14, "UBER *TRIP", 46.2],
  [15, "AMAZON WEB SERVICES", 2310.75],
  [17, "PERPLEXITY AI PRO", 200],
  [18, "FIGMA", 225],
  [19, "ELEVENLABS.IO", 99],
  [21, "ANTHROPIC, PBC API CREDITS", 2500],
  [22, "LINEAR ORBIT INC", 128],
  [24, "OPENAI *API USAGE", 1420.15],
  [25, "AIR CANADA", 612.3],
  [27, "MIDJOURNEY INC", 120],
  [28, "VERCEL INC", 480],
];

// Spend grows month over month, as AI budgets do.
const GROWTH = [0.78, 0.9, 1];

function iso(d) {
  return d.toISOString().slice(0, 10);
}

export function buildCustomUser(today = new Date()) {
  const transactions = [];
  for (let back = 2; back >= 0; back--) {
    const month = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 1));
    for (const [day, description, amount] of MONTHLY) {
      const date = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day));
      if (date > today) continue;
      const scaled = Math.round(amount * GROWTH[2 - back] * 100) / 100;
      transactions.push({ date_transacted: iso(date), date_posted: iso(date), amount: scaled, description, currency: "USD" });
    }
  }
  return {
    override_accounts: [
      {
        type: "credit",
        subtype: "credit card",
        starting_balance: 0,
        meta: { name: "Business Visa", official_name: "Business Platinum Visa" },
        transactions,
      },
    ],
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(buildCustomUser(), null, 2));
}
