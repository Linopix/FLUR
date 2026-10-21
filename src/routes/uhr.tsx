import { createFileRoute } from "@tanstack/react-router";
import { WatchFace } from "@/components/flur/watch";

export const Route = createFileRoute("/uhr")({
  component: WatchFace,
});
