import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import * as fs from 'fs';
import path from 'path';
import {
  getInformesParaDicomizar,
  marcarComoMigrado,
  updateEstadoInforme,
} from '@/lib/db/queries';

const DICOM_OUTPUT_PATH = process.env.DICOM_OUTPUT_PATH || 'C:/dicom_output';

interface BatchConfig {
  patient_name: string;
  patient_id: string;
  accession_number: string;
  study_date?: string;
  study_description: string;
  pdfs: Array<{
    input: string;
    output: string;
    description: string;
  }>;
}

interface BatchResult {
  success: boolean;
  study_instance_uid?: string;
  total: number;
  exitosos: number;
  errores: number;
  results: Array<{
    input: string;
    output?: string;
    description?: string;
    success: boolean;
    error?: string;
  }>;
}

interface DicomResult {
  id: number;
  accession: string;
  success: boolean;
  totalPdfs: number;
  convertidos: number;
  errores: number;
  dicomPaths?: string[];
  error?: string;
}

function isPdfFile(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.pdf');
}

async function convertBatchToDicom(config: BatchConfig): Promise<BatchResult> {
  return new Promise((resolve) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'pdf_to_dicom.py');
    const configPath = path.join(process.cwd(), 'temp', `batch_${Date.now()}.json`);

    // Asegurar que existe el directorio temp
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Escribir config temporal
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

    const pythonProcess = spawn('python', [scriptPath, '--batch', configPath], {
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      // Limpiar archivo temporal
      try {
        fs.unlinkSync(configPath);
      } catch {
        // Ignorar error si no se puede eliminar
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch {
        resolve({
          success: false,
          total: 0,
          exitosos: 0,
          errores: 1,
          results: [{ input: '', success: false, error: stderr || `Exit code: ${code}` }],
        });
      }
    });

    pythonProcess.on('error', (err) => {
      try {
        fs.unlinkSync(configPath);
      } catch {
        // Ignorar
      }
      resolve({
        success: false,
        total: 0,
        exitosos: 0,
        errores: 1,
        results: [{ input: '', success: false, error: `No se pudo ejecutar Python: ${err.message}` }],
      });
    });
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const limite = body.limite || 50;

    const informes = await getInformesParaDicomizar(limite);

    if (informes.length === 0) {
      return NextResponse.json({
        success: true,
        mensaje: 'No hay informes validados para dicomizar',
        procesados: 0,
        exitosos: 0,
        errores: 0,
        totalPdfs: 0,
        pdfsConvertidos: 0,
        resultados: [],
      });
    }

    const resultados: DicomResult[] = [];
    let informesExitosos = 0;
    let informesErrores = 0;
    let totalPdfsConvertidos = 0;
    let totalPdfsErrores = 0;

    for (const informe of informes) {
      // Recopilar todos los PDFs del informe
      const pdfsToConvert: Array<{ input: string; output: string; description: string }> = [];

      // Formato: Accession_RUT_nombrearchivo.dcm
      const rut = informe.rut_paciente.replace(/[^0-9kK-]/g, ''); // Limpiar RUT
      const prefix = `${informe.accession_number}_${rut}_`;

      // 1. PDF principal del informe
      if (informe.informe_pdf && isPdfFile(informe.informe_pdf)) {
        const baseName = path.basename(informe.informe_pdf, '.pdf');
        // Si ya tiene el prefijo, usar el nombre original; si no, agregarlo
        const fileName = baseName.startsWith(informe.accession_number)
          ? `${baseName}.dcm`
          : `${prefix}informe.dcm`;
        pdfsToConvert.push({
          input: informe.informe_pdf,
          output: path.join(DICOM_OUTPUT_PATH, informe.accession_number, fileName),
          description: 'Informe Principal',
        });
      }

      // 2. Archivos adjuntos (pueden ser PDFs)
      if (informe.archivos_adjuntos) {
        try {
          const adjuntos: string[] = JSON.parse(informe.archivos_adjuntos);
          adjuntos.forEach((adjunto) => {
            if (isPdfFile(adjunto)) {
              const baseName = path.basename(adjunto, '.pdf');
              // Si ya tiene el prefijo, usar el nombre original; si no, agregarlo
              const fileName = baseName.startsWith(informe.accession_number)
                ? `${baseName}.dcm`
                : `${prefix}${baseName}.dcm`;
              pdfsToConvert.push({
                input: adjunto,
                output: path.join(DICOM_OUTPUT_PATH, informe.accession_number, fileName),
                description: baseName,
              });
            }
          });
        } catch {
          // Si falla el parse, ignorar adjuntos
        }
      }

      // Si no hay PDFs para convertir
      if (pdfsToConvert.length === 0) {
        await updateEstadoInforme(
          informe.id,
          'error',
          'No tiene archivos PDF para convertir'
        );
        resultados.push({
          id: informe.id,
          accession: informe.accession_number,
          success: false,
          totalPdfs: 0,
          convertidos: 0,
          errores: 0,
          error: 'No tiene archivos PDF',
        });
        informesErrores++;
        continue;
      }

      // Preparar configuración batch
      const patientName = informe.nombre_paciente
        ? informe.nombre_paciente.replace(/\s+/g, '^')
        : 'DESCONOCIDO';

      const studyDate = informe.fecha_informe
        ? new Date(informe.fecha_informe).toISOString().slice(0, 10).replace(/-/g, '')
        : undefined;

      const batchConfig: BatchConfig = {
        patient_name: patientName,
        patient_id: informe.rut_paciente,
        accession_number: informe.accession_number,
        study_date: studyDate,
        study_description: 'Informe Radiologico',
        pdfs: pdfsToConvert,
      };

      // Convertir todos los PDFs del informe
      const result = await convertBatchToDicom(batchConfig);

      const dicomPaths = result.results
        .filter((r) => r.success && r.output)
        .map((r) => r.output as string);

      if (result.exitosos > 0) {
        // Al menos un PDF se convirtió exitosamente
        const mensaje = result.errores > 0
          ? `DICOM parcial: ${result.exitosos}/${result.total} PDFs convertidos`
          : `DICOM: ${result.exitosos} PDFs convertidos`;

        await marcarComoMigrado(informe.id, mensaje);

        resultados.push({
          id: informe.id,
          accession: informe.accession_number,
          success: true,
          totalPdfs: result.total,
          convertidos: result.exitosos,
          errores: result.errores,
          dicomPaths,
        });

        informesExitosos++;
        totalPdfsConvertidos += result.exitosos;
        totalPdfsErrores += result.errores;
      } else {
        // Ningún PDF se convirtió
        const errorMsg = result.results[0]?.error || 'Error desconocido';
        await updateEstadoInforme(informe.id, 'error', `Error DICOM: ${errorMsg}`);

        resultados.push({
          id: informe.id,
          accession: informe.accession_number,
          success: false,
          totalPdfs: result.total,
          convertidos: 0,
          errores: result.errores,
          error: errorMsg,
        });

        informesErrores++;
        totalPdfsErrores += result.total;
      }
    }

    return NextResponse.json({
      success: true,
      procesados: informes.length,
      exitosos: informesExitosos,
      errores: informesErrores,
      totalPdfs: totalPdfsConvertidos + totalPdfsErrores,
      pdfsConvertidos: totalPdfsConvertidos,
      pdfsErrores: totalPdfsErrores,
      outputPath: DICOM_OUTPUT_PATH,
      resultados,
    });
  } catch (error) {
    console.error('Error en dicomize:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}

// GET para verificar configuración
export async function GET() {
  const informes = await getInformesParaDicomizar(1);

  return NextResponse.json({
    success: true,
    configuracion: {
      dicomOutputPath: DICOM_OUTPUT_PATH,
      pythonDisponible: true,
    },
    pendientesDicomizar: informes.length > 0,
  });
}
