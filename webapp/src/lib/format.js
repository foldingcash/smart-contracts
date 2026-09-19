const integerFormatter = new Intl.NumberFormat('en-US');

/** Formats a bigint/number/numeric-string with thousands separators. */
export function formatInt(value) {
    if (value === null || value === undefined || value === '') {
        return '—';
    }
    try {
        return integerFormatter.format(typeof value === 'bigint' ? value : BigInt(value));
    } catch {
        return String(value);
    }
}

export function formatMaybe(value) {
    return value === null || value === undefined || value === '' ? '—' : String(value);
}

export function shortenHex(hex, keep = 8) {
    if (typeof hex !== 'string' || hex.length <= keep * 2 + 3) {
        return hex ?? '';
    }
    return `${hex.slice(0, keep)}…${hex.slice(-keep)}`;
}
