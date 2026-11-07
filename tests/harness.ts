/* Tiny test harness: no extra dependencies, readable output, non-zero exit on failure. */
type Fn = () => void | Promise<void>;
const tests: { name: string; fn: Fn }[] = [];
let suite = '';

export function describe(name: string, body: () => void): void { suite = name; body(); suite = ''; }
export function it(name: string, fn: Fn): void { tests.push({ name: suite ? `${suite} › ${name}` : name, fn }); }

export class AssertionError extends Error {}
export function ok(cond: unknown, msg = 'expected truthy'): asserts cond { if (!cond) throw new AssertionError(msg); }
export function eq<T>(actual: T, expected: T, msg = ''): void {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new AssertionError(`${msg ? `${msg}: ` : ''}expected ${e}, got ${a}`);
}

export async function run(): Promise<number> {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ✓ ${t.name}`); } catch (e) { failed++; console.log(`  ✗ ${t.name}\n      ${(e as Error).message}`); }
  }
  console.log(`\n${tests.length - failed} passed, ${failed} failed`);
  return failed;
}
