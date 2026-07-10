import { describe, it, expect } from "vitest";
import { buildReminderItem, REMINDER_LEAD_MS } from "@/lib/data/outings";
import { reminderRecipients } from "@/lib/jobs/outing-reminders";

describe("buildReminderItem (pre-event RSVP reminder queue row)", () => {
  const NOW = Date.parse("2099-06-01T12:00:00.000Z");

  it("is due 24h before the occurrence, bucketed by UTC due-day", () => {
    const occurrence = "2099-06-15T18:00:00.000Z";
    const row = buildReminderItem("out1", occurrence, NOW);
    expect(row.dueTs).toBe("2099-06-14T18:00:00.000Z");
    expect(row.pk).toBe("REMDAY#2099-06-14");
    expect(row.sk).toBe("REM#2099-06-14T18:00:00.000Z#out1");
    expect(row.occurrenceTs).toBe(occurrence);
    expect(row.entity).toBe("OUTINGREM");
  });

  it("clamps the due time to NOW for outings created inside the lead window", () => {
    const occurrence = new Date(NOW + REMINDER_LEAD_MS / 2).toISOString(); // 12h out
    const row = buildReminderItem("out2", occurrence, NOW);
    expect(row.dueTs).toBe(new Date(NOW).toISOString());
    expect(row.pk).toBe(`REMDAY#${new Date(NOW).toISOString().slice(0, 10)}`);
  });
});

describe("reminderRecipients (who gets the 'can you make it?' ask)", () => {
  const members = ["organizer", "silent", "maybe", "going", "declined", "waitlisted"];
  const rsvps = [
    { uid: "maybe", status: "maybe" },
    { uid: "going", status: "going" },
    { uid: "declined", status: "declined" },
    { uid: "waitlisted", status: "waitlist" },
  ];

  it("asks members with no answer or a 'maybe'; never the organizer or decided members", () => {
    expect(reminderRecipients(members, rsvps, "organizer")).toEqual(["silent", "maybe"]);
  });

  it("asks nobody when everyone has decided", () => {
    expect(
      reminderRecipients(["a", "b"], [{ uid: "a", status: "going" }, { uid: "b", status: "declined" }], "org"),
    ).toEqual([]);
  });
});
