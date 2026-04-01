import io
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, ListFlowable, ListItem
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch

def create_pdf(summary: dict):
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()

    body_style = ParagraphStyle(
        'BodyText',
        parent=styles['BodyText'],
        fontSize=11,
        leading=14,
    )

    header_style = ParagraphStyle(
        'Heading',
        parent=styles['Heading2'],
        fontSize=14,
        leading=18,
    )

    elements = []

    elements.append(Paragraph("Legal Document Summary", styles['Title']))
    elements.append(Spacer(1,0.25 * inch))

    #Elevator Summary
    elements.append(Paragraph("Elevator Summary", header_style))
    elements.append(Paragraph(summary.get('summary_elevator', ''), body_style))

    #Key Points
    elements.append(Paragraph("Key Points", header_style))
    elements.append(ListFlowable([
        ListItem(Paragraph(str(b), body_style))
        for b in summary.get('summary_bullets', [])
    ]))

    #Missing Info
    elements.append(Paragraph("Missing Information", header_style))
    elements.append(ListFlowable([
        ListItem(Paragraph(str(m), body_style))
        for m in summary.get('missing_info', [])
    ]))

    # Next steps
    elements.append(Paragraph("Next Steps", header_style))
    elements.append(ListFlowable([
        ListItem(Paragraph(str(s), body_style))
        for s in summary.get('next_steps', [])
    ]))

    elements.append(Paragraph(f"Confidence: {summary.get('confidence', 0)}%", header_style))

    doc.build(elements)
    buffer.seek(0)

    return buffer
