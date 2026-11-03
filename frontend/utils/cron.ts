/** Validate a 5-field cron expression */
export function isValidCron(expr: string): boolean {
  if (!expr) return false;
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const ranges = [
    [0, 59], // minute
    [0, 23], // hour
    [1, 31], // day of month
    [1, 12], // month
    [0, 7],  // day of week (0 and 7 = Sunday)
  ];
  return parts.every((part, i) => isValidField(part, ranges[i][0], ranges[i][1]));
}

function isValidField(field: string, min: number, max: number): boolean {
  if (field === '*') return true;
  // */n
  if (/^\*\/\d+$/.test(field)) {
    const n = parseInt(field.slice(2), 10);
    return n >= 1 && n <= max;
  }
  // n-m
  if (/^\d+-\d+$/.test(field)) {
    const [a, b] = field.split('-').map(Number);
    return a >= min && b <= max && a <= b;
  }
  // comma list
  if (field.includes(',')) {
    return field.split(',').every((f) => isValidField(f.trim(), min, max));
  }
  // plain number
  if (/^\d+$/.test(field)) {
    const n = parseInt(field, 10);
    return n >= min && n <= max;
  }
  return false;
}

/** Compute the next Date a cron expression fires after `from` (defaults to now) */
export function nextCronRun(expr: string, from: Date = new Date()): Date | null {
  if (!isValidCron(expr)) return null;
  const [minF, hrF, domF, monF, dowF] = expr.trim().split(/\s+/);

  const start = new Date(from);
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() + 1); // start from next minute

  // Search up to 1 year ahead to find next match
  const limit = new Date(start);
  limit.setFullYear(limit.getFullYear() + 1);

  const candidate = new Date(start);

  while (candidate < limit) {
    const mon = candidate.getMonth() + 1; // 1-12
    if (!matchField(monF, mon, 1, 12)) {
      candidate.setMonth(candidate.getMonth() + 1, 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }
    const dom = candidate.getDate();
    const dow = candidate.getDay(); // 0=Sun
    if (!matchField(domF, dom, 1, 31) || !matchField(dowF, dow, 0, 7)) {
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }
    const hr = candidate.getHours();
    if (!matchField(hrF, hr, 0, 23)) {
      candidate.setHours(hr + 1, 0, 0, 0);
      continue;
    }
    const min = candidate.getMinutes();
    if (!matchField(minF, min, 0, 59)) {
      candidate.setMinutes(min + 1, 0, 0);
      continue;
    }
    return new Date(candidate);
  }
  return null;
}

function matchField(field: string, value: number, min: number, max: number): boolean {
  if (field === '*') return true;
  if (/^\*\/\d+$/.test(field)) {
    const step = parseInt(field.slice(2), 10);
    return (value - min) % step === 0;
  }
  if (/^\d+-\d+$/.test(field)) {
    const [a, b] = field.split('-').map(Number);
    return value >= a && value <= b;
  }
  if (field.includes(',')) {
    return field.split(',').some((f) => matchField(f.trim(), value, min, max));
  }
  if (/^\d+$/.test(field)) {
    const n = parseInt(field, 10);
    // day-of-week: 7 = Sunday (same as 0)
    if (n === 7 && value === 0) return true;
    return n === value;
  }
  return false;
}

/** Return human-readable "in 3h 22m", "in 45m", etc. */
export function formatNextRun(expr: string): string {
  const next = nextCronRun(expr);
  if (!next) return '';
  const diffMs = next.getTime() - Date.now();
  if (diffMs <= 0) return 'soon';
  const totalMin = Math.round(diffMs / 60000);
  if (totalMin < 60) return `in ${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return rh > 0 ? `in ${d}d ${rh}h` : `in ${d}d`;
  }
  return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`;
}
