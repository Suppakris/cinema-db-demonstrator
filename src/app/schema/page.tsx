import { SchemaWorkspace } from "@/app/schema/schema-workspace";
import { WorkspaceFrame } from "@/components/workspace-frame";

export const metadata = {
  title: "Schema Design — cinema/db",
  description: "Explore the live MySQL schema, keys, and verified foreign-key relationships.",
};

export default function SchemaPage() {
  return <WorkspaceFrame page="schema"><SchemaWorkspace /></WorkspaceFrame>;
}
