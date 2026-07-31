/**
 * A small history router — this app has three sections and two pages, not sixty
 * routes.
 *
 * It tracks the query string as well as the path, because one thing genuinely
 * benefits from being addressable: `?bewerten` on a trip opens the rating sheet.
 * That makes "du hast noch 3 offen" a list of links rather than a list of
 * places to click twice.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface RouterValue {
  path: string;
  search: URLSearchParams;
  navigate: (to: string, opts?: { replace?: boolean; keepScroll?: boolean }) => void;
  /** Add, change or (with null) drop one query parameter, without a scroll. */
  setParam: (key: string, value: string | null) => void;
}

const RouterContext = createContext<RouterValue>({
  path: "/",
  search: new URLSearchParams(),
  navigate: () => {},
  setParam: () => {},
});

function current(): { path: string; query: string } {
  return { path: window.location.pathname, query: window.location.search };
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [{ path, query }, setLocation] = useState(current);

  useEffect(() => {
    const onPop = () => setLocation(current());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback<RouterValue["navigate"]>((to, opts) => {
    const url = new URL(to, window.location.origin);
    if (url.pathname === window.location.pathname && url.search === window.location.search) return;

    window.history[opts?.replace ? "replaceState" : "pushState"]({}, "", url);
    setLocation({ path: url.pathname, query: url.search });

    // A new page starts at the top. Changing a sheet's query parameter does not.
    if (!opts?.keepScroll) window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  const setParam = useCallback<RouterValue["setParam"]>((key, value) => {
    const url = new URL(window.location.href);
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
    window.history.replaceState({}, "", url);
    setLocation({ path: url.pathname, query: url.search });
  }, []);

  const value = useMemo<RouterValue>(
    () => ({ path, search: new URLSearchParams(query), navigate, setParam }),
    [path, query, navigate, setParam],
  );

  return <RouterContext value={value}>{children}</RouterContext>;
}

export function useRouter(): RouterValue {
  return useContext(RouterContext);
}

interface LinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: string;
  children: ReactNode;
}

export function Link({ to, children, onClick, ...rest }: LinkProps) {
  const { navigate } = useRouter();
  return (
    <a
      href={to}
      onClick={(event) => {
        onClick?.(event);
        // Let modified clicks (new tab, download) behave natively.
        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.button !== 0
        ) {
          return;
        }
        event.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
