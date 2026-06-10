/**
 * config.js
 * Default configuration and constants for the Architectural Pricing & Proposal Management App.
 * All user-editable settings are persisted in LocalStorage; this file provides fallback defaults.
 */

const CONFIG = {
  // App meta
  APP_NAME: 'ArchiQuote Pro',
  APP_VERSION: '1.0.0',

  // Default financial settings
  DEFAULT_VAT: 16,           // Percentage (Mexico standard IVA)
  DEFAULT_CURRENCY: 'MXN',
  CURRENCY_SYMBOLS: {
    MXN: '$',
    USD: '$',
    EUR: '\u20AC',
    COP: '$',
    ARS: '$',
    CLP: '$',
  },
  SUPPORTED_CURRENCIES: ['MXN', 'USD', 'EUR', 'COP', 'ARS', 'CLP'],

  // Proposal settings
  // Fix #9: Updated validity text to 14 calendar days
  PROPOSAL_VALIDITY_DAYS: 14,
  PROPOSAL_VALIDITY_TEXT: 'Esta propuesta tiene vigencia de 14 dias calendario a partir de la fecha de emision.',
  PROPOSAL_PREFIX: 'COT',    // Prefix for proposal numbers, e.g. COT-2026-001

  // Letterhead image path (relative; can be overridden in Settings and stored as Base64)
  LETTERHEAD_PATH: '../Membretes/n1png.png',

  // Unit types available for services
  // Fix #6: Added 'pct' (Porcentaje %) unit type
  UNIT_TYPES: [
    { value: 'm2',    label: 'Por m\u00B2' },
    { value: 'unit',  label: 'Por Unidad' },
    { value: 'hour',  label: 'Por Hora' },
    { value: 'visit', label: 'Por Visita' },
    { value: 'fixed', label: 'Honorario Fijo' },
    { value: 'pct',   label: 'Porcentaje (%)' },
  ],

  // Default service catalogue
  DEFAULT_SERVICES: [
    {
      id: 'svc-001',
      name: 'Diseno de Concepto Arquitectonico',
      unit: 'm2',
      price: 350,
      description: 'Desarrollo de concepto arquitectonico, partido arquitectonico, volumetria y renders conceptuales.',
      active: true,
    },
    {
      id: 'svc-002',
      name: 'Proyecto Ejecutivo para Permiso',
      unit: 'm2',
      price: 280,
      description: 'Elaboracion de planos arquitectonicos, memorias y documentacion requerida para tramite de licencia de construccion.',
      active: true,
    },
    {
      id: 'svc-003',
      name: 'Proyecto Ejecutivo',
      unit: 'm2',
      price: 420,
      description: 'Proyecto arquitectonico completo con planos de detalle, cortes, fachadas e instalaciones coordinadas.',
      active: true,
    },
    {
      id: 'svc-004',
      name: 'Supervision de Obra',
      unit: 'visit',
      price: 2500,
      description: 'Supervision periodica de obra para verificar el cumplimiento del proyecto ejecutivo y especificaciones.',
      active: true,
    },
    {
      id: 'svc-005',
      name: 'Supervision Especializada de Proceso Constructivo',
      unit: 'hour',
      price: 800,
      description: 'Supervision tecnica especializada en procesos constructivos especificos o etapas criticas de obra.',
      active: true,
    },
    {
      id: 'svc-006',
      name: 'Firma DRO',
      unit: 'fixed',
      price: 15000,
      description: 'Firma del Director Responsable de Obra para tramites ante autoridades municipales.',
      active: true,
    },
    {
      id: 'svc-007',
      name: 'Modelado BIM (Revit)',
      unit: 'hour',
      price: 650,
      description: 'Modelado de proyectos en plataforma Revit bajo metodologia BIM para coordinacion y deteccion de interferencias.',
      active: true,
    },
    {
      id: 'svc-008',
      name: 'Digitalizacion de Planos',
      unit: 'unit',
      price: 1200,
      description: 'Vectorizacion y digitalizacion de planos fisicos o escaneados a formatos CAD / BIM.',
      active: true,
    },
    {
      id: 'svc-009',
      name: 'Documentacion de Obra',
      unit: 'fixed',
      price: 8000,
      description: 'Elaboracion de expediente tecnico as-built, memoria fotografica y entrega de documentacion final.',
      active: true,
    },
    {
      id: 'svc-010',
      name: 'Levantamiento Arquitectonico',
      unit: 'm2',
      price: 120,
      description: 'Levantamiento fisico de construcciones existentes con medicion, registro y elaboracion de planos.',
      active: true,
    },
    {
      id: 'svc-011',
      name: 'Render Arquitectonico',
      unit: 'unit',
      price: 3500,
      description: 'Produccion de imagenes fotorrealistas de proyectos arquitectonicos para presentacion al cliente.',
      active: true,
    },
    {
      id: 'svc-012',
      name: 'Diseno de Interiores',
      unit: 'm2',
      price: 380,
      description: 'Propuesta de diseno interior, seleccion de materiales, mobiliario y coordinacion de acabados.',
      active: true,
    },
    {
      id: 'svc-013',
      name: 'Catalogo de Conceptos',
      unit: 'fixed',
      price: 12000,
      description: 'Elaboracion de catalogo de conceptos de obra con especificaciones tecnicas y precios unitarios.',
      active: true,
    },
    {
      id: 'svc-014',
      name: 'Cuantificacion de Obra',
      unit: 'm2',
      price: 95,
      description: 'Calculo y cuantificacion de volumenes de obra a partir de planos ejecutivos.',
      active: true,
    },
    // Fix #7: New service — Professional Fees Based on Construction Cost
    {
      id: 'svc-015',
      name: 'Honorarios Profesionales sobre Costo de Obra',
      unit: 'pct',
      price: 8,
      description: 'Honorarios profesionales calculados como porcentaje sobre el costo total de construccion. Ingresar costo de obra en cantidad y porcentaje en precio unitario.',
      active: true,
    },
  ],
};

// Freeze to prevent accidental mutation of defaults
Object.freeze(CONFIG);
