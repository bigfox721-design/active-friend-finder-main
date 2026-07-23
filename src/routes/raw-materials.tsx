import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import RawMaterials from "@/pages/RawMaterials";

export const Route = createFileRoute("/raw-materials")({
  head: () => ({ meta: [{ title: "Raw Materials — Branch Keeper" }] }),
  component: () => (
    <ProtectedRoute requiredRole="manager">
      <RawMaterials />
    </ProtectedRoute>
  ),
});
