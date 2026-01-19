import { readFileSync } from 'fs';

export interface IndexData {
  AccessionNumber: string;
  RutPaciente: string;
  NombrePaciente: string;
  FechaInforme: string;
  InformePDF: string;
  SHA256: string;
  Origen: string;
  ExportadoPor: string;
  FechaExport: string;
}

/**
 * Parsea un archivo index.txt y extrae los datos estructurados
 * @param filePath Ruta completa al archivo index.txt
 * @returns Objeto con los datos del index
 */
export function parseIndexFile(filePath: string): IndexData {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const data: Partial<IndexData> = {};

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Formato: "Clave : Valor"
      const colonIndex = trimmedLine.indexOf(':');
      if (colonIndex === -1) continue;

      const key = trimmedLine.substring(0, colonIndex).trim();
      const value = trimmedLine.substring(colonIndex + 1).trim();

      // Mapear las claves del archivo a las propiedades del objeto
      switch (key) {
        case 'AccessionNumber':
          data.AccessionNumber = value;
          break;
        case 'RutPaciente':
          data.RutPaciente = value;
          break;
        case 'NombrePaciente':
          data.NombrePaciente = value;
          break;
        case 'FechaInforme':
          data.FechaInforme = value;
          break;
        case 'InformePDF':
          data.InformePDF = value;
          break;
        case 'SHA256':
          data.SHA256 = value;
          break;
        case 'Origen':
          data.Origen = value;
          break;
        case 'ExportadoPor':
          data.ExportadoPor = value;
          break;
        case 'FechaExport':
          data.FechaExport = value;
          break;
      }
    }

    // Validar que los campos requeridos estén presentes
    if (!data.AccessionNumber || !data.RutPaciente) {
      throw new Error(
        `Archivo index.txt inválido: faltan campos requeridos en ${filePath}`
      );
    }

    return data as IndexData;
  } catch (error) {
    throw new Error(`Error al parsear ${filePath}: ${error}`);
  }
}

/**
 * Convierte la fecha del formato del index.txt a un objeto Date
 * @param fechaStr Fecha en formato "2025-01-01 10:01:56.0"
 * @returns Objeto Date
 */
export function parseFechaInforme(fechaStr: string): Date | null {
  if (!fechaStr) return null;

  try {
    // Formato: "2025-01-01 10:01:56.0"
    // Remover los milisegundos si existen
    const cleanStr = fechaStr.replace(/\.\d+$/, '');
    const date = new Date(cleanStr.replace(' ', 'T'));

    if (isNaN(date.getTime())) {
      console.warn(`Fecha inválida: ${fechaStr}`);
      return null;
    }

    return date;
  } catch (error) {
    console.warn(`Error al parsear fecha: ${fechaStr}`, error);
    return null;
  }
}

/**
 * Convierte la fecha de exportación del formato ISO a un objeto Date
 * @param fechaStr Fecha en formato ISO "2026-01-06T15:55:06.777794500"
 * @returns Objeto Date
 */
export function parseFechaExport(fechaStr: string): Date | null {
  if (!fechaStr) return null;

  try {
    const date = new Date(fechaStr);

    if (isNaN(date.getTime())) {
      console.warn(`Fecha de exportación inválida: ${fechaStr}`);
      return null;
    }

    return date;
  } catch (error) {
    console.warn(`Error al parsear fecha de exportación: ${fechaStr}`, error);
    return null;
  }
}
