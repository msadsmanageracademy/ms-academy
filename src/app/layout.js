import SessionWrapper from "@/providers/SessionWrapper";
import Navbar from "@/components/navbar/Navbar";
import Footer from "@/components/footer/Footer";
import { Inter } from "next/font/google";
import "./globals.css";

export const metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

const inter = Inter({
  subsets: ["latin"],
});

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={inter.className}>
      <body>
        <SessionWrapper>
          <Navbar />
          {children}
          <Footer />
        </SessionWrapper>
      </body>
    </html>
  );
}
