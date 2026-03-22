// Utility to normalize button URLs in the same way as the backend
export function normalizeButtonUrl(kind: string, input: string): string {
    if (!input) return '';
    if (kind === 'map') {
        return `https://maps.google.com/?q=${encodeURIComponent(input)}`;
    }
    if (kind === 'phone') {
        const compact = input.replace(/\s+/g, '');
        return compact ? `tel:${compact}` : '';
    }
    if (kind === 'email') {
        return /^\S+@\S+\.\S+$/.test(input) ? `mailto:${input}` : '';
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
