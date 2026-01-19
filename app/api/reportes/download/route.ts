import { NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';
import Papa from 'papaparse';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') || 'todos';

    let whereClause = '';
    let fileName = 'reporte_todos';

    switch (tipo) {
      case 'migrados':
        whereClause = "WHERE estado = 'migrado'";
        fileName = 'reporte_migrados';
        break;
      case 'errores':
        whereClause = "WHERE estado = 'error'";
        fileName = 'reporte_errores';
        break;
      case 'pendientes':
        whereClause = "WHERE estado = 'pendiente'";
        fileName = 'reporte_pendientes';
        break;
      case 'validados':
        whereClause = "WHERE estado = 'validado'";
        fileName = 'reporte_validados';
        break;
      default:
        whereClause = '';
        fileName = 'reporte_completo';
    }

    const result = await query(`
      SELECT
        accession_number,
        rut_paciente,
        nombre_paciente,
        fecha_informe,
        estado,
        fecha_indexacion,
        fecha_validacion,
        fecha_migracion,
        error_mensaje,
        informe_pdf,
        archivos_adjuntos
      FROM informes_staging
      ${whereClause}
      ORDER BY fecha_indexacion DESC
    `);

    const data = result.rows.map((row) => {
      let cantidadAdjuntos = 0;
      try {
        const adjuntos = JSON.parse(row.archivos_adjuntos || '[]');
        cantidadAdjuntos = adjuntos.length;
      } catch {
        cantidadAdjuntos = 0;
      }

      return {
        'Accession Number': row.accession_number,
        'RUT Paciente': row.rut_paciente,
        'Nombre Paciente': row.nombre_paciente || '',
        'Fecha Informe': row.fecha_informe
          ? new Date(row.fecha_informe).toLocaleDateString('es-CL')
          : '',
        'Estado': row.estado.toUpperCase(),
        'Fecha Indexacion': row.fecha_indexacion
          ? new Date(row.fecha_indexacion).toLocaleString('es-CL')
          : '',
        'Fecha Validacion': row.fecha_validacion
          ? new Date(row.fecha_validacion).toLocaleString('es-CL')
          : '',
        'Fecha Migracion': row.fecha_migracion
          ? new Date(row.fecha_migracion).toLocaleString('es-CL')
          : '',
        'Mensaje Error': row.error_mensaje || '',
        'PDF Principal': row.informe_pdf ? 'Si' : 'No',
        'Cantidad Adjuntos': cantidadAdjuntos,
      };
    });

    const csv = Papa.unparse(data, {
      quotes: true,
      delimiter: ';',
    });

    // BOM para Excel
    const bom = '\uFEFF';
    const csvWithBom = bom + csv;

    const timestamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(csvWithBom, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}_${timestamp}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error al generar reporte:', error);
    return NextResponse.json(
      { success: false, error: 'Error al generar reporte' },
      { status: 500 }
    );
  }
}
