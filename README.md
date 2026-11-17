# API Delicia CRM · Node + Express + PostgreSQL (Neon)

Backend del caso académico **Pastelería Delicia**. Expone una API REST que consumen dos frontends en React:

- `app_web_crm_react_cliente`: la tienda del cliente (catálogo, pedido, seguimiento).
- `app_web_crm_react_adm_emp`: el CRM interno del administrador y el empleado.

Los datos viven en **Neon PostgreSQL** y las fotos de los productos en **Neon Object Storage**.

---

## 1. Vista general

```mermaid
flowchart LR
    C["App cliente<br/>React :5173"] -- "HTTP + JSON" --> API
    A["App adm/emp<br/>React :5174"] -- "HTTP + JSON + token" --> API
    API["API Node / Express<br/>:3000"] -- "SQL con $1, $2" --> DB[("Neon PostgreSQL")]
    C -. "carga las fotos" .-> S[("Neon Object Storage<br/>bucket productos")]
```

- Los frontends **nunca** se conectan a la base de datos: solo hablan con la API.
- Solo la API conoce la base de datos, así que las reglas del negocio y la seguridad viven en un solo lugar.
- La base guarda la **URL** de cada foto (`imagen_url`), no la foto. El navegador descarga la imagen directamente del bucket público.

---

## 2. Arquitectura por capas

Cada carpeta responde **una sola pregunta**, y cada capa **solo habla con la de abajo**.

```mermaid
flowchart TB
    R["Petición HTTP<br/>GET /api/productos"] --> APP
    APP["app.js<br/>cors · JSON · monta las rutas"] --> RT
    RT["routes/<br/>¿qué URL existe?"] --> MW
    MW["middlewares/<br/>¿puede pasar? token y rol"] --> CT
    CT["controllers/<br/>lee req, responde res"] --> SV
    SV["services/<br/>reglas del negocio"] --> RP
    RP["repositories/<br/>solo SQL"] --> DB[("PostgreSQL")]
    SV -. "throw AppError" .-> EH["errorHandler<br/>400 · 401 · 403 · 404 · 409"]
```

| Capa | Carpeta | Responde a… | Qué **no** hace |
|---|---|---|---|
| Arranque | `server.js` | ¿En qué puerto escucho? | No configura Express |
| Aplicación | `app.js` | ¿Qué middlewares y rutas existen? | No tiene lógica |
| Configuración | `config/` | ¿A qué base me conecto? | — |
| Rutas | `routes/` | ¿Qué URL atiende cada función? | No valida ni consulta |
| Filtros | `middlewares/` | ¿Trae token? ¿Tiene el rol? ¿Cómo respondo un error? | No conoce las tablas |
| Controladores | `controllers/` | ¿Qué llegó en `req` y qué respondo en `res`? | No escribe SQL ni reglas |
| Servicios | `services/` | ¿Qué reglas se cumplen? (precio, código, estados) | No escribe SQL |
| Repositorios | `repositories/` | ¿Qué SQL se ejecuta? | No toma decisiones de negocio |
| Utilidades | `utils/` | Herramientas que usan varias capas | — |

**Por qué así:** cada capa cambia por una sola razón. Si mañana cambia la base de datos, solo se toca `repositories/`. Si cambia una regla del negocio, solo `services/`. Si se agrega una URL, solo `routes/` y `controllers/`.

> Cuando un endpoint no tiene reglas de negocio (por ejemplo, listar productos), el controller puede llamar directo al repository. Apenas aparezca una regla, se agrega el service.

---

## 3. Estructura de carpetas

```
app_web_crm_node_api/
├── .env                      ← tus claves (NO se sube a GitHub)
├── .env.example              ← plantilla sin claves
├── package.json              ← dependencias y scripts
├── database/
│   ├── schema.sql            ← tablas del caso completo
│   └── init.js               ← crea tablas y datos de prueba (borra todo)
└── src/
    ├── server.js             ← enciende el servidor
    ├── app.js                ← arma Express y monta las rutas
    ├── config/
    │   └── db.js             ← pool de conexión a Neon
    ├── routes/
    │   ├── productos.routes.js     GET /api/productos
    │   ├── pedidos.routes.js       (siguiente etapa)
    │   ├── auth.routes.js          (siguiente etapa)
    │   └── gestion.routes.js       (siguiente etapa)
    ├── controllers/
    │   └── productos.controller.js
    ├── services/
    │   ├── pedidos.service.js      (siguiente etapa)
    │   └── auth.service.js         (siguiente etapa)
    ├── repositories/
    │   └── productos.repository.js
    ├── middlewares/
    │   ├── errorHandler.js
    │   ├── auth.js                 (siguiente etapa)
    │   └── requireRol.js           (siguiente etapa)
    └── utils/
        ├── asyncHandler.js
        ├── AppError.js
        └── validaciones.js
```

