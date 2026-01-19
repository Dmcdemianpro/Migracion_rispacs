import { NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';

export async function GET() {
  try {
    // Estadísticas generales
    const statsResult = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE estado = 'pendiente') as pendientes,
        COUNT(*) FILTER (WHERE estado = 'validado') as validados,
        COUNT(*) FILTER (WHERE estado = 'migrado') as migrados,
        COUNT(*) FILTER (WHERE estado = 'error') as errores,
        MAX(fecha_migracion) as ultima_migracion,
        MIN(fecha_indexacion) as primera_indexacion
      FROM informes_staging
    `);

    const row = statsResult.rows[0];
    const total = parseInt(row.total) || 0;
    const migrados = parseInt(row.migrados) || 0;

    // Conteo de archivos (informes PDF y escaneados)
    const archivosResult = await query(`
      SELECT
        COUNT(*) FILTER (WHERE informe_pdf IS NOT NULL) as total_informes,
        COALESCE(SUM(
          CASE
            WHEN archivos_adjuntos IS NOT NULL AND archivos_adjuntos != '[]'
            THEN jsonb_array_length(archivos_adjuntos::jsonb)
            ELSE 0
          END
        ), 0) as total_escaneados
      FROM informes_staging
    `);

    const archivosRow = archivosResult.rows[0];
    const totalInformes = parseInt(archivosRow.total_informes) || 0;
    const totalEscaneados = parseInt(archivosRow.total_escaneados) || 0;

    const estadisticas = {
      total,
      pendientes: parseInt(row.pendientes) || 0,
      validados: parseInt(row.validados) || 0,
      migrados,
      errores: parseInt(row.errores) || 0,
      ultimaMigracion: row.ultima_migracion,
      primeraIndexacion: row.primera_indexacion,
      porcentajeMigrado: total > 0 ? (migrados / total) * 100 : 0,
      totalInformes,
      totalEscaneados,
      totalArchivos: totalInformes + totalEscaneados,
    };

    // Resumen por fecha (últimos 7 días)
    const resumenResult = await query(`
      SELECT
        DATE(fecha_migracion) as fecha,
        COUNT(*) FILTER (WHERE estado = 'migrado') as migrados,
        COUNT(*) FILTER (WHERE estado = 'error') as errores
      FROM informes_staging
      WHERE fecha_migracion IS NOT NULL
        AND fecha_migracion >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(fecha_migracion)
      ORDER BY fecha DESC
      LIMIT 7
    `);

    const resumenPorFecha = resumenResult.rows.map((r) => ({
      fecha: new Date(r.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }),
      migrados: parseInt(r.migrados) || 0,
      errores: parseInt(r.errores) || 0,
    })).reverse();

    return NextResponse.json({
      success: true,
      estadisticas,
      resumenPorFecha,
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de reporte:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener estadísticas' },
      { status: 500 }
    );
  }
}
