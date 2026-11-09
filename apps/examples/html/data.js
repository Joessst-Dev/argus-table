// 10,000 made-up orders. The generator is seeded, so every run (and every
// starter) gets the same rows: replace this with your own data.

const FIRST = [
  'Ada',
  'Grace',
  'Alan',
  'Edsger',
  'Barbara',
  'Donald',
  'Margaret',
  'Ken',
  'Radia',
  'Tim',
];
const LAST = [
  'Lovelace',
  'Hopper',
  'Turing',
  'Dijkstra',
  'Liskov',
  'Knuth',
  'Hamilton',
  'Thompson',
  'Perlman',
  'Lee',
];
const CITIES = ['Amsterdam', 'Berlin', 'Lisbon', 'Oslo', 'Prague', 'Vienna', 'Warsaw', 'Zurich'];
const STATUSES = ['Paid', 'Pending', 'Refunded'];

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** @returns {{ id: string, customer: string, city: string, total: number, status: string }[]} */
export function createOrders(count = 10_000) {
  const random = seeded(42);
  const pick = (list) => list[Math.floor(random() * list.length)];
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    customer: `${pick(FIRST)} ${pick(LAST)}`,
    city: pick(CITIES),
    total: Math.round(random() * 100_000) / 100,
    status: pick(STATUSES),
  }));
}
