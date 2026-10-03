// Builds a Plaid Sandbox custom user: a business credit card with three
// months of realistic charges, a mix of AI vendors and ordinary expenses.
// Run directly to print the JSON for Plaid's Sandbox Studio.
import { fileURLToPath } from "node:url";

const MONTHLY = [
  // [day, description, amount]
  [1, "WEWORK VANCOUVER", 4200],
  [2, "ANTHROPIC, PBC API CREDITS", 3800],
  [3, "OPENAI *API USAGE", 2950.4],
  [3, "GOOGLE *WORKSPACE", 432],
  [4, "SALESFORCE.COM", 3150],
  [5, "CURSOR, INC. TEAMS", 960],
  [6, "GITHUB COPILOT BUSINESS", 513],
  [7, "AMAZON WEB SERVICES", 6310.75],
  [9, "ANTHROPIC, PBC API CREDITS", 4500],
  [10, "HUBSPOT INC", 1780],
  [11, "SLACK TECHNOLOGIES", 375],
  [12, "OPENAI *CHATGPT TEAM", 600],
  [13, "DELL CANADA", 2890.5],
  [14, "UBER *TRIP", 46.2],
  [15, "GOOGLE CLOUD", 1840.6],
  [16, "AIR CANADA", 1612.3],
  [17, "PERPLEXITY AI PRO", 400],
  [18, "FIGMA", 450],
  [19, "ELEVENLABS.IO", 330],
  [20, "FAIRMONT HOTEL VANCOUVER", 1204.8],
  [21, "ANTHROPIC, PBC API CREDITS", 4200],
  [22, "LINEAR ORBIT INC", 256],
  [23, "ZOOM.US", 299],
  [24, "OPENAI *API USAGE", 2420.15],
  [25, "CANADA POST", 88.4],
  [26, "NOTION LABS", 384],
  [27, "MIDJOURNEY INC", 240],
  [28, "VERCEL INC", 960],
];

// Spend grows month over month, as AI budgets do. Oldest month first.
const GROWTH = [0.7, 0.8, 0.9, 1];

function iso(d) {
  return d.toISOString().slice(0, 10);
}

export function buildCustomUser(today = new Date()) {
  const transactions = [];
  const oldest = GROWTH.length - 1;
  for (let back = oldest; back >= 0; back--) {
    const month = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 1));
    for (const [day, description, amount] of MONTHLY) {
      const date = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day));
      if (date > today) continue;
      const scaled = Math.round(amount * GROWTH[oldest - back] * 100) / 100;
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