---

## 4. El recorrido de una petición

Ejemplo real del catálogo: `GET /api/productos`.

```mermaid
sequenceDiagram
    participant React as React (useProductos)
    participant Route as productos.routes.js
    participant Ctrl as productos.controller.js
    participant Repo as productos.repository.js
    participant DB as Neon PostgreSQL

    React->>Route: GET /api/productos
    Route->>Ctrl: ctrl.listar
    Ctrl->>Repo: listarActivos()
    Repo->>DB: SELECT id, nombre, descripcion, precio, imagen_url ...
    DB-->>Repo: filas
    Repo-->>Ctrl: arreglo de productos
    Ctrl-->>React: 200 · JSON
```

Respuesta:

```json
[
  {
    "id": 1,
    "nombre": "Torta de chocolate de 18 porciones",
    "descripcion": "Insumos de calidad",
    "precio": 120,
    "imagen_url": "https://<branch>.storage.c-8.us-east-2.aws.neon.tech/productos/Torta_Chocolate.jpg"
  }
]
```

---

## 5. Instalación y ejecución local

Requisito: **Node.js 20.19 o superior** (`node -v`).

```powershell
cd app_web_crm_node_api
npm install
copy .env.example .env      # en Mac/Linux: cp .env.example .env
```

Completa el `.env` con **tu propio proyecto Neon**:

```
DATABASE_URL=postgresql://usuario:password@ep-xxxx-pooler.c-0.us-east-2.aws.neon.tech/neondb?sslmode=require
DB_SSL=true
PORT=3000
JWT_SECRET=cambia_esta_clave
```

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Cadena de conexión de Neon (*Connect → Postgres database*). Deja solo `?sslmode=require` al final |
| `DB_SSL` | `true` para Neon, `false` para PostgreSQL local |
| `PORT` | Puerto local. En Render no se define: lo asigna Render |
| `JWT_SECRET` | Clave para firmar los tokens de sesión (siguiente etapa) |

Enciende la API:

```powershell
npm run dev      # desarrollo: reinicia al guardar (nodemon)
npm start        # producción: lo que usa Render
```

Comprueba:

- `http://localhost:3000/api/salud` → `{"ok":true}`
- `http://localhost:3000/api/productos` → lista de productos

---

## 6. Base de datos

### Tabla actual: `productos`

Se crea en el **SQL Editor** de Neon:

```sql
CREATE TABLE productos (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(80)  NOT NULL,
  descripcion VARCHAR(200) NOT NULL,
  precio      NUMERIC(8,2) NOT NULL CHECK (precio > 0),
  imagen_url  VARCHAR(400),            -- URL de la foto en el bucket, no la foto
  activo      BOOLEAN DEFAULT TRUE
);
```

### Modelo completo (siguiente etapa)

```mermaid
erDiagram
    clientes ||--o{ pedidos : "hace"
    productos ||--o{ pedidos : "incluye"
    pedidos ||--o{ pedido_estados : "registra"
    usuarios ||--o{ pedido_estados : "cambia"

    productos {
        int id PK
        string nombre
        numeric precio
        string imagen_url
    }
    clientes {
        int id PK
        string nombre
        string celular
    }
    pedidos {
        int id PK
        string codigo
        int cliente_id FK
        int producto_id FK
        timestamp fecha_entrega
        string estado
    }
    pedido_estados {
        int id PK
        int pedido_id FK
        string estado
        int usuario_id FK
        timestamp fecha
    }
    usuarios {
        int id PK
        string email
        string rol
    }
```

`pedido_estados` es la **trazabilidad**: una fila por cada cambio de estado, con quién lo hizo y cuándo (`usuario_id = NULL` significa que lo registró el cliente).

> **Cuidado:** `npm run db:init` borra las tablas y las vuelve a crear con datos de prueba. No lo ejecutes en una base que tenga tus productos con imágenes.

---

## 7. Imágenes en Neon Object Storage

```mermaid
flowchart LR
    U["Subir foto<br/>Consola Neon · Upload"] --> B[("Bucket productos<br/>visibilidad Public")]
    B -- "URL pública" --> SQL["UPDATE productos<br/>SET imagen_url = ..."]
    SQL --> API["GET /api/productos<br/>devuelve imagen_url"]
    API --> IMG["React: img src = imagen_url"]
```

1. En Neon: **Object storage → Create bucket**, nombre `productos`, visibilidad **Public** (no se puede cambiar después).
2. Entra al bucket y usa **Upload** para subir las fotos.
3. El endpoint está en **Connect → Storage → `.env` → `AWS_ENDPOINT_URL_S3`**.
4. La URL de cada foto es `<endpoint>/productos/<nombre-del-archivo>`. Respeta mayúsculas y extensión.
5. Guarda esa URL en `productos.imagen_url`.

