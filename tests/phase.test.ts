import { describe, expect, it } from "vitest";
import {
  currentProgramIndex,
  eventStartMs,
  getEventPhase,
  isRsvpClosed,
  programWithInstants,
} from "@/lib/phase";
import { event } from "@/content/event.config";

const START = eventStartMs();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe("getEventPhase", () => {
  it("is countdown well before the debut", () => {
    expect(getEventPhase(START - 60 * DAY)).toBe("countdown");
  });

  it("enters final-week exactly seven days out", () => {
    expect(getEventPhase(START - 7 * DAY + 1000)).toBe("final-week");
    expect(getEventPhase(START - 7 * DAY - 1000)).toBe("countdown");
  });

  it("enters event-day on the morning of", () => {
    expect(getEventPhase(START - 11 * HOUR)).toBe("event-day");
    expect(getEventPhase(START - 13 * HOUR)).toBe("final-week");
  });

  it("is event-day during the party", () => {
    expect(getEventPhase(START + HOUR)).toBe("event-day");
    expect(getEventPhase(START + 5 * HOUR)).toBe("event-day");
  });

  it("becomes past once the night is over", () => {
    expect(getEventPhase(START + 7 * HOUR)).toBe("past");
    expect(getEventPhase(START + 365 * DAY)).toBe("past");
  });
});

describe("isRsvpClosed", () => {
  const deadline = Date.parse(event.rsvp.deadlineIso);

  it("is open before the deadline", () => {
    expect(isRsvpClosed(deadline - DAY)).toBe(false);
  });

  it("is closed after the deadline", () => {
    expect(isRsvpClosed(deadline + 1000)).toBe(true);
  });

  it("is closed once the event is past, regardless of deadline", () => {
    expect(isRsvpClosed(START + 7 * HOUR)).toBe(true);
  });

  it("keeps the deadline before the debut", () => {
    // A deadline after the event would mean the form accepts replies during the
    // party. Guard the config, not just the code.
    expect(deadline).toBeLessThan(START);
  });
});

describe("programWithInstants", () => {
  const program = programWithInstants();

  it("resolves every entry to a real instant", () => {
    expect(program).toHaveLength(event.program.length);
    for (const item of program) {
      expect(item.startsAt).toBeLessThan(Number.MAX_SAFE_INTEGER);
      expect(Number.isFinite(item.startsAt)).toBe(true);
    }
  });

  it("produces times in ascending order", () => {
    const times = program.map((p) => p.startsAt);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("anchors 6:00 PM to the debut start instant", () => {
    const grandEntrance = program.find((p) => p.time === "6:00 PM");
    expect(grandEntrance?.startsAt).toBe(START);
  });

  it("converts 12-hour times correctly across the noon boundary", () => {
    const five = program.find((p) => p.time === "5:00 PM");
    const ten = program.find((p) => p.time === "10:00 PM");

    expect(five!.startsAt).toBe(START - HOUR);
    expect(ten!.startsAt).toBe(START + 4 * HOUR);
  });
});

describe("currentProgramIndex", () => {
  const program = programWithInstants();

  it("is -1 before anything starts", () => {
    expect(currentProgramIndex(program, START - 5 * HOUR)).toBe(-1);
  });

  it("tracks the last item whose time has passed", () => {
    expect(currentProgramIndex(program, START)).toBe(1); // Grand Entrance
    expect(currentProgramIndex(program, START + 2 * HOUR + 10 * 60_000)).toBe(5);
  });

  it("stays on the final item after the programme ends", () => {
    expect(currentProgramIndex(program, START + 10 * HOUR)).toBe(program.length - 1);
  });
});
