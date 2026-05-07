import { createFileRoute } from "@tanstack/react-router";
import WildGuardChat from "@/components/WildGuardChat";

export const Route = createFileRoute("/")({
  component: WildGuardChat,
});
