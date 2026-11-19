// The kit of parts. Anywhere a drawing takes the name of a thing, it can also
// take a person or a building put together from parts:
//   person:POSE:MOOD:WEARS:HOLDS   for example person:refusing:angry:crown
//   place:SHELL:SIGN               for example place:hall:scales
// Parts after the first may be left empty or left off. The parts themselves
// live in kitparts.ts and are drawn by drawThing in draw.ts.
import { KIT_POSES, KIT_SHELLS } from "./kitparts";
import { THINGS } from "./things";

/** True when a name is something we can draw: a drawn thing, or one built from the kit. */
export function hasThing(name: string | null | undefined): boolean {
  "worklet";
  if (!name) return false;
  if (THINGS[name]) return true;
  const q = name.split(":");
  if (q[0] === "person") return !!KIT_POSES[q[1] || "stand"];
  if (q[0] === "place") return !!KIT_SHELLS[q[1]];
  return false;
}

/** True when a name is one person who can be turned to face someone. */
export function isPerson(name: string): boolean {
  "worklet";
  return name.indexOf("person") === 0;
}
