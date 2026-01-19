# Migracion RISPACS

Sistema de migracion de informes radiologicos desde repositorio de archivos hacia PACS, con capacidad de indexacion, validacion, conversion a DICOM y generacion de reportes.

## Autor

**Dario Perez**

## Descripcion

Esta herramienta permite:

- **Escanear repositorios** de informes radiologicos (archivos index.txt con PDFs asociados)
- **Indexar datos** en base de datos PostgreSQL de staging
- **Revisar y validar** registros mediante interfaz web
- **Convertir PDFs a DICOM** (Encapsulated PDF DICOM)
- **Exportar a CSV** con formato personalizado
- **Generar reportes** y dashboard de estadisticas de migracion

## Tecnologias

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Backend**: Next.js API Routes
- **Base de datos**: PostgreSQL
- **DICOM**: Python con pydicom
- **CSV**: papaparse

## Requisitos

- Node.js 18+
- PostgreSQL 14+
- Python 3.8+ con pydicom instalado

## Instalacion

1. Clonar el repositorio:
```bash
git clone https://github.com/Dmcdemianpro/Migracion_rispacs.git
cd Migracion_rispacs
```

2. Instalar dependencias de Node.js:
```bash
npm install
```

3. Instalar dependencias de Python:
```bash
pip install pydicom
```

4. Configurar variables de entorno en `.env.local`:
```env
DATABASE_URL=postgresql://usuario:password@localhost:5432/migracion_pacs
REPOSITORIO_PATH=C:/ruta/al/repositorio
DICOM_OUTPUT_PATH=C:/ruta/salida/dicom
```

5. Crear la base de datos y tabla:
```sql
CREATE DATABASE migracion_pacs;

CREATE TABLE informes_staging (
  id SERIAL PRIMARY KEY,
  accession_number VARCHAR(50) NOT NULL,
  rut_paciente VARCHAR(20) NOT NULL,
  nombre_paciente VARCHAR(200),
  fecha_informe TIMESTAMP,
  informe_pdf TEXT,
  archivos_adjuntos TEXT,
  estado VARCHAR(20) DEFAULT 'pendiente',
  error_mensaje TEXT,
  fecha_indexacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_migracion TIMESTAMP,
  sha256 VARCHAR(64),
  exportado_por VARCHAR(50),
  fecha_export TIMESTAMP
);
```

6. Iniciar el servidor de desarrollo:
```bash
npm run dev
```

## Uso

### Interfaz Web

Acceder a `http://localhost:3000` para:

1. **Pestana Migracion**:
   - Escanear repositorio para indexar informes
   - Ver tabla de registros con filtros por estado
   - Validar o rechazar registros individualmente
   - Validar todos los pendientes en lote
   - Dicomizar PDFs (convertir a formato DICOM)

2. **Pestana Reportes**:
   - Ver estadisticas generales (total, migrados, errores, % completado)
   - Ver conteo de archivos (informes PDF, documentos escaneados)
   - Barra de progreso visual
   - Grafico de migraciones por dia
   - Descargar reportes en CSV (migrados, errores, todos)

### Formato de Repositorio

El sistema espera la siguiente estructura:
```
repositorio/
├── carpeta1/
│   ├── index.txt
│   ├── informe.pdf
│   └── escaneado01.pdf
├── carpeta2/
│   ├── index.txt
│   └── informe.pdf
...
```

Formato del archivo `index.txt`:
```
AccessionNumber : 1048107
RutPaciente     : 4603452-K
NombrePaciente  : Barindelli Latorre Jose Antonio
FechaInforme    : 2025-01-01 10:01:56.0
InformePDF      : 1048107_4603452-K_informe.pdf
SHA256          : bca176f6b95f729bdbc36e1c0cdb234e865a1cc2483b316006cb115a40c541c5
Origen          : Centricity RIS
ExportadoPor    : ITMS
FechaExport     : 2026-01-06T15:55:06.777794500
```

### Conversion DICOM

Los PDFs se convierten a Encapsulated PDF DICOM (SOP Class 1.2.840.10008.5.1.4.1.1.104.1), manteniendo:
- Mismo StudyInstanceUID para todos los archivos de un mismo estudio
- SeriesInstanceUID unico por tipo (informe vs escaneados)
- SOPInstanceUID unico por archivo

## API Endpoints

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/scan` | POST | Escanear repositorio |
| `/api/informes` | GET | Listar informes |
| `/api/informes/[id]` | PUT | Actualizar estado |
| `/api/informes/validate` | POST | Validar todos |
| `/api/informes/dicomize` | POST | Convertir a DICOM |
| `/api/informes/export` | GET | Exportar CSV |
| `/api/reportes/stats` | GET | Estadisticas |
| `/api/reportes/download` | GET | Descargar reporte |

## Estructura del Proyecto

```
migracion-pacs/
├── app/
│   ├── api/
│   │   ├── informes/
│   │   │   ├── route.ts
│   │   │   ├── [id]/route.ts
│   │   │   ├── dicomize/route.ts
│   │   │   ├── export/route.ts
│   │   │   ├── scan/route.ts
│   │   │   └── validate/route.ts
│   │   ├── reportes/
│   │   │   ├── stats/route.ts
│   │   │   └── download/route.ts
│   │   └── stats/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── Dashboard.tsx
│   ├── MainContent.tsx
│   ├── ReporteDashboard.tsx
│   └── TablaInformes.tsx
├── lib/
│   └── db/
│       ├── connection.ts
│       └── queries.ts
├── scripts/
│   └── pdf_to_dicom.py
└── README.md
```

## Scripts Disponibles

- `npm run dev` - Iniciar servidor de desarrollo
- `npm run build` - Compilar para produccion
- `npm run start` - Iniciar servidor de produccion
- `npm run lint` - Ejecutar linter
- `npm run db:init` - Inicializar esquema de base de datos

## Licencia

Proyecto privado - Todos los derechos reservados.

---

Desarrollado por **Dario Perez**
