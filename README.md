# Catálogo web de autos seminuevos y autopartes

Sitio web para un negocio que vende autos seminuevos y autos para desarme (autopartes). Los clientes buscan, arman una lista de lo que les interesa y cierran el trato por WhatsApp; el dueño administra todo desde un panel propio.

> Proyecto de portafolio, sin publicar en producción. Los datos de contacto y el nombre del negocio que trae el código son de ejemplo.

## Qué hace

**Lado cliente**
- Dos secciones: **Seminuevos** (precio, fotos y ficha técnica) y **Autopartes** (autos para desarme con su lista de piezas y disponibilidad).
- Filtros por marca, modelo, año y precio máximo, y búsqueda de piezas.
- Galería de fotos por vehículo.
- **Tickets:** el cliente arma una lista, se genera un folio y la envía por WhatsApp. No hay carrito ni pagos.
- Cuenta de cliente con verificación por correo, favoritos y vistos recientemente.

**Lado dueño**
- Panel para agregar y editar vehículos, fotos y piezas.
- Consulta de tickets y edición de los datos del negocio (WhatsApp, teléfono, dirección, horario).

## Tecnologías

- HTML, CSS y JavaScript (sin frameworks)
- PHP 8 con PDO (API en `api/*.php`)
- MySQL
- Docker y Docker Compose (Apache + MySQL 8)

## Seguridad

- Consultas preparadas (PDO) en toda la API.
- Contraseñas con `password_hash`.
- Token CSRF en los formularios.
- Tokens de verificación guardados como hash SHA-256 y con vencimiento.
- La carpeta `subidas/` no ejecuta código y `storage/` es privada (`.htaccess`).

## Cómo correrlo

### Con Docker

```bash
docker compose up --build
```

1. Abre `http://localhost:8080/instalar.php`, crea la cuenta del dueño y, si quieres, marca la opción de vehículos de ejemplo.
2. El sitio queda en `http://localhost:8080/` y el panel del dueño en `http://localhost:8080/panel.html`.

En modo de prueba (`MODO_PRUEBA = true`) los correos no se envían: el enlace de verificación aparece en pantalla.

### Con XAMPP

1. Copia esta carpeta dentro de `htdocs`.
2. Inicia Apache y MySQL.
3. Abre `http://localhost/<nombre-de-la-carpeta>/instalar.php` y crea la cuenta del dueño.

`api/config.php` trae los valores de prueba locales (usuario `root` sin contraseña). Si lo publicas en un servidor, usa tus propios datos y **no los subas a GitHub**. Al terminar de instalar, borra `instalar.php` del servidor.

## Estructura

```
├── api/            API en PHP (vehículos, tickets, sesión, favoritos, panel)
├── css/            Estilos
├── js/             Lógica del sitio (app.js) y del panel (panel.js)
├── docker/         Configuración para Docker
├── img/            Logotipo e íconos
├── index.html      Inicio
├── seminuevos.html, autopartes.html, detalle.html, ticket.html, cuenta.html
├── panel.html      Panel del dueño
└── instalar.php    Instalador (se usa una sola vez)
```

## Autor

Marco Octavio Blancas Guzmán
