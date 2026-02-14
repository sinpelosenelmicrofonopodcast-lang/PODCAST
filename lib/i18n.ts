import type { AppLang } from "@/lib/language";

export const navTexts: Record<
  AppLang,
  {
    feed: string;
    community: string;
    forum: string;
    news: string;
    blog: string;
    guest: string;
    rawZone: string;
    dashboard: string;
    profile: string;
    hello: string;
    login: string;
    join: string;
    logout: string;
  }
> = {
  es: {
    feed: "Feed",
    community: "Comunidad",
    forum: "Foro",
    news: "Noticias",
    blog: "Blog",
    guest: "Quiero salir",
    rawZone: "Zona Cruda",
    dashboard: "Dashboard",
    profile: "Mi perfil",
    hello: "Hola",
    login: "Entrar",
    join: "Unirme",
    logout: "Salir"
  },
  en: {
    feed: "Feed",
    community: "Community",
    forum: "Forum",
    news: "News",
    blog: "Blog",
    guest: "Be a guest",
    rawZone: "Raw Zone",
    dashboard: "Dashboard",
    profile: "My profile",
    hello: "Hi",
    login: "Login",
    join: "Join",
    logout: "Sign out"
  }
};

