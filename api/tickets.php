<?php
// Tickets de referencia (no son compras: el trato se cierra por WhatsApp).
//   POST {items:[{tipo:'vehiculo'|'parte', id}], nombre}  → crea el ticket
//   GET  ?folio=IG-XXXXXX                                 → consulta un ticket
//   GET  ?mios=1                                          → tickets de la cuenta
//   GET  ?folios=IG-AAAAAA,IG-BBBBBB                      → varios (los que guarda el navegador sin cuenta)
require __DIR__ . '/base.php';
api_json();

function ticket_completo(array $t): array
{
    $s = bd()->prepare('SELECT descripcion, precio FROM ticket_items WHERE ticket_id = ? ORDER BY id');
    $s->execute([$t['id']]);
    return [
        'folio'    => $t['folio'],
        'nombre'   => $t['nombre'],
        'total'    => $t['total'],
        'atendido' => (bool)$t['atendido'],
        'creado'   => $t['creado'],
        'items'    => $s->fetchAll(),
    ];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['mios'])) {
        $u = exigir_sesion();
        $s = bd()->prepare('SELECT * FROM tickets WHERE usuario_id = ? ORDER BY id DESC LIMIT 50');
        $s->execute([$u['id']]);
        responder(['tickets' => array_map('ticket_completo', $s->fetchAll())]);
    }
    if (isset($_GET['folios'])) {
        $folios = array_slice(array_filter(explode(',', strtoupper((string)$_GET['folios'])), fn($f) => preg_match('/^IG-[A-Z0-9]{6}$/', $f)), 0, 30);
        if (!$folios) responder(['tickets' => []]);
        $s = bd()->prepare('SELECT * FROM tickets WHERE folio IN (' . implode(',', array_fill(0, count($folios), '?')) . ') ORDER BY id DESC');
        $s->execute(array_values($folios));
        responder(['tickets' => array_map('ticket_completo', $s->fetchAll())]);
    }
    $s = bd()->prepare('SELECT * FROM tickets WHERE folio = ?');
    $s->execute([strtoupper(texto($_GET, 'folio', 12))]);
    $t = $s->fetch();
    if (!$t) fallo('No encontramos un ticket con ese folio.', 404);
    responder(['ticket' => ticket_completo($t)]);
}

exigir_csrf();
if ((usuario()['rol'] ?? '') === 'dueno') {
    fallo('La cuenta del dueño no genera tickets: es para administrar el sitio.', 403);
}
$d = entrada();
$pedidos = is_array($d['items'] ?? null) ? array_slice($d['items'], 0, 40) : [];

$items = [];
$total = 0;
foreach ($pedidos as $p) {
    $id = (int)($p['id'] ?? 0);
    if (($p['tipo'] ?? '') === 'vehiculo') {
        $s = bd()->prepare("SELECT marca, modelo, version, anio, precio FROM vehiculos
                            WHERE id = ? AND tipo = 'seminuevo' AND estado <> 'vendido'");
        $s->execute([$id]);
        if ($v = $s->fetch()) {
            $items[] = [trim("{$v['marca']} {$v['modelo']} {$v['version']}") . " {$v['anio']} (seminuevo)", (int)$v['precio']];
        }
    } else {
        $s = bd()->prepare("SELECT p.nombre, p.codigo, p.precio, v.marca, v.modelo, v.anio
                            FROM partes p JOIN vehiculos v ON v.id = p.vehiculo_id
                            WHERE p.id = ? AND p.estado = 'existencia'");
        $s->execute([$id]);
        if ($v = $s->fetch()) {
            $codigo = $v['codigo'] !== '' ? " [{$v['codigo']}]" : '';
            $items[] = ["{$v['nombre']}$codigo · {$v['marca']} {$v['modelo']} {$v['anio']}", (int)$v['precio']];
        }
    }
}
if (!$items) {
    fallo('Lo que elegiste ya no está disponible. Revisa tu lista.');
}
foreach ($items as $i) {
    $total += $i[1];
}

// folio corto y fácil de dictar: sin 0/O ni 1/I
$letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
$u = usuario();
$pdo = bd();
$pdo->beginTransaction();
do {
    $folio = 'IG-';
    for ($i = 0; $i < 6; $i++) {
        $folio .= $letras[random_int(0, strlen($letras) - 1)];
    }
    $s = $pdo->prepare('SELECT 1 FROM tickets WHERE folio = ?');
    $s->execute([$folio]);
} while ($s->fetch());

$pdo->prepare('INSERT INTO tickets (folio, usuario_id, nombre, total) VALUES (?, ?, ?, ?)')
    ->execute([$folio, $u['id'] ?? null, texto($d, 'nombre', 80), $total]);
$tid = (int)$pdo->lastInsertId();
$ins = $pdo->prepare('INSERT INTO ticket_items (ticket_id, descripcion, precio) VALUES (?, ?, ?)');
foreach ($items as $i) {
    $ins->execute([$tid, mb_substr($i[0], 0, 255), $i[1]]);
}
$pdo->commit();

responder(['folio' => $folio]);
