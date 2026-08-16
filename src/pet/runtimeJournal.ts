export interface RuntimeJournalEntry {
  at: number;
  kind: "behavior" | "scheduler-error" | "recovery";
  state?: string;
  frame?: string;
  source?: string;
  task?: string;
}

/**
 * A small local-only flight recorder. It intentionally accepts only enum-like
 * runtime fields: never typed text, window titles, URLs, paths, or keycodes.
 */
export class RuntimeJournal {
  private readonly entries: RuntimeJournalEntry[] = [];

  constructor(private readonly capacity = 80) {}

  record(entry: RuntimeJournalEntry): void {
    this.entries.push({ ...entry });
    if (this.entries.length > this.capacity) {
      this.entries.splice(0, this.entries.length - this.capacity);
    }
  }

  snapshot(): RuntimeJournalEntry[] {
    return this.entries.map(entry => ({ ...entry }));
  }
}
