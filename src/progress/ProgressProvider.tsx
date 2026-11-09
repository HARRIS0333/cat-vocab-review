import {
  createContext,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react";
import {
  createProgressStore,
  type ProgressSnapshot,
  type ProgressStore,
  type StorageLike,
} from "./progress-store";

type ProgressContextValue = {
  store: ProgressStore;
  snapshot: ProgressSnapshot;
};

type ProgressProviderProps = PropsWithChildren<{
  store?: ProgressStore;
  contentVersion?: string;
  storage?: StorageLike;
  now?: () => Date;
}>;

const ProgressContext = createContext<ProgressContextValue | null>(null);

const MEMORY_ONLY_STORAGE: StorageLike = {
  getItem() {
    throw new Error("localStorage unavailable");
  },
  setItem() {},
  removeItem() {},
};

function resolveStorage(storage?: StorageLike): StorageLike {
  if (storage) return storage;
  try {
    return window.localStorage;
  } catch {
    return MEMORY_ONLY_STORAGE;
  }
}

export function ProgressProvider({
  children,
  store,
  contentVersion,
  storage,
  now,
}: ProgressProviderProps) {
  const [resolvedStore] = useState(() => {
    if (store) return store;
    if (!contentVersion) {
      throw new Error("ProgressProvider 需要 store 或 contentVersion");
    }
    return createProgressStore(resolveStorage(storage), contentVersion, now);
  });

  const snapshot = useSyncExternalStore(
    resolvedStore.subscribe,
    resolvedStore.getSnapshot,
    resolvedStore.getSnapshot,
  );
  const value = useMemo(
    () => ({ store: resolvedStore, snapshot }),
    [resolvedStore, snapshot],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const value = useContext(ProgressContext);
  if (!value) {
    throw new Error("useProgress 必须在 ProgressProvider 内使用");
  }
  return value;
}
