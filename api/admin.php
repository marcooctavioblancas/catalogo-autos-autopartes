<?php
// Panel del dueño: inventario, fotos, piezas, tickets y datos del negocio.
require __DIR__ . '/base.php';
api_json();
exigir_dueno();

const CARPETA_FOTOS = __DIR__ . '/../subidas';
const TIPOS_FOTO = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $tickets = bd()->query('SELECT t.*, u.correo FROM tickets t LEFT JOIN usuarios u ON u.id = t.usuario_id
                            ORDER BY t.id DESC LIMIT 200')->fetchAll();
    $items = bd()->prepare('SELECT descripcion, precio FROM ticket_items WHERE ticket_id = ? ORDER BY id');
    foreach ($tickets as &$t) {
        $items->execute([$t['id']]);
        $t['items'] = $items->fetchAll();
        $t['atendido'] = (bool)$t['atendido'];
        unset($t['usuario_id']);
    }
    responder(['tickets' => $tickets]);
}

exigir_csrf();

// la subida de fotos llega como formulario (multipart); lo demás como JSON
$d = !empty($_POST) || !empty($_FILES) ? $_POST : entrada();
$accion = $d['accion'] ?? '';
$id = (int)($d['id'] ?? 0);

function entero_o_nulo(array $d, string $campo): ?int
{
    $v = trim((string)($d[$campo] ?? ''));
    return $v === '' ? null : max(0, (int)$v);
}

function borrar_archivos(array $archivos): void
{
    foreach ($archivos as $a) {
        $ruta = CARPETA_FOTOS . '/' . basename($a);
        if (is_file($ruta)) {
            unlink($ruta);
        }
    }
}

