import React, { createContext, useContext, useState, useEffect } from 'react';

interface RateLimitState {
    availableCount: number;
    progress: number;
    timeLeft: number;
}

interface RateLimitContextType {
    rateLimitState: RateLimitState;
    consumeCredit: () => boolean;
    depleteAllCredits: () => void;
    resetRateLimit: () => void;
}

const RateLimitContext = createContext<RateLimitContextType | undefined>(undefined);

const REFILL_TIME_MS = 12000; // 12 seconds per credit

export const RateLimitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [timestamps, setTimestamps] = useState<number[]>(() => {
        const stored = localStorage.getItem('ai_request_timestamps');
        return stored ? JSON.parse(stored) : [];
    });
    const [quotaExceeded, setQuotaExceeded] = useState<boolean>(() => {
        const stored = localStorage.getItem('api_quota_exceeded');
        return stored === 'true';
    });
    const [now, setNow] = useState(Date.now());

    // Update timer for progress bar
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 100); // Update frequently for smooth bar
        return () => clearInterval(timer);
    }, []);

    // Clean up old timestamps and save to local storage (only if quota not exceeded)
    useEffect(() => {
        if (!quotaExceeded) {
            const valid = timestamps.filter(t => now - t < REFILL_TIME_MS);
            if (valid.length !== timestamps.length) {
                setTimestamps(valid);
                localStorage.setItem('ai_request_timestamps', JSON.stringify(valid));
            }
        }
    }, [now, timestamps, quotaExceeded]);

    const getRateLimitState = (): RateLimitState => {
        // If quota exceeded, always return 0 credits
        if (quotaExceeded) {
            return { availableCount: 0, progress: 0, timeLeft: 0 };
        }

        // Valid timestamps are those less than 12s old
        const valid = timestamps.filter(t => now - t < REFILL_TIME_MS).sort((a, b) => a - b);
        const availableCount = 5 - valid.length;

        // Calculate progress for the NEXT refill (oldest timestamp)
        let progress = 100;
        let timeLeft = 0;
        if (valid.length > 0) {
            const oldest = valid[0];
            const elapsed = now - oldest;
            progress = Math.min(100, (elapsed / REFILL_TIME_MS) * 100);
            timeLeft = Math.ceil((REFILL_TIME_MS - elapsed) / 1000);
        }

        return { availableCount, progress, timeLeft };
    };

    const consumeCredit = (): boolean => {
        if (quotaExceeded) {
            return false; // No credits when quota exceeded
        }

        const { availableCount } = getRateLimitState();
        if (availableCount <= 0) {
            return false; // No credits available
        }

        // Add timestamp
        const newTimestamps = [...timestamps, Date.now()];
        setTimestamps(newTimestamps);
        localStorage.setItem('ai_request_timestamps', JSON.stringify(newTimestamps));
        return true; // Credit consumed successfully
    };

    const depleteAllCredits = (): void => {
        // Set quota exceeded flag to prevent recharging
        setQuotaExceeded(true);
        localStorage.setItem('api_quota_exceeded', 'true');

        // Also deplete timestamps for immediate visual feedback
        const depleted = Array(5).fill(Date.now());
        setTimestamps(depleted);
        localStorage.setItem('ai_request_timestamps', JSON.stringify(depleted));
    };

    const resetRateLimit = (): void => {
        // Clear quota exceeded flag
        setQuotaExceeded(false);
        localStorage.removeItem('api_quota_exceeded');

        // Clear all timestamps to give fresh credits
        setTimestamps([]);
        localStorage.setItem('ai_request_timestamps', JSON.stringify([]));
    };

    const rateLimitState = getRateLimitState();

    return (
        <RateLimitContext.Provider value={{ rateLimitState, consumeCredit, depleteAllCredits, resetRateLimit }}>
            {children}
        </RateLimitContext.Provider>
    );
};

export const useRateLimit = () => {
    const context = useContext(RateLimitContext);
    if (context === undefined) {
        throw new Error('useRateLimit must be used within a RateLimitProvider');
    }
    return context;
};
