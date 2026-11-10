<?php
// Entrega el inventario, los datos del negocio y la sesión.
//   api/datos.php          → JavaScript (lo cargan las páginas con <script>)
//   api/datos.php?json=1   → JSON (lo usa el panel para refrescar)
require __DIR__ . '/base.php';

header('Cache-Control: no-store');

try {
    $datos = [
        'negocio'    => ajustes(),
        'inventario' => inventario(),
        'sesion'     => sesion_publica(),
        'csrf'       => csrf(),
    ];
} catch (Throwable $e) {
    error_log('IGRIS: ' . $e->getMessage());
    $datos = ['negocio' => AJUSTES_INICIALES, 'inventario' => [], 'sesion' => null, 'csrf' => '', 'sin_bd' => true];
}

$json = json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG);

if (isset($_GET['json'])) {
    header('Content-Type: application/json; charset=utf-8');
    echo $json;
} else {
    header('Content-Type: application/javascript; charset=utf-8');
    echo 'window.DATOS = ' . $json . ';';
}
