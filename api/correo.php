<?php
// Envío de correos. En MODO_PRUEBA se guardan en storage/correos/ en vez de enviarse.

function enviar_correo(string $para, string $asunto, string $html): bool
{
    if (MODO_PRUEBA) {
        $carpeta = dirname(__DIR__) . '/storage/correos';
        if (!is_dir($carpeta)) {
            mkdir($carpeta, 0755, true);
        }
        return file_put_contents($carpeta . '/' . date('Ymd-His') . '-' . bin2hex(random_bytes(3)) . '.html', $html) !== false;
    }

    $nombre = ajustes()['nombre'];
    $cabeceras = [
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        'From: ' . mb_encode_mimeheader($nombre, 'UTF-8') . ' <' . CORREO_REMITENTE . '>',
        'Reply-To: ' . CORREO_REMITENTE,
    ];
    return mail($para, mb_encode_mimeheader($asunto, 'UTF-8'), $html, implode("\r\n", $cabeceras), '-f' . CORREO_REMITENTE);
}

function correo_verificacion(string $nombre, string $enlace): string
{
    $sitio  = htmlspecialchars(ajustes()['nombre']);
    $nombre = htmlspecialchars($nombre);
    $enlace = htmlspecialchars($enlace);
    $logo   = htmlspecialchars(url_sitio() . '/img/correo/pensol.png');

    return <<<HTML
<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#f4f2ec;font-family:Arial,Helvetica,sans-serif;color:#111111;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ec;padding:32px 12px;">
<tr><td align="center">
  <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;">
    <tr><td align="center" style="background:#111111;padding:26px 24px 20px;border-bottom:4px solid #C9A227;">
      <img src="$logo" width="108" alt="PenSol" style="display:block;border:0;border-radius:8px;">
      <p style="margin:12px 0 0;font-size:22px;font-weight:bold;letter-spacing:.5px;color:#ffffff;">Pen<span style="color:#C9A227;">Sol</span></p>
    </td></tr>
    <tr><td style="padding:32px 32px 8px;">
      <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;">Confirma tu correo, $nombre</h1>
      <p style="margin:0 0 22px;font-size:16px;line-height:1.55;color:#3c424b;">
        Creaste una cuenta en <strong>$sitio</strong>. Solo falta confirmar que este correo es tuyo para
        guardar tus tickets y tus favoritos.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#C9A227;border-radius:6px;">
        <a href="$enlace" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:bold;color:#111111;text-decoration:none;">Confirmar mi correo</a>
      </td></tr></table>
      <p style="margin:22px 0 0;font-size:13px;line-height:1.5;color:#5d646f;">
        El enlace vence en 24 horas. Si el botón no abre, copia esta dirección en tu navegador:<br>
        <a href="$enlace" style="color:#5d646f;word-break:break-all;">$enlace</a>
      </p>
    </td></tr>
    <tr><td style="padding:22px 32px 28px;">
      <p style="margin:0;padding-top:18px;border-top:1px solid #dcd8cd;font-size:12px;line-height:1.5;color:#5d646f;">
        Si tú no creaste esta cuenta, ignora este mensaje y no pasará nada.<br>
        Sitio de $sitio · Plataforma desarrollada por PenSol.
      </p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>
HTML;
}
