// Panel administrador: inventario, fotos, piezas, tickets y datos del negocio.
(function () {
  'use strict';
  const { $, $$, esc, dinero, fecha, fechaHora, titulo, enExistencia, fotoSrc, tono, sello, estadoDe, tarjeta, api, aviso, SESION } = window.IGRIS;
  const destino = $('#panel');

  if (!SESION || SESION.rol !== 'dueno') {
    destino.innerHTML = `<div class="vacio"><h3>Solo para el dueño</h3><p>Inicia sesión con la cuenta del dueño para administrar el sitio.</p>
      <a class="boton" href="cuenta.html">Iniciar sesión</a></div>`;
    return;
  }

  // app.js agrega una foto provisional a los vehículos sin fotos; aquí solo interesan las reales
  const soloReales = (lista) => lista.map((a) => ({ ...a, fotos: a.fotos.filter((f) => f.id) }));

  let inventario = soloReales(window.IGRIS.DATOS.inventario);
  let negocio = window.IGRIS.DATOS.negocio;
  let tickets = null;
  let vista = 'inventario';
  let filtro = { texto: '', tipo: '' };
  let buscarTicket = '';

  // estado del editor
  let editando = null;   // {id} si ya existe, {tipo} si es nuevo
  let borrador = {};     // lo escrito en el formulario (sobrevive a los repintados)
  let pendientes = [];   // fotos elegidas antes de guardar un vehículo nuevo: {archivo, url, vista}
  let subiendo = '';

  const VISTAS_FOTO = ['Frente', 'Lateral', 'Trasera', 'Interior', 'Tablero', 'Motor', 'Cajuela', 'Detalle'];
  const MARCAS = ['Audi', 'BMW', 'Chevrolet', 'Dodge', 'Fiat', 'Ford', 'Honda', 'Hyundai', 'Jeep', 'Kia', 'Mazda', 'Mercedes-Benz', 'Mitsubishi', 'Nissan', 'Peugeot', 'Renault', 'Seat', 'Suzuki', 'Toyota', 'Volkswagen'];
  const CAMPOS = ['marca', 'modelo', 'version', 'anio', 'precio', 'km', 'transmision', 'motor', 'combustible', 'color', 'puertas', 'duenos', 'estado', 'descripcion'];

  const actual = () => (editando && editando.id ? inventario.find((x) => x.id === editando.id) : null);
  const tipoActual = () => (actual() ? actual().tipo : editando.tipo);
  const opciones = (lista) => lista.map((x) => `<option value="${esc(x)}">`).join('');
  const usados = (campo) => Array.from(new Set(inventario.map((a) => a[campo]).filter(Boolean)));

  async function recargar() {
    const d = await api('datos.php?json=1');
    inventario = soloReales(d.inventario);
    negocio = d.negocio;
  }

  // ejecuta una acción del panel, recarga los datos y vuelve a pintar
  async function accion(datos, mensaje) {
    try {
      const r = await api('admin.php', datos);
      await recargar();
      pintar();
      if (mensaje) aviso(mensaje);
      return r;
    } catch (err) {
      aviso(err.message);
      return null;
    }
  }

  function abrirEditor(objetivo) {
    editando = objetivo;
    pendientes.forEach((p) => URL.revokeObjectURL(p.url));
    pendientes = [];
    const a = actual();
    borrador = {};
    CAMPOS.forEach((c) => { borrador[c] = a && a[c] != null ? String(a[c]) : ''; });
    if (!borrador.estado) borrador.estado = 'disponible';
    vista = 'editar';
    pintar();
    scrollTo(0, 0);
  }

  const pendientesTickets = () => (tickets ? tickets.filter((t) => !t.atendido).length : 0);

  const pestanas = () => `
    <div class="panel__cabeza">
      <h1 class="titulo-pagina">Panel administrador</h1>
      <div class="segmentos">
        ${[['inventario', 'Inventario'], ['tickets', `Tickets${pendientesTickets() ? ` (${pendientesTickets()})` : ''}`], ['negocio', 'Datos del negocio']].map(([k, t]) =>
          `<button type="button" data-vista="${k}" class="${vista === k || (k === 'inventario' && vista === 'editar') ? 'activo' : ''}">${t}</button>`).join('')}
      </div>
    </div>`;

  /* ---------- inventario ---------- */
  function filasInventario() {
    const t = filtro.texto.trim().toLowerCase();
    const lista = inventario.filter((a) =>
      (!filtro.tipo || a.tipo === filtro.tipo) &&
      (!t || `${titulo(a)} ${a.anio}`.toLowerCase().includes(t)));

    return lista.map((a) => {
      const mini = fotoSrc(a.fotos[0] || { src: '', vista: '' }, tono(a));
      const estado = a.tipo === 'seminuevo'
        ? `<select data-estado-vehiculo="${a.id}" class="select-estado select-estado--${a.estado}" aria-label="Estado de ${esc(titulo(a))}">
            ${['disponible', 'apartado', 'vendido'].map((e) => `<option value="${e}"${a.estado === e ? ' selected' : ''}>${e[0].toUpperCase() + e.slice(1)}</option>`).join('')}
           </select>`
        : `${sello(estadoDe(a))} <small>${enExistencia(a)} de ${a.partes.length} piezas</small>`;
      const falta = a.fotos.length ? '' : ' · <span class="falta">sin fotos</span>';
      return `<tr>
        <td><img class="mini" src="${esc(mini)}" data-vista="" alt=""></td>
        <td data-t="Vehículo"><strong>${esc(titulo(a))} ${a.anio}</strong><small>${a.tipo === 'seminuevo' ? 'Seminuevo · ' + dinero(a.precio) : 'Para autopartes'} · ${a.fotos.length} fotos${falta} · ${fecha(a.agregado)}</small></td>
        <td data-t="Estado">${estado}</td>
        <td class="acciones">
          <button type="button" class="boton boton--chico" data-editar="${a.id}">Editar</button>
          <a class="boton boton--chico boton--linea" href="detalle.html?id=${a.id}" target="_blank" rel="noopener">Ver</a>
          <button type="button" class="boton boton--chico boton--peligro" data-borrar-vehiculo="${a.id}">Eliminar</button>
        </td>
      </tr>`;
    }).join('') || `<tr><td colspan="4" class="piezas__vacio">${inventario.length ? 'Ningún vehículo coincide con la búsqueda.' : 'Aún no hay vehículos. Agrega el primero con los botones de arriba.'}</td></tr>`;
  }

  function vistaInventario() {
    const semis = inventario.filter((a) => a.tipo === 'seminuevo');
    const partes = inventario.filter((a) => a.tipo === 'autopartes');
    const piezas = partes.reduce((s, a) => s + enExistencia(a), 0);
    return `
      <div class="tablero">
        <div class="caja dato"><b>${semis.length}</b><span>Seminuevos</span><small>${semis.filter((a) => a.estado === 'disponible').length} disponibles</small>
          <button type="button" class="boton boton--amarillo" data-nuevo="seminuevo">+ Agregar seminuevo</button></div>
        <div class="caja dato"><b>${partes.length}</b><span>Autos para autopartes</span><small>${piezas} piezas en existencia</small>
          <button type="button" class="boton boton--amarillo" data-nuevo="autopartes">+ Agregar auto para piezas</button></div>
        <div class="caja dato"><b>${tickets ? pendientesTickets() : '…'}</b><span>Tickets pendientes</span><small>${tickets ? tickets.length + ' en total' : 'Cargando'}</small>
          <button type="button" class="boton boton--linea" data-vista="tickets">Ver tickets</button></div>
      </div>
      <div class="panel__barra">
        <input type="search" id="buscar-inventario" class="entrada" placeholder="Buscar en el inventario" value="${esc(filtro.texto)}" aria-label="Buscar en el inventario">
        <div class="segmentos">
          ${[['', 'Todos'], ['seminuevo', 'Seminuevos'], ['autopartes', 'Autopartes']].map(([k, t]) =>
            `<button type="button" data-filtro-tipo="${k}" class="${filtro.tipo === k ? 'activo' : ''}">${t}</button>`).join('')}
        </div>
      </div>
      <div class="tabla-envoltura">
        <table class="piezas tabla-panel">
          <thead><tr><th></th><th>Vehículo</th><th>Estado</th><th></th></tr></thead>
          <tbody id="filas-inventario">${filasInventario()}</tbody>
        </table>
      </div>`;
  }

  /* ---------- editor de un vehículo ---------- */
  // el vehículo tal como quedaría con lo que hay escrito, para la vista previa
  function vehiculoBorrador() {
    const a = actual();
    const fotos = [...(a ? a.fotos : []), ...pendientes.map((p) => ({ src: p.url, vista: p.vista }))];
    return {
      id: a ? a.id : 0,
      tipo: tipoActual(),
      agregado: a ? a.agregado : new Date().toISOString().slice(0, 10),
      partes: a && a.partes ? a.partes : [],
      ...borrador,
      marca: borrador.marca || 'Marca',
      modelo: borrador.modelo || 'Modelo',
      anio: borrador.anio || 'Año',
      precio: Number(borrador.precio) || 0,
      km: Number(borrador.km) || 0,
      fotos: fotos.length ? fotos : [{ src: '', vista: '' }],
      sinFotos: !fotos.length
    };
  }

  function vistaPrevia() {
    const v = vehiculoBorrador();
    const faltan = [];
    if (!borrador.marca || !borrador.modelo) faltan.push('marca y modelo');
    if (!borrador.anio) faltan.push('año');
    if (v.tipo === 'seminuevo' && !borrador.precio) faltan.push('precio');
    if (v.sinFotos) faltan.push('al menos una foto');
    if (v.tipo === 'autopartes' && !v.partes.length) faltan.push('las piezas');
    return `<div class="previa__tarjeta">${tarjeta(v)}</div>
      ${faltan.length
        ? `<p class="previa__falta">Falta: ${faltan.join(', ')}.</p>`
        : '<p class="previa__bien">Completo. Así se ve en el sitio.</p>'}`;
  }

  function seccionFotos() {
    const a = actual();
    const selectVista = (valor, atributo) => `<select ${atributo} aria-label="Qué muestra la foto">
      <option value="">Sin etiqueta</option>
      ${VISTAS_FOTO.map((x) => `<option${x === valor ? ' selected' : ''}>${x}</option>`).join('')}</select>`;

    const guardadas = a ? a.fotos.map((f, i) => `<figure class="${i === 0 ? 'es-portada' : ''}">
        <img src="${esc(f.src)}" data-vista="${esc(f.vista)}" alt="">
        ${i === 0 ? '<span class="insignia">Portada</span>' : ''}
        ${selectVista(f.vista, `data-vista-foto="${f.id}"`)}
        <div class="foto__botones">
          ${i === 0 ? '' : `<button type="button" class="enlace-boton" data-portada="${f.id}">Hacer portada</button>`}
          <button type="button" class="quitar" data-borrar-foto="${f.id}">Eliminar</button>
        </div>
      </figure>`).join('') : '';

    const enEspera = pendientes.map((p, i) => `<figure class="en-espera">
        <img src="${p.url}" alt="">
        <span class="insignia insignia--espera">${i === 0 && !a ? 'Portada · se sube al guardar' : 'Se sube al guardar'}</span>
        ${selectVista(p.vista, `data-vista-pendiente="${i}"`)}
        <div class="foto__botones"><button type="button" class="quitar" data-quitar-pendiente="${i}">Quitar</button></div>
      </figure>`).join('');

    return `<section class="bloque" id="sec-fotos">
      <h2>2 · Fotos</h2>
      <label class="soltar" id="soltar">
        <input type="file" id="foto-archivos" accept="image/jpeg,image/png,image/webp" multiple hidden>
        <strong>${subiendo || 'Arrastra las fotos aquí o toca para elegirlas'}</strong>
        <span>Puedes elegir varias. Se reducen solas para que carguen rápido. La primera es la portada.</span>
      </label>
      ${guardadas || enEspera ? `<div class="fotos-panel">${guardadas}${enEspera}</div>` : ''}
    </section>`;
  }

  function seccionPiezas() {
    const a = actual();
    if (!a) {
      return `<section class="bloque" id="sec-piezas"><h2>3 · Piezas</h2>
        <p class="caja nada">Guarda primero el vehículo y aquí podrás ir agregando sus piezas una por una.</p></section>`;
    }
    const categorias = Array.from(new Set(inventario.flatMap((x) => (x.partes || []).map((p) => p.categoria)).filter(Boolean))).sort();
    return `<section class="bloque" id="sec-piezas">
      <h2>3 · Piezas <small>${enExistencia(a)} en existencia de ${a.partes.length}</small></h2>
      <form class="caja formulario formulario--linea" id="f-parte">
        <input type="hidden" name="id" value="">
        <label class="campo campo--crece">Pieza<input name="nombre" required maxlength="120" placeholder="Ej. Faro delantero izquierdo"></label>
        <label class="campo">Categoría<input name="categoria" maxlength="60" list="categorias" placeholder="Ej. Iluminación"></label>
        <label class="campo">Código<input name="codigo" maxlength="30" placeholder="Opcional"></label>
        <label class="campo">Precio<input name="precio" type="number" min="0" required></label>
        <label class="campo">Disponibilidad<select name="estado"><option value="existencia">En existencia</option><option value="agotado">Agotado</option></select></label>
        <button class="boton" type="submit" id="parte-enviar">+ Agregar pieza</button>
        <button class="boton boton--linea" type="reset" id="parte-cancelar" hidden>Cancelar</button>
        <datalist id="categorias">${opciones(categorias)}</datalist>
      </form>
      <div class="tabla-envoltura">
        <table class="piezas tabla-panel">
          <thead><tr><th>Pieza</th><th>Categoría</th><th>Código</th><th>Precio</th><th>Disponibilidad</th><th></th></tr></thead>
          <tbody>${a.partes.map((p) => `<tr>
            <td data-t="Pieza"><strong>${esc(p.nombre)}</strong></td>
            <td data-t="Categoría">${esc(p.categoria)}</td>
            <td data-t="Código"><code>${esc(p.codigo)}</code></td>
            <td data-t="Precio">${dinero(p.precio)}</td>
            <td data-t="Disponibilidad"><select data-estado-parte="${p.id}" class="select-estado select-estado--${p.estado}" aria-label="Disponibilidad de ${esc(p.nombre)}">
              <option value="existencia"${p.estado === 'existencia' ? ' selected' : ''}>En existencia</option>
              <option value="agotado"${p.estado === 'agotado' ? ' selected' : ''}>Agotado</option></select></td>
            <td class="acciones">
              <button type="button" class="boton boton--chico boton--linea" data-editar-parte="${p.id}">Editar</button>
              <button type="button" class="boton boton--chico boton--peligro" data-borrar-parte="${p.id}">Eliminar</button>
            </td>
          </tr>`).join('') || '<tr><td colspan="6" class="piezas__vacio">Este vehículo aún no tiene piezas. Agrega la primera arriba.</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;
  }

  function vistaEditar() {
    const a = actual();
    const semi = tipoActual() === 'seminuevo';
    const campo = (nombre, etiqueta, extra = '') => `<label class="campo">${etiqueta}<input name="${nombre}" value="${esc(borrador[nombre])}" ${extra}></label>`;
    const selector = (nombre, etiqueta, valores) => `<label class="campo">${etiqueta}<select name="${nombre}">
      ${valores.map(([v, t]) => `<option value="${esc(v)}"${borrador[nombre] === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
    const combustibles = ['', 'Gasolina', 'Diésel', 'Híbrido', 'Eléctrico', 'Gas LP'];
    if (borrador.combustible && !combustibles.includes(borrador.combustible)) combustibles.push(borrador.combustible);

    return `
      <p><button type="button" class="enlace-boton" data-vista="inventario">← Volver al inventario</button></p>
      <h2 class="panel__titulo">${a ? 'Editar ' + esc(titulo(a)) + ' ' + a.anio : (semi ? 'Nuevo seminuevo' : 'Nuevo auto para autopartes')}</h2>
      <div class="editor">
        <div class="editor__formulario">
          <section class="bloque bloque--primero" id="sec-datos">
            <h2>1 · Datos del vehículo</h2>
            <form class="caja formulario formulario--rejilla" id="f-vehiculo" autocomplete="off">
              ${campo('marca', 'Marca', 'required maxlength="60" list="lista-marcas" placeholder="Ej. Nissan"')}
              ${campo('modelo', 'Modelo', 'required maxlength="60" list="lista-modelos" placeholder="Ej. Versa"')}
              ${campo('version', 'Versión', 'maxlength="60" placeholder="Ej. Advance"')}
              ${campo('anio', 'Año', `required type="number" min="1950" max="${new Date().getFullYear() + 1}" placeholder="Ej. 2020"`)}
              ${semi ? campo('precio', 'Precio (MXN)', 'required type="number" min="0" step="500" placeholder="Ej. 229000"') : ''}
              ${semi ? campo('km', 'Kilometraje', 'type="number" min="0" placeholder="Ej. 48500"') : ''}
              ${campo('transmision', 'Transmisión', 'maxlength="60" list="lista-transmisiones" placeholder="Ej. Automática"')}
              ${campo('motor', 'Motor', 'maxlength="60" placeholder="Ej. 1.6 L · 4 cilindros"')}
              ${selector('combustible', 'Combustible', combustibles.map((c) => [c, c || 'Sin especificar']))}
              ${campo('color', 'Color', 'maxlength="40"')}
              ${semi ? campo('puertas', 'Puertas', 'type="number" min="2" max="6"') : ''}
              ${semi ? campo('duenos', 'Propietarios', 'maxlength="40" list="lista-duenos" placeholder="Ej. Único dueño"') : ''}
              ${semi ? selector('estado', 'Estado', [['disponible', 'Disponible'], ['apartado', 'Apartado'], ['vendido', 'Vendido']]) : ''}
              <label class="campo campo--todo">${semi ? 'Descripción' : 'Nota del vehículo (golpe, qué está completo…)'}
                <textarea name="descripcion" rows="3" maxlength="2000">${esc(borrador.descripcion)}</textarea></label>
              <datalist id="lista-marcas">${opciones(Array.from(new Set([...usados('marca'), ...MARCAS])).sort())}</datalist>
              <datalist id="lista-modelos">${opciones(usados('modelo').sort())}</datalist>
              <datalist id="lista-transmisiones">${opciones(['Manual', 'Automática', 'Automática CVT', 'Manual 5 velocidades', 'Manual 6 velocidades'])}</datalist>
              <datalist id="lista-duenos">${opciones(['Único dueño', 'Dos dueños', 'Tres o más dueños'])}</datalist>
            </form>
          </section>
          ${seccionFotos()}
          ${semi ? '' : seccionPiezas()}
          <div class="editor__guardar">
            <button class="boton boton--amarillo boton--ancho" type="submit" form="f-vehiculo" id="guardar-vehiculo">
              ${a ? 'Guardar cambios' : (pendientes.length ? `Guardar vehículo y subir ${pendientes.length} ${pendientes.length === 1 ? 'foto' : 'fotos'}` : 'Guardar vehículo')}</button>
          </div>
        </div>
        <aside class="previa">
          <p class="ceja">Vista previa</p>
          <div id="previa">${vistaPrevia()}</div>
          ${a ? `<a class="enlace" href="detalle.html?id=${a.id}" target="_blank" rel="noopener">Abrir la página del vehículo</a>` : ''}
        </aside>
      </div>`;
  }

  // reduce la foto en el navegador (lado mayor 1600 px) antes de subirla
  function reducir(archivo) {
    return new Promise((resolver, rechazar) => {
      const img = new Image();
      const url = URL.createObjectURL(archivo);
      img.onload = () => {
        const escala = Math.min(1, 1600 / Math.max(img.width, img.height));
        const lienzo = document.createElement('canvas');
        lienzo.width = Math.round(img.width * escala);
        lienzo.height = Math.round(img.height * escala);
        lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
        URL.revokeObjectURL(url);
        lienzo.toBlob((b) => (b ? resolver(b) : rechazar(new Error('No se pudo procesar la foto.'))), 'image/jpeg', 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error(`"${archivo.name}" no es una imagen válida.`)); };
      img.src = url;
    });
  }

  // sube una lista de {archivo, vista} al vehículo indicado; devuelve cuántas se subieron
  async function subir(vehiculoId, lista) {
    let subidas = 0;
    for (const foto of lista) {
      subiendo = `Subiendo foto ${subidas + 1} de ${lista.length}…`;
      const texto = $('#soltar strong');
      if (texto) texto.textContent = subiendo;
      try {
        const cuerpo = new FormData();
        cuerpo.append('accion', 'subir_foto');
        cuerpo.append('vehiculo_id', vehiculoId);
        cuerpo.append('vista', foto.vista);
        cuerpo.append('foto', await reducir(foto.archivo), 'foto.jpg');
        await api('admin.php', cuerpo);
        subidas++;
      } catch (err) {
        aviso(err.message);
      }
    }
    subiendo = '';
    return subidas;
  }

  async function recibirFotos(archivos) {
    const imagenes = archivos.filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type));
    if (imagenes.length < archivos.length) aviso('Solo se aceptan fotos JPG, PNG o WebP.');
    if (!imagenes.length) return;

    if (!editando.id) {
      // vehículo nuevo: se quedan en espera y se suben al guardar
      imagenes.forEach((archivo) => pendientes.push({ archivo, url: URL.createObjectURL(archivo), vista: '' }));
      pintar();
      return;
    }
    const subidas = await subir(editando.id, imagenes.map((archivo) => ({ archivo, vista: '' })));
    await recargar();
    pintar();
    if (subidas) aviso(subidas === 1 ? 'Foto subida.' : `${subidas} fotos subidas.`);
  }

  /* ---------- tickets ---------- */
  function vistaTickets() {
    if (!tickets) return '<p class="nada">Cargando tickets…</p>';
    const t = buscarTicket.trim().toUpperCase();
    const lista = tickets.filter((x) => !t || x.folio.includes(t) || x.nombre.toUpperCase().includes(t));
    return `
      <div class="panel__barra">
        <input type="search" id="buscar-ticket" class="entrada" placeholder="Buscar por folio o nombre" value="${esc(buscarTicket)}" aria-label="Buscar ticket">
        <span class="nada">${lista.length} de ${tickets.length} tickets</span>
      </div>
      <div class="tickets-panel">
        ${lista.map((x) => `<article class="caja ticket-panel${x.atendido ? ' ticket-panel--atendido' : ''}">
          <header>
            <div><strong>${esc(x.folio)}</strong><small>${fechaHora(x.creado)}${x.nombre ? ' · ' + esc(x.nombre) : ''}${x.correo ? ' · ' + esc(x.correo) : ' · sin cuenta'}</small></div>
            <label class="casilla"><input type="checkbox" data-atendido="${x.id}"${x.atendido ? ' checked' : ''}> Atendido</label>
          </header>
          <ul>${x.items.map((i) => `<li><span>${esc(i.descripcion)}</span><b>${dinero(i.precio)}</b></li>`).join('')}</ul>
          <footer><span>Total de referencia</span><b>${dinero(x.total)}</b></footer>
        </article>`).join('') || '<p class="nada">No hay tickets que coincidan.</p>'}
      </div>`;
  }

  /* ---------- datos del negocio ---------- */
  function vistaNegocio() {
    const campo = (nombre, etiqueta, extra = '') => `<label class="campo">${etiqueta}<input name="${nombre}" value="${esc(negocio[nombre])}" ${extra}></label>`;
    return `<form class="caja formulario" id="f-negocio" style="max-width:560px">
      ${campo('nombre', 'Nombre del negocio', 'required maxlength="60"')}
      ${campo('whatsapp', 'WhatsApp al que llegan los tickets (10 dígitos)', 'required inputmode="numeric"')}
      ${campo('telefono', 'Teléfono que se muestra', 'maxlength="40"')}
      ${campo('direccion', 'Dirección', 'maxlength="200"')}
      ${campo('horario', 'Horario', 'maxlength="120"')}
      ${campo('mapa', 'Ubicación en el mapa (dirección exacta o coordenadas)', 'maxlength="200" placeholder="Ej. 19.4326, -99.1332"')}
      <button class="boton boton--amarillo" type="submit">Guardar datos</button>
    </form>`;
  }

  /* ---------- pintado y eventos ---------- */
  function pintar() {
    const cuerpo = { inventario: vistaInventario, editar: vistaEditar, tickets: vistaTickets, negocio: vistaNegocio }[vista]();
    destino.innerHTML = pestanas() + cuerpo;
  }

  function ir(nueva) {
    vista = nueva;
    pintar();
    scrollTo(0, 0);
  }

  destino.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.vista) ir(d.vista);
    else if (d.nuevo) abrirEditor({ tipo: d.nuevo });
    else if (d.editar) abrirEditor({ id: Number(d.editar) });
    else if ('filtroTipo' in d) { filtro.tipo = d.filtroTipo; pintar(); }
    else if (d.borrarVehiculo) {
      const a = inventario.find((x) => x.id === Number(d.borrarVehiculo));
      if (confirm(`¿Eliminar "${titulo(a)} ${a.anio}" con sus fotos y piezas? No se puede deshacer.`)) {
        accion({ accion: 'borrar_vehiculo', id: a.id }, 'Vehículo eliminado.');
      }
    }
    else if (d.portada) accion({ accion: 'portada_foto', id: Number(d.portada) }, 'Portada cambiada.');
    else if (d.borrarFoto) {
      if (confirm('¿Eliminar esta foto?')) accion({ accion: 'borrar_foto', id: Number(d.borrarFoto) }, 'Foto eliminada.');
    }
    else if (d.quitarPendiente) {
      const [fuera] = pendientes.splice(Number(d.quitarPendiente), 1);
      URL.revokeObjectURL(fuera.url);
      pintar();
    }
    else if (d.borrarParte) {
      if (confirm('¿Eliminar esta pieza?')) accion({ accion: 'borrar_parte', id: Number(d.borrarParte) }, 'Pieza eliminada.');
    }
    else if (d.editarParte) {
      const p = actual().partes.find((x) => x.id === Number(d.editarParte));
      const f = $('#f-parte').elements;
      ['id', 'nombre', 'categoria', 'codigo', 'precio', 'estado'].forEach((c) => { f[c].value = p[c]; });
      $('#parte-enviar').textContent = 'Guardar pieza';
      $('#parte-cancelar').hidden = false;
      $('#f-parte').scrollIntoView({ block: 'center' });
      f.nombre.focus();
    }
  });

  destino.addEventListener('reset', (e) => {
    // getAttribute: el formulario tiene un campo llamado "id" que tapa a form.id
    if (e.target.getAttribute('id') !== 'f-parte') return;
    e.target.elements.id.value = '';
    $('#parte-enviar').textContent = '+ Agregar pieza';
    $('#parte-cancelar').hidden = true;
  });

  destino.addEventListener('change', (e) => {
    const d = e.target.dataset;
    if (d.estadoVehiculo) accion({ accion: 'estado_vehiculo', id: Number(d.estadoVehiculo), estado: e.target.value }, 'Estado actualizado.');
    else if (d.estadoParte) accion({ accion: 'estado_parte', id: Number(d.estadoParte), estado: e.target.value }, 'Disponibilidad actualizada.');
    else if (d.vistaFoto) accion({ accion: 'vista_foto', id: Number(d.vistaFoto), vista: e.target.value });
    else if (d.vistaPendiente) pendientes[Number(d.vistaPendiente)].vista = e.target.value;
    else if (d.atendido) {
      const id = Number(d.atendido);
      api('admin.php', { accion: 'ticket_atendido', id, atendido: e.target.checked })
        .then(() => { tickets.find((x) => x.id === id).atendido = e.target.checked; pintar(); })
        .catch((err) => aviso(err.message));
    }
    else if (e.target.id === 'foto-archivos' && e.target.files.length) recibirFotos(Array.from(e.target.files));
  });

  destino.addEventListener('input', (e) => {
    const el = e.target;
    if (el.form && el.form.id === 'f-vehiculo') {
      // lo escrito se guarda en el borrador y la vista previa se actualiza al momento
      borrador[el.name] = el.value;
      $('#previa').innerHTML = vistaPrevia();
    } else if (el.id === 'buscar-inventario') {
      filtro.texto = el.value;
      $('#filas-inventario').innerHTML = filasInventario();
    } else if (el.id === 'buscar-ticket') {
      buscarTicket = el.value;
      pintar();
      const campo = $('#buscar-ticket');
      campo.focus();
      campo.setSelectionRange(campo.value.length, campo.value.length);
    }
  });

  // arrastrar y soltar fotos
  ['dragenter', 'dragover'].forEach((tipo) => destino.addEventListener(tipo, (e) => {
    const zona = e.target.closest && e.target.closest('#soltar');
    if (!zona) return;
    e.preventDefault();
    zona.classList.add('encima');
  }));
  ['dragleave', 'drop'].forEach((tipo) => destino.addEventListener(tipo, (e) => {
    const zona = e.target.closest && e.target.closest('#soltar');
    if (!zona) return;
    e.preventDefault();
    zona.classList.remove('encima');
    if (tipo === 'drop' && e.dataTransfer.files.length) recibirFotos(Array.from(e.dataTransfer.files));
  }));

  destino.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.target));
    const formulario = e.target.getAttribute('id');

    if (formulario === 'f-vehiculo') {
      const nuevo = !editando.id;
      const boton = $('#guardar-vehiculo');
      boton.disabled = true;
      try {
        const r = await api('admin.php', { accion: 'guardar_vehiculo', id: editando.id || 0, tipo: tipoActual(), ...borrador });
        const porSubir = pendientes;
        pendientes = [];
        const subidas = porSubir.length ? await subir(r.id, porSubir) : 0;
        porSubir.forEach((p) => URL.revokeObjectURL(p.url));
        await recargar();
        editando = { id: r.id };
        const conFotos = subidas ? ` con ${subidas} ${subidas === 1 ? 'foto' : 'fotos'}` : '';
        if (nuevo && tipoActual() === 'autopartes') {
          // un auto para piezas recién creado se queda abierto: falta capturar sus piezas
          pintar();
          aviso(`Vehículo guardado${conFotos}. Ahora agrega sus piezas.`);
          $('#sec-piezas').scrollIntoView();
        } else {
          ir('inventario');
          aviso(nuevo ? `Vehículo guardado${conFotos}.` : 'Cambios guardados.');
        }
      } catch (err) {
        boton.disabled = false;
        aviso(err.message);
      }
    } else if (formulario === 'f-parte') {
      const editar = Boolean(datos.id);
      await accion({ accion: 'guardar_parte', vehiculo_id: editando.id, ...datos, id: Number(datos.id) || 0 }, editar ? 'Pieza actualizada.' : 'Pieza agregada.');
      const nombre = $('#f-parte [name=nombre]');
      if (nombre) nombre.focus(); // listo para capturar la siguiente
    } else if (formulario === 'f-negocio') {
      await accion({ accion: 'guardar_ajustes', ...datos }, 'Datos guardados. Se verán al recargar la página.');
    }
  });

  // arranque: se puede llegar con panel.html?editar=ID o ?ver=tickets|negocio
  const params = new URLSearchParams(location.search);
  const pedido = inventario.find((a) => a.id === Number(params.get('editar')));
  if (pedido) abrirEditor({ id: pedido.id });
  else { if (['tickets', 'negocio'].includes(params.get('ver'))) vista = params.get('ver'); pintar(); }

  api('admin.php').then((r) => { tickets = r.tickets; if (vista !== 'editar') pintar(); }).catch((err) => aviso(err.message));
})();
