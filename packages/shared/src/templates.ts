// Catalog of slide templates. The player renders them; the admin builds forms
// from this metadata; the server validates against it. Adding a template means
// adding an entry here plus one file in apps/player/templates/.

export type Theme = 'dark' | 'sage' | 'light';
export const THEMES: readonly Theme[] = ['dark', 'sage', 'light'];
export const THEME_LABELS: Record<Theme, string> = { dark: 'Oscuro', sage: 'Salvia', light: 'Claro' };

export type Transition = 'fade' | 'curtain' | 'none';
export const TRANSITIONS: readonly Transition[] = ['fade', 'curtain', 'none'];
export const TRANSITION_LABELS: Record<Transition, string> = {
  fade: 'Fundido',
  curtain: 'Cortina con la gota',
  none: 'Sin transición',
};

/** `offers` means every visible service that has an active offer price. */
export type SourceType = 'category' | 'services' | 'offers' | 'promo';

export interface SlideSource {
  type: SourceType;
  categoryId?: number;
  serviceIds?: number[];
  promoId?: number;
}

export interface Person {
  name: string;
  role?: string;
  quote?: string;
  image?: string;
}

/** Free-form content of a slide. Every key is optional; templates read what they need. */
export interface SlideSlots {
  title?: string;
  subtitle?: string;
  body?: string;
  source?: SlideSource;
  columns?: number;
  grid?: string;
  image?: string;
  video?: string;
  items?: string[];
  people?: Person[];
  /** Uploaded pictures for the gallery template. */
  images?: GalleryImage[];
  /** Gallery arrangement. */
  layout?: GalleryLayout;
  /** How pictures fill their frame: cropped to fill it, or shown whole. */
  fit?: 'cover' | 'contain';
}

export interface GalleryImage {
  url: string;
  caption?: string;
}

export type GalleryLayout = 'columns' | 'mosaic' | 'full';
export const GALLERY_LAYOUTS: readonly GalleryLayout[] = ['columns', 'mosaic', 'full'];
export const GALLERY_LAYOUT_LABELS: Record<GalleryLayout, string> = {
  columns: 'En columnas',
  mosaic: 'Mosaico (una grande y varias pequeñas)',
  full: 'Una a la vez, a pantalla completa',
};

export interface SlideSchedule {
  /** 0 = Sunday … 6 = Saturday. Empty or missing means every day. */
  days?: number[];
  /** "HH:MM" in clinic time (America/Puerto_Rico). */
  from?: string;
  to?: string;
  /** Show only while the clinic is open, only while closed, or always. */
  clinic?: 'any' | 'open' | 'closed';
}

export type FieldKey = 'title' | 'subtitle' | 'body' | 'columns' | 'grid' | 'image' | 'video' | 'items' | 'people' | 'images' | 'layout' | 'fit';

export interface TemplateMeta {
  id: string;
  label: string;
  description: string;
  sources: SourceType[];
  fields: FieldKey[];
  defaults: SlideSlots;
  /** Choices for the `columns` field. Defaults to 1 or 2. */
  columnOptions?: number[];
  /** Group shown in the "add slide" dialog. */
  group: 'Marca' | 'Menú y precios' | 'Fotos' | 'Ofertas y promociones' | 'Otros';
}

export const GRID_OPTIONS = ['2x2', '3x2', '3x3', '4x2', '4x3'] as const;

