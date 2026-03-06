import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { LanguageCode, getMessagesLanguage, setMessagesLanguage } from '@/constants/messages';
import { storageGetItem, storageSetItem } from '@/lib/secureStorage';

const LANGUAGE_KEY = 'unqx.language';

interface LanguageContextValue {
    language: LanguageCode;
    setLanguage: (language: LanguageCode) => void;
    toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function isSupportedLanguage(value: string | null): value is LanguageCode {
    return value === 'ru' || value === 'uz';
}

export function LanguageProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
    const [language, setLanguageState] = useState<LanguageCode>(getMessagesLanguage());

    useEffect(() => {
        let mounted = true;

        const hydrate = async (): Promise<void> => {
            const stored = await storageGetItem(LANGUAGE_KEY).catch(() => null);
            if (!mounted || !isSupportedLanguage(stored)) {
                return;
            }

            setMessagesLanguage(stored);
            setLanguageState(stored);
        };

        void hydrate();

        return () => {
            mounted = false;
        };
    }, []);

    const setLanguage = useCallback((next: LanguageCode) => {
        setMessagesLanguage(next);
        setLanguageState(next);
        void storageSetItem(LANGUAGE_KEY, next);
    }, []);

    const toggleLanguage = useCallback(() => {
        setLanguage(language === 'ru' ? 'uz' : 'ru');
    }, [language, setLanguage]);

    const value = useMemo(
        () => ({
            language,
            setLanguage,
            toggleLanguage,
        }),
        [language, setLanguage, toggleLanguage],
    );

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguageContext(): LanguageContextValue {
    const context = useContext(LanguageContext);

    if (!context) {
        throw new Error('useLanguageContext must be used inside LanguageProvider');
    }

    return context;
}
