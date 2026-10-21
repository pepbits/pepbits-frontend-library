import { Compliance } from "@/components/landing/Compliance";
import { FacilityExplorer } from "@/components/landing/FacilityExplorer";
import { Hero } from "@/components/landing/Hero";
import { HowWorkspaces } from "@/components/landing/HowWorkspaces";
import { SiteFooter, SiteHeader } from "@/components/landing/SiteHeader";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <FacilityExplorer />
        <Compliance />
        <HowWorkspaces />
      </main>
      <SiteFooter />
    </>
  );
}
