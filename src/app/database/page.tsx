import { DatabaseWorkspace } from "@/app/database/database-workspace";
import { WorkspaceFrame } from "@/components/workspace-frame";

export const metadata = {
  title: "Database Explorer — cinema/db",
  description: "Inspect live MySQL table structure and safely paginated records.",
};

export default async function DatabasePage({ searchParams }: { searchParams: Promise<{ bookingId?: string | string[] }> }) {
  const { bookingId: rawBookingId } = await searchParams;
  const parsedBookingId = typeof rawBookingId === "string" ? Number(rawBookingId) : NaN;
  const initialBookingId = Number.isSafeInteger(parsedBookingId) && parsedBookingId > 0 ? parsedBookingId : null;
  return <WorkspaceFrame page="database"><DatabaseWorkspace initialBookingId={initialBookingId} /></WorkspaceFrame>;
}
