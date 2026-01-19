'use client';

import { useEffect, useState } from 'react';

interface Estadisticas {
  total: number;
  pendientes: number;
  validados: number;
  migrados: number;
  errores: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Estadisticas | null>(null);
  const [escaneando, setEscaneando] = useState(false);
  const [dicomizando, setDicomizando] = useState(false);
  const [scanCursor, setScanCursor] = useState<string | null>(null);
  const scanBatchSize = 1000;

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats');
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
    }
  };

  const handleEscanear = async () => {
    if (!confirm(`Desea escanear ${scanBatchSize} carpetas y actualizar la base de datos?`)) {
      return;
    }

    setEscaneando(true);
    try {
      const payload = {
        limit: scanBatchSize,
        cursor: scanCursor ?? undefined,
      };
      const response = await fetch('/api/informes/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        const hasMore = Boolean(data?.continuidad?.hasMore);
        const nextCursor = data?.continuidad?.nextCursor ?? null;

        if (hasMore && nextCursor) {
          window.localStorage.setItem('scanCursor', nextCursor);
          setScanCursor(nextCursor);
        } else {
          window.localStorage.removeItem('scanCursor');
          setScanCursor(null);
        }

        const continuidadTexto = hasMore
          ? '\nContinuidad:\n- Hay mas carpetas por escanear'
          : '\nContinuidad:\n- Escaneo completado';
        alert(
          `Escaneo completado:\n` +
            `- Carpetas escaneadas: ${data.escaneo.total}\n` +
            `- Exitosos: ${data.escaneo.exitosos}\n` +
            `- Errores: ${data.escaneo.errores}\n` +
            `\nIndexacion:\n` +
            `- Indexados: ${data.indexacion.indexados}\n` +
            `- Errores: ${data.indexacion.errores}` +
            continuidadTexto
        );
        await fetchStats();
        window.location.reload();
      } else {
        alert(`Error al escanear: ${data.error}`);
      }
    } catch (error) {
      console.error('Error al escanear:', error);
      alert('Error al escanear el repositorio');
    } finally {
      setEscaneando(false);
    }
  };

  const handleExportar = async () => {
    window.open('/api/informes/export', '_blank');
  };

  const handleDicomizar = async () => {
    if (!stats?.validados || stats.validados === 0) {
      alert('No hay informes validados para dicomizar');
      return;
    }

    if (!confirm(`Desea convertir ${Math.min(stats.validados, 50)} informes validados a DICOM?`)) {
      return;
    }

    setDicomizando(true);
    try {
      const response = await fetch('/api/informes/dicomize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limite: 50 }),
      });

      const data = await response.json();

      if (data.success) {
        alert(
          `Dicomizacion completada:\n` +
            `\nInformes:\n` +
            `- Procesados: ${data.procesados}\n` +
            `- Exitosos: ${data.exitosos}\n` +
            `- Errores: ${data.errores}\n` +
            `\nPDFs convertidos:\n` +
            `- Total PDFs: ${data.totalPdfs || 0}\n` +
            `- Convertidos: ${data.pdfsConvertidos || 0}\n` +
            `- Errores: ${data.pdfsErrores || 0}\n` +
            `\nArchivos en: ${data.outputPath}`
        );
        await fetchStats();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error al dicomizar:', error);
      alert('Error al convertir a DICOM');
    } finally {
      setDicomizando(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const savedCursor = window.localStorage.getItem('scanCursor');
    if (savedCursor) {
      setScanCursor(savedCursor);
    }
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2>Dashboard</h2>
        <div className="flex gap-2">
          <button
            onClick={handleEscanear}
            disabled={escaneando}
            className="btn btn-primary"
          >
            {escaneando
              ? 'Escaneando...'
              : scanCursor
              ? `Continuar escaneo (${scanBatchSize})`
              : `Escanear ${scanBatchSize}`}
          </button>
          <button onClick={handleExportar} className="btn btn-success">
            Exportar CSV
          </button>
          <button
            onClick={handleDicomizar}
            disabled={dicomizando || !stats?.validados}
            className="btn btn-primary"
            style={{ background: '#7c3aed' }}
          >
            {dicomizando ? 'Dicomizando...' : `Dicomizar (${stats?.validados || 0})`}
          </button>
        </div>
      </div>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="stat-card pending">
            <div className="stat-value">{stats.pendientes}</div>
            <div className="stat-label">Pendientes</div>
          </div>
          <div className="stat-card validated">
            <div className="stat-value">{stats.validados}</div>
            <div className="stat-label">Validados</div>
          </div>
          <div className="stat-card migrated">
            <div className="stat-value">{stats.migrados}</div>
            <div className="stat-label">Migrados</div>
          </div>
          <div className="stat-card error">
            <div className="stat-value">{stats.errores}</div>
            <div className="stat-label">Errores</div>
          </div>
        </div>
      )}

      {!stats && (
        <div className="text-center text-gray">Cargando estadísticas...</div>
      )}
    </div>
  );
}