Las claves `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` **no se usan** para mostrar fotos de un bucket público. No las pongas en el código ni las compartas.

---

## 8. Seguridad aplicada

| Práctica | Dónde | Por qué |
|---|---|---|
| **SQL parametrizado** (`$1`, `$2`) | `repositories/` | Evita la inyección SQL: los datos del usuario nunca se pegan dentro del texto SQL |
| `.env` fuera de Git | `.gitignore` | Las contraseñas no llegan a GitHub. Se comparte solo `.env.example` |
| Precio calculado en el servidor | `services/` | El total que envía el navegador se ignora |
| Contraseñas con bcrypt | `auth.service.js` | Nunca se guardan en texto plano (siguiente etapa) |
| Rol validado en la API | `requireRol.js` | Ocultar un botón en React no es seguridad; la API responde 403 |
| Errores centralizados | `errorHandler.js` | Mensajes claros sin exponer detalles internos |

```js
// Vulnerable: nunca
pool.query(`SELECT * FROM pedidos WHERE codigo = '${codigo}'`);

// Seguro: siempre
pool.query('SELECT * FROM pedidos WHERE codigo = $1', [codigo]);
```

---

## 9. Cómo agregar un endpoint nuevo

Siempre **de abajo hacia arriba**. Ejemplo: `GET /api/productos/:id`.

```mermaid
flowchart LR
    A["1 · repository<br/>buscarPorId(id)"] --> B["2 · controller<br/>detalle(req, res)"]
    B --> C["3 · routes<br/>router.get('/:id')"]
    C --> D["4 · probar<br/>/api/productos/1"]
```

```js
// 1. repositories/productos.repository.js
export async function buscarPorId(id) {
  const { rows } = await pool.query(
    'SELECT id, nombre, descripcion, precio, imagen_url FROM productos WHERE id = $1 AND activo',
    [id]
  );
  return rows[0];
}

// 2. controllers/productos.controller.js
export const detalle = asyncHandler(async (req, res) => {
  const producto = await productosRepo.buscarPorId(Number(req.params.id));
  if (!producto) return res.status(404).json({ mensaje: 'Producto no encontrado' });
  res.json(producto);
});

// 3. routes/productos.routes.js
router.get('/:id', ctrl.detalle);
```

---

## 10. Despliegue en Render

**New → Web Service** → repositorio `app_web_crm_pasteleria_delicia`:

| Campo | Valor |
|---|---|
| Root Directory | `app_web_crm_node_api` |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Region | Ohio (la misma región que Neon) |
| Environment | `DATABASE_URL`, `DB_SSL=true`, `JWT_SECRET` |

- No definas `PORT`: Render lo asigna y `server.js` lo lee de `process.env.PORT`.
- Cada `git push` a `main` vuelve a desplegar automáticamente.
- El plan Free se duerme tras 15 minutos sin uso; la primera petición tarda unos 50 segundos.

---

## 11. Errores frecuentes

| Mensaje | Causa | Solución |
|---|---|---|
| `[nodemon] clean exit - waiting for changes` | `server.js` está vacío | Pega el código de `server.js` |
| `does not provide an export named 'default'` | El archivo importado está vacío | Revisa el archivo que menciona el error |
| `does not provide an export named 'asyncHandler'` | `utils/asyncHandler.js` vacío | Agrega su línea `export const asyncHandler = ...` |
| `EADDRINUSE :3000` | El puerto ya está ocupado | Cierra el otro servidor (Ctrl + C) |
| Error de SSL o conexión | `DATABASE_URL` incompleta | Copia la cadena completa de Neon con `?sslmode=require` |
| El frontend muestra "No pudimos conectar…" | La API no está encendida | Revisa `npm run dev` y `/api/salud` |
| La foto no se ve (403) | El bucket es privado | Crea el bucket con visibilidad **Public** |

Para encontrar archivos vacíos:

```powershell
dir src -Recurse -File | Select-Object Length, FullName
```

---

## 12. Hoja de ruta

- [x] Catálogo de productos con imágenes desde Neon (`GET /api/productos`)
- [ ] Pedido del cliente con código `DEL-0001` (`POST /api/pedidos`)
- [ ] Seguimiento del pedido con código + celular
- [ ] Login con JWT y roles (administrador / empleado)
- [ ] Tablero del empleado y cambio de estados con trazabilidad
- [ ] Resumen e historial del administrador

---

**Caso académico · Pastelería Delicia** · Desarrollo Web · Datos de demostración
