import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import TvMode from "@/pages/TvMode";

export const Route = createFileRoute("/tv")({
  head: () => ({ meta: [{ title: "TV Mode — Branch Keeper" }] }),
  component: () => <TvMode />,
});
