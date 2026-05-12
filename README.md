# 🍽️ Mozzafiato — Menú Digital

## Estructura del proyecto

```
mozzafiato/
├── index.html        ← Portada (landing con links a todas las secciones)
├── page1.html        ← Desayunos
├── page2.html        ← Ensaladas & Platillos
├── page3.html        ← Chapatas & Hamburguesas
├── page4.html        ← Sandwiches, Waffles & Crepas Saladas
├── page5.html        ← Pastas & Lasagna
├── page6.html        ← Waffles Dulces, Crepas Dulces & Postres
├── page7.html        ← Bebidas Calientes
├── page8.html        ← Tisanas & Bebidas Frías
├── page9.html        ← Frappes & Smoothies
├── page10.html       ← Complementos & Extras
├── style.css         ← Estilos compartidos
├── menu.js           ← Interacciones (sidebar, lightbox)
└── images/
    ├── logo.png      ← ⚠️ AGREGAR tu logo aquí
    ├── 1.png ... 27.png  ← Las 27 ilustraciones del menú
```

---

## 🚀 Cómo publicar en GitHub Pages (paso a paso)

### 1. Crea una cuenta en GitHub
Ve a https://github.com y regístrate (es gratis)

### 2. Crea un repositorio nuevo
- Click en **"New repository"** (botón verde)
- Nombre sugerido: `mozzafiato-menu`
- Marca **"Public"**
- NO marques "Initialize with README"
- Click **"Create repository"**

### 3. Sube los archivos
**Opción A — Desde el navegador (más fácil):**
1. En tu repositorio nuevo, haz click en **"uploading an existing file"**
2. Arrastra TODA la carpeta `mozzafiato/` (todos los archivos y la carpeta `images/`)
3. En el campo inferior escribe: `Subida inicial del menú`
4. Click **"Commit changes"**

**Opción B — Con GitHub Desktop (recomendado para futuras actualizaciones):**
1. Descarga GitHub Desktop: https://desktop.github.com
2. Clona tu repositorio
3. Copia los archivos a la carpeta clonada
4. "Commit" y "Push"

### 4. Activa GitHub Pages
1. Ve a tu repositorio en GitHub
2. Click en **"Settings"** (arriba a la derecha)
3. En el menú izquierdo, click **"Pages"**
4. En "Source" selecciona: **"Deploy from a branch"**
5. En "Branch" selecciona: **"main"** → carpeta **"/ (root)"**
6. Click **"Save"**

### 5. Espera 1-2 minutos
Tu menú estará en:
```
https://TU-USUARIO.github.io/mozzafiato-menu/
```

---

## 📱 Generar el QR

Una vez tengas la URL de GitHub Pages, ve a cualquiera de estos sitios gratuitos:

- https://qr-code-generator.com
- https://www.qrcode-monkey.com (permite agregar logo)
- https://goqr.me

1. Pega tu URL: `https://TU-USUARIO.github.io/mozzafiato-menu/`
2. Personaliza colores (sugerido: fondo crema, código en dorado oscuro)
3. Descarga en alta resolución (PNG 1000px mínimo para imprimir)
4. Imprime y coloca en tus mesas 🎉

---

## ✏️ Cómo editar el menú

Cada archivo HTML es independiente. Para editar un platillo:
1. Abre el archivo correspondiente (ej: `page1.html` para desayunos)
2. Busca el nombre del platillo con Ctrl+F
3. Modifica el texto
4. Sube el archivo actualizado a GitHub
5. Los cambios se reflejan en ~2 minutos

### Agregar/quitar un platillo:
Busca el bloque:
```html
<div class="dish-card">
  <span class="dish-name">Nombre del platillo</span>
  <p class="dish-desc">Descripción...</p>
  <span class="dish-price">199</span>
</div>
```
Cópialo, pégalo y edita. O elimínalo para quitar un platillo.

---

## 🖼️ Agregar tu logo

1. Pon tu archivo de logo PNG en la carpeta `images/`
2. Asegúrate de que se llame `logo.png`
3. Si tiene fondo transparente, mejor (se aplica el filtro sepia automáticamente)

---

## 📞 Soporte
Si necesitas actualizar precios o agregar secciones, edita directamente
el archivo HTML correspondiente. Cada página es completamente independiente.
