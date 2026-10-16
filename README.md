# Tiquea

Tiquea es una app web para dividir cuentas entre personas, con soporte para modo rápido, modo detallado y escaneo de recibos con IA.

## Descripción

La aplicación permite:
- dividir el total entre varios comensales
- asignar consumos por persona en modo detallado
- escanear tickets o recibos con IA
- compartir el resultado por WhatsApp
- exportar el resumen como imagen
- conservar un historial local de las últimas cuentas

## Stack

- React + TypeScript
- Vite
- Tailwind CSS
- Lucide React
- Zod para validación de datos

## Seguridad y privacidad

La base del proyecto incluye medidas de seguridad y privacidad mínimas para uso web:

- validación de entrada con Zod
- mensaje de error global con ErrorBoundary
- almacenamiento local minimalista y controlado
- manejo de errores en lectura/escritura de localStorage
- banner de consentimiento de cookies
- secciones legales para privacidad, cookies, términos, seguridad, delivery y contacto

### Consideraciones importantes para producción

Antes de lanzar a producción, se recomienda:

1. Revisar y personalizar contacto, correo, teléfono y URL del sitio.
2. Definir la base legal exacta según país o región de operación.
3. Añadir consentimiento granulado para cookies y analítica de terceros.
4. Evitar guardar imágenes o documentos sensibles en localStorage.
5. Usar un backend seguro si se requiere procesamiento de archivos, pagos o autenticación.
6. Mantener copias de seguridad y monitoreo de incidencias.

## Legal

El proyecto incluye el contenido base de:
- Aviso de Privacidad
- Política de Cookies
- Términos y Condiciones
- Política de Delivery
- Política de Seguridad
- Contacto y derechos ARCO

Estos textos están centralizados en:
- `src/config/legalContent.ts`
- `src/hooks/useLegalConsent.ts`
- `src/components/LegalModal.tsx`
- `src/components/CookieConsentBanner.tsx`

## Estructura general

```text
src/
  components/
  config/
  domain/
  hooks/
  services/
  app/
  App.tsx
```

## Ejecutar localmente

```bash
npm install
npm run dev
```

## Configurar el escáner con IA

Configura las claves como variables de entorno del backend (por ejemplo, en Vercel):

- `GEMINI_API_KEY`: proveedor principal.
- `OPENAI_API_KEY`: proveedor de respaldo opcional.

El escáner usa Gemini mientras esté disponible y cambia automáticamente a OpenAI si Gemini alcanza su cuota o no responde. Si solo se configura `OPENAI_API_KEY`, OpenAI se usa como proveedor principal. No coloques estas claves en el código del frontend.

### Desarrollo local

Las variables configuradas en Vercel se usan en el sitio desplegado y no se copian automáticamente a VS Code. Si ejecutas el backend localmente con Vercel CLI (`vercel dev`), configura las variables locales en `.env.local`; ese archivo está excluido de Git para evitar publicar las claves.

### Vercel

Si `GEMINI_API_KEY` ya está configurada y funciona, déjala como está. Solo agrega `OPENAI_API_KEY` en esa misma pantalla: **Project → Settings → Environment Variables**. Es una variable separada; no reemplaces ni vuelvas a pegar la clave de Gemini. Selecciona los entornos deseados y vuelve a desplegar el proyecto.

## Compilar

```bash
npm run build
```

## Recomendación final

La app ya tiene una base funcional y una capa legal imprescindible para un lanzamiento inicial, pero la versión final de producción debe revisarse con asesoría legal específica para el país y modelo de negocio real.
