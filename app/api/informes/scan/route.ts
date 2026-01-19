import { NextRequest, NextResponse } from 'next/server';
import {
  escanearRepositorio,
  convertirAInformeInsert,
} from '@/lib/scanner/repository-scanner';
import { getScanCursor, insertInforme, upsertScanCursor } from '@/lib/db/queries';

export async function POST(request: NextRequest) {
  try {
    const repositorioPath = process.env.REPOSITORIO_PATH;

    if (!repositorioPath) {
      return NextResponse.json(
        {
          error:
            'REPOSITORIO_PATH no está configurada en las variables de entorno',
        },
        { status: 500 }
      );
    }

    console.log(`Escaneando repositorio: ${repositorioPath}`);

    let body: { cursor?: string; limit?: number } = {};
    try {
      body = await request.json();
    } catch (error) {
      body = {};
    }

    const limit = typeof body.limit === 'number' && body.limit > 0 ? body.limit : undefined;
    let cursor =
      typeof body.cursor === 'string' && body.cursor.trim().length > 0
        ? body.cursor.trim()
        : undefined;

    if (!cursor) {
      const storedCursor = await getScanCursor(repositorioPath);
      if (storedCursor) {
        cursor = storedCursor;
      }
    }

    // Escanear el repositorio
    const resultado = await escanearRepositorio(repositorioPath, {
      limit,
      cursor,
    });

    console.log(
      `Escaneo completado: ${resultado.exitosos} exitosos, ${resultado.errores} errores`
    );

    // Indexar cada carpeta en la base de datos
    let indexados = 0;
    let erroresIndexacion = 0;
    const erroresIndexacionDetalle: Array<{
      accessionNumber: string;
      error: string;
    }> = [];

    for (const carpeta of resultado.carpetas) {
      try {
        const informeData = convertirAInformeInsert(carpeta);
        await insertInforme(informeData);
        indexados++;
      } catch (error) {
        erroresIndexacion++;
        erroresIndexacionDetalle.push({
          accessionNumber: carpeta.indexData.AccessionNumber,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (resultado.total > 0) {
      await upsertScanCursor(repositorioPath, resultado.nextCursor ?? null);
    }

    return NextResponse.json({
      success: true,
      escaneo: {
        total: resultado.total,
        exitosos: resultado.exitosos,
        errores: resultado.errores,
        erroresDetalle: resultado.erroresDetalle,
        totalDirectorios: resultado.totalDirectorios,
      },
      indexacion: {
        indexados,
        errores: erroresIndexacion,
        erroresDetalle: erroresIndexacionDetalle,
      },
      continuidad: {
        nextCursor: resultado.nextCursor ?? null,
        hasMore: resultado.hasMore ?? false,
      },
    });
  } catch (error) {
    console.error('Error al escanear repositorio:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
