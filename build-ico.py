import os
from PIL import Image

def build_icon():
    img_path = 'public/logo.png'
    out_path = 'public/icon.ico'
    
    if not os.path.exists(img_path):
        print("logo.png not found")
        return
        
    img = Image.open(img_path)
    
    # Ensure it's RGBA
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
        
    icon_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    img.save(out_path, format='ICO', sizes=icon_sizes)
    print("Multi-size icon.ico created successfully")

if __name__ == "__main__":
    build_icon()
