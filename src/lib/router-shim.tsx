/**
 * Drop-in shim providing the subset of `react-router-dom` APIs used by the
 * original Branch Keeper code, implemented on top of @tanstack/react-router.
 * This keeps the ported pages 1:1 with the source.
 */
import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from "react";
import {
  Link as TSLink,
  useNavigate as useTSNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { cn } from "@/lib/utils";

type NavOpts = { replace?: boolean; state?: unknown };
type To = string;

export const useNavigate = () => {
  const nav = useTSNavigate();
  return (to: To, opts?: NavOpts) => {
    nav({ to: to as any, replace: opts?.replace });
  };
};

export const useLocation = () => {
  const loc = useRouterState({ select: (s) => s.location });
  return {
    pathname: loc.pathname,
    search: loc.searchStr ?? "",
    hash: loc.hash ?? "",
    state: (loc.state as any) ?? null,
    key: (loc as any).key ?? "",
  };
};

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: To;
  replace?: boolean;
  state?: unknown;
  children?: ReactNode;
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  ({ to, replace, state: _state, children, ...rest }, ref) => (
    <TSLink ref={ref} to={to as any} replace={replace} {...(rest as any)}>
      {children}
    </TSLink>
  ),
);
Link.displayName = "Link";

export type NavLinkRenderProps = { isActive: boolean; isPending: boolean };
export interface NavLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "children"> {
  to: To;
  end?: boolean;
  replace?: boolean;
  className?: string | ((p: NavLinkRenderProps) => string);
  children?: ReactNode | ((p: NavLinkRenderProps) => ReactNode);
}

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ to, end, replace, className, children, ...rest }, ref) => {
    const pathname = useRouterState({ select: (s) => s.location.pathname });
    const isActive = end ? pathname === to : pathname === to || pathname.startsWith(to + "/");
    const renderProps: NavLinkRenderProps = { isActive, isPending: false };
    const cls =
      typeof className === "function" ? className(renderProps) : className;
    const kids =
      typeof children === "function" ? children(renderProps) : children;
    return (
      <TSLink ref={ref} to={to as any} replace={replace} className={cn(cls)} {...(rest as any)}>
        {kids}
      </TSLink>
    );
  },
);
NavLink.displayName = "NavLink";
