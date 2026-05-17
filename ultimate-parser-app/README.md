# The Ultimate Parser App

Aplicación web interactiva para **CS3402 Compiladores** (2026-1) — Bonificación Examen 1.

## Características

### Analizadores implementados
| Grupo | Algoritmo |
|-------|-----------|
| Top-Down | Descenso recursivo, LL(1) |
| Bottom-Up | LR(0), SLR(1), LALR(1), LR(1) |

### Por cada parser
- Construcción de tablas (LL(1), ACTION/GOTO, FIRST/FOLLOW)
- Validación de cadenas
- Simulación **paso a paso** con controles ⏮ ◀ ▶ ⏭

### Valor agregado
- Teclado virtual con símbolos formales (ε, →, \|, …)
- Visualización de autómata LR (Mermaid + export **DOT** para Graphviz)
- Árbol de parse / derivación
- **IA pedagógica**: explicación de errores, sugerencias LL(1) y ambigüedad
- Comparación entre algoritmos
- Historial local (50 análisis)
- Exportación de tablas a **PDF**
- **PWA** instalable

## Uso rápido

```bash
cd ultimate-parser-app
npm install
npm run dev
```

Abrir `http://localhost:5173`

### Formato de gramática
```
E -> T E'
E' -> + T E' | ε
F -> id
```
- Use `->` o `→` o `::=`
- Alternativas con `|`
- Épsilon: `ε`, `epsilon`, `eps`

### Formato de entrada
Tokens separados por espacios: `id + id * id`

## Gramáticas de ejemplo
Incluidas en la barra lateral: expresiones, paréntesis, listas, if-then-else, LL(1) simple.

## Despliegue (URL pública)

### Vercel / Netlify
1. Subir carpeta `ultimate-parser-app` a GitHub
2. Conectar repositorio en [vercel.com](https://vercel.com) o [netlify.com](https://netlify.com)
3. Build: `npm run build` — Directorio: `dist`

### GitHub Pages
```bash
npm run build
# Publicar contenido de dist/
```

## Arquitectura

```
src/
├── core/          # Gramática, FIRST/FOLLOW, LL(1), LR, runner
├── ai/            # Explicaciones en lenguaje natural
├── components/    # UI (teclado, tabla de pasos)
├── data/          # Gramáticas de ejemplo
└── utils/         # Historial, PDF, Graphviz DOT
```

## Exposición (10 min)
1. Objetivo: herramienta pedagógica de parsers
2. Demo: gramática simple LL(1) → expresiones con LR(1)
3. Mostrar tablas, autómata, paso a paso, panel IA
4. Mencionar desarrollo asistido por IA (Cursor/Copilot)
5. PWA y despliegue

## Tecnologías
React 19, TypeScript, Vite 8, Tailwind CSS 4, Mermaid, jsPDF, vite-plugin-pwa

## Equipo
Hasta 3 integrantes — personalizar este README con nombres y código de curso.
