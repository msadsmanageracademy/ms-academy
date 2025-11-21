const MENU = [
  {
    description: "Academia de Ads Manager",
    href: "/",
    iconKey: "NavbarHome",
    label: "Inicio",
  },
  {
    description: "Working to improve Core Banking",
    href: "/dashboard",
    iconKey: "NavbarDashboard",
    label: "Dashboard",
    protected: true,
  },
  {
    description: "Global Fineract deployments",
    iconKey: "NavbarClasses",
    label: "Próximas actividades",
    submenu: [
      {
        description: "Clases y cursos",
        href: "/content",
        iconKey: "NavbarLoan",
        label: "Material",
      },
    ],
  },
  {
    description: "Trailblazing the path to an agile financial world",
    href: "/contact",
    iconKey: "NavbarContact",
    label: "Contacto",
  },
  {
    description: "Trailblazing the path to an agile financial world",
    href: "/login",
    iconKey: "NavbarLogin",
    label: "Ingresar",
    hideWhenAuthenticated: true,
  },
  {
    description: "Working to improve Core Banking",
    href: "/about",
    iconKey: "NavbarAbout",
    label: "Sobre mí",
  },
];

export default MENU;
