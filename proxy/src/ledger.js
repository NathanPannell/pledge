import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

// Append-only JSONL ledger. Totals are kept in memory and rebuilt from the
// file on start, so a restart does not lose the running summary.
export function createLedger(path) {
  const totals = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, pledgeUsd: 0 };
  const byContributor = new Map();

  function add(entry) {
    totals.calls += 1;
    totals.inputTokens += entry.inputTokens;
    totals.outputTokens += entry.outputTokens;
    totals.costUsd += entry.costUsd;
    totals.pledgeUsd += entry.pledgeUsd;
    const key = entry.contributor ?? "anonymous";
    byContributor.set(key, (byContributor.get(key) ?? 0) + entry.pledgeUsd);
  }

  if (path && existsSync(path)) {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (line.trim()) add(JSON.parse(line));
    }
  }

  return {
    record(entry) {
      if (path) {
        mkdirSync(dirname(path), { recursive: true });
        appendFileSync(path, JSON.stringify(entry) + "\n");
      }
      add(entry);
    },
    summary() {
      return {
        ...totals,
        contributors: Object.fromEntries(byContributor),
      };
    },
  };
}
