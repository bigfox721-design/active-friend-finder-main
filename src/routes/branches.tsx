import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Branches from "@/pages/Branches";

export const Route = createFileRoute("/branches")({
  head: () => ({ meta: [{ title: "Branches — Branch Keeper" }] }),
  component: () => (<ProtectedRoute><Branches /></ProtectedRoute>),
});
