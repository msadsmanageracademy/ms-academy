import PageWrapper from "@/views/components/layout/PageWrapper";
import PrimaryLink from "@/views/components/ui/PrimaryLink";

export const metadata = { title: "Página no encontrada | MS Academy" };

export default function NotFound() {
  return (
    <PageWrapper>
      <h1>Página no encontrada</h1>
      <p>La página que buscás no existe o ya no está disponible.</p>
      <PrimaryLink dark href="/" text="Volver al inicio" />
    </PageWrapper>
  );
}
