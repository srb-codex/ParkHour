# ParkHour

PWA móvil-first (online y 100% offline) para consultar al instante si las zonas de aparcamiento regulado (ORA, SER, AREA, OTA, OLA, etc.) son **de pago o gratuitas** en las **50 capitales de provincia de España + Ceuta y Melilla (52 ciudades)**.

## Características

- **Semáforo en tiempo real** por zona (Azul, Verde, Naranja, Roja, Gratuita con límite) con cuenta atrás hasta el próximo cambio de estado.
- **Detección GPS 100% offline** (Haversine contra el catálogo local, sin llamadas a APIs externas).
- **Motor de horarios completo:** husos `Europe/Madrid` y `Atlantic/Canary`, festivos nacionales (con cálculo dinámico de Semana Santa), festivos autonómicos, festivos locales y horarios especiales de agosto/verano.
- **Buscador instantáneo** sin tildes y lista de **ciudades favoritas**.
- **Instalable en iPhone sin jailbreak** desde Safari (*Compartir → Añadir a pantalla de inicio*).

## Desarrollo local

Requisitos: Node.js 20+ y pnpm.

```bash
pnpm install
pnpm dev
```

### Tests y build de producción

```bash
pnpm test
pnpm build
pnpm preview
```

## Despliegue automático en GitHub Pages

El repositorio incluye el workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), que detecta automáticamente el nombre del repositorio para configurar la ruta base (`VITE_BASE_PATH`), ejecuta los tests, compila la PWA y la despliega.

1. Crea un repositorio en GitHub (por ejemplo `ParkHour`) y sube la rama `main`:
   ```bash
   git init
   git add .
   git commit -m "Initial ParkHour PWA"
   git branch -M main
   git remote add origin https://github.com/<tu-usuario>/ParkHour.git
   git push -u origin main
   ```
2. En GitHub, ve a **Settings → Pages → Build and deployment → Source** y selecciona **GitHub Actions**.
3. Al finalizar el workflow, abre `https://<tu-usuario>.github.io/ParkHour/` en **Safari** en tu iPhone y pulsa **Compartir → Añadir a pantalla de inicio**.

> **Nota:** Los horarios son orientativos. Comprueba siempre la señalización vertical y el parquímetro antes de estacionar.
