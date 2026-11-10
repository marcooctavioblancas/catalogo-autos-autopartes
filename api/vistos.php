<?php
// Vistos recientemente de la cuenta (para retomarlos en otro dispositivo): POST {vehiculo_id}
require __DIR__ . '/base.php';
api_json();
exigir_csrf();

$u = exigir_sesion();
$vid = (int)(entrada()['vehiculo_id'] ?? 0);

$s = bd()->prepare('SELECT 1 FROM vehiculos WHERE id = ?');
$s->execute([$vid]);
if (!$s->fetch()) fallo('Ese vehículo ya no existe.', 404);

bd()->prepare('INSERT INTO vistos (usuario_id, vehiculo_id, visto) VALUES (?, ?, NOW())
               ON DUPLICATE KEY UPDATE visto = NOW()')->execute([$u['id'], $vid]);
responder(['ok' => true]);
