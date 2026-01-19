import { NextRequest, NextResponse } from 'next/server';
import { getInformeById, updateEstadoInforme } from '@/lib/db/queries';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const informeId = parseInt(params.id);

    if (isNaN(informeId)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      );
    }

    const informe = await getInformeById(informeId);

    if (!informe) {
      return NextResponse.json(
        { error: 'Informe no encontrado' },
        { status: 404 }
      );
    }

    // Parsear archivos_adjuntos de string JSON a array
    const informeFormateado = {
      ...informe,
      archivos_adjuntos: informe.archivos_adjuntos
        ? JSON.parse(informe.archivos_adjuntos)
        : [],
    };

    return NextResponse.json({
      success: true,
      data: informeFormateado,
    });
  } catch (error) {
    console.error('Error al obtener informe:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const informeId = parseInt(params.id);

    if (isNaN(informeId)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { estado, errorMensaje } = body;

    if (!estado || !['pendiente', 'validado', 'migrado', 'error'].includes(estado)) {
      return NextResponse.json(
        { error: 'Estado inválido' },
        { status: 400 }
      );
    }

    const informe = await updateEstadoInforme(informeId, estado, errorMensaje);

    if (!informe) {
      return NextResponse.json(
        { error: 'Informe no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: informe,
    });
  } catch (error) {
    console.error('Error al actualizar informe:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
