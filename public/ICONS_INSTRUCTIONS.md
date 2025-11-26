# Instructions pour générer les icônes PNG/ICO à partir du logo BiteBox

## Fichiers nécessaires

Pour que les icônes fonctionnent partout, vous devez créer ces fichiers PNG/ICO à partir de votre image source :

- `/public/favicon.ico` (16x16, 32x32, 48x48 - format ICO multi-taille)
- `/public/favicon.png` (32x32 ou 64x64)
- `/public/icon-192.png` (192x192)
- `/public/icon-512.png` (512x512)
- `/public/apple-touch-icon.png` (180x180 pour iOS)

## Méthodes de conversion

### Option 1 : Outils en ligne
- https://favicon.io/favicon-converter/
- https://realfavicongenerator.net/
- https://www.icoconverter.com/

### Option 2 : ImageMagick (ligne de commande)
```bash
# Convertir en PNG 192x192
convert logo-source.png -resize 192x192 icon-192.png

# Convertir en PNG 512x512
convert logo-source.png -resize 512x512 icon-512.png

# Créer favicon.ico (multi-taille)
convert logo-source.png -define icon:auto-resize=256,128,64,48,32,16 favicon.ico
```

### Option 3 : GIMP / Photoshop
Ouvrez votre logo source, redimensionnez à chaque taille, exportez en PNG, puis utilisez un outil pour créer le .ico

## Couleur du logo
Couleur principale : `#7c3aed` (violet)
Fond : Noir `#000000`

## Note
Les fichiers SVG sont déjà créés et fonctionnent pour les navigateurs modernes, mais les PNG/ICO sont nécessaires pour une compatibilité maximale.

