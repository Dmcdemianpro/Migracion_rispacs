'use client';

import { useEffect, useState } from 'react';

interface EstadisticasMigracion {
  total: number;
  pendientes: number;
  validados: number;
  migrados: number;
  errores: number;
  ultimaMigracion: string | null;
  primeraIndexacion: string | null;
  porcentajeMigrado: number;
  totalInformes: number;
  totalEscaneados: number;
  totalArchivos: number;
}

interface ResumenPorFecha {
  fecha: string;
  migrados: number;
  errores: number;
}

export default function ReporteDashboard() {
  const [stats, setStats] = useState<EstadisticasMigracion | null>(null);
  const [resumenPorFecha, setResumenPorFecha] = useState<ResumenPorFecha[]>([]);
  const [loading, setLoading] = useState(true);
  const [generandoReporte, setGenerandoReporte] = useState(false);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/reportes/stats');
      const data = await response.json();
      if (data.success) {
        setStats(data.estadisticas);
        setResumenPorFecha(data.resumenPorFecha || []);
      }
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDescargarReporte = async (tipo: 'migrados' | 'errores' | 'todos') => {
    setGenerandoReporte(true);
    try {
      window.open(`/api/reportes/download?tipo=${tipo}`, '_blank');
    } finally {
      setGenerandoReporte(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="text-center text-gray">Cargando estadísticas...</div>;
  }

  if (!stats) {
    return <div className="text-center text-gray">Error al cargar estadísticas</div>;
  }

  const maxMigrados = Math.max(...resumenPorFecha.map(r => r.migrados), 1);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2>Reporte de Migracion</h2>
        <button onClick={fetchStats} className="btn btn-secondary">
          Actualizar
        </button>
      </div>

      {/* Resumen General */}
      <div className="card mb-4">
        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Resumen General</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Registros</div>
          </div>
          <div className="stat-card migrated">
            <div className="stat-value">{stats.migrados}</div>
            <div className="stat-label">Migrados</div>
          </div>
          <div className="stat-card error">
            <div className="stat-value">{stats.errores}</div>
            <div className="stat-label">Con Errores</div>
          </div>
          <div className="stat-card validated">
            <div className="stat-value">{stats.porcentajeMigrado.toFixed(1)}%</div>
            <div className="stat-label">Completado</div>
          </div>
        </div>
      </div>

      {/* Estadisticas de Archivos */}
      <div className="card mb-4">
        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Archivos Procesados</h3>
        <div className="stats-grid">
          <div className="stat-card validated">
            <div className="stat-value">{stats.totalInformes}</div>
            <div className="stat-label">Informes PDF</div>
          </div>
          <div className="stat-card migrated">
            <div className="stat-value">{stats.totalEscaneados}</div>
            <div className="stat-label">Docs Escaneados</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalArchivos}</div>
            <div className="stat-label">Total Archivos</div>
          </div>
        </div>
      </div>

      {/* Barra de Progreso */}
      <div className="card mb-4">
        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Progreso de Migracion</h3>
        <div className="progress-container">
          <div className="progress-bar">
            <div
              className="progress-fill migrated"
              style={{ width: `${(stats.migrados / stats.total) * 100}%` }}
            />
            <div
              className="progress-fill validated"
              style={{ width: `${(stats.validados / stats.total) * 100}%`, marginLeft: `${(stats.migrados / stats.total) * 100}%` }}
            />
            <div
              className="progress-fill pending"
              style={{ width: `${(stats.pendientes / stats.total) * 100}%`, marginLeft: `${((stats.migrados + stats.validados) / stats.total) * 100}%` }}
            />
            <div
              className="progress-fill error"
              style={{ width: `${(stats.errores / stats.total) * 100}%`, marginLeft: `${((stats.migrados + stats.validados + stats.pendientes) / stats.total) * 100}%` }}
            />
          </div>
          <div className="progress-legend">
            <span><span className="legend-dot migrated"></span> Migrados ({stats.migrados})</span>
            <span><span className="legend-dot validated"></span> Validados ({stats.validados})</span>
            <span><span className="legend-dot pending"></span> Pendientes ({stats.pendientes})</span>
            <span><span className="legend-dot error"></span> Errores ({stats.errores})</span>
          </div>
        </div>
      </div>

      {/* Historial por Fecha */}
      {resumenPorFecha.length > 0 && (
        <div className="card mb-4">
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Migraciones por Dia (ultimos 7 dias)</h3>
          <div className="chart-container">
            {resumenPorFecha.map((item) => (
              <div key={item.fecha} className="chart-bar-group">
                <div className="chart-bar-wrapper">
                  <div
                    className="chart-bar migrated"
                    style={{ height: `${(item.migrados / maxMigrados) * 100}%` }}
                  >
                    {item.migrados > 0 && <span className="chart-bar-value">{item.migrados}</span>}
                  </div>
                </div>
                <div className="chart-label">{item.fecha}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fechas Importantes */}
      <div className="card mb-4">
        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Informacion Temporal</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <div className="text-sm text-gray">Primera Indexacion</div>
            <div style={{ fontWeight: 'bold' }}>
              {stats.primeraIndexacion
                ? new Date(stats.primeraIndexacion).toLocaleString()
                : 'N/A'}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray">Ultima Migracion</div>
            <div style={{ fontWeight: 'bold' }}>
              {stats.ultimaMigracion
                ? new Date(stats.ultimaMigracion).toLocaleString()
                : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Botones de Descarga */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Descargar Reportes</h3>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <button
            onClick={() => handleDescargarReporte('migrados')}
            className="btn btn-primary"
            disabled={generandoReporte}
          >
            Descargar Migrados (CSV)
          </button>
          <button
            onClick={() => handleDescargarReporte('errores')}
            className="btn btn-danger"
            disabled={generandoReporte}
          >
            Descargar Errores (CSV)
          </button>
          <button
            onClick={() => handleDescargarReporte('todos')}
            className="btn btn-secondary"
            disabled={generandoReporte}
          >
            Descargar Todo (CSV)
          </button>
        </div>
        <p className="text-sm text-gray" style={{ marginTop: '0.5rem' }}>
          Los reportes incluyen: Accession, RUT, Nombre, Fecha, Estado, Fecha Migracion
        </p>
      </div>
    </div>
  );
}
