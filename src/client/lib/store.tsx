import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { api, type SessionInfo } from "./api.ts";
import { DEFAULT_WEIGHTS, type Weights } from "../../shared/scoring.ts";
import type { Me } from "../../shared/types.ts";

/* ------------------------------------------------------------------ */
/* Toasts                                                               */
/* ------------------------------------------------------------------ */

type ToastTone = "info" | "error" | "success";
interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastValue {
  toasts: Toast[];
  push: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastValue>({ toasts: [], push: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((message: string, tone: ToastTone = "info") => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 4200);
  }, []);

  const value = useMemo(() => ({ toasts, push }), [toasts, push]);

  return (
    <ToastContext value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast() {
  return useContext(ToastContext).push;
}

/* ------------------------------------------------------------------ */
/* Session                                                              */
/* ------------------------------------------------------------------ */

interface SessionValue {
  me: Me | null;
  needsBootstrap: boolean;
  hq: SessionInfo["hq"];
  loading: boolean;
  setMe: (me: Me | null) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

const FALLBACK_HQ = { label: "Durst HQ Brixen", lat: 46.7266, lon: 11.6435 };

export function SessionProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setInfo(await api.session());
    } catch {
      setInfo({ me: null, needsBootstrap: false, hq: FALLBACK_HQ });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<SessionValue>(
    () => ({
      me: info?.me ?? null,
      needsBootstrap: info?.needsBootstrap ?? false,
      hq: info?.hq ?? FALLBACK_HQ,
      loading,
      setMe: (me) =>
        setInfo((current) => ({
          me,
          needsBootstrap: false,
          hq: current?.hq ?? FALLBACK_HQ,
        })),
      refresh,
      signOut: async () => {
        await api.logout().catch(() => {});
        setInfo({ me: null, needsBootstrap: false, hq: info?.hq ?? FALLBACK_HQ });
      },
    }),
    [info, loading, refresh],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession außerhalb des SessionProvider");
  return value;
}

/* ------------------------------------------------------------------ */
/* Ranking weights (per browser)                                        */
/* ------------------------------------------------------------------ */

const WEIGHTS_KEY = "mai.weights.v1";
const PRESET_KEY = "mai.preset.v1";

export function useStoredWeights() {
  const [weights, setWeights] = useState<Weights>(() => {
    try {
      const raw = localStorage.getItem(WEIGHTS_KEY);
      if (!raw) return DEFAULT_WEIGHTS;
      const parsed = JSON.parse(raw) as Partial<Weights>;
      // Merge over the defaults so a new component never arrives undefined.
      return { ...DEFAULT_WEIGHTS, ...parsed };
    } catch {
      return DEFAULT_WEIGHTS;
    }
  });

  const [presetId, setPresetId] = useState<string>(() => localStorage.getItem(PRESET_KEY) ?? "haus");

  useEffect(() => {
    try {
      localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights));
      localStorage.setItem(PRESET_KEY, presetId);
    } catch {
      /* private mode - the ranking just resets next visit */
    }
  }, [weights, presetId]);

  return { weights, setWeights, presetId, setPresetId };
}
