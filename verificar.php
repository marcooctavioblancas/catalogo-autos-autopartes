<?php
// Destino del enlace que llega por correo al crear una cuenta.
require __DIR__ . '/api/base.php';

$ok = 0;
$token = (string)($_GET['token'] ?? '');

try {
    if (preg_match('/^[0-9a-f]{64}$/', $token)) {
        $s = bd()->prepare('UPDATE usuarios SET verificado = 1, token = NULL, token_expira = NULL
                            WHERE token = ? AND token_expira > NOW()');
        $s->execute([hash('sha256', $token)]);
        $ok = $s->rowCount() === 1 ? 1 : 0;
    }
} catch (Throwable $e) {
    error_log('IGRIS: ' . $e->getMessage());
}

header('Location: cuenta.html?verificado=' . $ok);
