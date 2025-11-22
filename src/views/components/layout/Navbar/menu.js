const MENU = [
  {
    description: "Academia de Ads Manager",
    href: "/",
    iconKey: "NavbarHome",
    label: "Inicio",
  },
  {
    description: "Dashboard",
    href: "/dashboard",
    iconKey: "NavbarDashboard",
    label: "Dashboard",
    protected: true,
  },
  {
    description: "Clases y cursos disponibles",
    href: "/content",
    iconKey: "NavbarClasses",
    label: "Próximas actividades",
  },
  {
    description: "Contacto",
    href: "/contact",
    iconKey: "NavbarContact",
    label: "Contacto",
  },
  {
    description: "Sobre mí",
    href: "/about",
    iconKey: "NavbarAbout",
    label: "Sobre mí",
  },
  {
    description: "Ingresar a la plataforma",
    href: "/login",
    iconKey: "NavbarLogin",
    label: "Ingresar",
    hideWhenAuthenticated: true,
  },
];

export default MENU;
