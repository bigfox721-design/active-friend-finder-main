import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DailyOverview from "@/pages/DailyOverview";

export const Route = createFileRoute("/daily-overview")({
  head: () => ({ meta: [{ title: "Daily Overview — Branch Keeper" }] }),
  component: () => (
    <ProtectedRoute>
      <DailyOverview />
    </ProtectedRoute>
  ),
});
