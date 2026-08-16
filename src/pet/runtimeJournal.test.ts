import { describe, expect, it } from "vitest";
import { RuntimeJournal } from "./runtimeJournal";

describe("RuntimeJournal", () => {
  it("keeps only the newest bounded entries", () => {
    const journal = new RuntimeJournal(2);
    journal.record({ at: 1, kind: "behavior", state: "idle" });
    journal.record({ at: 2, kind: "behavior", state: "walk" });
    journal.record({ at: 3, kind: "recovery", frame: "idle" });
    expect(journal.snapshot()).toEqual([
      { at: 2, kind: "behavior", state: "walk" },
      { at: 3, kind: "recovery", frame: "idle" },
    ]);
  });

  it("returns copies that callers cannot mutate", () => {
    const journal = new RuntimeJournal(2);
    journal.record({ at: 1, kind: "behavior", state: "idle" });
    journal.snapshot()[0].state = "drag";
    expect(journal.snapshot()[0].state).toBe("idle");
  });
});
