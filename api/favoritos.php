<?php
// Favoritos de la cuenta: POST {vehiculo_id, poner: true|false}
require __DIR__ . '/base.php';
api_json();
exigir_csrf();

$u = exigir_sesion();
$d = entrada();
$vid = (int)($d['vehiculo_id'] ?? 0);

if (!empty($d['poner'])) {
    $s = bd()->prepare('SELECT 1 FROM vehiculos WHERE id = ?');
    $s->execute([$vid]);
    if (!$s->fetch()) fallo('Ese vehículo ya no existe.', 404);
    bd()->prepare('INSERT IGNORE INTO favoritos (usuario_id, vehiculo_id) VALUES (?, ?)')->execute([$u['id'], $vid]);
} else {
    bd()->prepare('DELETE FROM favoritos WHERE usuario_id = ? AND vehiculo_id = ?')->execute([$u['id'], $vid]);
}
responder(['ok' => true]);
