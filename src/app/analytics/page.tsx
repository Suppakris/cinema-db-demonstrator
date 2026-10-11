import { WorkspaceFrame } from "@/components/workspace-frame";
import { AnalyticsWorkspace } from "@/app/analytics/analytics-workspace";

export const metadata = {
  title: "Analytics — Major Cineplex",
  description: "Explore live cinema business analytics from MySQL views.",
};

export default function AnalyticsPage() {
  return <WorkspaceFrame page="analytics"><AnalyticsWorkspace /></WorkspaceFrame>;
}
