import { redirect } from "next/navigation";

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ facilityId?: string }>;
}) {
  const { facilityId } = await searchParams;
  if (facilityId) {
    redirect(`/facilities/${facilityId}`);
  }
  redirect("/facilities");
}
