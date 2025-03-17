"use client";

import OvalSpinner from "@/components/spinners/OvalSpinner";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const ProfilePage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session || status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return <OvalSpinner />;
  }

  console.log(session);

  if (session) {
    return (
      <div>
        <header>
          <div>Bienvenido, {session.user.email}</div>
          <div>Rol: {session.user.role}</div>
        </header>
      </div>
    );
  }
};

export default ProfilePage;
