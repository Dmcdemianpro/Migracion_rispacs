import { NextRequest, NextResponse } from 'next/server';
import { getInformes } from '@/lib/db/queries';
import Papa from 'papaparse';
import { basename } from 'path';

type DateLike = Date | string | null | undefined;

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

function formatFechaInforme(value: DateLike): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Number.isNaN(value.getTime())) return '';

  const year = value.getFullYear();
  const month = pad2(value.getMonth() + 1);
  const day = pad2(value.getDate());
  const hours = pad2(value.getHours());
  const minutes = pad2(value.getMinutes());
  const seconds = pad2(value.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.0`;
}

function formatFechaExport(value: DateLike): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Number.isNaN(value.getTime())) return '';

  const year = value.getFullYear();
  const month = pad2(value.getMonth() + 1);
  const day = pad2(value.getDate());
  const hours = pad2(value.getHours());
  const minutes = pad2(value.getMinutes());
  const seconds = pad2(value.getSeconds());
  const milliseconds = value.getMilliseconds().toString().padStart(3, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}000`;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const estado = searchParams.get('estado') || undefined;

    // Obtener todos los informes (sin límite)
    const informes = await getInformes({ estado });

    // Formatear los datos para CSV - UNA FILA POR ARCHIVO
    const csvData: Array<{
      AccessionNumber: string;
      RutPaciente: string;
      NombrePaciente: string;
      FechaInforme: string;
      RutaArchivo: string;
      TipoArchivo: string;
      SHA256: string;
      ExportadoPor: string;
      FechaExport: string;
    }> = [];

    for (const informe of informes) {
      const baseRow = {
        AccessionNumber: informe.accession_number,
        RutPaciente: informe.rut_paciente,
        NombrePaciente: informe.nombre_paciente || '',
        FechaInforme: formatFechaInforme(informe.fecha_informe),
        SHA256: informe.sha256 || '',
        ExportadoPor: informe.exportado_por || 'ITMS',
        FechaExport: formatFechaExport(informe.fecha_export || new Date()),
      };

      // Fila para el informe principal
      if (informe.informe_pdf) {
        csvData.push({
          ...baseRow,
          RutaArchivo: informe.informe_pdf,
          TipoArchivo: 'informe',
        });
      }

      // Filas para cada archivo escaneado
      const archivosAdjuntos = informe.archivos_adjuntos
        ? JSON.parse(informe.archivos_adjuntos)
        : [];

      if (Array.isArray(archivosAdjuntos)) {
        archivosAdjuntos.forEach((archivo: string, index: number) => {
          const numEscaneado = (index + 1).toString().padStart(2, '0');
          csvData.push({
            ...baseRow,
            RutaArchivo: archivo,
            TipoArchivo: `escaneado${numEscaneado}`,
          });
        });
      }
    }

    const columns = [
      'AccessionNumber',
      'RutPaciente',
      'NombrePaciente',
      'FechaInforme',
      'RutaArchivo',
      'TipoArchivo',
      'SHA256',
      'ExportadoPor',
      'FechaExport',
    ];

    // Convertir a CSV usando papaparse
    const csv = Papa.unparse(csvData, {
      header: true,
      delimiter: ',',
      columns,
    });

    // Crear el nombre del archivo con timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `informes_${estado || 'todos'}_${timestamp}.csv`;

    // Retornar el CSV como respuesta
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error al exportar a CSV:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
