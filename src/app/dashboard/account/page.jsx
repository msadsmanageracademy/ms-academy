import AccountForm from "@/views/sections/pages/dashboard/account/AccountForm";
import { getActor } from "@/lib/api/guards";
import { getUser } from "@/server/users/service";
import { redirect } from "next/navigation";
import styles from "./styles.module.css";
import { toPlain } from "@/server/serialize";

export const metadata = { title: "Mi cuenta | MS Academy" };

// Server Component: the form arrives filled in
export default async function AccountPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const user = await getUser(actor, actor.id);

  return (
    <div className={styles.container}>
      <h1>Mi Cuenta</h1>
      <AccountForm userData={toPlain(user)} userId={actor.id} />
    </div>
  );
}
