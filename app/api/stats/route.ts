import { NextResponse } from 'next/server';
import { getEstadisticas } from '@/lib/db/queries';

export async function GET() {
  try {
    const stats = await getEstadisticas();

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
