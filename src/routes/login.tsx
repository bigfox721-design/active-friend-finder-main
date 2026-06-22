import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "@/pages/Login";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign In — Branch Keeper" }] }),
  component: () => (<Login />),
});
