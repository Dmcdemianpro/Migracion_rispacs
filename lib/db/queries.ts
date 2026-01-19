import { query } from './connection';

export interface InformeStaging {
  id: number;
  accession_number: string;
  rut_paciente: string;
  nombre_paciente: string | null;
  fecha_informe: Date | null;
  informe_pdf: string | null;
  sha256: string | null;
  origen: string | null;
  exportado_por: string | null;
  fecha_export: Date | null;
  carpeta_origen: string | null;
  archivos_adjuntos: string | null; // JSON string
  estado: 'pendiente' | 'validado' | 'migrado' | 'error';
  fecha_indexacion: Date;
  fecha_validacion: Date | null;
  fecha_migracion: Date | null;
  error_mensaje: string | null;
}

export interface InformeInsert {
  accession_number: string;
  rut_paciente: string;
  nombre_paciente?: string;
  fecha_informe?: Date;
  informe_pdf?: string;
  sha256?: string;
  origen?: string;
  exportado_por?: string;
  fecha_export?: Date;
  carpeta_origen?: string;
  archivos_adjuntos?: string[];
}

export interface EstadisticasInformes {
  total: number;
  pendientes: number;
  validados: number;
  migrados: number;
  errores: number;
}

// Obtener todos los informes con filtros opcionales
export async function getInformes(filtros?: {
  estado?: string;
  limite?: number;
  offset?: number;
}): Promise<InformeStaging[]> {
  let sql = 'SELECT * FROM informes_staging WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (filtros?.estado) {
    sql += ` AND estado = $${paramIndex}`;
    params.push(filtros.estado);
    paramIndex++;
  }

  sql += ' ORDER BY fecha_indexacion DESC';

  if (filtros?.limite) {
    sql += ` LIMIT $${paramIndex}`;
    params.push(filtros.limite);
    paramIndex++;
  }

  if (filtros?.offset) {
    sql += ` OFFSET $${paramIndex}`;
    params.push(filtros.offset);
  }

  const result = await query(sql, params);
  return result.rows;
}

// Obtener un informe por ID
export async function getInformeById(id: number): Promise<InformeStaging | null> {
  const result = await query(
    'SELECT * FROM informes_staging WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

// Obtener un informe por AccessionNumber
export async function getInformeByAccession(
  accessionNumber: string
): Promise<InformeStaging | null> {
  const result = await query(
    'SELECT * FROM informes_staging WHERE accession_number = $1',
    [accessionNumber]
  );
  return result.rows[0] || null;
}

// Insertar un nuevo informe
export async function insertInforme(
  informe: InformeInsert
): Promise<InformeStaging> {
  const archivosJson = informe.archivos_adjuntos
    ? JSON.stringify(informe.archivos_adjuntos)
    : null;

  const result = await query(
    `INSERT INTO informes_staging (
      accession_number, rut_paciente, nombre_paciente, fecha_informe,
      informe_pdf, sha256, origen, exportado_por, fecha_export,
      carpeta_origen, archivos_adjuntos
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (accession_number) DO UPDATE SET
      rut_paciente = EXCLUDED.rut_paciente,
      nombre_paciente = EXCLUDED.nombre_paciente,
      fecha_informe = EXCLUDED.fecha_informe,
      informe_pdf = EXCLUDED.informe_pdf,
      sha256 = EXCLUDED.sha256,
      origen = EXCLUDED.origen,
      exportado_por = EXCLUDED.exportado_por,
      fecha_export = EXCLUDED.fecha_export,
      carpeta_origen = EXCLUDED.carpeta_origen,
      archivos_adjuntos = EXCLUDED.archivos_adjuntos
    RETURNING *`,
    [
      informe.accession_number,
      informe.rut_paciente,
      informe.nombre_paciente,
      informe.fecha_informe,
      informe.informe_pdf,
      informe.sha256,
      informe.origen,
      informe.exportado_por,
      informe.fecha_export,
      informe.carpeta_origen,
      archivosJson,
    ]
  );

  return result.rows[0];
}

// Actualizar el estado de un informe
export async function updateEstadoInforme(
  id: number,
  nuevoEstado: 'pendiente' | 'validado' | 'migrado' | 'error',
  errorMensaje?: string
): Promise<InformeStaging | null> {
  const fechaCampo =
    nuevoEstado === 'validado'
      ? 'fecha_validacion'
      : nuevoEstado === 'migrado'
      ? 'fecha_migracion'
      : null;

  let sql = `UPDATE informes_staging SET estado = $1, error_mensaje = $2`;
  const params: any[] = [nuevoEstado, errorMensaje || null];

  if (fechaCampo) {
    sql += `, ${fechaCampo} = CURRENT_TIMESTAMP`;
  }

  sql += ` WHERE id = $3 RETURNING *`;
  params.push(id);

  const result = await query(sql, params);
  return result.rows[0] || null;
}

// Obtener estadísticas
// Validar todos los informes pendientes
export async function validarPendientes(): Promise<number> {
  const result = await query(`
    UPDATE informes_staging
    SET estado = 'validado',
        error_mensaje = NULL,
        fecha_validacion = CURRENT_TIMESTAMP
    WHERE estado = 'pendiente'
  `);

  return result.rowCount ?? 0;
}

// Obtener estadisticas
export async function getEstadisticas(): Promise<EstadisticasInformes> {
  const result = await query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE estado = 'pendiente') as pendientes,
      COUNT(*) FILTER (WHERE estado = 'validado') as validados,
      COUNT(*) FILTER (WHERE estado = 'migrado') as migrados,
      COUNT(*) FILTER (WHERE estado = 'error') as errores
    FROM informes_staging
  `);

  const row = result.rows[0];
  return {
    total: parseInt(row.total),
    pendientes: parseInt(row.pendientes),
    validados: parseInt(row.validados),
    migrados: parseInt(row.migrados),
    errores: parseInt(row.errores),
  };
}

// Eliminar un informe
export async function deleteInforme(id: number): Promise<boolean> {
  const result = await query('DELETE FROM informes_staging WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function getScanCursor(repositorioPath: string): Promise<string | null> {
  const result = await query(
    'SELECT last_cursor FROM scan_state WHERE repositorio_path = $1',
    [repositorioPath]
  );

  return result.rows[0]?.last_cursor ?? null;
}

export async function upsertScanCursor(
  repositorioPath: string,
  cursor: string | null
): Promise<void> {
  await query(
    `
    INSERT INTO scan_state (repositorio_path, last_cursor, updated_at)
    VALUES ($1, $2, CURRENT_TIMESTAMP)
    ON CONFLICT (repositorio_path)
    DO UPDATE SET last_cursor = EXCLUDED.last_cursor, updated_at = CURRENT_TIMESTAMP
  `,
    [repositorioPath, cursor]
  );
}

// Obtener informes validados para dicomizar
export async function getInformesParaDicomizar(limite: number = 100): Promise<InformeStaging[]> {
  const result = await query(
    `SELECT * FROM informes_staging
     WHERE estado = 'validado'
     ORDER BY fecha_validacion ASC
     LIMIT $1`,
    [limite]
  );
  return result.rows;
}

// Marcar informe como migrado
export async function marcarComoMigrado(
  id: number,
  dicomPath?: string
): Promise<InformeStaging | null> {
  const result = await query(
    `UPDATE informes_staging
     SET estado = 'migrado',
         fecha_migracion = CURRENT_TIMESTAMP,
         error_mensaje = $2
     WHERE id = $1
     RETURNING *`,
    [id, dicomPath ? `DICOM: ${dicomPath}` : null]
  );
  return result.rows[0] || null;
}
