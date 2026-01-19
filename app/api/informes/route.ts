import { NextRequest, NextResponse } from 'next/server';
import { getInformes } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const estado = searchParams.get('estado') || undefined;
    const limite = searchParams.get('limite')
      ? parseInt(searchParams.get('limite')!)
      : undefined;
    const offset = searchParams.get('offset')
      ? parseInt(searchParams.get('offset')!)
      : undefined;

    const informes = await getInformes({
      estado,
      limite,
      offset,
    });

    // Parsear archivos_adjuntos de string JSON a array
    const informesFormateados = informes.map((informe) => ({
      ...informe,
      archivos_adjuntos: informe.archivos_adjuntos
        ? JSON.parse(informe.archivos_adjuntos)
        : [],
    }));

    return NextResponse.json({
      success: true,
      data: informesFormateados,
      total: informesFormateados.length,
    });
  } catch (error) {
    console.error('Error al obtener informes:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
