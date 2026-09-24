import { FacilityEditor } from "@/features/facilities/components/facility-editor";

export default async function FacilityDetailPage({ params }: { params: Promise<{ facilityId: string }> }) {
  const { facilityId } = await params;
  return <FacilityEditor facilityId={facilityId} />;
}
