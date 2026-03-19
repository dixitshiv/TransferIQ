import json
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "demo_package")
PDF_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "demo_transfer_package.pdf")

# Map of demo transfer ID → package directory name
DEMO_PACKAGE_DIRS = {
    "demo-metformin-001": "demo_package",
    "demo-ibuprofen-001": "demo_package_ibuprofen",
    "demo-sitagliptin-001": "demo_package_sitagliptin",
    "demo-valsartan-001": "demo_package_valsartan",
}

# Map of demo transfer ID → PDF output path
DEMO_PDF_PATHS = {
    "demo-metformin-001": os.path.join(os.path.dirname(__file__), "..", "data", "demo_transfer_package.pdf"),
    "demo-ibuprofen-001": os.path.join(os.path.dirname(__file__), "..", "data", "demo_ibuprofen_package.pdf"),
    "demo-sitagliptin-001": os.path.join(os.path.dirname(__file__), "..", "data", "demo_sitagliptin_package.pdf"),
    "demo-valsartan-001": os.path.join(os.path.dirname(__file__), "..", "data", "demo_valsartan_package.pdf"),
}


def _package_dir(demo_id: str) -> str:
    subdir = DEMO_PACKAGE_DIRS.get(demo_id, "demo_package")
    return os.path.join(os.path.dirname(__file__), "..", "data", subdir)


def load_demo_package(demo_id: str = "demo-metformin-001") -> dict:
    pkg_dir = _package_dir(demo_id)

    with open(os.path.join(pkg_dir, "product_info.json")) as f:
        product_info = json.load(f)

    with open(os.path.join(pkg_dir, "batch_record.txt")) as f:
        batch_record = f.read()

    with open(os.path.join(pkg_dir, "analytical_methods.txt")) as f:
        analytical_methods = f.read()

    with open(os.path.join(pkg_dir, "stability_data.txt")) as f:
        stability_data = f.read()

    return {
        "product_info": product_info,
        "batch_record": batch_record,
        "analytical_methods": analytical_methods,
        "stability_data": stability_data,
    }


def build_package_summary(package: dict) -> str:
    if "product_info" in package:
        pi = package["product_info"]
        return f"""
PRODUCT: {pi['product_name']}
Dosage Form: {pi['dosage_form']}
Transfer Type: {pi['transfer_type']}
Sending Org: {pi['sending_org']} → Receiving Org: {pi['receiving_org']}
Regulatory Status: {pi['regulatory_status']}
CQAs: {', '.join(pi['critical_quality_attributes'])}
CPPs: {', '.join(pi['critical_process_parameters'])}

BATCH RECORD SUMMARY:
{package['batch_record']}

ANALYTICAL METHODS SUMMARY:
{package['analytical_methods']}

STABILITY DATA SUMMARY:
{package['stability_data']}
""".strip()
    else:
        # Uploaded PDF format — raw text values keyed by filename
        return "\n\n".join(f"--- {k} ---\n{v}" for k, v in package.items())


def generate_package_pdf(demo_id: str) -> str:
    """Generate a PDF for the given demo transfer. Returns the output path."""
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
    from reportlab.lib.enums import TA_LEFT

    output_path = DEMO_PDF_PATHS[demo_id]
    package = load_demo_package(demo_id)
    pi = package["product_info"]

    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=inch,
        rightMargin=inch,
        topMargin=inch,
        bottomMargin=inch,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "TitleStyle",
        parent=styles["Title"],
        fontSize=18,
        spaceAfter=6,
        textColor=colors.HexColor("#0f172a"),
    )
    h1_style = ParagraphStyle(
        "H1Style",
        parent=styles["Heading1"],
        fontSize=14,
        spaceBefore=18,
        spaceAfter=6,
        textColor=colors.HexColor("#1e40af"),
    )
    h2_style = ParagraphStyle(
        "H2Style",
        parent=styles["Heading2"],
        fontSize=11,
        spaceBefore=10,
        spaceAfter=4,
        textColor=colors.HexColor("#374151"),
    )
    body_style = ParagraphStyle(
        "BodyStyle",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        spaceAfter=4,
        textColor=colors.HexColor("#1f2937"),
    )
    mono_style = ParagraphStyle(
        "MonoStyle",
        parent=styles["Code"],
        fontSize=9,
        leading=13,
        spaceAfter=2,
        leftIndent=12,
        textColor=colors.HexColor("#374151"),
        backColor=colors.HexColor("#f8fafc"),
    )

    story = []

    # Cover
    story.append(Paragraph("Technology Transfer Package", title_style))
    story.append(Paragraph(pi["product_name"], styles["Heading2"]))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e2e8f0")))
    story.append(Spacer(1, 10))

    # Product Information
    story.append(Paragraph("1. Product Information", h1_style))
    fields = [
        ("Product Name", pi["product_name"]),
        ("Dosage Form", pi["dosage_form"]),
        ("Strength", pi["strength"]),
        ("Route of Administration", pi["route_of_administration"]),
        ("Transfer Type", pi["transfer_type"]),
        ("Sending Organisation", pi["sending_org"]),
        ("Receiving Organisation", pi["receiving_org"]),
        ("Regulatory Status", pi["regulatory_status"]),
        ("Therapeutic Area", pi["therapeutic_area"]),
        ("Shelf Life", pi["shelf_life"]),
        ("Storage Conditions", pi["storage_conditions"]),
        ("Batch Size", pi["batch_size"]),
    ]
    for label, value in fields:
        story.append(Paragraph(f"<b>{label}:</b> {value}", body_style))

    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Critical Quality Attributes (CQAs):</b>", body_style))
    for cqa in pi["critical_quality_attributes"]:
        story.append(Paragraph(f"• {cqa}", body_style))

    story.append(Paragraph("<b>Critical Process Parameters (CPPs):</b>", body_style))
    for cpp in pi["critical_process_parameters"]:
        story.append(Paragraph(f"• {cpp}", body_style))

    story.append(Paragraph("<b>Excipients:</b>", body_style))
    for exc in pi["excipients"]:
        story.append(Paragraph(f"• {exc}", body_style))

    def _add_text_section(title: str, text: str, section_num: int):
        story.append(Paragraph(f"{section_num}. {title}", h1_style))
        for line in text.split("\n"):
            stripped = line.rstrip()
            if not stripped:
                story.append(Spacer(1, 4))
            elif stripped.isupper() and len(stripped) < 80:
                story.append(Paragraph(stripped, h2_style))
            else:
                story.append(
                    Paragraph(stripped.replace("<", "&lt;").replace(">", "&gt;"), mono_style)
                )

    _add_text_section("Master Batch Record", package["batch_record"], 2)
    _add_text_section("Analytical Methods Package", package["analytical_methods"], 3)
    _add_text_section("Stability Data Summary", package["stability_data"], 4)

    doc.build(story)
    print(f"[TransferIQ] Demo PDF generated: {output_path}")
    return output_path


# Backwards-compatible alias for the original Metformin PDF generation
def generate_demo_pdf():
    generate_package_pdf("demo-metformin-001")
