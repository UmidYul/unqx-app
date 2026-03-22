function isSupportedButtonHref(value: string): boolean {
    return /^(https?:\/\/|mailto:|tel:|card:)/i.test(String(value || '').trim());
}

function parseCardDigits(rawValue: string): string {
    const digits = String(rawValue || '').replace(/\D/g, '');
    if (digits.length < 12 || digits.length > 19) {
        return '';
    }
    return digits;
}

// Utility to normalize button URLs in the same way as website/backend.
export function normalizeButtonUrl(type: string, rawUrl: string, label?: string): string {
    const input = String(rawUrl || '').trim();
    const kind = String(type || 'other').trim().toLowerCase();
    const labelRaw = String(label || '').trim().toLowerCase();
    const cardLikeLabel = /(карта|card)/i.test(labelRaw);
    const mapLikeLabel = /(map|maps|geo|location|локац)/i.test(labelRaw);

    if (!input) return '';
    if (isSupportedButtonHref(input)) return input;

    if (kind === 'card' || cardLikeLabel) {
        const digits = parseCardDigits(input);
        return digits ? `card:${digits}` : '';
    }
    if (kind === 'map' || mapLikeLabel) {
        return `https://maps.google.com/?q=${encodeURIComponent(input)}`;
    }
    if (kind === 'phone') {
        const compact = input.replace(/\s+/g, '');
        return compact ? `tel:${compact}` : '';
    }
    if (kind === 'email') {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input) ? `mailto:${input}` : '';
    }
    if (kind === 'website' || kind === 'other') {
        if (/^[^\s]+\.[^\s]+$/.test(input) && !input.startsWith('@')) {
            return `https://${input}`;
        }
    }
    if (kind === 'telegram') {
        const normalized = input.replace(/^@+/, '').replace(/^https?:\/\/t\.me\//i, '').trim();
        return normalized ? `https://t.me/${normalized}` : '';
    }
    if (kind === 'instagram') {
        const normalized = input
            .replace(/^@+/, '')
            .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
            .replace(/\/+$/, '')
            .trim();
        return normalized ? `https://instagram.com/${normalized}` : '';
    }
    if (kind === 'tiktok') {
        const normalized = input
            .replace(/^https?:\/\/(www\.)?tiktok\.com\//i, '')
            .replace(/^@+/, '')
            .replace(/\/+$/, '')
            .trim();
        if (!normalized) return '';
        return normalized.startsWith('@') ? `https://tiktok.com/${normalized}` : `https://tiktok.com/@${normalized}`;
    }
    if (kind === 'youtube') {
        if (/^(?:@[\w.-]+)$/i.test(input)) return `https://youtube.com/${input}`;
        if (/^[\w.-]+$/i.test(input)) return `https://youtube.com/@${input}`;
    }
    if (kind === 'whatsapp') {
        const digits = input.replace(/[^\d]/g, '');
        return digits ? `https://wa.me/${digits}` : '';
    }
    return input;
}
