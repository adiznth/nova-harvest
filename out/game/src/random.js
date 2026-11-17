// A small seeded random generator (mulberry32), so a seed always replays the same
// run: the same seed gives the same spawns, the same pickups, the same screenshots.

export function createRandom(seed) {
  let state = seed >>> 0;
  return {
    next() {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** A float in [min, max). */
    range(min, max) {
      return min + this.next() * (max - min);
    },
    /** An integer in [min, max]. */
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    },
    /** Pick one entry of an array. */
    pick(list) {
      return list[Math.floor(this.next() * list.length)];
    },
    /** An angle in radians, uniform around the circle. */
    angle() {
      return this.next() * Math.PI * 2;
    },
  };
}
