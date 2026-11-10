<?php
/* ==========================================================================
   CONFIGURACIÓN — lo único que cambia entre tu computadora y Hostinger.

   En Hostinger: hPanel → Bases de datos → MySQL → crear base y usuario,
   y copiar aquí los tres datos que te da (nombre de base, usuario, contraseña).
   ========================================================================== */

// Base de datos (estos valores son los de XAMPP en tu computadora)
const BD_HOST    = 'localhost';
const BD_NOMBRE  = 'igris';
const BD_USUARIO = 'root';
const BD_CLAVE   = '';

// true  = pruebas en tu computadora: el correo NO se envía, se guarda en
//         storage/correos/ y el enlace de verificación aparece en pantalla.
// false = sitio real en Hostinger: el correo se envía de verdad.
const MODO_PRUEBA = true;

// Remitente de los correos. En Hostinger debe ser un correo de tu dominio
// (créalo en hPanel → Correos), si no, los mensajes llegan a spam.
const CORREO_REMITENTE = 'no-responder@tudominio.com';

// Dirección del sitio SIN diagonal al final, ej. 'https://tudominio.com'.
// Vacío = se detecta sola.
const URL_SITIO = '';
