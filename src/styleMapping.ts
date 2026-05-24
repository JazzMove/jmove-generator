import type { PracticeStyle } from "./types";

/**
 * Map iReal Pro style strings to practice player styles.
 * iReal uses strings like "Medium Swing", "Bossa Nova", "Latin", "Ballad", "Even 8ths", etc.
 */
export function irealStyleToPracticeStyle(irealStyle: string | undefined): PracticeStyle {
  if (!irealStyle) return "swing";

  const s = irealStyle.toLowerCase();

  if (s.includes("bossa")) return "bossa";
  if (s.includes("latin") || s.includes("samba") || s.includes("afro")) return "latin";
  if (s.includes("ballad") || s.includes("slow")) return "ballad";
  // New genres before funk (prog rock contains "rock" which would match funk)
  if (s.includes("math") || s.includes("prog rock") || s.includes("odd meter")) return "mathRock";
  if (s.includes("neo") || s.includes("soul") || s.includes("r&b") || s.includes("gospel")) return "neoSoul";
  if (s.includes("contemporary") || s.includes("nordic") || s.includes("european")) return "contemporaryJazz";
  if (s.includes("electronic") || s.includes("idm") || s.includes("ambient")) return "idm";
  if (s.includes("funk") || s.includes("rock") || s.includes("even 8")) return "funk";
  if (s.includes("waltz") || s.includes("3/4")) return "jazzWaltz";
  if (s.includes("blues") || s.includes("shuffle")) return "shuffleBlues";
  if (s.includes("modal")) return "modal";
  if (s.includes("fusion")) return "fusion";
  if (s.includes("ecm") || s.includes("free")) return "ecm";

  // Fast swing → hard bop feel
  if (s.includes("up tempo") || s.includes("fast")) return "hardBop";

  // Default: swing covers "Medium Swing", "Medium Up Swing", etc.
  return "swing";
}
