export type Diff = {
  prefix: number;
  suffix: number;
  removed: string;
  added: string;
};

export function computeDiff(oldStr: string, newStr: string): Diff {
  const oldChars = Array.from(oldStr);
  const newChars = Array.from(newStr);

  let prefix = 0;
  const minLength = Math.min(oldChars.length, newChars.length);
  while (prefix < minLength && oldChars[prefix] === newChars[prefix]) {
    prefix++;
  }

  let suffix = 0;
  while (
    suffix < (oldChars.length - prefix)
    && suffix < (newChars.length - prefix)
    && oldChars[oldChars.length - 1 - suffix] === newChars[newChars.length - 1 - suffix]
  ) {
    suffix++;
  }

  const removed = oldChars.slice(prefix, oldChars.length - suffix).join('');
  const added = newChars.slice(prefix, newChars.length - suffix).join('');

  return {
    prefix,
    suffix,
    removed,
    added,
  };
}

export function applyDiff(baseStr: string, diff: Diff): string {
  return (
    baseStr.substring(0, diff.prefix)
    + diff.added
    + baseStr.substring(baseStr.length - diff.suffix)
  );
}
