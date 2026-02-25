import type { AppLang } from "@/lib/language";

export const navTexts: Record<
  AppLang,
  {
    home: string;
    feed: string;
    podcast: string;
    community: string;
    news: string;
    rawZone: string;
    menu: string;
    blog: string;
    music: string;
    entrepreneurship: string;
    ads: string;
    guest: string;
    confessional: string;
    forum: string;
    events: string;
    theories: string;
    dashboard: string;
    profile: string;
    hello: string;
    login: string;
    join: string;
    logout: string;
  }
> = {
  es: {
    home: "Inicio",
    feed: "Feed",
    podcast: "Podcast",
    community: "Comunidad",
    news: "Noticias",
    rawZone: "Zona Cruda",
    menu: "Menú",
    blog: "Blog",
    music: "Música",
    entrepreneurship: "Emprendimiento",
    ads: "Publicidad",
    guest: "Quiero ser parte del panel",
    confessional: "Confesionario",
    forum: "Foro",
    events: "Eventos",
    theories: "Teorías",
    dashboard: "Dashboard",
    profile: "Mi perfil",
    hello: "Hola",
    login: "Entrar",
    join: "Unirme",
    logout: "Salir"
  },
  en: {
    home: "Home",
    feed: "Feed",
    podcast: "Podcast",
    community: "Community",
    news: "News",
    rawZone: "Raw Zone",
    menu: "Menu",
    blog: "Blog",
    music: "Music",
    entrepreneurship: "Entrepreneurship",
    ads: "Advertise",
    guest: "Join the panel",
    confessional: "Confessional",
    forum: "Forum",
    events: "Events",
    theories: "Theories",
    dashboard: "Dashboard",
    profile: "My profile",
    hello: "Hi",
    login: "Login",
    join: "Join",
    logout: "Sign out"
  }
};

export const ui: Record<
  AppLang,
  {
    common: {
      read: string;
      back: string;
      loading: string;
      update: string;
      edit: string;
      delete: string;
      cancel: string;
      save: string;
      close: string;
      share: string;
      noData: string;
    };
    home: {
      heroHeadline: string;
      heroSubheadline: string;
      enterNow: string;
      viewUnifiedFeed: string;
      latestSection: string;
      latestFullEpisode: string;
      noEpisodes: string;
      viewEpisode: string;
      viewFeed: string;
      visitors: string;
      promotions: string;
      brandSlotTitle: string;
      brandSlotBody: string;
      requestMediaKit: string;
      noUpcomingEventsTitle: string;
      noUpcomingEventsBody: string;
      goToEvents: string;
    };
    news: {
      title: string;
      subtitle: string;
      all: string;
      latest: string;
      mostCommented: string;
      noneYet: string;
      views: string;
      likes: string;
    };
    blog: {
      title: string;
      subtitle: string;
      noneYet: string;
    };
    ads: {
      title: string;
      subtitle: string;
      submitOk: string;
      submitCta: string;
    };
    guest: {
      title: string;
      subtitle: string;
      cta: string;
      close: string;
    };
  }
> = {
  es: {
    common: {
      read: "Leer",
      back: "Volver",
      loading: "Cargando...",
      update: "Actualizar",
      edit: "Editar",
      delete: "Eliminar",
      cancel: "Cancelar",
      save: "Guardar",
      close: "Cerrar",
      share: "Compartir",
      noData: "Aún no hay datos."
    },
    home: {
      heroHeadline: "La plaza pública privada donde se dice lo que otros callan.",
      heroSubheadline: "Contenido diario y conversación directa. Entra por PR, TX o USA y quédate por la verdad incómoda.",
      enterNow: "Entrar ahora",
      viewUnifiedFeed: "Ver feed unificado",
      latestSection: "Lo último",
      latestFullEpisode: "Último episodio completo",
      noEpisodes: "Aún no hay episodios",
      viewEpisode: "Ver episodio",
      viewFeed: "Ver feed",
      visitors: "Visitantes del sitio",
      promotions: "Promociones y anuncios",
      brandSlotTitle: "Espacio para marcas",
      brandSlotBody: "Contáctanos para promociones, banners y media kit.",
      requestMediaKit: "Solicitar media kit",
      noUpcomingEventsTitle: "No hay eventos próximos",
      noUpcomingEventsBody: "Cuando haya eventos, aparecerán aquí.",
      goToEvents: "Ir a eventos"
    },
    news: {
      title: "Noticias Sin Pelos",
      subtitle: "Curaduría manual con análisis propio.",
      all: "Todas",
      latest: "Últimas",
      mostCommented: "Más comentadas",
      noneYet: "No hay noticias cargadas aún.",
      views: "Views",
      likes: "Likes"
    },
    blog: {
      title: "Blog Sin Pelos",
      subtitle: "Artículos largos, análisis y opinión profunda.",
      noneYet: "No hay artículos aún."
    },
    ads: {
      title: "Publicidad y Patrocinios",
      subtitle: "Marcas, negocios y creadores: cuéntanos qué quieres promover y te enviamos opciones.",
      submitOk: "Solicitud enviada. Te contactamos con opciones de publicidad y media kit.",
      submitCta: "Enviar solicitud"
    },
    guest: {
      title: "Invitado especial",
      subtitle: "Cuéntanos tu disponibilidad y el tema que quieres traer. Si encaja con la línea editorial, te contactamos.",
      cta: "Quiero ser parte del panel",
      close: "Cerrar"
    }
  },
  en: {
    common: {
      read: "Read",
      back: "Back",
      loading: "Loading...",
      update: "Refresh",
      edit: "Edit",
      delete: "Delete",
      cancel: "Cancel",
      save: "Save",
      close: "Close",
      share: "Share",
      noData: "No data yet."
    },
    home: {
      heroHeadline: "The private public square where people say what others won’t.",
      heroSubheadline: "Daily content and direct conversation. Enter through PR, TX, or the USA and stay for the uncomfortable truth.",
      enterNow: "Enter now",
      viewUnifiedFeed: "View unified feed",
      latestSection: "Latest",
      latestFullEpisode: "Latest full episode",
      noEpisodes: "No episodes yet",
      viewEpisode: "Watch episode",
      viewFeed: "View feed",
      visitors: "Website visitors",
      promotions: "Promotions and ads",
      brandSlotTitle: "Ad space available",
      brandSlotBody: "Contact us for promos, banners, and a media kit.",
      requestMediaKit: "Request media kit",
      noUpcomingEventsTitle: "No upcoming events",
      noUpcomingEventsBody: "When events go live, they will show here.",
      goToEvents: "Go to events"
    },
    news: {
      title: "Noticias Sin Pelos",
      subtitle: "Manual curation with original analysis.",
      all: "All",
      latest: "Latest",
      mostCommented: "Most commented",
      noneYet: "No news yet.",
      views: "Views",
      likes: "Likes"
    },
    blog: {
      title: "Blog Sin Pelos",
      subtitle: "Long-form articles, analysis, and opinion.",
      noneYet: "No posts yet."
    },
    ads: {
      title: "Advertising and Sponsorships",
      subtitle: "Brands, businesses, and creators: tell us what you want to promote and we will follow up.",
      submitOk: "Request sent. We will contact you with options and a media kit.",
      submitCta: "Send request"
    },
    guest: {
      title: "Featured guest",
      subtitle: "Share your availability and the topic you want to bring. If it fits, we will contact you.",
      cta: "Join the panel",
      close: "Close"
    }
  }
};
