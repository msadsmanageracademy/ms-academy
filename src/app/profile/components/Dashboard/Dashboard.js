"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import DashboardLayout from "../DashBoardLayout/DashboardLayout";
import AdminDashboard from "../AdminDashboard/AdminDashboard";
import OvalSpinner from "@/components/spinners/OvalSpinner";
import UserDashboard from "../UserDashboard/UserDashboard";

const Dashboard = () => {
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

  if (session) {
    return (
      <DashboardLayout user={session.user} signOut={signOut}>
        {session?.user.role === "admin" ? (
          <AdminDashboard />
        ) : (
          <UserDashboard />
        )}
      </DashboardLayout>
    );
  }
};

export default Dashboard;
