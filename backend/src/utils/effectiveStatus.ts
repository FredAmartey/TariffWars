/**
 * Resolve a row's status as of now, rather than as of the last refresh.
 *
 * Status is written into the CSV by the weekly agent, so a tariff scheduled to
 * take effect between two Mondays keeps reporting "Proposed" while it is
 * already being collected. The patented-pharmaceuticals row is the live case:
 * due to start 31 July 2026, with the next refresh three days behind it.
 *
 * Only "Proposed" is promoted. It is the one status that carries a committed
 * start date: "Threatened" and "Under Investigation" name no date they have to
 * honor, "Delayed" exists precisely because its date slipped, and the terminal
 * states are settled. A row whose date is "TBD" promises nothing either, so an
 * unparseable date leaves the status alone.
 *
 * The CSV remains the source of truth; this is the reading of it that is true
 * today. scripts/record-history.mjs repeats the rule so the daily snapshot and
 * the live API can never disagree about which tariffs are active.
 */
export const effectiveStatus = (
  status: string,
  effectiveDate: string,
  now: Date = new Date()
): string => {
  if (status !== "Proposed") return status;

  // The dates are written bare ("July 31, 2026"), which Date.parse reads in the
  // host's zone: a tariff would turn over at midnight in whatever zone the
  // process happened to run in, five hours late on a laptop in New York and on
  // time on Vercel. Pin the parse to UTC so both agree. "TBD" still yields NaN.
  const startsAt = Date.parse(`${effectiveDate} UTC`);
  if (Number.isNaN(startsAt)) return status;

  return startsAt <= now.getTime() ? "Active" : status;
};
