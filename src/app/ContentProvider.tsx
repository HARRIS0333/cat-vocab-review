import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { loadContent } from "../content/load-content";
import type { ContentFile } from "../content/types";

type ContentContextValue = {
  content: ContentFile;
  retry: () => void;
};

type LoadState =
  | { status: "loading" }
  | { status: "ready"; content: ContentFile }
  | { status: "error"; message: string };

const ContentContext = createContext<ContentContextValue | null>(null);

export function ContentProvider({ children }: PropsWithChildren) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const retry = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });

    loadContent()
      .then((content) => {
        if (active) setState({ status: "ready", content });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "内容加载失败",
        });
      });

    return () => {
      active = false;
    };
  }, [attempt]);

  if (state.status === "loading") {
    return (
      <p className="status-message" role="status" aria-live="polite">
        正在加载课程内容…
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <section className="error-panel" role="alert">
        <h2>课程内容暂时无法加载</h2>
        <p>{state.message}</p>
        <button className="button" type="button" onClick={retry}>
          重试
        </button>
      </section>
    );
  }

  return (
    <ContentContext.Provider value={{ content: state.content, retry }}>
      {children}
    </ContentContext.Provider>
  );
}

export function useContent(): ContentContextValue {
  const value = useContext(ContentContext);
  if (!value) {
    throw new Error("useContent 必须在 ContentProvider 内使用");
  }
  return value;
}
