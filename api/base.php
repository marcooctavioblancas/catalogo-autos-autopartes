<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

date_default_timezone_set('America/Mexico_City');

if (session_status() === PHP_SESSION_NONE) {
    session_name('igris');
    session_set_cookie_params([
        'httponly' => true,
        'samesite' => 'Lax',
        'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    ]);
    session_start();
}

const AJUSTES_INICIALES = [
    'nombre'    => 'IGRIS',
    'whatsapp'  => '520000000000',
    'telefono'  => '00 0000 0000',
    'direccion' => 'Dirección del negocio, Ciudad, Estado',
    'horario'   => 'Lunes a sábado · 9:00 a 18:00',
    'mapa'      => 'Ciudad de México', // lo que se busca en el mapa: dirección exacta o coordenadas
];

function bd(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=' . BD_HOST . ';dbname=' . BD_NOMBRE . ';charset=utf8mb4',
            BD_USUARIO,
            BD_CLAVE,
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]
        );
        $pdo->exec("SET time_zone = '" . date('P') . "'");
    }
    return $pdo;
}

/* ---------- respuestas JSON ---------- */
function responder(array $datos, int $codigo = 200): never
{
    http_response_code($codigo);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fallo(string $mensaje, int $codigo = 400, array $extra = []): never
{
    responder(['error' => $mensaje] + $extra, $codigo);
}

function api_json(): void
{
    set_exception_handler(function (Throwable $e) {
        error_log('IGRIS: ' . $e->getMessage());
        fallo('Ocurrió un error en el servidor. Intenta de nuevo.', 500);
    });
}

function entrada(): array
{
    $datos = json_decode(file_get_contents('php://input') ?: '', true);
    return is_array($datos) ? $datos : [];
}

function texto(array $d, string $campo, int $max = 255): string
{
    return mb_substr(trim((string)($d[$campo] ?? '')), 0, $max);
}

/* ---------- sesión ---------- */
function csrf(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
    }
    return $_SESSION['csrf'];
}

function exigir_csrf(): void
{
    $recibido = $_SERVER['HTTP_X_CSRF'] ?? '';
    if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !hash_equals(csrf(), $recibido)) {
        fallo('La página caducó. Recárgala e intenta de nuevo.', 403);
    }
}

function usuario(): ?array
{
    static $u = false;
    if ($u === false) {
        $u = null;
        if (!empty($_SESSION['uid'])) {
            $s = bd()->prepare('SELECT id, nombre, correo, rol FROM usuarios WHERE id = ? AND verificado = 1');
            $s->execute([$_SESSION['uid']]);
            $u = $s->fetch() ?: null;
        }
    }
    return $u;
}

function exigir_sesion(): array
{
    return usuario() ?? fallo('Inicia sesión para continuar.', 401);
}

function exigir_dueno(): array
{
    $u = exigir_sesion();
    if ($u['rol'] !== 'dueno') {
        fallo('Esta sección es solo para el dueño del sitio.', 403);
    }
    return $u;
}

function url_sitio(): string
{
    if (URL_SITIO !== '') {
        return rtrim(URL_SITIO, '/');
    }
    $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    $carpeta = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/');
    $carpeta = preg_replace('#/api$#', '', $carpeta);
    return ($https ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'] . $carpeta;
}

/* ---------- datos ---------- */
function ajustes(): array
{
    $guardados = bd()->query('SELECT clave, valor FROM ajustes')->fetchAll(PDO::FETCH_KEY_PAIR);
    return array_intersect_key($guardados, AJUSTES_INICIALES) + AJUSTES_INICIALES;
}

function inventario(): array
{
    $fotos = [];
    foreach (bd()->query('SELECT id, vehiculo_id, archivo, vista FROM fotos ORDER BY portada DESC, id') as $f) {
        $fotos[$f['vehiculo_id']][] = ['id' => $f['id'], 'src' => 'subidas/' . $f['archivo'], 'vista' => $f['vista']];
    }
    $partes = [];
    foreach (bd()->query('SELECT id, vehiculo_id, nombre, categoria, codigo, precio, estado FROM partes ORDER BY id') as $p) {
        $vid = $p['vehiculo_id'];
        unset($p['vehiculo_id']);
        $partes[$vid][] = $p;
    }
    $lista = [];
    foreach (bd()->query('SELECT * FROM vehiculos ORDER BY creado DESC, id DESC') as $v) {
        $v['agregado'] = substr($v['creado'], 0, 10);
        $v['descripcion'] = $v['descripcion'] ?? '';
        $v['fotos'] = $fotos[$v['id']] ?? [];
        if ($v['tipo'] === 'autopartes') {
            $v['partes'] = $partes[$v['id']] ?? [];
        }
        unset($v['creado']);
        $lista[] = $v;
    }
    return $lista;
}

function sesion_publica(): ?array
{
    $u = usuario();
    if (!$u) {
        return null;
    }
    $s = bd()->prepare('SELECT vehiculo_id FROM favoritos WHERE usuario_id = ?');
    $s->execute([$u['id']]);
    $v = bd()->prepare('SELECT vehiculo_id FROM vistos WHERE usuario_id = ? ORDER BY visto DESC LIMIT 8');
    $v->execute([$u['id']]);
    return [
        'vistos'    => $v->fetchAll(PDO::FETCH_COLUMN),
        'nombre'    => $u['nombre'],
        'correo'    => $u['correo'],
        'rol'       => $u['rol'],
        'favoritos' => $s->fetchAll(PDO::FETCH_COLUMN),
    ];
}
