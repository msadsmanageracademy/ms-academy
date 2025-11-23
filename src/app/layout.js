import "./globals.css";
import Footer from "@/views/components/layout/Footer";
import { Inter } from "next/font/google";
import Navbar from "@/views/components/layout/Navbar";
import { NotificationProvider } from "@/providers/NotificationProvider";
import SessionWrapper from "@/providers/SessionWrapper";

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
        <SessionWrapper>
          <NotificationProvider>
            <Navbar />
            {children}
            <Footer />
          </NotificationProvider>
        </SessionWrapper>
      </body>
    </html>
  );
}
