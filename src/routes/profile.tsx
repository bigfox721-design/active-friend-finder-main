import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Profile from "@/pages/Profile";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — Branch Keeper" }] }),
  component: () => (<ProtectedRoute><Profile /></ProtectedRoute>),
});
