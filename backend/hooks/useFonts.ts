// backend/hooks/useFonts.ts
import * as Font from 'expo-font';
import { useEffect, useState } from 'react';
import { logStartup } from '../utils/startupDiagnostics';

// Loads bundled fonts but never blocks startup indefinitely.
// Falls back to system fonts after a short timeout to avoid release hangs.
export function useLoadFonts(timeoutMs = 2500) {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    const timeout = setTimeout(() => {
      if (mounted) {
        logStartup('fonts:timeout-system-fallback');
        setFontsLoaded(true);
      }
    }, timeoutMs);

    (async () => {
      try {
        logStartup('fonts:load-start');
        await Font.loadAsync({
          Inter: require('../../assets/fonts/Inter-VariableFont_opsz,wght.ttf'),
          'Inter-Italic': require('../../assets/fonts/Inter-Italic-VariableFont_opsz,wght.ttf'),
        });
        if (mounted) {
          logStartup('fonts:load-ok');
          setFontsLoaded(true);
        }
      } catch (e) {
        console.error('Font loading failed:', e);
        logStartup('fonts:load-failed');
        if (mounted) setFontsLoaded(true);
      } finally {
        clearTimeout(timeout);
      }
    })();

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, [timeoutMs]);

  return fontsLoaded;
}
