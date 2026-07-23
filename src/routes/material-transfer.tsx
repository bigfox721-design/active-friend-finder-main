import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import MaterialTransferPage from "@/pages/MaterialTransfer";

export const Route = createFileRoute("/material-transfer")({
  head: () => ({ meta: [{ title: "Material Transfer — Branch Keeper" }] }),
  component: () => (
    <ProtectedRoute>
      <MaterialTransferPage />
    </ProtectedRoute>
  ),
});