export const TEMPLATES: readonly TemplateMeta[] = [
  {
    id: 'brand-cover',
    group: 'Marca',
    label: 'Portada de marca',
    description: 'Logo, descriptor, filete dorado, silueta de la gota y frases de la marca.',
    sources: [],
    fields: [],
    defaults: {},
  },
  {
    id: 'drip-menu',
    group: 'Menú y precios',
    label: 'Menú de drips',
    description: 'Lista elegante a 1 o 2 columnas con nombre, duración y precio en oro.',
    sources: ['category', 'services', 'offers'],
    fields: ['title', 'subtitle', 'columns'],
    defaults: { title: 'Menú de Drips', columns: 2 },
  },
  {
    id: 'service-cards',
    group: 'Menú y precios',
    label: 'Tarjetas de servicio',
    description: 'Cuadrícula de 2x2 a 4x3 con ícono o foto, nombre, descripción corta y precio.',
    sources: ['category', 'services', 'offers'],
    fields: ['title', 'grid'],
    defaults: { grid: '3x2' },
  },
  {
    id: 'featured-service',
    group: 'Menú y precios',
    label: 'Servicio destacado',
    description: 'Un servicio a pantalla completa con beneficios y precio.',
    sources: ['services'],
    fields: ['subtitle'],
    defaults: { subtitle: 'Servicio destacado' },
  },
  {
    id: 'build-your-drip',
    group: 'Menú y precios',
    label: 'Arma tu drip',
    description: 'Drips base más los complementos activos con sus precios.',
    sources: ['category', 'services'],
    fields: ['title', 'subtitle'],
    defaults: { title: 'Arma tu Drip', subtitle: 'Elige tu drip y personalízalo con complementos' },
  },
  {
    id: 'compact-list',
    group: 'Menú y precios',
    label: 'Inyectables y control de peso',
    description: 'Lista compacta con precios "Desde" y "Consultar".',
    sources: ['category', 'services', 'offers'],
    fields: ['title', 'subtitle', 'columns'],
    defaults: { title: 'Inyectables', columns: 1 },
  },
  {
    id: 'product-columns',
    group: 'Fotos',
    label: 'Productos con foto en columnas',
    description: 'Columnas altas con la foto de cada servicio, su nombre y su precio. Ideal para productos con imagen.',
    sources: ['category', 'services', 'offers'],
    fields: ['title', 'subtitle', 'columns', 'fit'],
    defaults: { columns: 4, fit: 'cover' },
    columnOptions: [2, 3, 4, 5],
  },
  {
    id: 'gallery',
    group: 'Fotos',
    label: 'Galería de imágenes',
    description: 'Tus propias imágenes: en columnas, en mosaico o una a la vez a pantalla completa.',
    sources: [],
    fields: ['title', 'images', 'layout', 'columns', 'fit'],
    defaults: { images: [], layout: 'columns', columns: 3, fit: 'cover' },
    columnOptions: [2, 3, 4],
  },
  {
    id: 'offers',
    group: 'Ofertas y promociones',
    label: 'Ofertas',
    description: 'Servicios en oferta con el precio anterior tachado, el precio nuevo y el porcentaje de descuento.',
    sources: ['offers', 'services', 'category'],
    fields: ['title', 'subtitle'],
    defaults: { title: 'Ofertas', subtitle: 'Por tiempo limitado', source: { type: 'offers' } },
  },
  {
    id: 'promos',
    group: 'Ofertas y promociones',
    label: 'Tablero de promociones',
    description: 'Todas las promociones vigentes juntas, con su imagen, texto y fecha de vigencia.',
    sources: [],
    fields: ['title', 'columns'],
    defaults: { title: 'Promociones', columns: 2 },
    columnOptions: [1, 2, 3],
  },
  {
    id: 'promo',
    group: 'Ofertas y promociones',
    label: 'Promoción / Gift Card',
    description: 'Una sola promoción a pantalla completa, con imagen, texto y fechas de vigencia.',
    sources: ['promo'],
    fields: [],
    defaults: {},
  },
  {
    id: 'benefits',
    group: 'Marca',
    label: 'Beneficios',
    description: 'Los beneficios de la infusión con íconos.',
    sources: [],
    fields: ['title', 'items'],
    defaults: { title: 'Beneficios de la terapia IV' },
  },
  {
    id: 'team',
    group: 'Otros',
    label: 'Equipo / testimonios',
    description: 'Fotos y nombres del equipo o testimonios. Solo con permiso del cliente.',
    sources: [],
    fields: ['title', 'people'],
    defaults: { title: 'Nuestro equipo', people: [] },
  },
  {
    id: 'free',
    group: 'Otros',
    label: 'Texto libre / imagen / video',
    description: 'Para cualquier mensaje: texto, una imagen o un video corto.',
    sources: [],
    fields: ['title', 'body', 'image', 'video'],
    defaults: { title: '', body: '' },
  },
];

export function getTemplate(id: string): TemplateMeta | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;
