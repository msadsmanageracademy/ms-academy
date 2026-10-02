import Hero from "@/views/sections/pages/about/Hero";
import PageWrapper from "@/views/components/layout/PageWrapper";

export const metadata = { title: "Sobre mí | MS Academy" };

const AboutPage = () => {
  return (
    <PageWrapper>
      <h1 className="visually-hidden">Sobre mí</h1>
      <Hero />
    </PageWrapper>
  );
};

export default AboutPage;
