import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ManpowerAnalytics from "@/pages/ManpowerAnalytics";

export const Route = createFileRoute("/manpower-analytics")({
  head: () => ({ meta: [{ title: "Manpower Analytics — Branch Keeper" }] }),
  component: () => (
    <ProtectedRoute>
      <ManpowerAnalytics />
    </ProtectedRoute>
  ),
});
