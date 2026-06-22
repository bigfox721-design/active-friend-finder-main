import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Products from "@/pages/Products";

export const Route = createFileRoute("/products")({
  head: () => ({ meta: [{ title: "Products — Branch Keeper" }] }),
  component: () => (<ProtectedRoute><Products /></ProtectedRoute>),
});
