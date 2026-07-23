import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ManagerOverridePage from "@/pages/ManagerOverride";

export const Route = createFileRoute("/manager-override")({
  head: () => ({ meta: [{ title: "Manager Override — Branch Keeper" }] }),
  component: () => (
    <ProtectedRoute requiredRole="manager">
      <ManagerOverridePage />
    </ProtectedRoute>
  ),
});
