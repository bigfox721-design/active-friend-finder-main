import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import InventoryPage from "@/pages/Inventory";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Inventory — Branch Keeper" }] }),
  component: () => (
    <ProtectedRoute>
      <InventoryPage />
    </ProtectedRoute>
  ),
});
