import { describe, it, expect } from "vitest";
import { irealStyleToPracticeStyle } from "../src/index";

describe("irealStyleToPracticeStyle", () => {
  it("maps swing variants", () => {
    expect(irealStyleToPracticeStyle("Medium Swing")).toBe("swing");
    expect(irealStyleToPracticeStyle("Up Tempo Swing")).toBe("hardBop");
    expect(irealStyleToPracticeStyle("Medium Up Swing")).toBe("swing");
    expect(irealStyleToPracticeStyle("Slow Swing")).toBe("ballad");
  });

  it("maps bossa", () => {
    expect(irealStyleToPracticeStyle("Bossa Nova")).toBe("bossa");
    expect(irealStyleToPracticeStyle("Even 8ths Bossa")).toBe("bossa");
  });

  it("maps latin", () => {
    expect(irealStyleToPracticeStyle("Latin")).toBe("latin");
    expect(irealStyleToPracticeStyle("Samba")).toBe("latin");
    expect(irealStyleToPracticeStyle("Afro Cuban")).toBe("latin");
  });

  it("maps ballad", () => {
    expect(irealStyleToPracticeStyle("Ballad")).toBe("ballad");
    expect(irealStyleToPracticeStyle("Slow")).toBe("ballad");
  });

  it("maps funk/rock", () => {
    expect(irealStyleToPracticeStyle("Funk")).toBe("funk");
    expect(irealStyleToPracticeStyle("Rock")).toBe("funk");
    expect(irealStyleToPracticeStyle("Even 8ths")).toBe("funk");
  });

  it("defaults to swing for unknown", () => {
    expect(irealStyleToPracticeStyle("")).toBe("swing");
    expect(irealStyleToPracticeStyle(undefined)).toBe("swing");
    expect(irealStyleToPracticeStyle("Something Unknown")).toBe("swing");
  });

  it("maps new styles (waltz, blues, modal, fusion, ecm)", () => {
    expect(irealStyleToPracticeStyle("Waltz")).toBe("jazzWaltz");
    expect(irealStyleToPracticeStyle("Jazz Waltz")).toBe("jazzWaltz");
    expect(irealStyleToPracticeStyle("3/4 Swing")).toBe("jazzWaltz");
    expect(irealStyleToPracticeStyle("Blues")).toBe("shuffleBlues");
    expect(irealStyleToPracticeStyle("Shuffle")).toBe("shuffleBlues");
    expect(irealStyleToPracticeStyle("Modal")).toBe("modal");
    expect(irealStyleToPracticeStyle("Fusion")).toBe("fusion");
    expect(irealStyleToPracticeStyle("ECM")).toBe("ecm");
    expect(irealStyleToPracticeStyle("Fast Swing")).toBe("hardBop");
  });

  it("case-insensitive", () => {
    expect(irealStyleToPracticeStyle("BOSSA NOVA")).toBe("bossa");
    expect(irealStyleToPracticeStyle("medium swing")).toBe("swing");
  });

  it("maps new genre styles (neoSoul, contemporaryJazz, mathRock, idm)", () => {
    expect(irealStyleToPracticeStyle("Neo Soul")).toBe("neoSoul");
    expect(irealStyleToPracticeStyle("R&B")).toBe("neoSoul");
    expect(irealStyleToPracticeStyle("Gospel")).toBe("neoSoul");
    expect(irealStyleToPracticeStyle("Contemporary Jazz")).toBe("contemporaryJazz");
    expect(irealStyleToPracticeStyle("Nordic Jazz")).toBe("contemporaryJazz");
    expect(irealStyleToPracticeStyle("European Jazz")).toBe("contemporaryJazz");
    expect(irealStyleToPracticeStyle("Math Rock")).toBe("mathRock");
    expect(irealStyleToPracticeStyle("Prog Rock")).toBe("mathRock");
    expect(irealStyleToPracticeStyle("IDM")).toBe("idm");
    expect(irealStyleToPracticeStyle("Electronic")).toBe("idm");
    expect(irealStyleToPracticeStyle("Ambient")).toBe("idm");
  });
});
