"use client";

// import ProtectedRoute from "@/components/protectedRoute/ProtectedRoute";
// import { useSession } from "@/context/SessionContext";

const Profile = () => {
  // const { userSession } = useSession();

  return (
    <>
      <div>Esta es la página del perfil de usuario</div>
    </>
    // <ProtectedRoute>
    // <div>
    //   <div>Este es el perfil personal del usuario</div>
    //   <div>Nombre: {userSession?.first_name}</div>
    //   <div>Apellido: {userSession?.last_name}</div>
    // </div>
    // </ProtectedRoute>
  );
};

export default Profile;
