import React from 'react';

function buildRetryImageUrl(imageUrl: string, retryCount: number): string {
    if (retryCount <= 0) {
        return imageUrl;
    }

    // Force a fresh request on retry so a failed cache entry does not block image rendering.
    const retryToken = `rn_retry=${retryCount}`;
    return imageUrl.includes('?') ? `${imageUrl}&${retryToken}` : `${imageUrl}?${retryToken}`;
}

interface UseRetryImageUriOptions {
    maxRetries?: number;
    baseDelayMs?: number;
    stepDelayMs?: number;
    cooldownRetryMs?: number;
}

interface RetryImageUriState {
    imageUri?: string;
    retryCount: number;
    showImage: boolean;
    onError: () => void;
}

export function useRetryImageUri(
    imageUrl?: string,
    options: UseRetryImageUriOptions = {},
): RetryImageUriState {
    const { maxRetries = 2, baseDelayMs = 600, stepDelayMs = 400, cooldownRetryMs = 9000 } = options;
    const [failed, setFailed] = React.useState(false);
    const [retryCount, setRetryCount] = React.useState(0);

    const imageUri = React.useMemo(() => {
        if (!imageUrl) {
            return undefined;
        }
        return buildRetryImageUrl(imageUrl, retryCount);
    }, [imageUrl, retryCount]);

    React.useEffect(() => {
        setFailed(false);
        setRetryCount(0);
    }, [imageUrl]);

    React.useEffect(() => {
        if (!imageUrl || !failed || retryCount >= maxRetries) {
            return;
        }

        const timer = setTimeout(() => {
            setFailed(false);
            setRetryCount((current) => current + 1);
        }, baseDelayMs + retryCount * stepDelayMs);

        return () => clearTimeout(timer);
    }, [baseDelayMs, failed, imageUrl, maxRetries, retryCount, stepDelayMs]);

    React.useEffect(() => {
        if (!imageUrl || !failed || retryCount < maxRetries) {
            return;
        }

        // Keep retrying failed avatars with a slower cadence so users don't need a manual refresh.
        const timer = setTimeout(() => {
            setFailed(false);
            setRetryCount(0);
        }, cooldownRetryMs);

        return () => clearTimeout(timer);
    }, [cooldownRetryMs, failed, imageUrl, maxRetries, retryCount]);

    return {
        imageUri,
        retryCount,
        showImage: Boolean(imageUri) && !failed,
        onError: () => setFailed(true),
    };
}
