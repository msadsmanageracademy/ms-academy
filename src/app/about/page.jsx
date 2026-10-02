import About from "@/views/sections/pages/home/About";
import Features from "@/views/sections/pages/home/Features";

export const metadata = {
  title: "Sobre mí | MS Academy",
  description: "Maximiliano Setzes, especialista en publicidad digital (Google Ads y Meta Ads).",
};

export default function AboutPage() {
  return (
    <>
      <About asPage />
      <Features />
    </>
  );
}
