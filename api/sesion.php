<?php
// Cuentas: registrar, entrar, salir y reenviar el correo de verificación.
require __DIR__ . '/base.php';
require __DIR__ . '/correo.php';
api_json();
exigir_csrf();

$d = entrada();
$accion = $d['accion'] ?? '';
$correo = mb_strtolower(texto($d, 'correo', 160));

function mandar_verificacion(int $id, string $nombre, string $correo): array
{
    $token = bin2hex(random_bytes(32));
    bd()->prepare('UPDATE usuarios SET token = ?, token_expira = ? WHERE id = ?')
        ->execute([hash('sha256', $token), date('Y-m-d H:i:s', time() + 86400), $id]);

    $enlace = url_sitio() . '/verificar.php?token=' . $token;
    $enviado = enviar_correo($correo, 'Confirma tu cuenta', correo_verificacion($nombre, $enlace));

    $r = ['ok' => true, 'mensaje' => "Te enviamos un correo a $correo. Abre el enlace para activar tu cuenta."];
    if (MODO_PRUEBA) {
        $r['enlace_prueba'] = $enlace;
    } elseif (!$enviado) {
        fallo('No pudimos enviar el correo de verificación. Intenta más tarde.', 500);
    }
    return $r;
}

if ($accion === 'registrar') {
    $nombre = texto($d, 'nombre', 80);
    $clave = (string)($d['clave'] ?? '');

    if ($nombre === '') fallo('Escribe tu nombre.');
    if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) fallo('Ese correo no parece válido.');
    if (strlen($clave) < 8) fallo('La contraseña debe tener al menos 8 caracteres.');

    $s = bd()->prepare('SELECT id, verificado FROM usuarios WHERE correo = ?');
    $s->execute([$correo]);
    $existe = $s->fetch();

    if ($existe && $existe['verificado']) {
        fallo('Ya hay una cuenta con ese correo. Inicia sesión.');
    }
    $hash = password_hash($clave, PASSWORD_DEFAULT);
    if ($existe) {
        bd()->prepare('UPDATE usuarios SET nombre = ?, clave = ? WHERE id = ?')->execute([$nombre, $hash, $existe['id']]);
        $id = (int)$existe['id'];
    } else {
        bd()->prepare('INSERT INTO usuarios (nombre, correo, clave) VALUES (?, ?, ?)')->execute([$nombre, $correo, $hash]);
        $id = (int)bd()->lastInsertId();
    }
    responder(mandar_verificacion($id, $nombre, $correo));
}

if ($accion === 'reenviar') {
    $s = bd()->prepare('SELECT id, nombre FROM usuarios WHERE correo = ? AND verificado = 0');
    $s->execute([$correo]);
    $u = $s->fetch();
    if (!$u) fallo('No hay una cuenta pendiente de verificar con ese correo.');
    responder(mandar_verificacion((int)$u['id'], $u['nombre'], $correo));
}

if ($accion === 'entrar') {
    // freno sencillo contra intentos automáticos
    $_SESSION['intentos'] = ($_SESSION['intentos'] ?? 0) + 1;
    if ($_SESSION['intentos'] > 5) {
        sleep(2);
    }

    $s = bd()->prepare('SELECT id, clave, verificado FROM usuarios WHERE correo = ?');
    $s->execute([$correo]);
    $u = $s->fetch();

    if (!$u || !password_verify((string)($d['clave'] ?? ''), $u['clave'])) {
        fallo('Correo o contraseña incorrectos.', 401);
    }
    if (!$u['verificado']) {
        fallo('Tu cuenta aún no está verificada. Revisa tu correo.', 403, ['sin_verificar' => true]);
    }
    session_regenerate_id(true);
    $_SESSION['uid'] = $u['id'];
    $_SESSION['intentos'] = 0;
    responder(['ok' => true]);
}

if ($accion === 'salir') {
    $_SESSION = [];
    session_destroy();
    responder(['ok' => true]);
}

fallo('Acción desconocida.');
