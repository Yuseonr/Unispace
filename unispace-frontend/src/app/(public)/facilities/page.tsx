import { FacilityCatalog } from "@/features/facilities/components/facility-catalog";
import { landingFacilities } from "@/features/facilities/data/landing-facilities";

export default function FacilitiesPage() {
  return <FacilityCatalog facilities={landingFacilities} />;
}
