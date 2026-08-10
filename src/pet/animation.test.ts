import { describe, expect, it } from "vitest";
import { animatedCel } from "./animation";

describe("animatedCel", () => {
  it("alternates typing cels at the normal action cadence", () => {
    const frames = new Set(["type_paw", "type_paw_alt"]);
    expect(animatedCel("type_paw", 0, frames)).toBe("type_paw");
    expect(animatedCel("type_paw", 180, frames)).toBe("type_paw_alt");
    expect(animatedCel("type_paw", 360, frames)).toBe("type_paw");
  });

  it("uses a faster cadence for intense typing", () => {
    const frames = new Set(["type_intense", "type_intense_alt"]);
    expect(animatedCel("type_intense", 90, frames)).toBe("type_intense_alt");
    expect(animatedCel("type_intense", 180, frames)).toBe("type_intense");
  });

  it("falls back cleanly for community packs without alternate cels", () => {
    expect(animatedCel("drink", 180, new Set(["drink"]))).toBe("drink");
  });

  it("gives celebration actions anticipation, peak and recovery", () => {
    const frames = new Set(["tail_wag", "jump", "happy_jump", "land", "tail_wag_alt", "pet_happy"]);
    expect(animatedCel("happy_jump", 0, frames)).toBe("tail_wag");
    expect(animatedCel("happy_jump", 140, frames)).toBe("jump");
    expect(animatedCel("happy_jump", 280, frames)).toBe("happy_jump");
    expect(animatedCel("happy_jump", 420, frames)).toBe("land");
    expect(animatedCel("happy_jump", 700, frames)).toBe("pet_happy");
  });

  it("filters unsupported sequence cels for community packs", () => {
    const frames = new Set(["walk_a"]);
    expect(animatedCel("walk_a", 170, frames)).toBe("walk_a");
  });
});
