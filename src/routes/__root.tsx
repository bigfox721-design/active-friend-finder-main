import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { BranchProvider } from "@/hooks/useBranch";
import { RoleProvider } from "@/hooks/useRole";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-4 text-sm text-muted-foreground">This page doesn't exist.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Branch Keeper" },
      { name: "description", content: "Live production pulse for your factory branches." },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

// Scrolls the nearest scrollable container (or the page) as the mouse moves
// vertically. Scrollbars are hidden everywhere, so this replaces them.
function useMouseMoveScroll() {
  useEffect(() => {
    let lastX: number | null = null;
    let lastY: number | null = null;
    let accX = 0;
    let accY = 0;
    const THRESHOLD = 2;
    const isEditable = (el: Element | null) => {
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      return !!(el as HTMLElement | null)?.isContentEditable;
    };
    const getScrollable = (el: Element | null): Element | null => {
      let node: Element | null = el;
      while (node) {
        const style = getComputedStyle(node);
        if (
          /(auto|scroll|overlay)/.test(style.overflowY) &&
          node.scrollHeight > node.clientHeight
        ) {
          return node;
        }
        node = node.parentElement;
      }
      return document.scrollingElement;
    };
    const onMove = (e: MouseEvent) => {
      if (lastY == null || lastX == null) {
        lastX = e.clientX;
        lastY = e.clientY;
        return;
      }
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      accX += dx;
      accY += dy;
      // Left/right (or diagonal) movement must not scroll — if the horizontal
      // component ever matches or exceeds vertical, discard everything.
      if (Math.abs(accX) >= Math.abs(accY)) {
        accX = 0;
        accY = 0;
        return;
      }
      // Once enough vertical movement accumulates, scroll by exactly that.
      if (Math.abs(accY) < THRESHOLD) return;
      const delta = accY;
      accX = 0;
      accY = 0;
      if (isEditable(e.target as Element)) return;
      const el = getScrollable(e.target as Element);
      if (el) el.scrollTop += delta;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);
}

function RootComponent() {
  useMouseMoveScroll();
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <BranchProvider>
            <RoleProvider>
              <Outlet />
              <Sonner richColors position="top-right" />
            </RoleProvider>
          </BranchProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
