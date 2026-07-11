import os
# import pytesseract
# from PIL import Image

def run_ocr(image_path: str) -> str:
    """
    Runs OCR on the given image path to extract logs.
    (PyTesseract is commented out to prevent execution crashes on missing binaries).
    """
    if not os.path.exists(image_path):
        return f"File not found: {image_path}"
        
    # try:
    #     image = Image.open(image_path)
    #     return pytesseract.image_to_string(image)
    # except Exception as e:
    #     return f"OCR Error: {str(e)}"
    
    return "Extracted OCR text: [Mock log entry - Bearing replaced on Motor C]"
