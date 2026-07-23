import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import QualityChecks from "@/pages/QualityChecks";

export const Route = createFileRoute("/quality-checks")({
  head: () => ({ meta: [{ title: "Quality Checks — Branch Keeper" }] }),
  component: () => (
    <ProtectedRoute>
      <QualityChecks />
    </ProtectedRoute>
  ),
});
