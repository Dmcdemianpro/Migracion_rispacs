#!/usr/bin/env python3
"""
Convierte PDF a DICOM Encapsulado.
Soporta múltiples PDFs por estudio (mismo StudyInstanceUID).

Uso simple:
  python pdf_to_dicom.py <pdf_path> <output_dcm_path> <patient_name> <patient_id> <accession_number> [study_date]

Uso batch (múltiples PDFs mismo estudio):
  python pdf_to_dicom.py --batch <json_config_file>

JSON config format:
{
  "patient_name": "APELLIDO^NOMBRE",
  "patient_id": "12345678-9",
  "accession_number": "ACC001",
  "study_date": "20240115",
  "study_instance_uid": "1.2.3...",  // opcional, se genera si no existe
  "pdfs": [
    {"input": "path/to/pdf1.pdf", "output": "path/to/out1.dcm", "description": "Informe Principal"},
    {"input": "path/to/pdf2.pdf", "output": "path/to/out2.dcm", "description": "Anexo 1"}
  ]
}
"""

import sys
import os
import json
from datetime import datetime

try:
    from pydicom import Dataset, FileDataset
    from pydicom.uid import generate_uid, ExplicitVRLittleEndian
except ImportError:
    print("ERROR: pydicom no está instalado. Ejecute: pip install pydicom")
    sys.exit(1)

# UID para Encapsulated PDF Storage
ENCAPSULATED_PDF_STORAGE = "1.2.840.10008.5.1.4.1.1.104.1"


