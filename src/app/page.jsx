import HeroSection from "@/views/sections/pages/home/Hero";
import Features from "@/views/sections/pages/home/Features";
import About from "@/views/sections/pages/home/About";
import Testimonials from "@/views/sections/pages/home/Testimonials";
import FAQ from "@/views/sections/pages/home/FAQ";
import CTA from "@/views/sections/pages/home/CTA";
import { listFeaturedReviews } from "@/server/reviews/featured";

// Static page regenerated every hour, so new testimonials show up without a query per visit
export const revalidate = 3600;

export default async function Home() {
  const reviews = await listFeaturedReviews();
  return (
    <div>
      <HeroSection />
      <Features />
      <About />
      <Testimonials reviews={reviews} />
      <FAQ />
      <CTA />
    </div>
  );
}
