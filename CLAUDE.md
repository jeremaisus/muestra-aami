# muestra-aami

App interna para organizar la muestra de fin de año de la escuela de música AAMI.

## Contexto
Leer ESTADO.md antes de escribir código. Contiene las reglas de negocio
completas, los roles, las pantallas y la dirección visual.

## Stack
Node.js + Express + Supabase + JWT en cookie httpOnly.
Sin framework de frontend: HTML/CSS/JS servido por Express.
Deploy: GitHub -> VPS Hostinger.

## Convenciones
- Todas las tablas llevan prefijo muestra_
- El esquema está en db/muestra_schema.sql y es la fuente de verdad
- Toda autorización pasa por el backend, no por RLS
- Nunca escribir credenciales en el código: van en .env
- Actualizar el checklist de ESTADO.md al terminar cada bloque

## Diseño
Antes de generar cualquier componente, usar el skill ui-ux-pro-max con el
brief que está en la sección "Dirección visual" de ESTADO.md.
Un componente por vez, revisando entre uno y otro.
