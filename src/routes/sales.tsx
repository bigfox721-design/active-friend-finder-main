import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Sales from "@/pages/Sales";

export const Route = createFileRoute("/sales")({
  head: () => ({ meta: [{ title: "Sales — Branch Keeper" }] }),
  component: () => (
    <ProtectedRoute>
      <Sales />
    </ProtectedRoute>
  ),
});
