import { FacilityDetailView } from "@/features/facilities/components/facility-detail-view";

export default async function PublicFacilityDetailPage({
  params,
}: {
  params: Promise<{ facilityId: string }>;
}) {
  const { facilityId } = await params;
  return <FacilityDetailView facilityId={facilityId} />;
}
