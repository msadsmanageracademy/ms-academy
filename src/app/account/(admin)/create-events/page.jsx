"use client";

import EventsForm from "../../components/EventsForm/EventsForm";
import { useSession } from "next-auth/react";
import { toastError } from "@/utils/alerts";
import { useRouter } from "next/navigation";

const AdminPage = () => {
  return (
    <>
      <EventsForm />
    </>
  );
};

export default AdminPage;
