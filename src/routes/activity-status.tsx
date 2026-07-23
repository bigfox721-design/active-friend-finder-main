import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ActivityStatus from "@/pages/ActivityStatus";

export const Route = createFileRoute("/activity-status")({
  head: () => ({ meta: [{ title: "Activity Status — Branch Keeper" }] }),
  component: () => (
    <ProtectedRoute>
      <ActivityStatus />
    </ProtectedRoute>
  ),
});
