import "./globals.css";
import Footer from "@/views/components/layout/Footer";
import { Inter } from "next/font/google";
import Navbar from "@/views/components/layout/Navbar";
import { NotificationProvider } from "@/providers/NotificationProvider";
import SessionWrapper from "@/providers/SessionWrapper";
import SkipLink from "@/views/components/layout/SkipLink";

export const metadata = {
  title: "MS - Academy",
  description: "Plataforma de cursos en línea para desarrollo profesional",
};

const inter = Inter({
  subsets: ["latin"],
  weight: ["100", "300", "400", "500", "600", "700"],
});

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={inter.className}>
      <body>
        {/* Keyboard users can jump over the navigation */}
        <SkipLink />
        <SessionWrapper>
          <NotificationProvider>
            <Navbar />
            <main id="main-content" tabIndex={-1}>
              {children}
            </main>
            <Footer />
          </NotificationProvider>
        </SessionWrapper>
      </body>
    </html>
  );
}
