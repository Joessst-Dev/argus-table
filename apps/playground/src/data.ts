// Seeded fake data so every run and every browser scrolls the same rows.
// Carried over from the Phase 0 rendering spike.

export type Status = 'active' | 'invited' | 'paused' | 'blocked';

export interface Person {
  id: string;
  index: number;
  name: string;
  email: string;
  /** Nested, so the playground exercises path accessors (`'location.city'`). */
  location: { city: string; country: string };
  status: Status;
  amount: number;
  date: string;
  /** Generic padding columns f1..f11, mixed text and numbers. */
  extra: (string | number)[];
}

/** mulberry32: tiny, fast, good enough for fake data. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = [
  'Ada',
  'Grace',
  'Alan',
  'Edsger',
  'Barbara',
  'Linus',
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
  'Torvalds',
  'Hamilton',
  'Thompson',
  'Perlman',
  'Berners-Lee',
];
const CITIES = [
  'Berlin',
  'Lisbon',
  'Osaka',
  'Toronto',
  'Nairobi',
  'Lima',
  'Oslo',
  'Hanoi',
  'Austin',
  'Perth',
];
const COUNTRIES = ['DE', 'PT', 'JP', 'CA', 'KE', 'PE', 'NO', 'VN', 'US', 'AU'];
export const STATUSES: readonly Status[] = ['active', 'invited', 'paused', 'blocked'];
const WORDS = [
  'alpha',
  'bravo',
  'charlie',
  'delta',
  'echo',
  'foxtrot',
  'golf',
  'hotel',
  'india',
  'juliet',
];

/** Number of generic `fN` columns that pad the table out to 20 columns. */
export const EXTRA_COLUMNS = 11;

function pick<T>(rand: () => number, list: readonly T[]): T {
  return list[Math.floor(rand() * list.length)] as T;
}

export function makePeople(count: number, seed = 42): Person[] {
  const rand = seeded(seed);
  const start = Date.UTC(2020, 0, 1);
  const people: Person[] = new Array<Person>(count);
  for (let i = 0; i < count; i++) {
    const first = pick(rand, FIRST);
    const last = pick(rand, LAST);
    const person: Person = {
      id: `r${String(i)}`,
      index: i,
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${String(i)}@example.com`,
      location: { city: pick(rand, CITIES), country: pick(rand, COUNTRIES) },
      status: pick(rand, STATUSES),
      amount: Math.round(rand() * 1_000_000) / 100,
      date: new Date(start + Math.floor(rand() * 2000) * 86_400_000).toISOString().slice(0, 10),
      extra: Array.from({ length: EXTRA_COLUMNS }, (_, f) =>
        f % 2 ? Math.floor(rand() * 10_000) : pick(rand, WORDS),
      ),
    };
    people[i] = person;
  }
  return people;
}
