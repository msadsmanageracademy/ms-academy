import HeroSection from "@/views/sections/pages/home/Hero";
import Features from "@/views/sections/pages/home/Features";
import About from "@/views/sections/pages/home/About";
import Testimonials from "@/views/sections/pages/home/Testimonials";
import FAQ from "@/views/sections/pages/home/FAQ";
import CTA from "@/views/sections/pages/home/CTA";

export default function Home() {
  return (
    <div>
      <HeroSection />
      <Features />
      <About />
      <Testimonials />
      <FAQ />
      <CTA />
    </div>
  );
}
