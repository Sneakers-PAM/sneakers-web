// The ready marker review tooling waits for (npm run gallery:appliance-admin): the running app
// sets `data-app-ready="<pathname>"` on <html> once the route has rendered and every API call
// it made has answered, and removes it while a navigation or a call is in flight. The HTML
// never carries it, so a build that doesn't start never looks ready.
import { useEffect, useSyncExternalStore } from "react";
import { useLocation, useNavigation } from "react-router";

let pending = 0;
const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Counts the call as in flight until it settles, either way. */
export const trackRequest = <Result>(request: Promise<Result>): Promise<Result> => {
  pending++;
  notify();
  return request.finally(() => {
    pending--;
    notify();
  });
};

export const useReadyMarker = () => {
  const { pathname } = useLocation();
  const navigation = useNavigation();
  const inFlight = useSyncExternalStore(
    subscribe,
    () => pending,
    () => 0,
  );
  useEffect(() => {
    const html = document.documentElement;
    // The live count, not the rendered one: a page's effects run before this one and may
    // just have started its first call.
    if (navigation.state === "idle" && pending === 0) html.dataset.appReady = pathname;
    else delete html.dataset.appReady;
  }, [inFlight, navigation.state, pathname]);
};
