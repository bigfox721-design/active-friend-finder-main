import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Processes from "@/pages/Processes";

export const Route = createFileRoute("/processes")({
  head: () => ({ meta: [{ title: "Process Management — Branch Keeper" }] }),
  component: () => (
    <ProtectedRoute requiredRole="manager">
      <Processes />
    </ProtectedRoute>
  ),
});
