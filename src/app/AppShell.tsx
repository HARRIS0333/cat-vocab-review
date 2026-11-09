import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PropsWithChildren,
} from "react";
import type { ContentFile } from "../content/types";
import { LessonList } from "../features/home/LessonList";
import { Mascot } from "../ui/Mascot";
import type { Route } from "./hash-router";

type AppShellProps = PropsWithChildren<{
  content: ContentFile;
  currentRoute: Route;
}>;

const WIDE_LESSON_QUERY = "(orientation: landscape) and (min-width: 900px)";

function useWideLessonSidebar(): boolean {
  const [wide, setWide] = useState(() => {
    if (typeof window.matchMedia !== "function") return false;
    return window.matchMedia(WIDE_LESSON_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      setWide(false);
      return;
    }

    const query = window.matchMedia(WIDE_LESSON_QUERY);
    const update = () => setWide(query.matches);
    update();

    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", update);
      return () => query.removeEventListener("change", update);
    }

    query.addListener(update);
    return () => query.removeListener(update);
  }, []);

  return wide;
}

function currentGroupId(route: Route): string | undefined {
  return route.name === "practice" || route.name === "summary"
    ? route.groupId
    : undefined;
}

function focusableElements(dialog: HTMLDialogElement): HTMLElement[] {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.getAttribute("aria-hidden") !== "true");
}

function LessonDrawer({
  content,
  activeGroupId,
  onClose,
}: {
  content: ContentFile;
  activeGroupId?: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    try {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    } catch {
      dialog.setAttribute("open", "");
    }
    closeRef.current?.focus();

    return () => {
      try {
        if (typeof dialog.close === "function" && dialog.open) {
          dialog.close();
        } else {
          dialog.removeAttribute("open");
        }
      } catch {
        dialog.removeAttribute("open");
      }
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = focusableElements(dialogRef.current);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      id="lesson-drawer"
      className="lesson-drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lesson-drawer-title"
      aria-describedby="lesson-drawer-description"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="lesson-drawer__header">
        <div>
          <p className="lesson-drawer__eyebrow">小桃猫的课目小屋</p>
          <h2 id="lesson-drawer-title">选择课目</h2>
        </div>
        <button
          ref={closeRef}
          className="button button-secondary"
          type="button"
          onClick={onClose}
        >
          关闭课目列表
        </button>
      </div>
      <p id="lesson-drawer-description" className="lesson-drawer__description">
        按单元顺序选择一课，开始认读或书写练习。
      </p>
      <div className="lesson-drawer__content">
        <LessonList
          groups={content.groups}
          variant="compact"
          currentGroupId={activeGroupId}
          onNavigate={onClose}
        />
      </div>
    </dialog>
  );
}

export function AppShell({ content, currentRoute, children }: AppShellProps) {
  const wideLessonSidebar = useWideLessonSidebar();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreDrawerFocus = useRef(false);
  const activeGroupId = currentGroupId(currentRoute);

  useEffect(() => {
    if (wideLessonSidebar && drawerOpen) {
      restoreDrawerFocus.current = false;
      setDrawerOpen(false);
    }
  }, [drawerOpen, wideLessonSidebar]);

  useEffect(() => {
    if (!drawerOpen && restoreDrawerFocus.current) {
      restoreDrawerFocus.current = false;
      triggerRef.current?.focus();
    }
  }, [drawerOpen]);

  function closeDrawer() {
    restoreDrawerFocus.current = true;
    setDrawerOpen(false);
  }

  function skipToMain(event: ReactMouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const main = document.getElementById("main-content");
    main?.focus();
    main?.scrollIntoView?.({ block: "start" });
  }

  return (
    <>
      <a className="skip-link" href="#main-content" onClick={skipToMain}>
        跳到练习内容
      </a>
      <div className="app-shell">
        <header className="app-header">
          <div className="brand">
            <Mascot mood="wave" />
            <div>
              <h1>小桃猫生字屋</h1>
              <p>四年级上册生字复习</p>
            </div>
          </div>
          <nav className="app-header__actions" aria-label="页面导航">
            {!wideLessonSidebar ? (
              <button
                ref={triggerRef}
                id="lesson-drawer-trigger"
                className="button button-secondary lesson-drawer-trigger"
                type="button"
                aria-expanded={drawerOpen}
                aria-controls="lesson-drawer"
                aria-haspopup="dialog"
                onClick={() => {
                  restoreDrawerFocus.current = false;
                  setDrawerOpen(true);
                }}
              >
                打开课目列表
              </button>
            ) : null}
            <a className="header-link" href="#/about">
              关于与许可
            </a>
          </nav>
        </header>

        {wideLessonSidebar ? (
          <aside className="lesson-sidebar" aria-label="课目列表">
            <p className="lesson-sidebar__eyebrow">小桃猫陪你复习</p>
            <h2>选择课目</h2>
            <div className="lesson-sidebar__content">
              <LessonList
                groups={content.groups}
                variant="compact"
                currentGroupId={activeGroupId}
              />
            </div>
          </aside>
        ) : null}

        <main id="main-content" className="app-main" tabIndex={-1}>
          {children}
        </main>
      </div>

      {drawerOpen ? (
        <LessonDrawer
          content={content}
          activeGroupId={activeGroupId}
          onClose={closeDrawer}
        />
      ) : null}
    </>
  );
}
