import pdfplumber

def extract_text_from_pdf(filepath: str) -> str:
    text = ""

    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"

    return text.strip()