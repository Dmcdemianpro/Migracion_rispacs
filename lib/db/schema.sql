-- Tabla de staging para informes radiológicos
CREATE TABLE IF NOT EXISTS informes_staging (
    id SERIAL PRIMARY KEY,
    accession_number VARCHAR(50) NOT NULL,
    rut_paciente VARCHAR(15) NOT NULL,
    nombre_paciente VARCHAR(200),
    fecha_informe TIMESTAMP,
    informe_pdf VARCHAR(255),
    sha256 VARCHAR(64),
    origen VARCHAR(100),
    exportado_por VARCHAR(100),
    fecha_export TIMESTAMP,

    -- Campos de control
    carpeta_origen VARCHAR(500),
    archivos_adjuntos TEXT,  -- JSON array de archivos escaneados
    estado VARCHAR(20) DEFAULT 'pendiente',  -- pendiente, validado, migrado, error
    fecha_indexacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_validacion TIMESTAMP,
    fecha_migracion TIMESTAMP,
    error_mensaje TEXT,

    CONSTRAINT unique_accession UNIQUE(accession_number)
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_estado ON informes_staging(estado);
CREATE INDEX IF NOT EXISTS idx_accession ON informes_staging(accession_number);
CREATE INDEX IF NOT EXISTS idx_rut ON informes_staging(rut_paciente);
CREATE INDEX IF NOT EXISTS idx_fecha_informe ON informes_staging(fecha_informe);

-- Estado de escaneo para continuidad
CREATE TABLE IF NOT EXISTS scan_state (
    repositorio_path TEXT PRIMARY KEY,
    last_cursor TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scan_state_updated_at ON scan_state(updated_at);
