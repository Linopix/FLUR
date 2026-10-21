import { createFileRoute } from "@tanstack/react-router";
import { Board } from "@/components/flur/board";

export const Route = createFileRoute("/")({
  component: Board,
});
