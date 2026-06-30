'use client';

import { useEffect, useState } from 'react';
import { getXlmToPhpRate } from '@/lib/utils/currency';

/**
 * React hook for the live XLM/PHP exchange rate.
 * Returns the rate, loading state, and a refresh function.
 */
export function useExchangeRate() {
  const [rate, setRate] = useState<number>(22); // fallback
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getXlmToPhpRate()
      .then((r) => {
        if (mounted) {
          setRate(r);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  return { rate, loading };
}
