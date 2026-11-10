<?php
// Instalación (se usa una sola vez): crea las tablas, los ejemplos y la cuenta del dueño.
// Cuando ya existe un dueño, esta página deja de hacer cambios. Bórrala del servidor al terminar.
require_once __DIR__ . '/api/config.php';

$mensajes = [];
$error = '';
$listo = false;

try {
    // en XAMPP la base se crea sola; en Hostinger ya viene creada desde hPanel
    try {
        $raiz = new PDO('mysql:host=' . BD_HOST . ';charset=utf8mb4', BD_USUARIO, BD_CLAVE);
        $raiz->exec('CREATE DATABASE IF NOT EXISTS `' . BD_NOMBRE . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    } catch (Throwable $e) {
    }

    require __DIR__ . '/api/base.php';
    $pdo = bd();

    foreach (array_filter(array_map('trim', explode(';', file_get_contents(__DIR__ . '/api/esquema.sql')))) as $sql) {
        $pdo->exec($sql);
    }
    // cambios a tablas de instalaciones anteriores (si la columna ya existe, se ignora)
    foreach (['ALTER TABLE fotos ADD COLUMN portada TINYINT(1) NOT NULL DEFAULT 0'] as $sql) {
        try {
            $pdo->exec($sql);
        } catch (Throwable $e) {
        }
    }
    $mensajes[] = 'Tablas listas.';

    foreach (['subidas', 'storage'] as $carpeta) {
        if (!is_dir(__DIR__ . "/$carpeta")) {
            mkdir(__DIR__ . "/$carpeta", 0755, true);
        }
    }

    $hayDueno = (bool)$pdo->query("SELECT 1 FROM usuarios WHERE rol = 'dueno' LIMIT 1")->fetch();

    if (!$hayDueno && $_SERVER['REQUEST_METHOD'] === 'POST' && hash_equals(csrf(), $_POST['csrf'] ?? '')) {
        $nombre = trim($_POST['nombre'] ?? '');
        $correo = mb_strtolower(trim($_POST['correo'] ?? ''));
        $clave = (string)($_POST['clave'] ?? '');

        if ($nombre === '' || !filter_var($correo, FILTER_VALIDATE_EMAIL) || strlen($clave) < 8) {
            $error = 'Revisa los datos: nombre, un correo válido y contraseña de 8 caracteres o más.';
        } else {
            $pdo->prepare("INSERT INTO usuarios (nombre, correo, clave, rol, verificado) VALUES (?, ?, ?, 'dueno', 1)
                           ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), clave = VALUES(clave), rol = 'dueno', verificado = 1")
                ->execute([$nombre, $correo, password_hash($clave, PASSWORD_DEFAULT)]);
            $hayDueno = true;
            $mensajes[] = 'Cuenta del dueño creada.';

            if (!empty($_POST['ejemplos']) && !$pdo->query('SELECT 1 FROM vehiculos LIMIT 1')->fetch()) {
                sembrar_ejemplos($pdo);
                $mensajes[] = 'Vehículos de ejemplo agregados.';
            }
        }
    }
    $listo = $hayDueno;
} catch (Throwable $e) {
    $error = 'No se pudo conectar a la base de datos. Revisa los datos en api/config.php. (' . $e->getMessage() . ')';
}

function sembrar_ejemplos(PDO $pdo): void
{
    $v = $pdo->prepare('INSERT INTO vehiculos (tipo, marca, modelo, version, anio, precio, km, transmision, combustible, motor, color, puertas, duenos, descripcion, estado, creado)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $p = $pdo->prepare('INSERT INTO partes (vehiculo_id, nombre, categoria, codigo, precio, estado) VALUES (?, ?, ?, ?, ?, ?)');
    $hace = fn(int $dias) => date('Y-m-d H:i:s', time() - $dias * 86400);

    $v->execute(['seminuevo', 'Nissan', 'Versa', 'Advance', 2020, 229000, 48500, 'Automática CVT', 'Gasolina', '1.6 L · 4 cilindros', 'Gris Oxford', 4, 'Único dueño',
        'Factura original, servicios de agencia y llantas a media vida. Todo pagado, listo para cambio de propietario.', 'disponible', $hace(1)]);
    $v->execute(['seminuevo', 'Volkswagen', 'Jetta', 'Comfortline', 2019, 285000, 71200, 'Automática Tiptronic', 'Gasolina', '1.4 L Turbo · 4 cilindros', 'Blanco Puro', 4, 'Dos dueños',
        'Pantalla táctil, cámara de reversa y rines de aluminio. Sin adeudos, se entrega con verificación vigente.', 'apartado', $hace(6)]);

    $v->execute(['autopartes', 'Chevrolet', 'Aveo', 'LT', 2015, null, null, 'Manual 5 velocidades', 'Gasolina', '1.6 L · 4 cilindros', 'Rojo', 4, '',
        'Golpe trasero. Motor, caja y frente completos en buen estado.', 'disponible', $hace(0)]);
    $aveo = (int)$pdo->lastInsertId();
    foreach ([
        ['Motor completo 1.6 L', 'Motor y caja', 'AV15-001', 18500, 'existencia'],
        ['Caja de velocidades manual', 'Motor y caja', 'AV15-002', 7800, 'existencia'],
        ['Alternador', 'Sistema eléctrico', 'AV15-003', 1450, 'agotado'],
        ['Faro delantero izquierdo', 'Iluminación', 'AV15-004', 950, 'existencia'],
        ['Faro delantero derecho', 'Iluminación', 'AV15-005', 950, 'existencia'],
        ['Cofre', 'Carrocería', 'AV15-006', 2600, 'existencia'],
        ['Facia delantera', 'Carrocería', 'AV15-007', 1900, 'agotado'],
        ['Puerta delantera derecha', 'Carrocería', 'AV15-008', 2200, 'existencia'],
        ['Radiador', 'Enfriamiento', 'AV15-009', 1200, 'existencia'],
        ['Tablero de instrumentos', 'Interiores', 'AV15-010', 1600, 'agotado'],
    ] as $parte) {
        $p->execute([$aveo, ...$parte]);
    }

    $v->execute(['autopartes', 'Ford', 'Fiesta', 'SE Sedán', 2014, null, null, 'Automática PowerShift', 'Gasolina', '1.6 L · 4 cilindros', 'Plata', 4, '',
        'Golpe frontal. Parte trasera, puertas e interiores completos.', 'disponible', $hace(4)]);
    $fiesta = (int)$pdo->lastInsertId();
    foreach ([
        ['Tapa de cajuela', 'Carrocería', 'FI14-001', 2400, 'existencia'],
        ['Defensa trasera', 'Carrocería', 'FI14-002', 1700, 'existencia'],
        ['Puerta trasera izquierda', 'Carrocería', 'FI14-003', 2100, 'existencia'],
        ['Calavera izquierda', 'Iluminación', 'FI14-004', 780, 'agotado'],
        ['Calavera derecha', 'Iluminación', 'FI14-005', 780, 'existencia'],
        ['Asientos delanteros (par)', 'Interiores', 'FI14-006', 3500, 'existencia'],
        ['Volante con bolsa de aire', 'Interiores', 'FI14-007', 2900, 'agotado'],
        ['Módulo de transmisión (TCM)', 'Sistema eléctrico', 'FI14-008', 4200, 'agotado'],
        ['Rines de aluminio 15" (juego)', 'Suspensión y ruedas', 'FI14-009', 4800, 'existencia'],
    ] as $parte) {
        $p->execute([$fiesta, ...$parte]);
    }
}
?>
<!DOCTYPE html>
<html lang="es-MX">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Instalación — IGRIS</title>
  <link rel="stylesheet" href="css/estilos.css">
</head>
<body>
  <main class="contenedor contenedor--angosto" style="padding:48px 0">
    <h1 style="font-size:44px">Instalación del sitio</h1>

    <?php foreach ($mensajes as $m): ?>
      <p class="aviso aviso--bien"><?= htmlspecialchars($m) ?></p>
    <?php endforeach; ?>
    <?php if ($error): ?>
      <p class="aviso aviso--mal"><?= htmlspecialchars($error) ?></p>
    <?php endif; ?>

    <?php if ($listo): ?>
      <div class="caja">
        <h2>Todo listo</h2>
        <p>El sitio ya tiene dueño y base de datos. <strong>Borra el archivo <code>instalar.php</code> del servidor.</strong></p>
        <p style="margin-top:16px"><a class="boton" href="cuenta.html">Iniciar sesión</a> <a class="boton boton--linea" href="index.html">Ver el sitio</a></p>
      </div>
    <?php elseif (!$error || isset($pdo)): ?>
      <form class="caja formulario" method="post" autocomplete="off">
        <h2>Cuenta del dueño</h2>
        <p>Con esta cuenta se entra al panel para agregar vehículos, fotos y piezas.</p>
        <input type="hidden" name="csrf" value="<?= htmlspecialchars(csrf()) ?>">
        <label class="campo">Nombre <input type="text" name="nombre" required maxlength="80"></label>
        <label class="campo">Correo <input type="email" name="correo" required maxlength="160"></label>
        <label class="campo">Contraseña (mínimo 8 caracteres) <input type="password" name="clave" required minlength="8"></label>
        <label class="casilla"><input type="checkbox" name="ejemplos" value="1" checked> Agregar vehículos de ejemplo</label>
        <button class="boton" type="submit">Crear cuenta e instalar</button>
      </form>
    <?php endif; ?>
  </main>
</body>
</html>
