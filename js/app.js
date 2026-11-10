(function () {
  'use strict';

  /* ---------- datos que entrega api/datos.php ---------- */
  const D = window.DATOS || { negocio: { nombre: 'IGRIS', whatsapp: '', telefono: '', direccion: '', horario: '' }, inventario: [], sesion: null, csrf: '', sin_bd: true };
  const NEGOCIO = D.negocio;
  const SESION = D.sesion;
  const INVENTARIO = D.inventario;
  INVENTARIO.forEach((a) => { if (!a.fotos.length) { a.sinFotos = true; a.fotos = [{ src: '', vista: '' }]; } });
  // el dueño administra: no arma tickets ni guarda favoritos como si fuera cliente
  const ES_DUENO = Boolean(SESION && SESION.rol === 'dueno');
  const SEMINUEVOS = INVENTARIO.filter((a) => a.tipo === 'seminuevo');
  const AUTOPARTES = INVENTARIO.filter((a) => a.tipo === 'autopartes');

  /* ---------- utilidades ---------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const dinero = (n) => new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', maximumFractionDigits: 0
  }).format(n || 0);
  const miles = (n) => new Intl.NumberFormat('es-MX').format(n || 0);
  const fecha = (iso) => new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
  const fechaHora = (sql) => new Date(sql.replace(' ', 'T')).toLocaleString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  const normal = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const titulo = (a) => `${a.marca} ${a.modelo} ${a.version}`.trim();
  const enExistencia = (a) => a.partes.filter((p) => p.estado === 'existencia').length;
  const enlaceDetalle = (a) => `detalle.html?id=${a.id}`;

  const leer = (clave, defecto) => {
    try { return JSON.parse(localStorage.getItem(clave)) ?? defecto; } catch (e) { return defecto; }
  };
  const guardar = (clave, valor) => {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) { /* almacenamiento bloqueado */ }
  };

  function whats(mensaje) {
    return `https://wa.me/${NEGOCIO.whatsapp}?text=${encodeURIComponent(mensaje)}`;
  }

  async function api(ruta, datos) {
    const opciones = { credentials: 'same-origin' };
    if (datos instanceof FormData) {
      Object.assign(opciones, { method: 'POST', headers: { 'X-CSRF': D.csrf }, body: datos });
    } else if (datos !== undefined) {
      Object.assign(opciones, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF': D.csrf },
        body: JSON.stringify(datos)
      });
    }
    const resp = await fetch('api/' + ruta, opciones);
    const json = await resp.json().catch(() => ({ error: 'El servidor no respondió como se esperaba.' }));
    if (!resp.ok) throw Object.assign(new Error(json.error || 'Algo salió mal.'), json);
    return json;
  }

  function aviso(texto, enlace) {
    let t = $('#toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      t.setAttribute('role', 'status');
      document.body.append(t);
    }
    t.innerHTML = esc(texto) + (enlace ? ` <a href="${esc(enlace.href)}">${esc(enlace.texto)}</a>` : '');
    t.classList.add('visible');
    clearTimeout(aviso.reloj);
    aviso.reloj = setTimeout(() => t.classList.remove('visible'), 4000);
  }

  /* ---------- imagen provisional (vehículos sin foto) ---------- */
  const TONOS = [['#23272e', '#f5c400'], ['#2f3640', '#ffffff'], ['#3a3226', '#f5c400'], ['#1c2a33', '#ffffff']];

  function fotoProvisional(vista, i) {
    const [fondo, trazo] = TONOS[i % TONOS.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 424 280">
<rect width="424" height="280" fill="${fondo}"/>
<path d="M0 232h424" stroke="${trazo}" stroke-opacity=".25" stroke-width="2" stroke-dasharray="14 10"/>
<g transform="translate(0 24)" fill="none" stroke="${trazo}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
<path d="M40 170q0-28 30-32l40-6q30-38 70-40h70q40 2 66 38l44 10q24 6 24 30v12q0 8-8 8h-26a34 34 0 0 0-68 0H178a34 34 0 0 0-68 0H48q-8 0-8-8z"/>
<path d="M130 130q24-26 52-28h30v28zM226 102h24q28 2 48 28h-72z"/>
<circle cx="144" cy="190" r="24"/><circle cx="316" cy="190" r="24"/>
<circle cx="144" cy="190" r="8"/><circle cx="316" cy="190" r="8"/>
</g>
<text x="400" y="262" text-anchor="end" font-family="Arial, sans-serif" font-size="13" fill="${trazo}" fill-opacity=".6">${vista ? esc(vista).toUpperCase() + ' · ' : ''}FOTO PENDIENTE</text>
</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  const fotoSrc = (foto, i) => foto.src || fotoProvisional(foto.vista, i);
  const tono = (a) => (a.tipo === 'autopartes' ? 2 : 0);

  // si una foto no carga, se sustituye por la provisional
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName === 'IMG' && 'vista' in img.dataset && !img.dataset.respaldo) {
      img.dataset.respaldo = '1';
      img.src = fotoProvisional(img.dataset.vista, Number(img.dataset.i) || 0);
    }
  }, true);

  /* ---------- sellos de estado ---------- */
  const SELLOS = { disponible: 'Disponible', apartado: 'Apartado', vendido: 'Vendido', agotado: 'Agotado' };
  const estadoDe = (a) => (a.tipo === 'autopartes' ? (enExistencia(a) ? 'disponible' : 'agotado') : a.estado);
  const sello = (estado) => `<span class="sello sello--${estado}">${SELLOS[estado]}</span>`;

  /* ---------- favoritos (requieren cuenta) ---------- */
  const favoritos = new Set(SESION ? SESION.favoritos : []);
  const CORAZON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.500 4.500 13a5 5 0 0 1 7.100-7.100l.400.400.400-.400A5 5 0 0 1 19.500 13z"/></svg>';
  const corazon = (id) => ES_DUENO ? '' : `<button type="button" class="corazon${favoritos.has(id) ? ' activo' : ''}" data-fav="${id}" aria-pressed="${favoritos.has(id)}" aria-label="Guardar en favoritos">${CORAZON}</button>`;

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-fav]');
    if (!b) return;
    e.preventDefault();
    if (!SESION) {
      aviso('Los favoritos se guardan en tu cuenta.', { href: 'cuenta.html', texto: 'Entrar o crear cuenta' });
      return;
    }
    const id = Number(b.dataset.fav);
    const poner = !favoritos.has(id);
    try {
      await api('favoritos.php', { vehiculo_id: id, poner });
      if (poner) favoritos.add(id); else favoritos.delete(id);
      $$(`[data-fav="${id}"]`).forEach((x) => {
        x.classList.toggle('activo', poner);
        x.setAttribute('aria-pressed', poner);
      });
      aviso(poner ? 'Guardado en tus favoritos.' : 'Quitado de tus favoritos.');
    } catch (err) {
      aviso(err.message);
    }
  });

  /* ---------- ticket (lista de lo que le interesa al cliente) ---------- */
  let ticket = leer('igris_ticket', []);
  const claveDe = (tipo, id) => `${tipo}:${id}`;
  const enTicket = (tipo, id) => ticket.some((x) => x.tipo === tipo && x.id === id);

  // convierte {tipo, id} en algo que se puede mostrar; null si ya no está disponible
  function resolver(item) {
    if (item.tipo === 'vehiculo') {
      const a = SEMINUEVOS.find((x) => x.id === item.id);
      if (!a || a.estado === 'vendido') return null;
      return { ...item, nombre: `${titulo(a)} ${a.anio}`, detalle: 'Auto seminuevo', precio: a.precio, href: enlaceDetalle(a), foto: fotoSrc(a.fotos[0], 0) };
    }
    for (const a of AUTOPARTES) {
      const p = a.partes.find((x) => x.id === item.id);
      if (p && p.estado === 'existencia') {
        return { ...item, nombre: p.nombre, detalle: `${p.codigo ? p.codigo + ' · ' : ''}${titulo(a)} ${a.anio}`, precio: p.precio, href: enlaceDetalle(a), foto: fotoSrc(a.fotos[0], 2) };
      }
    }
    return null;
  }

  const itemsTicket = () => ticket.map(resolver).filter(Boolean);

  function botonTicket(tipo, id, clase, corto) {
    if (ES_DUENO) return '';
    const dentro = enTicket(tipo, id);
    const texto = dentro ? (corto ? '✓ En tu ticket' : '✓ En tu ticket · quitar') : (corto ? 'Agregar' : 'Agregar a mi ticket');
    return `<button type="button" class="boton ${clase}${dentro ? ' boton--dentro' : ''}" data-ticket="${claveDe(tipo, id)}" data-clase="${clase}"${corto ? ' data-corto="1"' : ''} aria-pressed="${dentro}">${texto}</button>`;
  }

  function pintarContador() {
    const n = itemsTicket().length;
    $$('[data-cuenta-ticket]').forEach((el) => { el.textContent = n; el.hidden = n === 0; });
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ticket]');
    if (!b) return;
    const [tipo, idTexto] = b.dataset.ticket.split(':');
    const id = Number(idTexto);
    const estaba = enTicket(tipo, id);
    ticket = estaba ? ticket.filter((x) => !(x.tipo === tipo && x.id === id)) : [...ticket, { tipo, id }];
    guardar('igris_ticket', ticket);
    $$(`[data-ticket="${b.dataset.ticket}"]`).forEach((x) => {
      if ('clase' in x.dataset) x.outerHTML = botonTicket(tipo, id, x.dataset.clase, x.dataset.corto);
    });
    pintarContador();
    document.dispatchEvent(new CustomEvent('ticket-cambio'));
    if (!estaba) aviso('Agregado a tu ticket.', { href: 'ticket.html', texto: 'Ver ticket' });
  });

  /* ---------- tarjetas ---------- */
  // fotos de cada tarjeta pintada, para pasar de una a otra con las flechas sin abrir el vehículo
  const fotosDeTarjeta = new Map();
  let serieTarjetas = 0;

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pasar]');
    if (!b) return;
    e.preventDefault();
    const marco = b.closest('[data-galeria]');
    const fotos = fotosDeTarjeta.get(Number(marco.dataset.galeria));
    const i = (Number(marco.dataset.actual) + Number(b.dataset.pasar) + fotos.length) % fotos.length;
    const img = $('img', marco);
    marco.dataset.actual = i;
    delete img.dataset.respaldo;
    img.dataset.vista = fotos[i].vista;
    img.src = fotoSrc(fotos[i], i);
    $('[data-foto-num]', marco).textContent = i + 1;
  });

  function tarjeta(a) {
    const partes = a.tipo === 'autopartes';
    const foto = a.fotos[0];
    const pie = partes
      ? `<span class="existencias"><b>${enExistencia(a)}</b> de ${a.partes.length} piezas en existencia</span><span class="tarjeta__ir">Ver piezas</span>`
      : `<strong class="precio">${dinero(a.precio)}</strong><span class="tarjeta__ir">Ver fotos y ficha</span>`;
    const tercero = partes ? esc(a.motor) : `${miles(a.km)} km`;
    const varias = a.fotos.length > 1;
    if (varias) fotosDeTarjeta.set(++serieTarjetas, a.fotos);
    return `<article class="tarjeta tarjeta--${estadoDe(a)}">
      <div class="tarjeta__foto"${varias ? ` data-galeria="${serieTarjetas}" data-actual="0"` : ''}>
        <img src="${esc(fotoSrc(foto, tono(a)))}" data-vista="${esc(foto.vista)}" data-i="${tono(a)}" alt="" loading="lazy">
        ${sello(estadoDe(a))}
        ${corazon(a.id)}
        ${varias ? `<button type="button" class="pasar pasar--antes" data-pasar="-1" aria-label="Foto anterior">‹</button>
        <button type="button" class="pasar pasar--despues" data-pasar="1" aria-label="Foto siguiente">›</button>` : ''}
        ${a.sinFotos ? '' : `<span class="tarjeta__fotos">${varias ? `<b data-foto-num>1</b> / ${a.fotos.length}` : '1 foto'}</span>`}
      </div>
      <div class="tarjeta__cuerpo">
        <p class="tarjeta__fecha">${partes ? 'Para autopartes' : 'Seminuevo'} · Agregado el ${fecha(a.agregado)}</p>
        <h3 class="tarjeta__titulo"><a class="tarjeta__enlace" href="${enlaceDetalle(a)}">${esc(titulo(a))}</a></h3>
        <ul class="datos"><li>${a.anio}</li><li>${tercero}</li>${a.transmision ? `<li>${esc(a.transmision)}</li>` : ''}</ul>
        <div class="tarjeta__pie">${pie}</div>
      </div>
    </article>`;
  }

  const tarjetas = (lista) => lista.map(tarjeta).join('');

  /* ---------- filtros de los listados ---------- */
  function llenarSelect(select, valores, textoTodos) {
    const actual = select.value;
    select.innerHTML = `<option value="">${textoTodos}</option>` +
      valores.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    if (valores.map(String).includes(actual)) select.value = actual;
  }

  const unicos = (lista, campo) => Array.from(new Set(lista.map((x) => x[campo])));

  function iniciarListado(lista, coincideTexto) {
    const form = $('#filtro');
    const rejilla = $('#resultados');
    const conteo = $('#conteo');
    const { marca, modelo, anio, precio, buscar, orden, existencia } = form.elements;

    llenarSelect(marca, unicos(lista, 'marca').sort(), 'Todas las marcas');
    llenarSelect(anio, unicos(lista, 'anio').sort((a, b) => b - a), 'Todos los años');

    function modelosDeMarca() {
      const base = marca.value ? lista.filter((a) => a.marca === marca.value) : lista;
      llenarSelect(modelo, unicos(base, 'modelo').sort(), 'Todos los modelos');
    }

    function pintar() {
      const texto = normal(buscar.value.trim());
      const res = lista.filter((a) =>
        (!marca.value || a.marca === marca.value) &&
        (!modelo.value || a.modelo === modelo.value) &&
        (!anio.value || String(a.anio) === anio.value) &&
        (!precio || !precio.value || a.precio <= Number(precio.value)) &&
        (!existencia || !existencia.checked || enExistencia(a) > 0) &&
        (!texto || coincideTexto(a, texto))
      );
      // la lista ya viene del más reciente al más antiguo
      if (orden && orden.value === 'menor') res.sort((a, b) => a.precio - b.precio);
      if (orden && orden.value === 'mayor') res.sort((a, b) => b.precio - a.precio);

      conteo.textContent = res.length === 1 ? '1 resultado' : `${res.length} resultados`;
      rejilla.innerHTML = res.length
        ? tarjetas(res)
        : `<div class="vacio"><h3>Sin resultados</h3><p>No hay unidades con esos filtros. Prueba quitando alguno o escríbenos y lo buscamos por ti.</p>
           <a class="boton boton--whats" href="${whats('Hola, busco una unidad o pieza que no encontré en la página.')}" target="_blank" rel="noopener">Preguntar por WhatsApp</a></div>`;
    }

    marca.addEventListener('change', () => { modelosDeMarca(); pintar(); });
    form.addEventListener('input', pintar);
    if (orden) orden.addEventListener('change', pintar); // está fuera del <form>, su evento no burbujea hasta él
    form.addEventListener('submit', (e) => e.preventDefault());
    form.addEventListener('reset', () => setTimeout(() => { modelosDeMarca(); pintar(); }));

    modelosDeMarca();
    pintar();
  }

  /* ---------- páginas públicas ---------- */
  // con cuenta, los vistos vienen del servidor (sirven en cualquier dispositivo); sin cuenta, de este navegador
  const vistos = () => [...new Set([...(SESION ? SESION.vistos : []), ...leer('igris_vistos', [])])]
    .map((id) => INVENTARIO.find((a) => a.id === id)).filter(Boolean);

  function pintarUbicacion() {
    const lugar = encodeURIComponent(NEGOCIO.mapa || NEGOCIO.direccion);
    $('#ubicacion').innerHTML = `<div class="contenedor ubicacion__rejilla">
      <div class="ubicacion__datos">
        <p class="ceja">Ubicación</p>
        <h2>Dónde estamos</h2>
        <p>${esc(NEGOCIO.direccion)}</p>
        <p>${esc(NEGOCIO.horario)}</p>
        <p>Tel. ${esc(NEGOCIO.telefono)}</p>
        <a class="boton" href="https://www.google.com/maps/dir/?api=1&destination=${lugar}" target="_blank" rel="noopener">Cómo llegar</a>
        <small>Mapa de referencia. Confirma la dirección por WhatsApp antes de venir.</small>
      </div>
      <iframe class="ubicacion__mapa" title="Mapa de referencia de ${esc(NEGOCIO.nombre)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
        src="https://www.google.com/maps?q=${lugar}&z=15&output=embed"></iframe>
    </div>`;
    // la sección se pinta después de cargar, así que el salto a #ubicacion se hace aquí
    if (location.hash === '#ubicacion') setTimeout(() => $('#ubicacion').scrollIntoView({ behavior: 'instant' }), 100);
  }

  function paginaInicio() {
    $('#ultimos-seminuevos').innerHTML = tarjetas(SEMINUEVOS.slice(0, 3)) || '<p class="nada">Pronto habrá unidades aquí.</p>';
    $('#ultimos-autopartes').innerHTML = tarjetas(AUTOPARTES.slice(0, 3)) || '<p class="nada">Pronto habrá vehículos aquí.</p>';
    const libres = SEMINUEVOS.filter((a) => a.estado === 'disponible').length;
    $('[data-conteo="seminuevos"]').textContent = libres === 1 ? '1 unidad disponible' : `${libres} unidades disponibles`;
    const piezas = AUTOPARTES.reduce((s, a) => s + enExistencia(a), 0);
    $('[data-conteo="autopartes"]').textContent = `${piezas} piezas en existencia`;

    const recientes = vistos().slice(0, 3);
    if (recientes.length) {
      $('#vistos').hidden = false;
      $('#vistos .rejilla').innerHTML = tarjetas(recientes);
    }
    pintarUbicacion();
  }

  function paginaSeminuevos() {
    iniciarListado(SEMINUEVOS, (a, t) =>
      normal(`${titulo(a)} ${a.anio} ${a.color} ${a.transmision}`).includes(t));
  }

  function paginaAutopartes() {
    iniciarListado(AUTOPARTES, (a, t) =>
      normal(`${titulo(a)} ${a.anio}`).includes(t) ||
      a.partes.some((p) => normal(`${p.nombre} ${p.categoria} ${p.codigo}`).includes(t)));
  }

  function galeria(a) {
    const d = tono(a);
    return `<div class="galeria">
      <div class="galeria__principal">
        <img id="foto-principal" src="${esc(fotoSrc(a.fotos[0], d))}" data-vista="${esc(a.fotos[0].vista)}" data-i="${d}" alt="${esc(titulo(a))} ${esc(a.fotos[0].vista)}">
        ${sello(estadoDe(a))}
        <span class="galeria__cuenta"><b id="foto-num">1</b> / ${a.fotos.length}</span>
      </div>
      <div class="galeria__miniaturas">
        ${a.fotos.map((f, i) => `<button type="button" class="miniatura${i === 0 ? ' activa' : ''}" data-foto="${i}" aria-label="Ver foto ${i + 1}${f.vista ? ': ' + esc(f.vista) : ''}">
          <img src="${esc(fotoSrc(f, i + d))}" data-vista="${esc(f.vista)}" data-i="${i + d}" alt="">
        </button>`).join('')}
      </div>
    </div>`;
  }

  function activarGaleria(a) {
    const d = tono(a);
    const principal = $('#foto-principal');
    let actual = 0;
    function mostrar(i) {
      actual = (i + a.fotos.length) % a.fotos.length;
      const f = a.fotos[actual];
      delete principal.dataset.respaldo;
      principal.dataset.vista = f.vista;
      principal.dataset.i = actual + d;
      principal.src = fotoSrc(f, actual + d);
      principal.alt = `${titulo(a)} ${f.vista}`;
      $('#foto-num').textContent = actual + 1;
      $$('.miniatura').forEach((m, n) => m.classList.toggle('activa', n === actual));
    }
    $$('.miniatura').forEach((m) => m.addEventListener('click', () => mostrar(Number(m.dataset.foto))));
    principal.addEventListener('click', () => mostrar(actual + 1));
    document.addEventListener('keydown', (e) => {
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight') mostrar(actual + 1);
      if (e.key === 'ArrowLeft') mostrar(actual - 1);
    });
  }

  function detalleSeminuevo(a, destino) {
    const ficha = [
      ['Marca', a.marca], ['Modelo', a.modelo], ['Versión', a.version], ['Año', a.anio],
      ['Kilometraje', a.km != null ? `${miles(a.km)} km` : ''], ['Transmisión', a.transmision], ['Motor', a.motor],
      ['Combustible', a.combustible], ['Color', a.color], ['Puertas', a.puertas], ['Propietarios', a.duenos]
    ].filter(([, v]) => v !== '' && v != null);

    const acciones = a.estado === 'vendido'
      ? '<p class="nota nota--mal">Este auto ya se vendió. Pregúntanos por unidades parecidas.</p>'
      : (a.estado === 'apartado' ? '<p class="nota nota--ojo">Está apartado por otro cliente. Agrégalo a tu ticket y te avisamos si se libera.</p>' : '') +
        botonTicket('vehiculo', a.id, 'boton--ancho boton--amarillo');

    destino.innerHTML = `
      <nav class="migas"><a href="index.html">Inicio</a><a href="seminuevos.html">Seminuevos</a><span>${esc(titulo(a))}</span></nav>
      <div class="detalle">
        ${galeria(a)}
        <aside class="resumen">
          <div class="resumen__arriba"><span class="etiqueta">Seminuevo</span>${corazon(a.id)}</div>
          <h1>${esc(titulo(a))}</h1>
          <ul class="datos"><li>${a.anio}</li><li>${miles(a.km)} km</li>${a.transmision ? `<li>${esc(a.transmision)}</li>` : ''}</ul>
          <p class="resumen__precio">${dinero(a.precio)}</p>
          ${a.descripcion ? `<p class="resumen__texto">${esc(a.descripcion)}</p>` : ''}
          ${acciones}
          <a class="boton boton--whats boton--ancho" href="${whats(`Hola, me interesa el ${titulo(a)} ${a.anio} (${dinero(a.precio)}) que vi en la página.`)}" target="_blank" rel="noopener">Preguntar por WhatsApp</a>
          <p class="resumen__nota">Agregado el ${fecha(a.agregado)}</p>
        </aside>
      </div>
      <section class="bloque">
        <h2>Especificaciones</h2>
        <dl class="ficha">${ficha.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      </section>`;
    activarGaleria(a);
  }

  function detalleAutopartes(a, destino) {
    const hay = enExistencia(a);
    destino.innerHTML = `
      <nav class="migas"><a href="index.html">Inicio</a><a href="autopartes.html">Autopartes</a><span>${esc(titulo(a))}</span></nav>
      <div class="detalle">
        ${galeria(a)}
        <aside class="resumen">
          <div class="resumen__arriba"><span class="etiqueta">Para autopartes</span>${corazon(a.id)}</div>
          <h1>${esc(titulo(a))}</h1>
          <ul class="datos"><li>${a.anio}</li>${[a.motor, a.transmision, a.color].filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
          ${a.descripcion ? `<p class="resumen__texto">${esc(a.descripcion)}</p>` : ''}
          <div class="marcador">
            <div><b>${hay}</b><span>en existencia</span></div>
            <div><b>${a.partes.length - hay}</b><span>agotadas</span></div>
          </div>
          <a class="boton boton--whats boton--ancho" href="${whats(`Hola, busco una pieza del ${titulo(a)} ${a.anio} que vi en la página.`)}" target="_blank" rel="noopener">¿No ves tu pieza? Pregunta</a>
          <p class="resumen__nota">Agregado el ${fecha(a.agregado)}</p>
        </aside>
      </div>
      <section class="bloque">
        <div class="bloque__cabeza">
          <h2>Piezas de este vehículo</h2>
          <div class="piezas-filtro">
            <input type="search" id="buscar-pieza" placeholder="Buscar pieza o código" aria-label="Buscar pieza o código">
            <div class="segmentos" role="group" aria-label="Filtrar por disponibilidad">
              <button type="button" class="activo" data-estado="">Todas</button>
              <button type="button" data-estado="existencia">En existencia</button>
              <button type="button" data-estado="agotado">Agotadas</button>
            </div>
          </div>
        </div>
        <div class="tabla-envoltura">
          <table class="piezas">
            <thead><tr><th>Pieza</th><th>Categoría</th><th>Código</th><th>Precio</th><th>Disponibilidad</th><th></th></tr></thead>
            <tbody id="piezas"></tbody>
          </table>
        </div>
      </section>`;
    activarGaleria(a);

    let estado = '';
    const buscar = $('#buscar-pieza');
    function pintar() {
      const t = normal(buscar.value.trim());
      const filas = a.partes.filter((p) =>
        (!estado || p.estado === estado) &&
        (!t || normal(`${p.nombre} ${p.categoria} ${p.codigo}`).includes(t)));
      $('#piezas').innerHTML = filas.length ? filas.map((p) => {
        const ok = p.estado === 'existencia';
        return `<tr class="${ok ? '' : 'fila-agotada'}">
          <td data-t="Pieza"><strong>${esc(p.nombre)}</strong></td>
          <td data-t="Categoría">${esc(p.categoria)}</td>
          <td data-t="Código"><code>${esc(p.codigo)}</code></td>
          <td data-t="Precio">${dinero(p.precio)}</td>
          <td data-t="Disponibilidad"><span class="estado estado--${ok ? 'si' : 'no'}">${ok ? 'En existencia' : 'Agotado'}</span></td>
          <td>${ok
            ? botonTicket('parte', p.id, 'boton--chico', true)
            : '<span class="boton boton--chico boton--apagado" aria-disabled="true">No disponible</span>'}</td>
        </tr>`;
      }).join('') : '<tr><td colspan="6" class="piezas__vacio">Ninguna pieza coincide con la búsqueda.</td></tr>';
    }
    buscar.addEventListener('input', pintar);
    $$('.segmentos button').forEach((b) => b.addEventListener('click', () => {
      estado = b.dataset.estado;
      $$('.segmentos button').forEach((x) => x.classList.toggle('activo', x === b));
      pintar();
    }));
    pintar();
  }

  function paginaDetalle() {
    const id = Number(new URLSearchParams(location.search).get('id'));
    const a = INVENTARIO.find((x) => x.id === id);
    const destino = $('#detalle');

    if (!a) {
      destino.innerHTML = `<div class="vacio"><h3>No encontramos esa unidad</h3>
        <p>Puede que ya se haya vendido o que el enlace esté incompleto.</p>
        <p><a class="boton" href="seminuevos.html">Ver seminuevos</a> <a class="boton boton--linea" href="autopartes.html">Ver autopartes</a></p></div>`;
      return;
    }
    document.title = `${titulo(a)} ${a.anio} — ${NEGOCIO.nombre}`;
    guardar('igris_vistos', [a.id, ...leer('igris_vistos', []).filter((x) => x !== a.id)].slice(0, 8));
    if (SESION && !ES_DUENO) api('vistos.php', { vehiculo_id: a.id }).catch(() => {});
    if (ES_DUENO) {
      destino.insertAdjacentHTML('beforebegin', `<p class="aviso aviso--dueno contenedor">Estás viendo esta página como dueño.
        <a class="boton boton--chico boton--amarillo" href="panel.html?editar=${a.id}">Editar este vehículo</a></p>`);
    }
    const seccion = a.tipo === 'autopartes' ? 'autopartes.html' : 'seminuevos.html';
    $$('.menu a').forEach((l) => l.classList.toggle('activo', l.getAttribute('href') === seccion));
    (a.tipo === 'autopartes' ? detalleAutopartes : detalleSeminuevo)(a, destino);
  }

  /* ---------- ticket ---------- */
  function mensajeTicket(t) {
    return [
      `Hola, generé el ticket *${t.folio}* en la página.`,
      '',
      ...t.items.map((i) => `• ${i.descripcion} — ${dinero(i.precio)}`),
      '',
      `Total de referencia: ${dinero(t.total)}`,
      t.nombre ? `A nombre de: ${t.nombre}` : '',
      '¿Me confirman disponibilidad y precio?'
    ].filter((l, n, todo) => l !== '' || todo[n - 1] !== '').join('\n');
  }

  function ticketHTML(t) {
    return `<div class="ticket">
      <div class="ticket__cabeza"><strong>${esc(NEGOCIO.nombre)}</strong><span>Ticket de referencia</span></div>
      <p class="ticket__folio">${esc(t.folio)}</p>
      <p class="ticket__fecha">${fechaHora(t.creado)}${t.nombre ? ' · A nombre de ' + esc(t.nombre) : ''}</p>
      <ul class="ticket__items">${t.items.map((i) => `<li><span>${esc(i.descripcion)}</span><b>${dinero(i.precio)}</b></li>`).join('')}</ul>
      <div class="ticket__total"><span>Total de referencia</span><b>${dinero(t.total)}</b></div>
      <p class="ticket__nota">Este ticket no es un comprobante de pago ni aparta la mercancía. El precio final y la existencia se confirman por WhatsApp.</p>
    </div>`;
  }

  // Tickets ya generados: los folios se guardan en este navegador (sin cuenta) y, con cuenta, también en el servidor
  async function ticketsGuardados() {
    const folios = leer('igris_folios', []);
    const locales = folios.length ? (await api('tickets.php?folios=' + folios.join(','))).tickets : [];
    if (!SESION) return locales;
    const mios = (await api('tickets.php?mios=1')).tickets;
    return [...mios, ...locales.filter((l) => !mios.some((m) => m.folio === l.folio))];
  }

  async function paginaTicket() {
    const destino = $('#ticket');
    const params = new URLSearchParams(location.search);
    const folio = params.get('folio');

    if (ES_DUENO && !folio) {
      destino.innerHTML = `<div class="vacio"><h3>Los tickets son de los clientes</h3>
        <p>Con la cuenta del dueño no se arman tickets. Los que generan tus clientes están en el panel.</p>
        <a class="boton boton--amarillo" href="panel.html?ver=tickets">Ver tickets en el panel</a></div>`;
      return;
    }

    if (folio) {
      try {
        const { ticket: t } = await api('tickets.php?folio=' + encodeURIComponent(folio));
        document.title = `Ticket ${t.folio} — ${NEGOCIO.nombre}`;
        destino.innerHTML = `
          ${params.has('nuevo') ? '<p class="aviso aviso--bien">Tu ticket quedó generado. Envíalo por WhatsApp para cerrar el trato.</p>' : ''}
          ${ticketHTML(t)}
          <div class="ticket__acciones">
            <a class="boton boton--whats boton--ancho" href="${whats(mensajeTicket(t))}" target="_blank" rel="noopener">Enviar ticket por WhatsApp</a>
            <button class="boton boton--linea" type="button" id="imprimir">Imprimir o guardar PDF</button>
            <a class="boton boton--linea" href="index.html">Seguir viendo</a>
          </div>
          <p class="ticket__pista">Tu ticket queda guardado: lo encuentras cuando quieras en <a href="ticket.html">Mi ticket</a>.</p>`;
        $('#imprimir').addEventListener('click', () => window.print());
      } catch (err) {
        destino.innerHTML = `<div class="vacio"><h3>Ticket no encontrado</h3><p>${esc(err.message)}</p><a class="boton" href="index.html">Ir al inicio</a></div>`;
      }
      return;
    }

    destino.innerHTML = `<div id="lista"></div>
      <section class="bloque" id="generados" hidden><h2>Tickets generados</h2><div class="lista-ticket"></div></section>`;
    const lista = $('#lista');

    ticketsGuardados().then((guardados) => {
      if (!guardados.length) return;
      $('#generados').hidden = false;
      $('#generados .lista-ticket').innerHTML = guardados.map(filaTicket).join('');
    }).catch(() => {});

    function pintar() {
      const items = itemsTicket();
      if (!items.length) {
        lista.innerHTML = `<div class="vacio"><h3>Tu ticket está vacío</h3>
          <p>Agrega el auto o las piezas que te interesen y genera un folio para tratarlo por WhatsApp. No es una compra.</p>
          <p><a class="boton" href="seminuevos.html">Ver seminuevos</a> <a class="boton boton--linea" href="autopartes.html">Ver autopartes</a></p></div>`;
        return;
      }
      const total = items.reduce((s, i) => s + i.precio, 0);
      lista.innerHTML = `
        <h1 class="titulo-pagina">Mi ticket</h1>
        <p class="bajada">Esto no es un carrito ni una compra: es tu lista de interés. Al generarla recibes un folio y el trato se cierra por WhatsApp.</p>
        <div class="lista-ticket">
          ${items.map((i) => `<div class="renglon">
            <img src="${esc(i.foto)}" data-vista="" alt="">
            <div><a href="${i.href}"><strong>${esc(i.nombre)}</strong></a><small>${esc(i.detalle)}</small></div>
            <b>${dinero(i.precio)}</b>
            <button type="button" class="quitar" data-ticket="${claveDe(i.tipo, i.id)}" aria-label="Quitar ${esc(i.nombre)}">Quitar</button>
          </div>`).join('')}
          <div class="renglon renglon--total"><span>Total de referencia</span><b>${dinero(total)}</b></div>
        </div>
        <form class="caja formulario" id="generar">
          <label class="campo">Tu nombre (opcional)
            <input type="text" name="nombre" maxlength="80" value="${esc(SESION ? SESION.nombre : '')}" placeholder="Para saber con quién tratamos">
          </label>
          <button class="boton boton--amarillo boton--ancho" type="submit">Generar ticket</button>
          <p class="formulario__pie">${SESION ? 'Se guardará en tu cuenta.' : 'No necesitas cuenta: el ticket se guarda en este dispositivo.'}</p>
        </form>`;

      $('#generar').addEventListener('submit', async (e) => {
        e.preventDefault();
        const boton = $('button[type=submit]', e.target);
        boton.disabled = true;
        try {
          const r = await api('tickets.php', { nombre: e.target.elements.nombre.value, items: items.map(({ tipo, id }) => ({ tipo, id })) });
          guardar('igris_ticket', []);
          guardar('igris_folios', [r.folio, ...leer('igris_folios', [])].slice(0, 30));
          location.href = `ticket.html?folio=${r.folio}&nuevo=1`;
        } catch (err) {
          boton.disabled = false;
          aviso(err.message);
        }
      });
    }
    document.addEventListener('ticket-cambio', pintar);
    pintar();
  }

  /* ---------- cuenta ---------- */
  function filaTicket(t) {
    return `<a class="renglon renglon--enlace" href="ticket.html?folio=${esc(t.folio)}">
      <div><strong>${esc(t.folio)}</strong><small>${fechaHora(t.creado)} · ${t.items.length} ${t.items.length === 1 ? 'artículo' : 'artículos'}</small></div>
      <span class="estado estado--${t.atendido ? 'si' : 'espera'}">${t.atendido ? 'Atendido' : 'Pendiente'}</span>
      <b>${dinero(t.total)}</b>
    </a>`;
  }

  async function paginaCuenta() {
    const destino = $('#cuenta');
    const verificado = new URLSearchParams(location.search).get('verificado');
    const avisoArriba = verificado === '1'
      ? '<p class="aviso aviso--bien">Correo verificado. Ya puedes iniciar sesión.</p>'
      : verificado === '0'
        ? '<p class="aviso aviso--mal">El enlace de verificación no es válido o ya venció. Inicia sesión para pedir uno nuevo.</p>'
        : '';

    if (!SESION) {
      destino.innerHTML = `${avisoArriba}
        <div class="acceso">
          <div class="acceso__texto">
            <h1 class="titulo-pagina">Tu cuenta</h1>
            <p class="bajada">No necesitas cuenta para cotizar: tus tickets se guardan en este dispositivo y todo se trata por WhatsApp. La cuenta es opcional y sirve para:</p>
            <ul class="ventajas">
              <li>Marcar autos como favoritos</li>
              <li>Retomar lo que viste desde cualquier dispositivo</li>
            </ul>
          </div>
          <div class="caja">
            <div class="segmentos segmentos--anchos" role="tablist">
              <button type="button" class="activo" data-forma="entrar">Iniciar sesión</button>
              <button type="button" data-forma="registrar">Crear cuenta</button>
            </div>
            <form class="formulario" id="f-entrar">
              <label class="campo">Correo <input type="email" name="correo" required autocomplete="email"></label>
              <label class="campo">Contraseña <input type="password" name="clave" required autocomplete="current-password"></label>
              <button class="boton boton--ancho" type="submit">Entrar</button>
            </form>
            <form class="formulario" id="f-registrar" hidden>
              <label class="campo">Nombre <input type="text" name="nombre" required maxlength="80" autocomplete="name"></label>
              <label class="campo">Correo <input type="email" name="correo" required autocomplete="email"></label>
              <label class="campo">Contraseña (mínimo 8 caracteres) <input type="password" name="clave" required minlength="8" autocomplete="new-password"></label>
              <button class="boton boton--ancho" type="submit">Crear cuenta</button>
              <p class="formulario__pie">Te enviaremos un correo para confirmar que es tuyo.</p>
            </form>
            <div id="acceso-aviso" aria-live="polite"></div>
          </div>
        </div>
        <section class="bloque" id="generados" hidden><h2>Tus tickets en este dispositivo</h2><div class="lista-ticket"></div></section>`;

      ticketsGuardados().then((guardados) => {
        if (!guardados.length) return;
        $('#generados').hidden = false;
        $('#generados .lista-ticket').innerHTML = guardados.map(filaTicket).join('');
      }).catch(() => {});

      const salida = $('#acceso-aviso');
      const decir = (clase, html) => { salida.innerHTML = `<p class="aviso aviso--${clase}">${html}</p>`; };
      const enlacePrueba = (r) => (r.enlace_prueba ? `<br><small>Modo de prueba: <a href="${esc(r.enlace_prueba)}">abrir el enlace de verificación</a></small>` : '');

      $$('[data-forma]').forEach((b) => b.addEventListener('click', () => {
        $$('[data-forma]').forEach((x) => x.classList.toggle('activo', x === b));
        $('#f-entrar').hidden = b.dataset.forma !== 'entrar';
        $('#f-registrar').hidden = b.dataset.forma !== 'registrar';
        salida.innerHTML = '';
      }));

      $('#f-entrar').addEventListener('submit', async (e) => {
        e.preventDefault();
        const { correo, clave } = e.target.elements;
        try {
          await api('sesion.php', { accion: 'entrar', correo: correo.value, clave: clave.value });
          location.href = 'cuenta.html';
        } catch (err) {
          decir('mal', esc(err.message) + (err.sin_verificar ? ' <button type="button" class="enlace-boton" id="reenviar">Reenviar correo</button>' : ''));
          const re = $('#reenviar');
          if (re) re.addEventListener('click', async () => {
            try {
              const r = await api('sesion.php', { accion: 'reenviar', correo: correo.value });
              decir('bien', esc(r.mensaje) + enlacePrueba(r));
            } catch (err2) { decir('mal', esc(err2.message)); }
          });
        }
      });

      $('#f-registrar').addEventListener('submit', async (e) => {
        e.preventDefault();
        const { nombre, correo, clave } = e.target.elements;
        try {
          const r = await api('sesion.php', { accion: 'registrar', nombre: nombre.value, correo: correo.value, clave: clave.value });
          e.target.reset();
          decir('bien', esc(r.mensaje) + enlacePrueba(r));
        } catch (err) { decir('mal', esc(err.message)); }
      });
      return;
    }

    const salir = () => $('#salir').addEventListener('click', async () => {
      await api('sesion.php', { accion: 'salir' }).catch(() => {});
      location.href = 'index.html';
    });

    if (ES_DUENO) {
      destino.innerHTML = `
        <div class="cuenta__cabeza">
          <div><h1 class="titulo-pagina">Hola, ${esc(SESION.nombre)}</h1><p class="bajada">${esc(SESION.correo)} · Cuenta del dueño</p></div>
          <button class="boton boton--linea" type="button" id="salir">Cerrar sesión</button>
        </div>
        <div class="accesos">
          <a class="caja acceso-rapido" href="panel.html"><strong>Inventario</strong><span>Agrega autos, fotos y piezas, y cambia su estado.</span></a>
          <a class="caja acceso-rapido" href="panel.html?ver=tickets"><strong>Tickets de clientes</strong><span>Revisa los folios que te mandan por WhatsApp.</span></a>
          <a class="caja acceso-rapido" href="panel.html?ver=negocio"><strong>Datos del negocio</strong><span>WhatsApp, dirección, horario y mapa.</span></a>
        </div>`;
      salir();
      return;
    }

    const favs = INVENTARIO.filter((a) => favoritos.has(a.id));
    const recientes = vistos();
    destino.innerHTML = `
      <div class="cuenta__cabeza">
        <div><h1 class="titulo-pagina">Hola, ${esc(SESION.nombre)}</h1><p class="bajada">${esc(SESION.correo)}</p></div>
        <div class="cuenta__botones">
          ${SESION.rol === 'dueno' ? '<a class="boton boton--amarillo" href="panel.html">Abrir panel administrador</a>' : ''}
          <button class="boton boton--linea" type="button" id="salir">Cerrar sesión</button>
        </div>
      </div>
      <section class="bloque"><h2>Mis tickets</h2><div class="lista-ticket" id="mis-tickets"><p class="nada">Cargando…</p></div></section>
      <section class="bloque"><h2>Favoritos</h2>
        ${favs.length ? `<div class="rejilla">${tarjetas(favs)}</div>` : '<p class="nada">Toca el corazón de un auto para guardarlo aquí.</p>'}</section>
      <section class="bloque"><h2>Vistos recientemente</h2>
        ${recientes.length ? `<div class="rejilla">${tarjetas(recientes)}</div>` : '<p class="nada">Aquí aparecerán los autos que vayas abriendo.</p>'}</section>`;

    salir();
    try {
      const tickets = await ticketsGuardados();
      $('#mis-tickets').innerHTML = tickets.length
        ? tickets.map(filaTicket).join('')
        : '<p class="nada">Aún no generas tickets.</p>';
    } catch (err) {
      $('#mis-tickets').innerHTML = `<p class="nada">${esc(err.message)}</p>`;
    }
  }

  /* ---------- cabecera y pie (iguales en todas las páginas) ---------- */
  function comun() {
    const pagina = document.body.dataset.pagina;
    const enlace = (href, texto, clave) => `<a href="${href}"${pagina === clave ? ' class="activo"' : ''}>${texto}</a>`;
    const nombreCorto = SESION ? esc(SESION.nombre.split(' ')[0]) : 'Entrar';

    document.body.insertAdjacentHTML('afterbegin', `
      <header class="cabecera">
        <div class="contenedor cabecera__fila">
          <a class="marca" href="index.html">
            <span class="marca__sello">${esc(NEGOCIO.nombre.slice(0, 2).toUpperCase())}</span>
            <span class="marca__texto">${esc(NEGOCIO.nombre)}<small>Seminuevos y autopartes</small></span>
          </a>
          <nav class="menu" id="menu" aria-label="Principal">
            ${enlace('index.html', 'Inicio', 'inicio')}
            ${enlace('seminuevos.html', 'Seminuevos', 'seminuevos')}
            ${enlace('autopartes.html', 'Autopartes', 'autopartes')}
            ${SESION && SESION.rol === 'dueno' ? enlace('panel.html', 'Panel', 'panel') : ''}
            <a class="menu__cuenta" href="cuenta.html">${SESION ? 'Mi cuenta' : 'Entrar o crear cuenta'}</a>
          </nav>
          ${ES_DUENO ? '' : '<a class="cabecera__ticket" href="ticket.html">Mi ticket <b data-cuenta-ticket hidden>0</b></a>'}
          <a class="cabecera__cuenta" href="cuenta.html" title="${SESION ? 'Mi cuenta' : 'Iniciar sesión o crear cuenta'}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>${nombreCorto}
          </a>
          <button class="menu-boton" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="menu"><span></span></button>
        </div>
      </header>
      ${D.sin_bd ? '<p class="aviso aviso--mal contenedor" style="margin-top:16px">El sitio aún no está instalado o no hay conexión a la base de datos. Abre <a href="instalar.php">instalar.php</a>.</p>' : ''}`);

    document.body.insertAdjacentHTML('beforeend', `
      <footer class="pie" id="contacto">
        <div class="contenedor pie__rejilla">
          <div><p class="pie__marca">${esc(NEGOCIO.nombre)}</p><p>Autos seminuevos y autopartes usadas.</p></div>
          <div><h4>Visítanos</h4><p>${esc(NEGOCIO.direccion)}</p><p>${esc(NEGOCIO.horario)}</p><p><a href="index.html#ubicacion">Ver mapa</a></p></div>
          <div><h4>Contacto</h4><p>Tel. ${esc(NEGOCIO.telefono)}</p>
            <p><a href="${whats('Hola, vi su página y quiero más información.')}" target="_blank" rel="noopener">Enviar WhatsApp</a></p></div>
        </div>
        <p class="pie__legal">© ${new Date().getFullYear()} ${esc(NEGOCIO.nombre)} · Sitio desarrollado por PenSol</p>
      </footer>`);

    const boton = $('.menu-boton');
    const menu = $('#menu');
    boton.addEventListener('click', () => {
      boton.setAttribute('aria-expanded', menu.classList.toggle('abierto'));
    });
    pintarContador();
  }

  // lo que usa js/panel.js
  // lo que el dueño haya dejado en este navegador antes de iniciar sesión no debe seguirlo
  if (ES_DUENO) {
    ticket = [];
    ['igris_ticket', 'igris_folios', 'igris_vistos'].forEach((k) => { try { localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } });
  }

  window.IGRIS = { tarjeta, $, $$, esc, dinero, miles, fecha, fechaHora, titulo, enExistencia, fotoSrc, tono, sello, estadoDe, api, aviso, SESION, NEGOCIO, DATOS: D };

  comun();
  const paginas = { inicio: paginaInicio, seminuevos: paginaSeminuevos, autopartes: paginaAutopartes, detalle: paginaDetalle, ticket: paginaTicket, cuenta: paginaCuenta };
  const pagina = paginas[document.body.dataset.pagina];
  if (pagina) pagina();
})();
