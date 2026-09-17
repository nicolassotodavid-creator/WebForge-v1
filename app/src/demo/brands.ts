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
    primary: "#3d8505", secondary: "#77fc04",
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
    primary: "#b55b00", secondary: "#7e7e7e",
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
    primary: "#966d00", secondary: "#e7a802",
  },
  {
    slug: "cecever", empresa: "Reformas Cecever", ciudad: "Paterna",
    web: "https://www.cecever.com", logo: "/demo/logos/cecever.png", logoOnDark: true,
    primary: "#a06909", secondary: "#fcb62a",
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
    primary: "#d14500", secondary: "#1e1916",
  },
  // Lote 3 (13-sep): Safor y Ribera + fichas A de agosto.
  {
    slug: "renovat-reformas", empresa: "Renovat Reformas", ciudad: "Alzira",
    web: "https://www.reformasrenovat.com", logo: "/demo/logos/renovat-reformas.png", logoOnDark: true,
    primary: "#927204", secondary: "#f8c40c",
  },
  {
    slug: "reformas-pintores-nico", empresa: "Reformas y Pintores Nico", ciudad: "Gandia",
    web: "https://xn--reformaypintoresnicoespaa-woc.com", logo: "/demo/logos/reformas-pintores-nico.png",
    primary: "#d44141", secondary: "#db5e5e",
  },
  {
    slug: "mestre-reformas", empresa: "Mestre Reformas", ciudad: "Gandia",
    web: "https://www.mestrereformas.com", logo: "/demo/logos/mestre-reformas.png",
    primary: "#937138", secondary: "#c09a5b",
  },
  {
    slug: "reformas-villa", empresa: "Reformas Villa", ciudad: "Cullera",
    web: "https://www.reformasvilla.com", logo: "/demo/logos/reformas-villa.png",
    primary: "#eb1412", secondary: "#3a3a44",
  },
  {
    slug: "macamon-reformas", empresa: "Macamon Reformas Integrales", ciudad: "Gandia",
    web: "https://macamoncho.es", logo: "/demo/logos/macamon-reformas.png",
    primary: "#e2001a", secondary: "#1a171b",
  },
  {
    slug: "hidro2-grup", empresa: "Hidro2 Grup", ciudad: "Gandia",
    web: "https://www.hidro2grup.com", logo: "/demo/logos/hidro2-grup.png",
    primary: "#312783", secondary: "#2daae1",
  },
  {
    slug: "estil-nou-miravet", empresa: "Estil Nou Miravet", ciudad: "Algemesí",
    web: "https://estilnoumiravet.com", logo: "/demo/logos/estil-nou-miravet.png", logoOnDark: true,
    mono: true, primary: "#23232e", secondary: "#5c5c6b",
  },
  {
    slug: "reformas-antoine", empresa: "Reformas Antoine", ciudad: "Gandia",
    web: "https://reformasytrasterosantuine.com", logo: "/demo/logos/reformas-antoine.png",
    primary: "#bf4e86", secondary: "#d07ea7",
  },
  {
    slug: "cuinex", empresa: "Reformas integrales Cuinex", ciudad: "Alzira",
    web: "https://www.cuinexreformas.es", logo: "/demo/logos/cuinex.png",
    primary: "#d8241c", secondary: "#71706e",
  },
  {
    slug: "jesbal-habitatge", empresa: "Jesbal Habitatge", ciudad: "Gandia",
    web: "https://jesbalhabitatge.es", logo: "/demo/logos/jesbal-habitatge.jpg",
    primary: "#b95e00", secondary: "#e47400",
  },
  {
    slug: "gytech-group", empresa: "Gytech group", ciudad: "Llíria",
    web: "https://gytechgroup.com", logo: "/demo/logos/gytech-group.png",
    primary: "#0d589e", secondary: "#6c6c6d",
  },
  {
    slug: "reformas-genesis", empresa: "Construcciones y Reformas Génesis", ciudad: "L'Eliana",
    web: "https://www.reformasgenesis.com.es", logo: "/demo/logos/reformas-genesis.png", logoOnDark: true,
    primary: "#88743b", secondary: "#b8a05c",
  },
  {
    slug: "sacaber", empresa: "Reformas y Proyectos Sacaber", ciudad: "Torrent",
    web: "http://sacaber.com", logo: "/demo/logos/sacaber.svg",
    primary: "#0d1d5c", secondary: "#d96e3f",
  },
  {
    slug: "ramirez-castaneda", empresa: "Construcciones y Reformas Ramírez Castañeda", ciudad: "Catarroja",
    web: "https://www.xn--construccionesyreformasramirezcastaedasl-n2d.es", logo: "/demo/logos/ramirez-castaneda.png",
    primary: "#a4150b", secondary: "#013e1c",
  },
  {
    slug: "multiservicios-am-levante", empresa: "Multiservicios AM Levante", ciudad: "Picassent",
    web: "https://www.multiserviciosamlevante.es", logo: "/demo/logos/multiservicios-am-levante.jpeg",
    primary: "#008429", secondary: "#074d89",
  },
  // Lote 4 (13-sep): lo mejor que quedaba de las auditorías.
  {
    slug: "ecerotres", empresa: "Ecerotres Arquitectos", ciudad: "Alboraya",
    web: "https://ecerotresarquitectos.com", logo: "/demo/logos/ecerotres.png", logoOnDark: true,
    mono: true, primary: "#23232e", secondary: "#5c5c6b",
  },
  {
    slug: "extramurs", empresa: "extraMURS Arquitectura", ciudad: "Alboraya",
    web: "https://extramurs.com", logo: "/demo/logos/extramurs.svg",
    mono: true, primary: "#23232e", secondary: "#5c5c6b",
  },
  {
    slug: "proyecta-lara", empresa: "Proyecta Lara", ciudad: "Paterna",
    web: "https://proyectalara.es", logo: "/demo/logos/proyecta-lara.png",
    mono: true, primary: "#23232e", secondary: "#5c5c6b",
  },
  {
    slug: "construcciones-olbe", empresa: "Construcciones OLBE", ciudad: "Aldaia",
    web: "https://www.construccionesolbe.com", logo: "/demo/logos/construcciones-olbe.png",
    primary: "#a06c09", secondary: "#f4b63f",
  },
  {
    slug: "clurjor", empresa: "Construcciones y Reformas Clurjor", ciudad: "Aldaia",
    web: "http://www.clurjor.com", logo: "/demo/logos/clurjor.png",
    primary: "#98203f", secondary: "#1a1a1a",
  },
  {
    slug: "nca-interiores", empresa: "NCA Interiores", ciudad: "Alaquàs",
    web: "https://ncainteriores.es", logo: "/demo/logos/nca-interiores.svg",
    mono: true, primary: "#23232e", secondary: "#5c5c6b",
  },
  {
    slug: "obralis", empresa: "Obralis", ciudad: "València",
    web: "https://obralis.es", logo: "/demo/logos/obralis.png",
    primary: "#a76807", secondary: "#f59a10",
  },
  {
    slug: "mesform", empresa: "Mesform Interiorismo", ciudad: "Cullera",
    web: "https://www.mesform.es", logo: "/demo/logos/mesform.png",
    primary: "#3f853d", secondary: "#469544",
  },
  {
    slug: "tres-i-tres", empresa: "Tres i Tres Interiorismo", ciudad: "Paterna",
    web: "https://3itres.com", logo: "/demo/logos/tres-i-tres.png",
    primary: "#6d004a", secondary: "#9d9fa0",
  },
  {
    slug: "escriva-sanjuan", empresa: "Reformas Escrivá Sanjuan", ciudad: "Gandia",
    web: "https://escrivasanjuan.com", logo: "/demo/logos/escriva-sanjuan.png",
    primary: "#c22227", secondary: "#2d2d2c",
  },
  {
    slug: "mya-instaladores", empresa: "M&A Instaladores", ciudad: "Torrent",
    web: "https://myainstaladores.com", logo: "/demo/logos/mya-instaladores.png",
    primary: "#2a7bba", secondary: "#318bd1",
  },
  {
    slug: "vimoa", empresa: "Vimoa", ciudad: "Burjassot",
    web: "https://vimoa.es", logo: "/demo/logos/vimoa.png",
    mono: true, primary: "#23232e", secondary: "#5c5c6b",
  },
  {
    slug: "dluxesolutions", empresa: "DLUXE Solutions · Reformas en Oliva", ciudad: "Oliva",
    web: "https://reformasenoliva.es", logo: "/demo/logos/dluxesolutions.png", logoOnDark: true,
    mono: true, primary: "#23232e", secondary: "#5c5c6b",
  },
  {
    slug: "salvicar", empresa: "Construcciones y Reformas Salvicar", ciudad: "Carlet",
    web: "https://reformas.salvicar.com", logo: "",
    mono: true, primary: "#23232e", secondary: "#5c5c6b",
  },
  {
    slug: "obraestil", empresa: "ObraEstil", ciudad: "Ontinyent",
    web: "https://obraestil.es", logo: "/demo/logos/obraestil.png",
    mono: true, primary: "#23232e", secondary: "#5c5c6b",
  },
  // ---- Madrid sur y este, lote 1 (13-sep) ----
  {
    slug: "reformas-blancor", empresa: "Reformas Blancor", ciudad: "Alcorcón",
    web: "https://reformasblancor.es", logo: "/demo/logos/reformas-blancor.png",
    primary: "#637d1d", secondary: "#abd342",
  },
  {
    slug: "varada", empresa: "Varada Reformas", ciudad: "Torrejón de Ardoz",
    web: "https://varada.es", logo: "/demo/logos/varada.png",
    mono: true, primary: "#23232e", secondary: "#5c5c6b",
  },
  {
    slug: "raynadecor", empresa: "Raynadecor", ciudad: "Móstoles",
    web: "https://raynadecor.es", logo: "/demo/logos/raynadecor.jpg",
    primary: "#667c2a", secondary: "#a5c260",
  },
  {
    slug: "construcciones-jdm", empresa: "Construcciones J.D.M.", ciudad: "Alcobendas",
    web: "https://construccionesjdm.com", logo: "/demo/logos/construcciones-jdm.png",
    primary: "#36046f", secondary: "#ff3900",
  },
  {
    slug: "reformas-areal", empresa: "Reformas Integrales Areal", ciudad: "Alcorcón",
    web: "https://reformasintegralesareal.es", logo: "/demo/logos/reformas-areal.png",
    primary: "#a86300", secondary: "#ff9600",
  },
  {
    slug: "quality-reform", empresa: "Quality Reform", ciudad: "Fuenlabrada",
    web: "https://qualityreform.com", logo: "/demo/logos/quality-reform.png",
    primary: "#147ba8", secondary: "#8e1216",
  },
  {
    slug: "iasa-design", empresa: "Iasa Design", ciudad: "Rivas-Vaciamadrid",
    web: "https://www.iasadesign.com", logo: "/demo/logos/iasa-design-fondo.png", logoOnDark: true,
    mono: true, primary: "#23232e", secondary: "#5c5c6b",
  },
  {
    slug: "foydecor", empresa: "Foydecor", ciudad: "Móstoles",
    web: "https://foydecor.com", logo: "/demo/logos/foydecor.png",
    primary: "#29579e", secondary: "#5c5c6b",
  },
  {
    slug: "reformas-el-baul", empresa: "Reformas El Baúl", ciudad: "Móstoles",
    web: "https://www.reformaselbaul.com", logo: "/demo/logos/reformas-el-baul.png",
    primary: "#690202", secondary: "#ff3535",
  },
  {
    slug: "reformas-alcomad", empresa: "Reformas AlcoMad", ciudad: "Alcorcón",
    web: "https://www.reformasalcomad.es", logo: "/demo/logos/reformas-alcomad.jpg",
    primary: "#057cb1", secondary: "#079fe2",
  },
  {
    slug: "reformas-marian", empresa: "Reformas Marian", ciudad: "Torrejón de Ardoz",
    web: "https://reformasmarian.es", logo: "",
    primary: "#996d00", secondary: "#ffb600",
  },
  {
    slug: "support-home", empresa: "Support Home", ciudad: "Valdemoro",
    web: "https://supporthome.es", logo: "/demo/logos/support-home.jpg",
    primary: "#0262bd", secondary: "#bfe1b2",
  },
  {
    slug: "remacen", empresa: "Remacen Reparaciones", ciudad: "Alcalá de Henares",
    web: "https://www.reformasmadridcentro.com", logo: "",
    primary: "#986c18", secondary: "#eac378",
  },
  {
    slug: "reformas-vegam", empresa: "Reformas Vegam", ciudad: "Alcobendas",
    web: "https://www.reformasvegam.es", logo: "/demo/logos/reformas-vegam.jpeg",
    primary: "#9c6b01", secondary: "#feb619",
  },
  {
    slug: "grupo-leon-reformas", empresa: "Grupo León Reformas", ciudad: "Getafe",
    web: "https://grupoleonreformas.com", logo: "",
    mono: true, primary: "#23232e", secondary: "#5c5c6b",
  },

