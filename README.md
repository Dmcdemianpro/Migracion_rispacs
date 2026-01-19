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

## Flujo de Trabajo Paso a Paso

### Paso 1: Preparar el Repositorio de Origen

Antes de iniciar, asegurese de tener el repositorio de informes con la estructura correcta:

```
repositorio/
├── paciente_001/
│   ├── index.txt          # Metadatos del estudio
│   ├── informe.pdf        # Informe radiologico principal
│   ├── escaneado01.pdf    # Documentos escaneados (opcional)
│   └── escaneado02.pdf
├── paciente_002/
│   ├── index.txt
│   └── informe.pdf
...
```

### Paso 2: Escanear e Indexar

1. Abrir la aplicacion en `http://localhost:3000`
2. En la pestana **Migracion**, hacer clic en **"Escanear Repositorio"**
3. El sistema:
   - Recorre todas las carpetas del repositorio
   - Lee cada archivo `index.txt` y extrae los metadatos
   - Identifica los PDFs asociados (informe principal + escaneados)
   - Inserta los registros en la base de datos con estado **"pendiente"**
4. El dashboard muestra el conteo de registros indexados

### Paso 3: Revisar y Validar Registros

1. En la tabla de registros, revisar los informes indexados
2. Usar el filtro de estado para ver solo los **"pendientes"**
3. Para cada registro:
   - **Validar**: Si los datos son correctos, clic en "Validar" → cambia a estado **"validado"**
   - **Rechazar**: Si hay errores, clic en "Rechazar" e ingresar el motivo → cambia a estado **"error"**
4. Opcion rapida: **"Validar todos"** para aprobar todos los pendientes en lote

### Paso 4: Convertir a DICOM (Dicomizar)

1. Una vez validados los registros, hacer clic en **"Dicomizar"**
2. El sistema:
   - Toma los registros en estado **"validado"**
   - Convierte cada PDF a formato DICOM (Encapsulated PDF)
   - Genera archivos `.dcm` en la carpeta de salida configurada
   - Nombra los archivos como: `AccessionNumber_RUT_nombrearchivo.dcm`
   - Mantiene el mismo StudyInstanceUID para todos los archivos de un estudio
   - Actualiza el estado a **"migrado"**
3. Los archivos DICOM quedan listos para enviar al PACS

### Paso 5: Verificar Resultados

1. Ir a la pestana **Reportes**
2. Revisar el dashboard:
   - **Total Registros**: Cantidad total indexada
   - **Migrados**: Cantidad convertida a DICOM exitosamente
   - **Con Errores**: Cantidad con problemas
   - **% Completado**: Progreso general
3. Ver estadisticas de archivos:
   - **Informes PDF**: Cantidad de informes principales
   - **Docs Escaneados**: Cantidad de documentos adjuntos
   - **Total Archivos**: Suma total de PDFs procesados

### Paso 6: Exportar Reportes

1. En la pestana **Reportes**, seccion "Descargar Reportes"
2. Opciones disponibles:
   - **Descargar Migrados (CSV)**: Solo registros migrados exitosamente
   - **Descargar Errores (CSV)**: Solo registros con errores
   - **Descargar Todo (CSV)**: Todos los registros
3. El CSV incluye una fila por cada archivo:
   - AccessionNumber, RUT, Nombre, Fecha
   - Ruta del archivo, Tipo (informe/escaneado01/escaneado02...)
   - SHA256, ExportadoPor, FechaExport

### Paso 7: Enviar al PACS

Los archivos DICOM generados en `DICOM_OUTPUT_PATH` estan listos para:
- Enviar mediante DICOM C-STORE a un servidor PACS
- Importar manualmente en el visor DICOM
- Integrar con Mirth Connect u otro motor de integracion

### Diagrama de Estados

```
┌──────────────┐    Escanear    ┌──────────────┐
│  Repositorio │ ─────────────> │  PENDIENTE   │
│   (PDFs)     │                └──────────────┘
└──────────────┘                       │
                                       │ Validar
                                       ▼
                               ┌──────────────┐
                               │   VALIDADO   │
                               └──────────────┘
                                       │
                          ┌────────────┴────────────┐
                          │ Dicomizar               │ Rechazar
                          ▼                         ▼
                   ┌──────────────┐         ┌──────────────┐
                   │   MIGRADO    │         │    ERROR     │
                   │  (archivos   │         │  (mensaje)   │
                   │    .dcm)     │         └──────────────┘
                   └──────────────┘
```

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
