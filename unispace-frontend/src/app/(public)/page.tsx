import { LandingPage } from "@/features/facilities/components/landing-page";
import { landingFacilities } from "@/features/facilities/data/landing-facilities";

export default function PublicHomePage() {
  return <LandingPage facilities={landingFacilities} />;
}
