import { useCallback, useEffect, useState } from 'react';

import { isReachable, onReachabilityChange } from 'src/api/client';

// 14.6 — is the server reachable?
//
// Two signals, because neither is sufficient on its own:
//
//   - `navigator.onLine` knows whether the *device* has a network. It is
//     instant and it fires events, but it is frequently wrong on desktop and
//     it says nothing about whether this particular server is answering.
//   - the transport's own verdict, from `api/client`: a request that rejected
//     before producing a response could not reach the server, and a request
//     that came back at all — even a 500 — proves it is there.
//
// Offline means either one says so. Coming back is deliberate rather than
// optimistic: the browser saying "online" is not proof the server returned, so
// `retry` makes a real request and the bar clears only when one succeeds.

const browserOnline = (): boolean => (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean' ? true : navigator.onLine);

export type Connection = { offline: boolean; retrying: boolean; retry: () => void };

export const useConnection = (probe: () => Promise<unknown>): Connection => {
  const [online, setOnline] = useState(browserOnline);
  const [reachable, setReachable] = useState(isReachable);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);

    window.addEventListener('online', up);
    window.addEventListener('offline', down);

    const stop = onReachabilityChange(setReachable);

    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
      stop();
    };
  }, []);

  const retry = useCallback(() => {
    setRetrying(true);

    // The probe updates reachability through the client as a side effect, so
    // nothing here has to interpret the result — only stop the spinner.
    void probe()
      .catch(() => undefined)
      .finally(() => {
        setRetrying(false);
        setOnline(browserOnline());
      });
  }, [probe]);

  return { offline: !online || !reachable, retrying, retry };
};
