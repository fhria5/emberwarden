// Emberwarden — seeded random numbers (mulberry32).
// One clear job: deterministic randomness, so a ?seed=N run always plays
// the same way and the screenshot scenes are reproducible.

export function createRandom(seed) {
  let state = (seed >>> 0) || 1;
  return {
    /** Float in [0, 1). */
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** Float in [min, max). */
    range(min, max) {
      return min + (max - min) * this.next();
    },
    /** Integer in [min, max] inclusive. */
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    },
    /** Random element of an array. */
    pick(array) {
      return array[Math.floor(this.next() * array.length)];
    },
    /** Angle in radians, uniform over the circle. */
    angle() {
      return this.next() * Math.PI * 2;
    },
  };
}