def create_dicom_from_pdf(
    pdf_path: str,
    output_path: str,
    patient_name: str,
    patient_id: str,
    accession_number: str,
    study_date: str = None,
    study_description: str = "Informe Radiologico",
    series_description: str = "Informe PDF",
    series_number: int = 1,
    instance_number: int = 1,
    study_instance_uid: str = None,
    series_instance_uid: str = None,
) -> dict:
    """
    Crea un archivo DICOM con el PDF encapsulado.

    Returns:
        dict con success, path, study_uid, series_uid, error
    """

    if not os.path.exists(pdf_path):
        return {"success": False, "error": f"PDF no encontrado: {pdf_path}"}

    try:
        # Leer el PDF
        with open(pdf_path, 'rb') as f:
            pdf_data = f.read()

        # Generar UIDs si no se proporcionan
        if not study_instance_uid:
            study_instance_uid = generate_uid()
        if not series_instance_uid:
            series_instance_uid = generate_uid()

        # Crear el dataset DICOM
        file_meta = Dataset()
        file_meta.MediaStorageSOPClassUID = ENCAPSULATED_PDF_STORAGE
        file_meta.MediaStorageSOPInstanceUID = generate_uid()
        file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
        file_meta.ImplementationClassUID = generate_uid()
        file_meta.ImplementationVersionName = "MIGRACION_PACS_1.0"

        # Crear FileDataset
        ds = FileDataset(
            output_path,
            {},
            file_meta=file_meta,
            preamble=b"\x00" * 128
        )

        # Fecha y hora
        now = datetime.now()
        if study_date:
            ds.StudyDate = study_date
        else:
            ds.StudyDate = now.strftime("%Y%m%d")

        ds.StudyTime = now.strftime("%H%M%S")
        ds.ContentDate = now.strftime("%Y%m%d")
        ds.ContentTime = now.strftime("%H%M%S")

        # Patient Module
        ds.PatientName = patient_name
        ds.PatientID = patient_id
        ds.PatientBirthDate = ""
        ds.PatientSex = ""

        # General Study Module
        ds.StudyInstanceUID = study_instance_uid
        ds.StudyID = accession_number[:16] if len(accession_number) > 16 else accession_number
        ds.AccessionNumber = accession_number
        ds.ReferringPhysicianName = ""
        ds.StudyDescription = study_description

        # General Series Module
        ds.SeriesInstanceUID = series_instance_uid
        ds.SeriesNumber = series_number
        ds.Modality = "DOC"
        ds.SeriesDescription = series_description

        # General Equipment Module
        ds.Manufacturer = "Sistema Migracion PACS"
        ds.InstitutionName = ""
        ds.StationName = "MIGRACION"

        # SC Equipment Module
        ds.ConversionType = "WSD"

        # SOP Common Module
        ds.SOPClassUID = ENCAPSULATED_PDF_STORAGE
        ds.SOPInstanceUID = file_meta.MediaStorageSOPInstanceUID
        ds.InstanceNumber = instance_number

        # Encapsulated Document Module
        ds.BurnedInAnnotation = "YES"
        ds.DocumentTitle = f"{series_description} - {accession_number}"
        ds.MIMETypeOfEncapsulatedDocument = "application/pdf"
        ds.EncapsulatedDocument = pdf_data

        # Concept Name Code Sequence
        ds.ConceptNameCodeSequence = [Dataset()]
        ds.ConceptNameCodeSequence[0].CodeValue = "18782-3"
        ds.ConceptNameCodeSequence[0].CodingSchemeDesignator = "LN"
        ds.ConceptNameCodeSequence[0].CodeMeaning = "Radiology Study observation"

        # Crear directorio de salida
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # Guardar
        ds.save_as(output_path)

        return {
            "success": True,
            "path": output_path,
            "study_uid": study_instance_uid,
            "series_uid": series_instance_uid
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


def process_batch(config_path: str) -> dict:
    """
    Procesa múltiples PDFs de un mismo estudio.
    """
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
    except Exception as e:
        return {"success": False, "error": f"Error leyendo config: {e}", "results": []}

    patient_name = config.get("patient_name", "DESCONOCIDO")
    patient_id = config.get("patient_id", "000000000")
    accession_number = config.get("accession_number", "ACC000")
    study_date = config.get("study_date")
    study_description = config.get("study_description", "Informe Radiologico")

    # Usar el mismo StudyInstanceUID para todos los PDFs del estudio
    study_instance_uid = config.get("study_instance_uid") or generate_uid()

    pdfs = config.get("pdfs", [])
    results = []
    success_count = 0
    error_count = 0

    for idx, pdf_info in enumerate(pdfs):
        input_path = pdf_info.get("input")
        output_path = pdf_info.get("output")
        description = pdf_info.get("description", f"Documento {idx + 1}")

        if not input_path or not output_path:
            results.append({
                "input": input_path,
                "success": False,
                "error": "Falta input o output path"
            })
            error_count += 1
            continue

        # Cada PDF es una serie diferente dentro del mismo estudio
        series_instance_uid = generate_uid()

        result = create_dicom_from_pdf(
            pdf_path=input_path,
            output_path=output_path,
            patient_name=patient_name,
            patient_id=patient_id,
            accession_number=accession_number,
            study_date=study_date,
            study_description=study_description,
            series_description=description,
            series_number=idx + 1,
            instance_number=1,
            study_instance_uid=study_instance_uid,
            series_instance_uid=series_instance_uid,
        )

        results.append({
            "input": input_path,
            "output": output_path,
            "description": description,
            **result
        })

        if result["success"]:
            success_count += 1
        else:
            error_count += 1

    return {
        "success": error_count == 0,
        "study_instance_uid": study_instance_uid,
        "total": len(pdfs),
        "exitosos": success_count,
        "errores": error_count,
        "results": results
    }


def main():
    if len(sys.argv) < 2:
        print("Uso simple: python pdf_to_dicom.py <pdf_path> <output_dcm_path> <patient_name> <patient_id> <accession_number> [study_date]")
        print("Uso batch:  python pdf_to_dicom.py --batch <json_config_file>")
        sys.exit(1)

    # Modo batch
    if sys.argv[1] == "--batch":
        if len(sys.argv) < 3:
            print("ERROR: Falta archivo de configuración JSON")
            sys.exit(1)

        result = process_batch(sys.argv[2])
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(0 if result["success"] else 1)

    # Modo simple (un solo PDF)
    if len(sys.argv) < 6:
        print("Uso: python pdf_to_dicom.py <pdf_path> <output_dcm_path> <patient_name> <patient_id> <accession_number> [study_date]")
        sys.exit(1)

    pdf_path = sys.argv[1]
    output_path = sys.argv[2]
    patient_name = sys.argv[3]
    patient_id = sys.argv[4]
    accession_number = sys.argv[5]
    study_date = sys.argv[6] if len(sys.argv) > 6 else None

    result = create_dicom_from_pdf(
        pdf_path=pdf_path,
        output_path=output_path,
        patient_name=patient_name,
        patient_id=patient_id,
        accession_number=accession_number,
        study_date=study_date
    )

    if result["success"]:
        print(f"OK:{result['path']}")
    else:
        print(f"ERROR:{result['error']}")
        sys.exit(1)


if __name__ == "__main__":
    main()
