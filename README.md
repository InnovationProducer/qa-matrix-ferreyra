# Matriz QA — Planta Ferreyra | WCM

Generador automático de giros de Matriz QA para la metodología World Class Manufacturing.

## ¿Qué hace?

El usuario arrastra el archivo Excel exportado de SurveyMonkey y la app genera automáticamente la Matriz QA completa con:

- Cálculo de índice **S × O × D × C** (Severidad × Ocurrencia × Detectabilidad × Costo)
- Clasificación de voces **AA / A / B / C** por acumulado de ocurrencia
- Desglose de detectabilidad por punto de detección
- Pareto por componente
- Origen del defecto 4M + 1D
- Filtros y búsqueda en tiempo real

## Deploy en Netlify (paso a paso)

### Opción 1: Deploy directo desde GitHub

1. **Crear repositorio en GitHub:**
   ```bash
   cd qa-matrix-app
   git init
   git add .
   git commit -m "Matriz QA v1.0"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/qa-matrix-ferreyra.git
   git push -u origin main
   ```

2. **Conectar con Netlify:**
   - Ir a [app.netlify.com](https://app.netlify.com)
   - Click en "Add new site" → "Import an existing project"
   - Seleccionar GitHub y el repo `qa-matrix-ferreyra`
   - Configurar:
     - **Build command:** `npm run build`
     - **Publish directory:** `dist`
   - Click "Deploy site"

3. **Listo.** Netlify te da una URL como `https://qa-matrix-ferreyra.netlify.app`

### Opción 2: Deploy manual (drag & drop)

```bash
cd qa-matrix-app
npm install
npm run build
```

Arrastrar la carpeta `dist/` directamente a [app.netlify.com/drop](https://app.netlify.com/drop)

## Desarrollo local

```bash
npm install
npm run dev
```

Abrir `http://localhost:5173`

## Tecnologías

- **Vite** + **React 18** — Build ultrarrápido
- **SheetJS (xlsx)** — Parseo de Excel en el navegador
- **Procesamiento 100% client-side** — No necesita backend ni Supabase para esta versión

## Notas sobre Supabase

Esta versión procesa todo en el navegador del usuario (no se envían datos a ningún servidor). Si en el futuro quieren:
- Guardar histórico de giros
- Gestionar el PDCA (Plan-Do-Check-Act) de cada voz
- Login de usuarios por planta

Se puede agregar Supabase como backend. La estructura actual lo permite fácilmente.
