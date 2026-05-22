import { Command } from "commander";
import { resolveConfig, snapshotSelector } from "../lib/config";
import {
  buildAllBoxesJsonWithTotals, checkPrereqs, formatAllBoxesSummary, getServer,
  getServerTypePrice, listServers, listSnapshots, resolveTargetName, serverIp,
  type BoxSummaryRow, type ServerInfo, type ServerTypePrice,
} from "../lib/hcloud";
import {
  formatEur, formatEurHourly, formatHours, hoursBetween, runningCostSoFar,
  snapshotStorageCost,
} from "../lib/cost";
import { shouldDefaultToJson } from "../../../lib/output-mode";

export function statusCommand(): Command {
  return new Command("status")
    .description("List all boxes (no arg) or show one box's state, snapshots, and cost")
    .argument("[box]", "box name or id; omit to list ALL running boxes")
    .option("--json", "output JSON")
    .action((boxArg: string | undefined, opts: { json?: boolean }) => {
      const prereq = checkPrereqs();
      if (!prereq.ok) {
        console.error(`Error: ${prereq.error}`);
        process.exit(1);
      }

      const json = shouldDefaultToJson({
        envVarName: "BOX_OUTPUT",
        json: opts.json,
        env: process.env,
        isTTY: process.stdout.isTTY,
      });

      const servers = listServers();

      // No arg → fleet view: every running box, one line each, with a total.
      if (!boxArg?.trim()) {
        showAllBoxes(servers, json);
        return;
      }

      // With arg → single-box detail (default | name | id), unchanged.
      const cfg = resolveConfig();
      const resolved = resolveTargetName({ selector: boxArg }, cfg.name, servers);
      if (resolved.error) {
        console.error(`Error: ${resolved.error}`);
        process.exit(1);
      }
      showOneBox(resolved.name!, json);
    });
}

/**
 * Memoised, read-only price lookup keyed by `type@location` — boxes of the same
 * type/location share a price, so the all-boxes view only describes each once.
 */
function priceLookup(): (server: ServerInfo) => ServerTypePrice | null {
  const cache = new Map<string, ServerTypePrice | null>();
  return (server) => {
    const type = server.server_type?.name;
    if (!type) return null;
    const location = server.datacenter?.name;
    const key = `${type}@${location ?? ""}`;
    if (!cache.has(key)) {
      cache.set(key, getServerTypePrice(type, location));
    }
    return cache.get(key) ?? null;
  };
}

/** Fleet view: every running box + its snapshot count, per-box €/hr, and cost totals. */
function showAllBoxes(servers: ReturnType<typeof listServers>, json: boolean): void {
  const priceOf = priceLookup();
  const rows: BoxSummaryRow[] = servers.map((server) => {
    const snapshots = listSnapshots(snapshotSelector(server.name));
    return {
      server,
      snapshotCount: snapshots.length,
      price: priceOf(server),
      snapshotSizesGB: snapshots.map((s) => s.image_size ?? 0),
    };
  });

  if (json) {
    console.log(JSON.stringify(buildAllBoxesJsonWithTotals(rows), null, 2));
    return;
  }
  console.log(formatAllBoxesSummary(rows));
}

/** Single-box detail: server state + the full snapshot lineage + cost figures. */
function showOneBox(name: string, json: boolean): void {
  const server = getServer(name);
  const snapshots = listSnapshots(snapshotSelector(name));
  const nowIso = new Date().toISOString(); // the one impure bit: "now" for hours-up.

  // Read-only price + spend-so-far, only meaningful while the box is running.
  const price = server ? getServerTypePrice(server.server_type?.name ?? "", server.datacenter?.name) : null;
  const hoursUp = server?.created ? hoursBetween(server.created, nowIso) : 0;
  const costSoFar = price ? runningCostSoFar({ hourlyGross: price.hourlyGross, hoursUp, monthlyCapGross: price.monthlyCapGross }) : 0;
  const snapshotSizesGB = snapshots.map((s) => s.image_size ?? 0);
  const storageEurMonthly = snapshotStorageCost(snapshotSizesGB);

  if (json) {
    console.log(JSON.stringify({
      name,
      running: server !== null,
      server: server
        ? { id: server.id, type: server.server_type?.name, status: server.status, ip: serverIp(server), datacenter: server.datacenter?.name }
        : null,
      cost: server && price
        ? {
            costEurHourly: price.hourlyGross,
            costCapEurMonthly: price.monthlyCapGross,
            costSoFarEur: costSoFar,
            hoursUp,
          }
        : null,
      snapshots: {
        storageEurMonthly,
        items: snapshots.map((s) => ({ id: s.id, description: s.description, image_size: s.image_size, created: s.created })),
      },
    }, null, 2));
    return;
  }

  console.log(`=== ${name} ===`);
  if (server) {
    console.log(`  ${server.server_type?.name ?? "?"}  ${server.status}  ${serverIp(server) || "?"}  ${server.datacenter?.name ?? "?"}`);
    console.log(`  RUNNING — billing per hour. \`box down ${name}\` to snapshot + stop billing.`);
    if (price) {
      console.log(
        `  cost: ${formatEurHourly(price.hourlyGross)} · ~${formatEur(costSoFar)} so far (up ${formatHours(hoursUp)}) · cap ${formatEur(price.monthlyCapGross)}/mo`,
      );
    }
  } else {
    console.log("  (no server — cheap snapshot-only state)");
  }
  console.log("");
  console.log(`=== snapshots (${snapshotSelector(name)}) ===`);
  if (snapshots.length === 0) {
    console.log("  (none)");
  } else {
    for (const s of [...snapshots].sort((a, b) => a.created.localeCompare(b.created))) {
      const gb = s.image_size != null ? `${s.image_size.toFixed(2)}GB` : "?";
      console.log(`  ${s.id}  ${gb}  ${s.created}  ${s.description ?? ""}`.trimEnd());
    }
    console.log(`  snapshots: ${formatEur(storageEurMonthly)}/mo storage`);
  }
}
