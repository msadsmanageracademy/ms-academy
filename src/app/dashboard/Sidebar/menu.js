const SIDEBAR_MENU = [
  {
    href: "/dashboard",
    iconKey: "User",
    label: (session) => (session?.user?.role === "admin" ? "Admin" : "Usuario"),
    roles: ["user", "admin"],
  },
  {
    href: "/dashboard/account",
    iconKey: "UserId",
    label: "Mis datos",
    roles: ["user", "admin"],
  },
  {
    href: "/dashboard/notifications",
    iconKey: "Bell",
    label: "Notificaciones",
    roles: ["user", "admin"],
  },
  {
    href: "/dashboard/classes",
    iconKey: "NavbarClasses",
    label: "Clases",
    roles: ["user", "admin"],
  },
  {
    href: "/dashboard/courses",
    iconKey: "NavbarDashboard",
    label: "Cursos",
    roles: ["user", "admin"],
  },
];

export default SIDEBAR_MENU;
