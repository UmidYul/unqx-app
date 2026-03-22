// Универсальная функция для фильтрации уникальных элементов по ключу
export function uniqueBy<T>(arr: T[], key: (item: T) => any): T[] {
    const seen = new Set();
    return arr.filter(item => {
        const k = key(item);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
}
