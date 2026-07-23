import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Accessories from "@/pages/Accessories";

export const Route = createFileRoute("/accessories")({
  head: () => ({ meta: [{ title: "Accessories — Branch Keeper" }] }),
  component: () => (
    <ProtectedRoute requiredRole="manager">
      <Accessories />
    </ProtectedRoute>
  ),
});
