// Pure helper for deciding whether a pasabuy can be joined and, if not, why.
//
// The precedence ladder is fixed by Requirement 4.4 of the
// pasabuy-management-enhancements spec and is exercised by Property 10
// (Detail-page CTA precedence is deterministic). The first matching rule wins:
//
//   (a) Cancelled by organizer  — status === 'cancelled'
//   (b) Deadline passed         — now >= deadline
//   (c) Slots full              — joinedCount >= max_slots
//   (d) No longer accepting joins — status is in_progress | completed | expired
//   otherwise                   — joinable

export type UnavailabilityReason =
  | 'Cancelled by organizer'
  | 'Deadline passed'
  | 'Slots full'
  | 'No longer accepting joins';

export type JoinabilityResult =
  | { joinable: true }
  | { joinable: false; reason: UnavailabilityReason };

export type GroupBuyJoinability = {
  status: 'active' | 'in_progress' | 'completed' | 'expired' | 'cancelled';
  max_slots: number;
  deadline: string | Date;
};

/**
 * Decide whether a pasabuy is joinable for a viewer who does not yet have
 * a participants row. Pure: returns the same output for the same inputs.
 *
 * @param gb          Pasabuy fields needed to evaluate joinability.
 * @param joinedCount Count of participants with status in
 *                    {deposited, delivered, confirmed} for this pasabuy.
 * @param now         Current time. Defaults to `new Date()` for callers;
 *                    tests should inject a fixed clock.
 */
export function computeJoinability(
  gb: GroupBuyJoinability,
  joinedCount: number,
  now: Date = new Date()
): JoinabilityResult {
  // (a) Cancellation takes precedence over every other reason.
  if (gb.status === 'cancelled') {
    return { joinable: false, reason: 'Cancelled by organizer' };
  }

  // (b) Deadline check next. Normalize string deadlines via the Date ctor.
  const deadline = gb.deadline instanceof Date ? gb.deadline : new Date(gb.deadline);
  if (now.getTime() >= deadline.getTime()) {
    return { joinable: false, reason: 'Deadline passed' };
  }

  // (c) Slot capacity.
  if (joinedCount >= gb.max_slots) {
    return { joinable: false, reason: 'Slots full' };
  }

  // (d) Any non-active status that survived the earlier rules
  //     (in_progress | completed | expired).
  if (gb.status !== 'active') {
    return { joinable: false, reason: 'No longer accepting joins' };
  }

  return { joinable: true };
}
