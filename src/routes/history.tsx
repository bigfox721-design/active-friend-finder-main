import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import History from "@/pages/History";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "History — Branch Keeper" }] }),
  component: () => (
    <ProtectedRoute>
      <History />
    </ProtectedRoute>
  ),
});
