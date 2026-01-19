'use client';

import { useEffect, useState } from 'react';

interface Informe {
  id: number;
  accession_number: string;
  rut_paciente: string;
  nombre_paciente: string | null;
  fecha_informe: string | null;
  informe_pdf: string | null;
  archivos_adjuntos: string[];
  estado: string;
  error_mensaje: string | null;
}

export default function TablaInformes() {
  const [informes, setInformes] = useState<Informe[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [validandoTodo, setValidandoTodo] = useState(false);

  const fetchInformes = async () => {
    setLoading(true);
    try {
      const url = filtroEstado
        ? `/api/informes?estado=${filtroEstado}&limite=100`
        : '/api/informes?limite=100';

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setInformes(data.data);
      }
    } catch (error) {
      console.error('Error al obtener informes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleValidar = async (id: number) => {
    if (!confirm('¿Marcar este informe como validado?')) {
      return;
    }

    try {
      const response = await fetch(`/api/informes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'validado' }),
      });

      const data = await response.json();

      if (data.success) {
        await fetchInformes();
        alert('Informe marcado como validado');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error al validar:', error);
      alert('Error al validar el informe');
    }
  };

  const handleRechazar = async (id: number) => {
    const motivo = prompt('Ingrese el motivo del rechazo:');
    if (!motivo) return;

    try {
      const response = await fetch(`/api/informes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'error', errorMensaje: motivo }),
      });

      const data = await response.json();

      if (data.success) {
        await fetchInformes();
        alert('Informe marcado como error');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error al rechazar:', error);
      alert('Error al rechazar el informe');
    }
  };

  const handleValidarTodo = async () => {
    if (!confirm('Desea validar todos los informes pendientes?')) {
      return;
    }

    setValidandoTodo(true);
    try {
      const response = await fetch('/api/informes/validate', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        await fetchInformes();
        alert(`Se validaron ${data.actualizados} informes.`);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error al validar todos:', error);
      alert('Error al validar todos los informes');
    } finally {
      setValidandoTodo(false);
    }
  };

  const getBadgeClass = (estado: string) => {
    const classes: Record<string, string> = {
      pendiente: 'badge badge-pending',
      validado: 'badge badge-validated',
      migrado: 'badge badge-migrated',
      error: 'badge badge-error',
    };
    return classes[estado] || 'badge';
  };

  useEffect(() => {
    fetchInformes();
  }, [filtroEstado]);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2>Registros de Informes</h2>

        <div className="flex items-center gap-4">
          <label className="text-sm">Filtrar por estado:</label>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="pendiente">Pendientes</option>
            <option value="validado">Validados</option>
            <option value="migrado">Migrados</option>
            <option value="error">Errores</option>
          </select>

          <button onClick={fetchInformes} className="btn btn-secondary">
            Actualizar
          </button>
          <button
            onClick={handleValidarTodo}
            className="btn btn-success"
            disabled={loading || validandoTodo}
          >
            {validandoTodo ? 'Validando...' : 'Validar todos'}
          </button>
        </div>
      </div>

      {loading && <div className="text-center text-gray">Cargando...</div>}

      {!loading && informes.length === 0 && (
        <div className="text-center text-gray" style={{ padding: '2rem' }}>
          No hay informes para mostrar. Escanea el repositorio primero.
        </div>
      )}

      {!loading && informes.length > 0 && (
        <>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Accession Number</th>
                <th>RUT</th>
                <th>Nombre Paciente</th>
                <th>Fecha Informe</th>
                <th>Informes</th>
                <th>Escaneados</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {informes.map((informe) => (
                <tr key={informe.id}>
                  <td>{informe.id}</td>
                  <td style={{ fontFamily: 'monospace' }}>{informe.accession_number}</td>
                  <td>{informe.rut_paciente}</td>
                  <td>{informe.nombre_paciente || '-'}</td>
                  <td>
                    {informe.fecha_informe
                      ? new Date(informe.fecha_informe).toLocaleDateString()
                      : '-'}
                  </td>
                  <td>
                    <span
                      className={`badge ${informe.informe_pdf ? 'badge-validated' : ''}`}
                      title={informe.informe_pdf || ''}
                    >
                      {informe.informe_pdf ? 1 : 0}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${informe.archivos_adjuntos.length > 0 ? 'badge-migrated' : ''}`}>
                      {informe.archivos_adjuntos.length}
                    </span>
                  </td>
                  <td>
                    <span className={getBadgeClass(informe.estado)}>
                      {informe.estado.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      {informe.estado === 'pendiente' && (
                        <>
                          <button
                            onClick={() => handleValidar(informe.id)}
                            className="btn btn-success"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          >
                            Validar
                          </button>
                          <button
                            onClick={() => handleRechazar(informe.id)}
                            className="btn btn-danger"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                      {informe.estado === 'error' && informe.error_mensaje && (
                        <span
                          className="text-sm"
                          style={{ color: 'var(--error)', cursor: 'help' }}
                          title={informe.error_mensaje}
                        >
                          ⚠️ Ver error
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="text-sm text-gray" style={{ textAlign: 'right', marginTop: '1rem' }}>
            Mostrando {informes.length} registros
          </div>
        </>
      )}
    </div>
  );
}
