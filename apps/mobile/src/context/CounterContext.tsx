import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react'

interface ICounterContext {
    counter: number;
    increase: () => void;
    decrease: () => void;
    reset: () => void;
}

const CounterContext = createContext<ICounterContext | undefined>(undefined)

const STORAGE_KEY = 'chatCounter';

const CounterProvider = ({ children }: { children: React.ReactNode }) => {
    const [loading, setLoading] = useState<boolean>(true);
    const [counter, setCounter] = useState<number>(0);

    useEffect(() => {
        const loadCounter = async () => {
            try {
                const storedValue = await AsyncStorage.getItem(STORAGE_KEY);
                if (storedValue !== null) {
                    setCounter(parseInt(storedValue, 10));
                }
            } catch (e) {
                console.error("Failed to load counter from storage", e);
            } finally {
                setLoading(false);
            }
        };

        loadCounter();
    }, []);

    useEffect(() => {
        if (!loading) {
            (async function () {
                try {
                    await AsyncStorage.setItem(STORAGE_KEY, counter.toString());
                } catch (e) {
                    console.error("Failed to save counter to storage", e);
                }
            })()
        }
    }, [counter, loading]);

    const increase = () => setCounter((c: number) => c + 1);
    const decrease = () => setCounter((c: number) => c - 1);
    const reset = () => setCounter(0);

    if (loading) {
        return null;
    }

    return (
        <CounterContext.Provider
            value={{
                counter: counter,
                increase,
                decrease,
                reset
            }}
        >
            {children}
        </CounterContext.Provider>
    )
}

export default CounterProvider

export const useCounterContext = () => {
    const context = useContext(CounterContext);
    if (context === undefined) {
        throw new Error('useCounterContext must be used within a CounterProvider');
    }
    return context;
};