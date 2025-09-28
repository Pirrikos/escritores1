# Instrucciones rápidas para agentes IA (resumen)

Objetivo: ayudar a un agente IA a hacerse productivo rápido en este repositorio.

1) Primeros pasos — archivos que inspeccionar inmediatamente
- package.json: obtener scripts (dev, start, build, test, lint).
- README.md: contexto del proyecto y comandos de alto nivel.
- src/ (o app/): estructura del código fuente — busca index.ts|js, app.ts|js, server.ts.
- rutas y controladores: src/routes, src/controllers — seguir flujo HTTP → router → controller → service.
- servicios y lógica de negocio: src/services o src/usecases.
- modelos y persistencia: src/models, prisma/, migrations/, db/*.
- Configuración: config/, .env.example, Dockerfile, docker-compose.yml.

2) Comandos esenciales (verifica package.json antes de ejecutar)
- Instalar dependencias: npm install (o yarn).
- Desarrollo local: npm run dev (o start:dev).
- Construir: npm run build.
- Tests: npm test (buscar jest, vitest, mocha).
- Linter/formateo: npm run lint, npm run format.

3) Patrones y convenciones observables
- Separación clara: routes → controllers → services → models. Mantener controladores delgados.
- Archivos de entrada típicos: src/index.ts o src/server.ts expone el servidor.
- Config por entorno: usar process.env y archivos .env (buscar .env.example).
- Tipos: si existe tsconfig.json, usar TypeScript y seguir tipos exportados en src/types o @types.
- Pruebas: busca directorios __tests__ o tests/ y archivos *.spec.ts|js.

4) Integraciones externas y puntos de atención
- Base de datos: busca prisma/schema.prisma, migrations/ o knexfile.js.
- APIs externas: busca clientes en src/clients, src/adapters o llamadas fetch/axios.
- Autenticación: revisar middleware auth en src/middleware o src/auth.
- Docker/CI: mirar Dockerfile y .github/workflows para pasos de CI.

5) Sugerencias prácticas para cambios de código
- Antes de modificar: ejecutar lint y tests locales.
- Mantener la forma del proyecto: seguir la nomenclatura existente (ej.: verbos en controllers, nombres en plural para tablas/colecciones).
- Para nuevas rutas: añadir test unitario y, si hay integración, actualizar e2e tests y docker-compose.

6) Búsquedas útiles desde el agente
- package.json
- README.md
- src/index.ts, src/app.ts, src/server.ts
- src/routes, src/controllers, src/services, src/models
- prisma/, migrations/, docker-compose.yml, Dockerfile
- jest.config.js, vitest.config.ts, tsconfig.json, .eslintrc

7) Al entregar un PR o patch
- Ejecutar: npm run lint && npm test
- Añadir pruebas para nueva lógica
- Mantener commits pequeños y mensajes claros (tipo: feat(routes): add GET /items)

Si algo en estas instrucciones queda poco claro o faltan rutas/archivos específicos del proyecto, indícame qué archivos quieres que inspeccione y ajustaré estas instrucciones.