// --- Madrid 2 (2026-09-17): segunda tanda del sur, este y norte de Madrid ---
  {
    slug: "irc-service", empresa: "IRC Service", ciudad: "Torrejón de Ardoz",
    web: "https://reformasentorrejon.com", logo: "/demo/logos/irc-service.png", mono: true,
    primary: "#23232e", secondary: "#5c5c6b",
  },
  {
    slug: "sigueplac", empresa: "Sigueplac SGP Home", ciudad: "Alcorcón",
    web: "https://sigueplac.com", logo: "/demo/logos/sigueplac.png", mono: true,
    primary: "#23232e", secondary: "#5c5c6b",
  },
  {
    slug: "refordomus", empresa: "Refordomus Obras y Servicios", ciudad: "Móstoles",
    web: "https://refordomus.es", logo: "/demo/logos/refordomus.png",
    primary: "#fe621b", secondary: "#feb999",
  },
  {
    slug: "rehabiliti", empresa: "Rehabiliti", ciudad: "San Sebastián de los Reyes",
    web: "https://rehabiliti.com", logo: "/demo/logos/rehabiliti.png",
    primary: "#4b4c99", secondary: "#a1a1d1",
  },
  {
    slug: "reformax", empresa: "ReformaX", ciudad: "San Sebastián de los Reyes",
    web: "https://reformax.es", logo: "/demo/logos/reformax.png", mono: true,
    primary: "#23232e", secondary: "#5c5c6b",
  },
  {
    slug: "spacioh", empresa: "Spacioh", ciudad: "Fuenlabrada",
    web: "https://spacioh.com", logo: "/demo/logos/spacioh.svg",
    primary: "#e4092f", secondary: "#161616",
  },
  {
    slug: "reformas-europa", empresa: "Reformas Europa", ciudad: "Torrejón de Ardoz",
    web: "https://www.reformaseuropa.es", logo: "/demo/logos/reformas-europa.png",
    primary: "#003298", secondary: "#fdcf04",
  },
  {
    slug: "decojust", empresa: "Reformas Integrales DecoJust", ciudad: "Móstoles",
    web: "https://decojust.es", logo: "/demo/logos/decojust.png",
    primary: "#b8211e", secondary: "#e97d7b",
  },
  {
    slug: "juropa", empresa: "Juropa Reformas", ciudad: "Fuenlabrada",
    web: "https://www.juropareformas.es", logo: "/demo/logos/juropa.png",
    primary: "#fd8221", secondary: "#056899",
  },
  {
    slug: "fusion-reformas", empresa: "Fusión Reformas", ciudad: "Móstoles",
    web: "https://fusionreformas.com", logo: "/demo/logos/fusion-reformas.png",
    primary: "#1f074e", secondary: "#e1b71d",
  },
  {
    slug: "gesamarcos", empresa: "Gesamarcos", ciudad: "Rivas-Vaciamadrid",
    web: "https://www.gesamarcos.es", logo: "/demo/logos/gesamarcos.jpg",
    primary: "#e8434f", secondary: "#1f9ed9",
  },
  {
    slug: "areareforma", empresa: "AreaReforma", ciudad: "Leganés",
    web: "https://areareforma.com", logo: "/demo/logos/areareforma.jpg",
    primary: "#fae223", secondary: "#fcf19b",
  },
  {
    slug: "reformas-sucon", empresa: "Reformas Sucon", ciudad: "Parla",
    web: "https://reformassucon.com", logo: "/demo/logos/reformas-sucon.png",
    primary: "#006333", secondary: "#2e9e63",
  },
  {
    slug: "midan-home", empresa: "Midan Home", ciudad: "Getafe",
    web: "https://reformasmidanhome.com", logo: "/demo/logos/midan-home.png", mono: true,
    primary: "#23232e", secondary: "#c8922a",
  },
  {
    slug: "hometailor", empresa: "HomeTailor", ciudad: "San Sebastián de los Reyes",
    web: "https://hometailor.es", logo: "/demo/logos/hometailor.png",
    primary: "#1a3156", secondary: "#3b6fc3",
  },
  {
    slug: "integral-dgm", empresa: "Integral DGM", ciudad: "Móstoles",
    web: "https://reformainterior.es", logo: "/demo/logos/integral-dgm.png",
    primary: "#e02020", secondary: "#1a1a1a",
  },
  {
    slug: "waris-reformas", empresa: "Waris Reformas", ciudad: "Rivas-Vaciamadrid",
    web: "https://warisreformas.com", logo: "", mono: true,
    primary: "#23232e", secondary: "#5c5c6b",
  },
  {
    slug: "construpolis", empresa: "Construpolis", ciudad: "Alcalá de Henares",
    web: "https://construpolis.net", logo: "/demo/logos/construpolis.png",
    primary: "#03376b", secondary: "#067ef5",
  },
  {
    slug: "narvoa", empresa: "Narvoa Construcciones", ciudad: "Alcobendas",
    web: "https://narvoa.com", logo: "/demo/logos/narvoa.png", logoOnDark: true, mono: true,
    primary: "#23232e", secondary: "#5c5c6b",
  },
  {
    slug: "reformas-torrejon", empresa: "Reformas Torrejón de Ardoz", ciudad: "Torrejón de Ardoz",
    web: "https://reformastorrejondeardoz.com", logo: "", mono: true,
    primary: "#23232e", secondary: "#5c5c6b",
  },
  {
    slug: "jukave", empresa: "Jukave Construcciones y Reformas", ciudad: "Coslada",
    web: "https://cys-construccionesyreformasjukave.com", logo: "/demo/logos/jukave.png",
    primary: "#1b4f9c", secondary: "#d0202a",
  },
  {
    slug: "cocinas-plaza", empresa: "Cocinas y Reformas Plaza", ciudad: "Rivas-Vaciamadrid",
    web: "https://cocinasyreformasplaza.com", logo: "/demo/logos/cocinas-plaza.png",
    primary: "#d8232a", secondary: "#1b9ad6",
  },
  {
    slug: "caldisban", empresa: "Caldisban", ciudad: "Alcobendas",
    web: "http://www.caldisban.com", logo: "", mono: true,
    primary: "#23232e", secondary: "#5c5c6b",
  },
  {
    slug: "pro-reforma", empresa: "Pro Reforma", ciudad: "Rivas-Vaciamadrid",
    web: "https://www.proreforma.es", logo: "/demo/logos/pro-reforma.png",
    primary: "#c1121f", secondary: "#23232e",
  },
  {
    slug: "garcia-romero", empresa: "Grupo García Romero e Hijos", ciudad: "Rivas-Vaciamadrid",
    web: "https://www.reformasgarciaromero.es", logo: "/demo/logos/garcia-romero.png",
    primary: "#e30414", secondary: "#fc7982",
  },
  {
    slug: "180-grados", empresa: "180 Grados Obras y Proyectos", ciudad: "Alcobendas",
    web: "https://180grados.es", logo: "/demo/logos/180-grados.png",
    primary: "#00ae85", secondary: "#3dfed1",
  },
  {
    slug: "a-reformas", empresa: "A-Reformas", ciudad: "Alcobendas",
    web: "http://www.areformas.es", logo: "/demo/logos/a-reformas.png",
    primary: "#1ea7e1", secondary: "#111111",
  },
  {
    slug: "clc-reformas", empresa: "CLC Reformas", ciudad: "Arganda del Rey",
    web: "https://clcreformas.com", logo: "/demo/logos/clc-reformas.png", mono: true,
    primary: "#23232e", secondary: "#5c5c6b",
  },
  {
    slug: "reformas-valentin", empresa: "Reformas Valentín", ciudad: "Coslada",
    web: "https://www.reformasvalentin.es", logo: "/demo/logos/reformas-valentin.png",
    primary: "#08d2a0", secondary: "#6ff9d7",
  },
  {
    slug: "reformas-pio", empresa: "Reformas Integrales Pío", ciudad: "Mejorada del Campo",
    web: "https://www.reformasintegralespio.es", logo: "", mono: true,
    primary: "#23232e", secondary: "#5c5c6b",
  },
  {
    slug: "reformas-velez", empresa: "Reformas Vélez", ciudad: "Fuenlabrada",
    web: "https://reformasvelez.es", logo: "/demo/logos/reformas-velez.png",
    primary: "#124ca6", secondary: "#5993ed",
  },
  {
    slug: "auge-reformas", empresa: "Auge Reformas Madrid", ciudad: "Getafe",
    web: "https://augereformasmadrid.com", logo: "/demo/logos/auge-reformas.png", mono: true,
    primary: "#23232e", secondary: "#5c5c6b",
  },
  {
    slug: "juan-salcedo", empresa: "Reformas Juan Salcedo", ciudad: "Alcalá de Henares",
    web: "https://reformasjuansalcedo.com", logo: "", mono: true,
    primary: "#23232e", secondary: "#5c5c6b",
  },
  {
    slug: "hegasa", empresa: "Hegasa Construcciones y Reformas", ciudad: "Fuenlabrada",
    web: "https://reformasintegralesmadridhegasa.com", logo: "/demo/logos/hegasa.png",
    primary: "#5c2028", secondary: "#c04a5a",
  },
  {
    slug: "mhd-reformas", empresa: "MHD Reformas Integrales", ciudad: "Valdemoro",
    web: "https://mhdreformasintegrales.com", logo: "/demo/logos/mhd-reformas.png",
    primary: "#00b7c9", secondary: "#aa752a",
  },
  {
    slug: "reformas-daniel", empresa: "Decoración y Reformas Daniel", ciudad: "Leganés",
    web: "https://reformasdaniel.net", logo: "/demo/logos/reformas-daniel.png",
    primary: "#e01b24", secondary: "#23232e",
  },
  {
    slug: "mlc", empresa: "MLC Trabajos Integrales", ciudad: "Móstoles",
    web: "https://mlctrabajosintegrales.com", logo: "/demo/logos/mlc.jpg",
    primary: "#e8a800", secondary: "#23232e",
  },
];

export const findBrand = (slug: string | undefined): Brand | undefined =>
  BRANDS.find((b) => b.slug === slug);
