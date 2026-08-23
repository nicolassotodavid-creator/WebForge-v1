// Marca de cada empresa para su demo del Home Estimator (/demo/:slug).
//
// Los colores NO salen del CSS de su web: la mayoría de estas webs son WordPress y el
// scraping devolvía la paleta por defecto de Gutenberg (#cc3366, #f78da7…) o de Bootstrap
// (#337ab7, #d9534f…), que no son colores de marca. Están sacados del logo, revisados uno
// a uno. Cuando el logo es monocromo (grupodmh, claiz, metrocuadrado, efenval) se marca
// `mono` y la demo se pinta en tinta, que es la lectura honesta de esa marca.
//
// Los logos se sirven desde /demo/logos (descargados, no hotlink).

export interface Brand {
  slug: string;
  empresa: string;
  ciudad: string;
  web: string;
  /** Ruta del logo, o "" si su web no publica uno: entonces se compone un wordmark. */
  logo: string;
  /** El logo es blanco/claro: necesita fondo oscuro detrás. */
  logoOnDark?: boolean;
  /** La marca no tiene color propio: la demo se pinta en tinta. */
  mono?: boolean;
  primary: string;
  secondary: string;
}

export const BRANDS: Brand[] = [
  {
    slug: "reformas-valencia-myj", empresa: "Reformas Valencia M&J", ciudad: "València",
    web: "https://reformasvalenciamj.es", logo: "/demo/logos/reformas-valencia-myj.jpg",
    primary: "#152f8c", secondary: "#12907e",
  },
  {
    slug: "grupodmh", empresa: "GrupoDMH Reformas Integrales", ciudad: "València",
    web: "https://grupodmh.es", logo: "/demo/logos/grupodmh-logo.webp", logoOnDark: true,
    mono: true, primary: "#23232e", secondary: "#5c5c6b",
  },
  {
    slug: "nou-cabanyal", empresa: "Reformas Nou Cabanyal", ciudad: "València",
    web: "https://noucabanyal.com", logo: "/demo/logos/nou-cabanyal.svg",
    primary: "#ec6a2b", secondary: "#1e262e",
  },
  {
    slug: "reformas-lujan", empresa: "Reformas Luján", ciudad: "València",
    web: "https://reformaslujan.es", logo: "/demo/logos/reformas-lujan.png",
    primary: "#254a91", secondary: "#d83048",
  },
  {
    slug: "reformas-claiz", empresa: "Reformas Claiz", ciudad: "Burjassot",
    web: "https://www.reformasclaiz.es", logo: "/demo/logos/reformas-claiz.png",
    mono: true, primary: "#16161a", secondary: "#54545e",
  },
  {
    slug: "geteco", empresa: "GETECO", ciudad: "València",
    web: "https://www.geteco.es", logo: "/demo/logos/geteco.png", logoOnDark: true,
    primary: "#a72a2a", secondary: "#2aa768",
  },
  {
    slug: "reformas-rocha", empresa: "Reformas Rocha", ciudad: "València",
    web: "https://www.reformasrocha.es", logo: "/demo/logos/reformas-rocha-logo.png",
    primary: "#006eb3", secondary: "#d97706",
  },
  {
    slug: "tas-obras-y-reformas", empresa: "tAs obrAs y reformAs", ciudad: "València",
    web: "http://www.tasobrasyreformas.es", logo: "",
    primary: "#0090cf", secondary: "#6d6d3f",
  },
  {
    slug: "robles-home", empresa: "ROBLES Home", ciudad: "Torrent",
    web: "https://robleshome.com", logo: "/demo/logos/robles-home.png",
    primary: "#1c3690", secondary: "#4860a8",
  },
  {
    slug: "marcos-mym", empresa: "Reformas Marcos MyM", ciudad: "València",
    web: "https://reformasmarcosmym.com", logo: "",
    primary: "#b02318", secondary: "#a08a5e",
  },
  {
    slug: "rfc-reformas", empresa: "RFC Reformas", ciudad: "València",
    web: "https://rfcreformas.es", logo: "/demo/logos/rfc-reformas.png",
    primary: "#0a3048", secondary: "#f0a800",
  },
  {
    slug: "metrocuadrado", empresa: "Metrocuadrado Estudio", ciudad: "L'Eliana",
    web: "https://metrocuadradoestudio.com", logo: "/demo/logos/metrocuadrado.png",
    mono: true, primary: "#141418", secondary: "#55555f",
  },
  {
    slug: "efenval", empresa: "Construcciones Efenval", ciudad: "Quart de Poblet",
    web: "https://efenval.com", logo: "/demo/logos/efenval.jpg",
    mono: true, primary: "#17171b", secondary: "#57575f",
  },
  {
    slug: "rdg-reformas", empresa: "RDG Reformas", ciudad: "València",
    web: "https://www.reformasvalenciardg.es", logo: "/demo/logos/rdg-reformas.png",
    primary: "#0d8a33", secondary: "#e0c74e",
  },
  {
    slug: "reformas-turia", empresa: "Reformas Turia", ciudad: "València",
    web: "https://reformasintegrales-valencia.com.es", logo: "",
    primary: "#2c3e50", secondary: "#f39c12",
  },

  // ---- Lote del miércoles (16-30 de la auditoría) ----
  // Cuando el color del logo no aguanta texto blanco encima (el lima de Bailén, el oro de
  // Expovall, el naranja de Bono e Incoval), `primary` es ese mismo tono bajado hasta que
  // el botón se lee, y el color literal del logo queda en `secondary`.
  {
    slug: "gabi-reformas", empresa: "Gabi Reformas", ciudad: "Torrent",
    web: "https://gabireformas.com", logo: "/demo/logos/gabi-reformas.png",
    primary: "#016a38", secondary: "#8dc54a",
  },
  {
    slug: "reformas-bailen", empresa: "Reformas Bailén", ciudad: "Paterna",
    web: "http://www.reformasbailen.es", logo: "/demo/logos/reformas-bailen.jpg",
    primary: "#3f8a05", secondary: "#77fc04",
  },
  {
    slug: "grupo-g-reformas", empresa: "Grupo G Reformas", ciudad: "Sagunt",
    web: "https://grupogreformas.es", logo: "/demo/logos/grupo-g-reformas.jpg",
    primary: "#172948", secondary: "#3d5478",
  },
  {
    slug: "azahar-reformas", empresa: "Azahar Reformas Valencia", ciudad: "València",
    web: "https://azaharreformasvalencia.com", logo: "/demo/logos/azahar-reformas.png",
    logoOnDark: true, mono: true, primary: "#26211a", secondary: "#b3a48c",
  },
  {
    slug: "todo-reformas-valencia", empresa: "Todo Reformas Valencia", ciudad: "València",
    web: "https://www.todoreformasvalencia.com", logo: "/demo/logos/todo-reformas-valencia.png",
    primary: "#262c3a", secondary: "#cbbdb2",
  },
  {
    slug: "reformas-orcu", empresa: "Reformas Orcu", ciudad: "Picassent",
    web: "http://reformasorcuhogar.com", logo: "/demo/logos/reformas-orcu.jpg",
    primary: "#d0281a", secondary: "#17130c",
  },
  {
    slug: "obras-vip", empresa: "OBRAS VIP", ciudad: "Xirivella",
    // Su web solo publica el isotipo a 50 px: no da para pintarlo, así que va wordmark.
    web: "https://www.obrasvip.com", logo: "",
    primary: "#c33c00", secondary: "#2f3234",
  },
  {
    slug: "bono-proyectos", empresa: "BONO PROYECTOS", ciudad: "Catarroja",
    web: "http://www.bonoproyectos.es", logo: "/demo/logos/bono-proyectos.jpg",
    primary: "#de6f00", secondary: "#7e7e7e",
  },
  {
    slug: "vga-reformas", empresa: "VGA Proyectos y Reformas", ciudad: "Massamagrell",
    web: "https://vgareformas.es", logo: "/demo/logos/vga-reformas.jpg",
    primary: "#be0b30", secondary: "#231e1e",
  },
  {
    slug: "reformspeed", empresa: "REFORMSPEED", ciudad: "València",
    web: "https://reformspeed.es", logo: "/demo/logos/reformspeed.png",
    primary: "#404e7c", secondary: "#6c78a3",
  },
  {
    slug: "grupo-expovall", empresa: "Valltro · Grupo Expovall", ciudad: "Puerto de Sagunto",
    web: "https://grupoexpovall.com", logo: "/demo/logos/grupo-expovall.png", logoOnDark: true,
    primary: "#a87a00", secondary: "#e7a802",
  },
  {
    slug: "cecever", empresa: "Reformas Cecever", ciudad: "Paterna",
    web: "https://www.cecever.com", logo: "/demo/logos/cecever.png", logoOnDark: true,
    primary: "#b3760a", secondary: "#fcb62a",
  },
  {
    slug: "reformas-ferreira", empresa: "Reformas Ferreira", ciudad: "Manises",
    web: "http://www.reformasferreira.es", logo: "/demo/logos/reformas-ferreira.svg",
    primary: "#193665", secondary: "#ff631b",
  },
  {
    slug: "dekorinex", empresa: "Dekorinex", ciudad: "Quart de Poblet",
    web: "http://dekorinex.es", logo: "/demo/logos/dekorinex.jpg",
    primary: "#254899", secondary: "#4a4a4a",
  },
  {
    slug: "incoval", empresa: "Incoval Reformas Integrales", ciudad: "València",
    web: "https://www.incoval.es", logo: "/demo/logos/incoval.png",
    primary: "#e04a00", secondary: "#1e1916",
  },
];

export const findBrand = (slug: string | undefined): Brand | undefined =>
  BRANDS.find((b) => b.slug === slug);