switch ($accion) {
    case 'guardar_vehiculo':
        $tipo = ($d['tipo'] ?? '') === 'autopartes' ? 'autopartes' : 'seminuevo';
        $estado = in_array($d['estado'] ?? '', ['disponible', 'apartado', 'vendido'], true) ? $d['estado'] : 'disponible';
        $anio = (int)($d['anio'] ?? 0);

        if (texto($d, 'marca') === '' || texto($d, 'modelo') === '') fallo('Marca y modelo son obligatorios.');
        if ($anio < 1950 || $anio > (int)date('Y') + 1) fallo('Revisa el año del vehículo.');
        if ($tipo === 'seminuevo' && !entero_o_nulo($d, 'precio')) fallo('Un seminuevo necesita precio.');

        $campos = [
            'tipo' => $tipo, 'marca' => texto($d, 'marca', 60), 'modelo' => texto($d, 'modelo', 60),
            'version' => texto($d, 'version', 60), 'anio' => $anio,
            'precio' => entero_o_nulo($d, 'precio'), 'km' => entero_o_nulo($d, 'km'),
            'transmision' => texto($d, 'transmision', 60), 'combustible' => texto($d, 'combustible', 40),
            'motor' => texto($d, 'motor', 60), 'color' => texto($d, 'color', 40),
            'puertas' => entero_o_nulo($d, 'puertas'), 'duenos' => texto($d, 'duenos', 40),
            'descripcion' => texto($d, 'descripcion', 2000), 'estado' => $estado,
        ];
        if ($id) {
            unset($campos['tipo']); // el tipo no cambia una vez creado
            $sets = implode(', ', array_map(fn($c) => "$c = ?", array_keys($campos)));
            bd()->prepare("UPDATE vehiculos SET $sets WHERE id = ?")->execute([...array_values($campos), $id]);
        } else {
            $cols = implode(', ', array_keys($campos));
            $marcas = implode(', ', array_fill(0, count($campos), '?'));
            bd()->prepare("INSERT INTO vehiculos ($cols) VALUES ($marcas)")->execute(array_values($campos));
            $id = (int)bd()->lastInsertId();
        }
        responder(['id' => $id]);

    case 'estado_vehiculo':
        if (!in_array($d['estado'] ?? '', ['disponible', 'apartado', 'vendido'], true)) fallo('Estado inválido.');
        bd()->prepare('UPDATE vehiculos SET estado = ? WHERE id = ?')->execute([$d['estado'], $id]);
        responder(['ok' => true]);

    case 'borrar_vehiculo':
        $s = bd()->prepare('SELECT archivo FROM fotos WHERE vehiculo_id = ?');
        $s->execute([$id]);
        $archivos = $s->fetchAll(PDO::FETCH_COLUMN);
        bd()->prepare('DELETE FROM vehiculos WHERE id = ?')->execute([$id]);
        borrar_archivos($archivos);
        responder(['ok' => true]);

    case 'subir_foto':
        $vid = (int)($d['vehiculo_id'] ?? 0);
        $s = bd()->prepare('SELECT 1 FROM vehiculos WHERE id = ?');
        $s->execute([$vid]);
        if (!$s->fetch()) fallo('Guarda primero el vehículo.');

        $f = $_FILES['foto'] ?? null;
        if (!$f || $f['error'] !== UPLOAD_ERR_OK) fallo('No se recibió la foto. Puede que pese demasiado.');
        if ($f['size'] > 6 * 1024 * 1024) fallo('La foto pesa más de 6 MB.');

        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
        if (!isset(TIPOS_FOTO[$mime]) || !getimagesize($f['tmp_name'])) fallo('Solo se aceptan fotos JPG, PNG o WebP.');

        if (!is_dir(CARPETA_FOTOS)) {
            mkdir(CARPETA_FOTOS, 0755, true);
        }
        $archivo = 'v' . $vid . '-' . bin2hex(random_bytes(8)) . '.' . TIPOS_FOTO[$mime];
        if (!move_uploaded_file($f['tmp_name'], CARPETA_FOTOS . '/' . $archivo)) fallo('No se pudo guardar la foto.', 500);

        bd()->prepare('INSERT INTO fotos (vehiculo_id, archivo, vista) VALUES (?, ?, ?)')
            ->execute([$vid, $archivo, texto($d, 'vista', 30)]);
        responder(['ok' => true]);

    case 'portada_foto':
        $s = bd()->prepare('SELECT vehiculo_id FROM fotos WHERE id = ?');
        $s->execute([$id]);
        $vid = $s->fetchColumn();
        if (!$vid) fallo('Esa foto ya no existe.', 404);
        bd()->prepare('UPDATE fotos SET portada = (id = ?) WHERE vehiculo_id = ?')->execute([$id, $vid]);
        responder(['ok' => true]);

    case 'vista_foto':
        bd()->prepare('UPDATE fotos SET vista = ? WHERE id = ?')->execute([texto($d, 'vista', 30), $id]);
        responder(['ok' => true]);

    case 'borrar_foto':
        $s = bd()->prepare('SELECT archivo FROM fotos WHERE id = ?');
        $s->execute([$id]);
        $archivos = $s->fetchAll(PDO::FETCH_COLUMN);
        bd()->prepare('DELETE FROM fotos WHERE id = ?')->execute([$id]);
        borrar_archivos($archivos);
        responder(['ok' => true]);

    case 'guardar_parte':
        if (texto($d, 'nombre') === '') fallo('Escribe el nombre de la pieza.');
        $estado = ($d['estado'] ?? '') === 'agotado' ? 'agotado' : 'existencia';
        $valores = [texto($d, 'nombre', 120), texto($d, 'categoria', 60), texto($d, 'codigo', 30), entero_o_nulo($d, 'precio') ?? 0, $estado];
        if ($id) {
            bd()->prepare('UPDATE partes SET nombre = ?, categoria = ?, codigo = ?, precio = ?, estado = ? WHERE id = ?')
                ->execute([...$valores, $id]);
        } else {
            $vid = (int)($d['vehiculo_id'] ?? 0);
            $s = bd()->prepare("SELECT 1 FROM vehiculos WHERE id = ? AND tipo = 'autopartes'");
            $s->execute([$vid]);
            if (!$s->fetch()) fallo('Ese vehículo no es de autopartes.');
            bd()->prepare('INSERT INTO partes (nombre, categoria, codigo, precio, estado, vehiculo_id) VALUES (?, ?, ?, ?, ?, ?)')
                ->execute([...$valores, $vid]);
        }
        responder(['ok' => true]);

    case 'estado_parte':
        $estado = ($d['estado'] ?? '') === 'agotado' ? 'agotado' : 'existencia';
        bd()->prepare('UPDATE partes SET estado = ? WHERE id = ?')->execute([$estado, $id]);
        responder(['ok' => true]);

    case 'borrar_parte':
        bd()->prepare('DELETE FROM partes WHERE id = ?')->execute([$id]);
        responder(['ok' => true]);

    case 'ticket_atendido':
        bd()->prepare('UPDATE tickets SET atendido = ? WHERE id = ?')->execute([empty($d['atendido']) ? 0 : 1, $id]);
        responder(['ok' => true]);

    case 'guardar_ajustes':
        $whats = preg_replace('/\D/', '', (string)($d['whatsapp'] ?? ''));
        if (strlen($whats) === 10) {
            $whats = '52' . $whats; // número mexicano escrito sin lada de país
        }
        if (strlen($whats) < 11) fallo('Escribe el WhatsApp a 10 dígitos.');
        $d['whatsapp'] = $whats;
        $s = bd()->prepare('REPLACE INTO ajustes (clave, valor) VALUES (?, ?)');
        foreach (array_keys(AJUSTES_INICIALES) as $clave) {
            $s->execute([$clave, texto($d, $clave)]);
        }
        responder(['ok' => true]);
}

fallo('Acción desconocida.');
