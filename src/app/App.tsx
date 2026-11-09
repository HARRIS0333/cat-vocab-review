import { HomePage } from "../features/home/HomePage";
import { AboutPage } from "../features/about/AboutPage";
import { RecognitionPage } from "../features/recognition/RecognitionPage";
import { WritingPage } from "../features/writing/WritingPage";
import { SummaryPage } from "../features/session/SummaryPage";
import type { ContentFile } from "../content/types";
import { loadContent } from "../content/load-content";
import { ProgressProvider } from "../progress/ProgressProvider";
import { useProgress } from "../progress/ProgressProvider";
import { useHashRoute, type Route } from "./hash-router";
import { AppShell } from "./AppShell";
import { ErrorBoundary } from "./ErrorBoundary";
import { PwaNoticeBoundary } from "../pwa/PwaNoticeBoundary";
import { UpdatePrompt } from "../pwa/UpdatePrompt";
import { useEffect, useState, type PropsWithChildren } from "react";

type ContentLoadState =
  | { status: "loading" }
  | { status: "ready"; content: ContentFile }
  | { status: "error"; message: string };

const loadingContent: ContentFile = {
  schemaVersion: 1,
  contentVersion: "loading",
  edition: "",
  publisher: "",
  auditYear: 2024,
  source: {
    name: "国家中小学智慧教育平台",
    contentId: "",
    ebookId: "",
  },
  counts: {
    lessons: 27,
    gardens: 4,
    groups: 31,
    readingItems: 265,
    readingCounted: 250,
    polyphoneEntries: 15,
    writingItems: 250,
    uniqueTargets: 413,
  },
  groups: [],
};

function displayUnit(unit: string): string {
  return unit.trim() || "未分单元";
}

function displayTitle(title: string): string {
  return title.trim() || "未命名课目";
}

function HomeLink() {
  return (
    <a className="text-link" href="#/">
      返回首页
    </a>
  );
}

function MissingGroup() {
  return (
    <section className="error-panel" aria-labelledby="missing-heading">
      <h2 id="missing-heading">找不到这课</h2>
      <p>没有找到这节课</p>
      <p>课程内容可能已更新，请返回首页重新选择。</p>
      <HomeLink />
    </section>
  );
}

function RoutedContent({
  route,
  content,
}: {
  route: Route;
  content: ContentFile;
}) {
  const { store } = useProgress();

  if (route.name === "home") return <HomePage content={content} />;
  if (route.name === "about") return <AboutPage content={content} />;

  const group = content.groups.find((candidate) => candidate.id === route.groupId);
  if (!group) return <MissingGroup />;

  if (route.name === "practice") {
    if (route.mode === "read") {
      return (
        <RecognitionPage
          key={`${group.id}:${route.retry ? "retry" : "full"}`}
          group={group}
          retry={route.retry}
          store={store}
        />
      );
    }
    return (
      <WritingPage
        key={`${group.id}:${route.retry ? "retry" : "full"}`}
        group={group}
        retry={route.retry}
        store={store}
      />
    );
  }

  return (
    <SummaryPage
      key={`${group.id}:${route.mode}`}
      group={group}
      groupId={group.id}
      mode={route.mode}
      store={store}
    />
  );
}

function AppFrame() {
  const route = useHashRoute();
  const [attempt, setAttempt] = useState(0);
  const [loadState, setLoadState] = useState<ContentLoadState>({
    status: "loading",
  });

  useEffect(() => {
    let active = true;
    setLoadState({ status: "loading" });

    loadContent().then(
      (content) => {
        if (active) setLoadState({ status: "ready", content });
      },
      (error: unknown) => {
        if (!active) return;
        setLoadState({
          status: "error",
          message: error instanceof Error ? error.message : "内容加载失败",
        });
      },
    );

    return () => {
      active = false;
    };
  }, [attempt]);

  const content = loadState.status === "ready" ? loadState.content : loadingContent;

  return (
    <AppShell content={content} currentRoute={route}>
      <PwaNoticeBoundary>
        <UpdatePrompt />
      </PwaNoticeBoundary>
      {loadState.status === "loading" ? (
        <p className="status-message" role="status" aria-live="polite">
          正在加载课程内容…
        </p>
      ) : loadState.status === "error" ? (
        <section className="error-panel" role="alert">
          <h2>课程内容暂时无法加载</h2>
          <p>{loadState.message}</p>
          <button
            className="button"
            type="button"
            onClick={() => setAttempt((current) => current + 1)}
          >
            重试
          </button>
        </section>
      ) : (
        <ProgressRoot content={content}>
          <RoutedContent route={route} content={content} />
        </ProgressRoot>
      )}
    </AppShell>
  );
}

function ProgressRoot({
  content,
  children,
}: PropsWithChildren<{ content: ContentFile }>) {
  return (
    <ProgressProvider key={content.contentVersion} contentVersion={content.contentVersion}>
      {children}
    </ProgressProvider>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <AppFrame />
    </ErrorBoundary>
  );
}
