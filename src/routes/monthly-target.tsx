import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import MonthlyTarget from "@/pages/MonthlyTarget";

export const Route = createFileRoute("/monthly-target")({
  head: () => ({ meta: [{ title: "Monthly Target — Branch Keeper" }] }),
  component: () => (
    <ProtectedRoute requiredRole="manager">
      <MonthlyTarget />
    </ProtectedRoute>
  ),
});
