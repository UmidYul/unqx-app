import { NativeModules, Platform } from 'react-native';

type WidgetStatsNativeModule = {
    updateTapStats?: (today: number, total: number) => Promise<boolean> | boolean;
};

export async function updateWidgetTapStats(today: number, total: number): Promise<void> {
    if (Platform.OS !== 'android') {
        return;
    }

    const module = NativeModules.WidgetStatsModule as WidgetStatsNativeModule | undefined;
    if (!module?.updateTapStats) {
        return;
    }

    const safeToday = Number.isFinite(today) ? Math.max(0, Math.round(today)) : 0;
    const safeTotal = Number.isFinite(total) ? Math.max(0, Math.round(total)) : 0;

    try {
        await module.updateTapStats(safeToday, safeTotal);
    } catch {
        // Ignore widget update failures to avoid affecting app UX.
    }
}
