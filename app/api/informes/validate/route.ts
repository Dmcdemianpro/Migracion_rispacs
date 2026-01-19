import { NextResponse } from 'next/server';
import { validarPendientes } from '@/lib/db/queries';

export async function POST() {
  try {
    const actualizados = await validarPendientes();

    return NextResponse.json({
      success: true,
      actualizados,
    });
  } catch (error) {
    console.error('Error al validar pendientes:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
