import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import {
  parseIndexFile,
  parseFechaInforme,
  parseFechaExport,
  IndexData,
} from './index-parser';

export interface CarpetaPaciente {
  carpeta: string;
  indexData: IndexData;
  informePdf: string | null;
  archivosEscaneados: string[];
}

export interface ResultadoEscaneo {
  total: number;
  exitosos: number;
  errores: number;
  carpetas: CarpetaPaciente[];
  erroresDetalle: Array<{
    carpeta: string;
    error: string;
  }>;
  totalDirectorios?: number;
  nextCursor?: string | null;
  hasMore?: boolean;
}

export interface ScanOptions {
  cursor?: string | null;
  limit?: number;
}

/**
 * Escanea el repositorio de carpetas y extrae la información de los informes
 * @param repositorioPath Ruta base del repositorio
 * @returns Resultado del escaneo con todas las carpetas encontradas
 */
export async function escanearRepositorio(
  repositorioPath: string,
  options: ScanOptions = {}
): Promise<ResultadoEscaneo> {
  const resultado: ResultadoEscaneo = {
    total: 0,
    exitosos: 0,
    errores: 0,
    carpetas: [],
    erroresDetalle: [],
  };

  if (!existsSync(repositorioPath)) {
    throw new Error(`El repositorio no existe: ${repositorioPath}`);
  }

  try {
    // Leer todas las carpetas del repositorio
    const entries = readdirSync(repositorioPath, { withFileTypes: true });
    const carpetas = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    resultado.totalDirectorios = carpetas.length;

    let startIndex = 0;
    if (options.cursor) {
      const cursorIndex = carpetas.indexOf(options.cursor);
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1;
      }
    }

    const limit = options.limit && options.limit > 0 ? options.limit : undefined;
    const endIndex = limit
      ? Math.min(startIndex + limit, carpetas.length)
      : carpetas.length;
    const batch = carpetas.slice(startIndex, endIndex);

    for (const item of batch) {
      const itemPath = join(repositorioPath, item);
      resultado.total++;

      try {
        const carpetaData = procesarCarpetaPaciente(itemPath);
        resultado.carpetas.push(carpetaData);
        resultado.exitosos++;
      } catch (error) {
        resultado.errores++;
        resultado.erroresDetalle.push({
          carpeta: item,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const hasMore = endIndex < carpetas.length;
    resultado.hasMore = hasMore;
    resultado.nextCursor = batch.length > 0 ? batch[batch.length - 1] : null;

    return resultado;
  } catch (error) {
    throw new Error(
      `Error al escanear el repositorio: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Procesa una carpeta individual de paciente
 * @param carpetaPath Ruta completa a la carpeta del paciente
 * @returns Datos de la carpeta procesada
 */
function procesarCarpetaPaciente(carpetaPath: string): CarpetaPaciente {
  const indexPath = join(carpetaPath, 'index.txt');

  // Verificar que existe index.txt
  if (!existsSync(indexPath)) {
    throw new Error(`No se encontró index.txt en ${carpetaPath}`);
  }

  // Parsear el archivo index.txt
  const indexData = parseIndexFile(indexPath);

  // Buscar archivos en la carpeta
  const archivos = readdirSync(carpetaPath);

  // Buscar el archivo de informe
  let informePdf: string | null = null;
  const archivosEscaneados: string[] = [];

  for (const archivo of archivos) {
    // Ignorar el index.txt
    if (archivo === 'index.txt') continue;

    // Verificar que sea un PDF
    if (!archivo.toLowerCase().endsWith('.pdf')) continue;

    const archivoPath = join(carpetaPath, archivo);

    // Verificar si es el informe o un escaneado
    if (archivo.includes('_informe.pdf')) {
      informePdf = archivoPath;
    } else if (archivo.includes('_escaneado')) {
      archivosEscaneados.push(archivoPath);
    }
  }

  // Ordenar los archivos escaneados
  archivosEscaneados.sort();

  return {
    carpeta: carpetaPath,
    indexData,
    informePdf,
    archivosEscaneados,
  };
}

/**
 * Convierte los datos de una carpeta a un formato compatible con la base de datos
 * @param carpeta Datos de la carpeta escaneada
 * @returns Objeto listo para insertar en la base de datos
 */
export function convertirAInformeInsert(carpeta: CarpetaPaciente) {
  const { indexData, carpeta: carpetaPath, informePdf, archivosEscaneados } = carpeta;

  return {
    accession_number: indexData.AccessionNumber,
    rut_paciente: indexData.RutPaciente,
    nombre_paciente: indexData.NombrePaciente || null,
    fecha_informe: parseFechaInforme(indexData.FechaInforme),
    informe_pdf: informePdf || null,
    sha256: indexData.SHA256 || null,
    origen: indexData.Origen || null,
    exportado_por: indexData.ExportadoPor || null,
    fecha_export: parseFechaExport(indexData.FechaExport),
    carpeta_origen: carpetaPath,
    archivos_adjuntos: archivosEscaneados,
  };
}
