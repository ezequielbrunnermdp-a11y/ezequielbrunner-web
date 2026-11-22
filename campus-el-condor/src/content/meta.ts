import type { ContentMeta } from './types';

/** Fecha de redacción de la propuesta pedagógica inicial. */
export const CONTENT_DATE = '2026-11-22';

export function proposedMeta(reference = 'Propuesta pedagógica original del campus'): ContentMeta {
  return {
    publicationStatus: 'publicado-en-campus',
    approvalStatus: 'sin-aprobar',
    sourceType: 'propuesta-pedagogica',
    sourceReference: reference,
    version: '1.0',
    updatedAt: CONTENT_DATE,
    approvedAt: null,
    approvedBy: null,
  };
}

export const PUBLICATION_LABEL: Record<ContentMeta['publicationStatus'], string> = {
  borrador: 'Borrador',
  'publicado-en-campus': 'Publicado en el campus',
  archivado: 'Archivado',
};

export const APPROVAL_LABEL: Record<ContentMeta['approvalStatus'], string> = {
  'sin-aprobar': 'Contenido propuesto · sin aprobación de El Cóndor',
  'en-revision': 'En revisión por El Cóndor',
  aprobado: 'Aprobado por El Cóndor',
};

export const SOURCE_LABEL: Record<ContentMeta['sourceType'], string> = {
  'propuesta-pedagogica': 'Propuesta pedagógica',
  'documento-el-condor': 'Documento de El Cóndor',
  'confirmacion-el-condor': 'Confirmado por El Cóndor',
  practica: 'Práctica',
};
