/* ============================================================
   MOZZAFIATO — DONATIVOS · código compartido
   (admin: donativos.html · institución: cupones.html · caja: caja.html)
   Requiere vendor/qrcode.js
   ============================================================ */
(function (global) {
  'use strict';

  // ── Supabase (misma cuenta/proyecto que PMS Regina Book y Producción) ──
  // La anon key es PÚBLICA por diseño; la seguridad la dan las funciones don_* (PIN, token, login).
  var SB_URL  = 'https://ujmecfdsbqtwxusqqiqi.supabase.co';
  var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqbWVjZmRzYnF0d3h1c3FxaXFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4NjMyMzYsImV4cCI6MjEwNTQzOTIzNn0.ZyeK1JW6tiHfvUmB2YP8n6gz-beGW8yfk8sHjN2Mq8c';

  var MOZZA = {
    nombre: 'Mozzafiato',
    lema: 'El placer del buen café',
    dir: 'Andador 65 × calle 66 y 68, Felipe Carrillo Puerto, Q. Roo',
    logo: 'images/logo.png'
  };

  // Normas generales: salen SIEMPRE en todos los cupones (imagen, página, caja)
  var NORMAS = [
    'Solo para consumir en el restaurante. No aplica para llevar ni a domicilio.',
    'Se usa una sola vez y completo; no genera saldo para otra visita.',
    'No canjeable por efectivo ni se da cambio.',
    'El consumo adicional a lo que incluye el cupón se paga normal.',
    'No se cambia por otros productos, salvo los marcados "a elegir".',
    'Válido solo dentro de su vigencia. No acumulable con otras promociones.',
    'Preséntalo en caja para validarlo antes de pedir tu cuenta.'
  ];
  // Texto que antes se guardaba por cupón (ya lo cubren las normas): no se repite
  var CONDICIONES_VIEJAS = 'Válido en una sola visita. No canjeable por efectivo. No acumulable con otras promociones.';
  var CONDICIONES_DEFAULT = '';
  function notaExtra(c) {
    var t = String((c && c.condiciones) || '').trim();
    return t && t !== CONDICIONES_VIEJAS ? t : '';
  }

  // ── Publicidad de Casa Regina (sale en las páginas de cupones) ──
  // Cambia aquí los textos o enlaces; con activo:false se oculta.
  var PROMO_REGINA = {
    activo: true,
    titulo: '¿Vienes de fuera o tienes visitas?',
    texto: 'Hospédate en Casa Regina Hotel Boutique y desayuna en Mozzafiato, nuestro restaurante asociado.',
    foto: 'images/casa-regina-portada.jpg',
    logo: 'images/casa-regina-logo.png',
    botones: [
      { texto: 'Reservar habitación', link: 'https://mozzafiatoamor-rgb.github.io/casa_regina_app/?reservar' },
      { texto: 'Síguenos en Facebook', link: 'https://www.facebook.com/share/1HwxUyNepJ/' }
    ]
  };
  function promoReginaHtml() {
    var P = PROMO_REGINA;
    if (!P.activo) return '';
    return '<aside class="promo-regina">' +
      '<div class="pr-foto" style="background-image:url(\'' + P.foto + '\')"><img src="' + P.logo + '" alt="Casa Regina Hotel Boutique"></div>' +
      '<div class="pr-cuerpo">' +
        '<div class="pr-titulo">' + esc(P.titulo) + '</div>' +
        '<div class="pr-texto">' + esc(P.texto) + '</div>' +
        '<div class="pr-botones">' + P.botones.map(function (b, i) {
          return '<a class="pr-btn' + (i ? ' sec' : '') + '" href="' + esc(b.link) + '" target="_blank" rel="noopener">' + esc(b.texto) + '</a>';
        }).join('') + '</div>' +
      '</div></aside>';
  }

  // ── Mensajes de error legibles ──
  var ERRORES = {
    NO_AUTORIZADO: 'Tu cuenta no tiene acceso a Donativos.',
    PIN_INCORRECTO: 'PIN de caja incorrecto.',
    DEMASIADOS_INTENTOS: 'Demasiados intentos con PIN incorrecto. Espera 10 minutos.',
    SIN_PIN_CAJA: 'Aún no hay PIN de caja. Defínelo en Donativos → Caja.',
    NO_EXISTE: 'No existe ningún cupón con ese folio.',
    YA_CANJEADO: 'Este cupón YA FUE CANJEADO.',
    CANCELADO: 'Este cupón fue CANCELADO.',
    VENCIDO: 'Este cupón está VENCIDO.',
    AUN_NO_VALIDO: 'Este cupón AÚN NO ES VÁLIDO (todavía no llega su fecha).',
    FECHAS_INVERTIDAS: 'La fecha "Válido desde" no puede ser después de "Válido hasta".',
    FALTA_NOMBRE: 'Escribe el nombre de quien canjea.',
    FALTA_TELEFONO: 'Escribe el teléfono de quien canjea.',
    FALTA_INSTITUCION: 'Falta el nombre de la institución.',
    FALTA_TITULO_CUPON: 'Cada cupón necesita un nombre (ej. "Premio 1").',
    FALTA_MONTO: 'Un cupón de monto necesita la cantidad en pesos.',
    FALTAN_PRODUCTOS: 'Un cupón de productos necesita al menos un producto.',
    TIENE_CANJEADOS: 'No se puede borrar: ya tiene cupones canjeados.',
    PIN_CORTO: 'El PIN debe tener al menos 4 dígitos.'
  };
  function textoError(e) {
    var m = (e && (e.message || e.msg || e.error_description || e.error)) || String(e || 'Error');
    for (var k in ERRORES) if (m.indexOf(k) !== -1) return ERRORES[k];
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sin conexión. Revisa el internet e intenta de nuevo.';
    if (/JWT expired/i.test(m)) return 'Tu sesión expiró. Vuelve a entrar.';
    if (/could not find the function/i.test(m)) return 'Falta instalar Donativos en Supabase (corre donativos.sql).';
    return m;
  }

  // ── Sesión de admin (login de Supabase) ──
  var SES_KEY = 'don.sesion';
  function getSesion() { try { return JSON.parse(localStorage.getItem(SES_KEY) || 'null'); } catch (e) { return null; } }
  function setSesion(s) { try { s ? localStorage.setItem(SES_KEY, JSON.stringify(s)) : localStorage.removeItem(SES_KEY); } catch (e) {} }

  async function authFetch(grant, body) {
    var r = await fetch(SB_URL + '/auth/v1/token?grant_type=' + grant, {
      method: 'POST',
      headers: { 'apikey': SB_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) {
      var msg = j.error_description || j.msg || j.message || 'No se pudo iniciar sesión';
      if (/invalid login/i.test(msg)) msg = 'Correo o contraseña incorrectos.';
      throw new Error(msg);
    }
    var s = { access_token: j.access_token, refresh_token: j.refresh_token,
              expires_at: Date.now() + (j.expires_in || 3600) * 1000, email: j.user && j.user.email };
    setSesion(s);
    return s;
  }
  function login(email, password) { return authFetch('password', { email: email, password: password }); }
  function logout() { setSesion(null); }
  async function tokenVigente() {
    var s = getSesion();
    if (!s) return null;
    if (Date.now() < s.expires_at - 60000) return s.access_token;
    try { return (await authFetch('refresh_token', { refresh_token: s.refresh_token })).access_token; }
    catch (e) { setSesion(null); return null; }
  }

  // ── Llamar funciones don_* ──
  async function rpc(fn, args, conSesion) {
    var token = SB_ANON;
    if (conSesion) {
      token = await tokenVigente();
      if (!token) throw new Error('SIN_SESION');
    }
    var r = await fetch(SB_URL + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { 'apikey': SB_ANON, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {})
    });
    var txt = await r.text();
    var j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = txt; }
    if (!r.ok) throw new Error((j && (j.message || j.hint)) || ('Error ' + r.status));
    return j;
  }

  // ── Formatos ──
  var mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
  function dinero(n) { return mxn.format(Number(n) || 0); }
  var MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  function fecha(iso) { // 'YYYY-MM-DD' → '31 de enero de 2027'
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    return (+p[2]) + ' de ' + MESES[(+p[1]) - 1] + ' de ' + p[0];
  }
  function fechaCorta(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    return (+p[2]) + ' ' + MESES[(+p[1]) - 1].slice(0, 3) + ' ' + p[0];
  }
  function fechaHora(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    return d.toLocaleString('es-MX', { timeZone: 'America/Cancun', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  function hoyISO() {
    var d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Cancun' }));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function telWa(t) { // a formato wa.me (México)
    var d = String(t || '').replace(/\D/g, '');
    if (d.length === 10) d = '52' + d;
    return d;
  }
  function waLink(tel, texto) {
    var n = telWa(tel);
    return 'https://wa.me/' + n + '?text=' + encodeURIComponent(texto);
  }

  // ── URLs (misma carpeta que esta página) ──
  function base() { return location.origin + location.pathname.replace(/[^/]*$/, ''); }
  function urlInstitucion(token) { return base() + 'cupones.html?t=' + token; }
  function urlCupon(token) { return base() + 'cupones.html?c=' + token; }
  function urlCaja(folio) { return base() + 'caja.html' + (folio ? '?f=' + encodeURIComponent(folio) : ''); }

  // ── Contenido del cupón ──
  function lineasCupon(c) {
    if (c.tipo === 'monto') return ['Consumo por ' + dinero(c.monto)];
    return (c.items || []).map(function (i) {
      var n = Number(i.cant) || 1;
      return (n > 1 ? n + ' × ' : '') + i.nombre;
    });
  }
  // "Válido del 5 de diciembre al 31 de enero de 2027" (usa la fecha del evento si no tiene su propio inicio)
  function vigenciaTexto(c) {
    var d = c.desde || c.valido_desde, v = c.vence;
    if (d && v && String(d).slice(0, 10) === String(v).slice(0, 10)) return 'Válido solo el ' + fecha(v);
    if (d && v) return 'Válido del ' + fecha(d).replace(/ de \d{4}$/, d.slice(0, 4) === String(v).slice(0, 4) ? '' : '$&') + ' al ' + fecha(v);
    if (d) return 'Válido a partir del ' + fecha(d);
    if (v) return 'Válido hasta el ' + fecha(v);
    return '';
  }
  // Cómo nombrar el motivo del donativo según lo escrito en "Evento"
  // ej. 'su evento «Kermés navideña»'  ·  sin evento: 'su evento'
  function eventoFrase(evento) {
    var e = String(evento || '').trim();
    return e ? 'su evento «' + e + '»' : 'su evento';
  }
  function estadoCupon(c) {
    if (c.estado === 'canjeado') return { clave: 'canjeado', texto: 'Canjeado' };
    if (c.estado === 'cancelado') return { clave: 'cancelado', texto: 'Cancelado' };
    if (c.vencido) return { clave: 'vencido', texto: 'Vencido' };
    return { clave: 'activo', texto: 'Vigente' };
  }

  // ── QR ──
  function qrMatriz(texto) {
    var q = global.qrcode(0, 'M');
    q.addData(texto); q.make();
    return q;
  }
  function qrSvg(texto, color) {
    var q = qrMatriz(texto), n = q.getModuleCount(), m = 2, d = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++)
      if (q.isDark(r, c)) d += 'M' + (c + m) + ' ' + (r + m) + 'h1v1h-1z';
    var t = n + m * 2;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + t + ' ' + t + '" shape-rendering="crispEdges">' +
      '<rect width="' + t + '" height="' + t + '" fill="#fff"/><path d="' + d + '" fill="' + (color || '#2d2416') + '"/></svg>';
  }
  function dibujarQr(ctx, texto, x, y, size, color) {
    var q = qrMatriz(texto), n = q.getModuleCount(), cell = size / n;
    ctx.fillStyle = color || '#2d2416';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++)
      if (q.isDark(r, c)) ctx.fillRect(Math.floor(x + c * cell), Math.floor(y + r * cell), Math.ceil(cell), Math.ceil(cell));
  }

  // ── Imagen del cupón (para WhatsApp / imprimir) ──
  // El logo original es negro: lo teñimos al dorado de Mozzafiato
  var _logo = {};
  function cargarLogo(color) {
    color = color || '#5e4f30';
    if (_logo[color]) return _logo[color];
    _logo[color] = new Promise(function (res) {
      var im = new Image();
      im.onload = function () {
        var c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
        var x = c.getContext('2d'); x.drawImage(im, 0, 0);
        x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
        res(c);
      };
      im.onerror = function () { res(null); };
      im.src = MOZZA.logo;
    });
    return _logo[color];
  }
  // Pone el logo teñido en todos los <img data-logo="#color">
  async function pintarLogos() {
    var els = document.querySelectorAll('img[data-logo]');
    for (var i = 0; i < els.length; i++) {
      var c = await cargarLogo(els[i].getAttribute('data-logo') || undefined);
      if (c) els[i].src = c.toDataURL('image/png');
    }
  }
  function envolver(ctx, texto, maxW) {
    var pal = String(texto).split(/\s+/), lineas = [], l = '';
    pal.forEach(function (w) {
      var t = l ? l + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && l) { lineas.push(l); l = w; } else l = t;
    });
    if (l) lineas.push(l);
    return lineas;
  }

  async function imagenCupon(c, info) {
    // c: cupón · info: {institucion, evento}
    try {
      await Promise.all([
        document.fonts.load('64px "Great Vibes"'), document.fonts.load('700 40px "Playfair Display"'),
        document.fonts.load('28px "Libre Baskerville"'), document.fonts.load('italic 28px "Libre Baskerville"'),
        document.fonts.load('700 20px "Libre Baskerville"')
      ]);
    } catch (e) {}
    var logo = await cargarLogo('#5e4f30');
    // 1ª pasada: medir el alto · 2ª pasada: dibujar con el alto exacto
    var medida = document.createElement('canvas'); medida.width = 1080; medida.height = 10;
    var H = Math.max(1500, Math.ceil(dibujarCupon(medida.getContext('2d'), c, info, logo, null)));
    var cv = document.createElement('canvas'); cv.width = 1080; cv.height = H;
    dibujarCupon(cv.getContext('2d'), c, info, logo, H);
    return cv;
  }

  // Dibuja el cupón; si H es null solo mide y devuelve el alto necesario
  function dibujarCupon(x, c, info, logo, H) {
    var W = 1080, dib = H != null;
    var ORO = '#8b7a52', ORO_OSC = '#5e4f30', TINTA = '#3a3020', SUAVE = '#6b5d3f';
    function txt(t, yy) { if (dib) x.fillText(t, W / 2, yy); }

    if (dib) {
      var g = x.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#f6f1e6'); g.addColorStop(1, '#ebe3d1');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.strokeStyle = ORO; x.lineWidth = 6; x.strokeRect(36, 36, W - 72, H - 72);
      x.lineWidth = 2; x.strokeRect(54, 54, W - 108, H - 108);
      [[54, 54], [W - 54, 54], [54, H - 54], [W - 54, H - 54]].forEach(function (p) {
        x.save(); x.translate(p[0], p[1]); x.rotate(Math.PI / 4); x.fillStyle = ORO; x.fillRect(-9, -9, 18, 18); x.restore();
      });
    }
    x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    var y = 120;
    if (logo) {
      var lw = 420, lh = lw * logo.height / logo.width;
      if (dib) x.drawImage(logo, (W - lw) / 2, y - 30, lw, lh);
      y += lh + 60;
    } else {
      x.fillStyle = ORO_OSC; x.font = '96px "Great Vibes", cursive'; txt('Mozzafiato', y + 80); y += 150;
    }
    x.fillStyle = ORO_OSC; x.font = '92px "Great Vibes", cursive';
    txt('Cupón de regalo', y); y += 28;
    if (dib) {
      x.strokeStyle = ORO; x.lineWidth = 2;
      x.beginPath(); x.moveTo(W / 2 - 160, y); x.lineTo(W / 2 - 20, y); x.moveTo(W / 2 + 20, y); x.lineTo(W / 2 + 160, y); x.stroke();
      x.save(); x.translate(W / 2, y); x.rotate(Math.PI / 4); x.fillStyle = ORO; x.fillRect(-6, -6, 12, 12); x.restore();
    }
    y += 62;
    x.fillStyle = SUAVE; x.font = '600 26px "Libre Baskerville", Georgia, serif';
    txt(String(c.titulo || '').toUpperCase(), y); y += 66;

    x.fillStyle = TINTA;
    var lineas = lineasCupon(c);
    var tam = lineas.length > 5 ? 34 : 44;
    x.font = '700 ' + tam + 'px "Playfair Display", Georgia, serif';
    lineas.forEach(function (l) {
      envolver(x, l, W - 220).forEach(function (s) { txt(s, y); y += tam + 16; });
    });
    y += 18;

    var qs = 330, qx = (W - qs) / 2;
    if (dib) {
      x.fillStyle = '#fff'; x.fillRect(qx - 18, y - 18, qs + 36, qs + 36);
      x.strokeStyle = 'rgba(139,122,82,.45)'; x.lineWidth = 2; x.strokeRect(qx - 18, y - 18, qs + 36, qs + 36);
      dibujarQr(x, urlCaja(c.folio), qx, y, qs);
    }
    y += qs + 68;
    x.fillStyle = ORO_OSC; x.font = '700 46px "Playfair Display", Georgia, serif';
    txt(c.folio, y); y += 52;
    x.fillStyle = SUAVE; x.font = '26px "Libre Baskerville", Georgia, serif';
    if (vigenciaTexto(c)) { txt(vigenciaTexto(c), y); y += 40; }
    x.font = 'italic 24px "Libre Baskerville", Georgia, serif';
    envolver(x, 'Cortesía para ' + (info.institucion || '') + (info.evento ? ' · ' + info.evento : ''), W - 220)
      .forEach(function (s) { txt(s, y); y += 34; });

    // Normas (siempre)
    y += 34;
    if (dib) { x.strokeStyle = 'rgba(139,122,82,.5)'; x.lineWidth = 1; x.beginPath(); x.moveTo(140, y - 30); x.lineTo(W - 140, y - 30); x.stroke(); }
    x.fillStyle = ORO_OSC; x.font = '700 21px "Libre Baskerville", Georgia, serif';
    txt('CONDICIONES', y); y += 36;
    x.fillStyle = SUAVE; x.font = '21px "Libre Baskerville", Georgia, serif';
    var normas = NORMAS.slice();
    var extra = notaExtra(c); if (extra) normas.push(extra);
    normas.forEach(function (n) {
      envolver(x, '• ' + n, W - 220).forEach(function (s) { txt(s, y); y += 30; });
    });
    y += 30;
    x.fillStyle = ORO; x.font = '19px "Libre Baskerville", Georgia, serif';
    txt(MOZZA.dir, y); y += 80;

    var est = estadoCupon(c);
    if (dib && est.clave !== 'activo') {
      x.save(); x.translate(W / 2, H * 0.45); x.rotate(-0.32);
      x.strokeStyle = 'rgba(165,72,47,.85)'; x.lineWidth = 10; x.strokeRect(-330, -80, 660, 160);
      x.fillStyle = 'rgba(165,72,47,.9)'; x.font = '700 96px "Playfair Display", Georgia, serif';
      x.textBaseline = 'middle'; x.fillText(est.texto.toUpperCase(), 0, 6);
      x.restore();
    }
    return y;
  }

  // HTML con las normas (para páginas)
  function normasHtml(c, clase) {
    var n = NORMAS.slice(); var extra = c ? notaExtra(c) : ''; if (extra) n.push(extra);
    return '<ul class="' + (clase || 'normas') + '">' + n.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
  }

  function canvasBlob(cv) { return new Promise(function (res) { cv.toBlob(res, 'image/png'); }); }
  function nombreArchivo(c) { return 'Cupon-Mozzafiato-' + c.folio + '.png'; }

  async function descargarCupon(c, info) {
    var cv = await imagenCupon(c, info);
    var b = await canvasBlob(cv);
    var a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = nombreArchivo(c);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  // Compartir la imagen (celular) o, si no se puede, descargarla
  async function compartirCupon(c, info, texto) {
    var cv = await imagenCupon(c, info);
    var b = await canvasBlob(cv);
    var f = new File([b], nombreArchivo(c), { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      try { await navigator.share({ files: [f], text: texto || '' }); return 'compartido'; }
      catch (e) { if (e && e.name === 'AbortError') return 'cancelado'; }
    }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = f.name;
    document.body.appendChild(a); a.click(); a.remove();
    return 'descargado';
  }

  // ── Aviso flotante ──
  function toast(msg, error) {
    var t = document.getElementById('don-toast');
    if (!t) {
      t = document.createElement('div'); t.id = 'don-toast';
      t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:999;max-width:92vw;' +
        'padding:12px 18px;border-radius:12px;font:15px "Libre Baskerville",Georgia,serif;box-shadow:0 10px 30px rgba(0,0,0,.25);' +
        'transition:opacity .25s;opacity:0;pointer-events:none;text-align:center';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = error ? '#a5482f' : '#3a3020';
    t.style.color = error ? '#fff' : '#f3ead4';
    t.style.opacity = '1';
    clearTimeout(t._h); t._h = setTimeout(function () { t.style.opacity = '0'; }, error ? 4200 : 2400);
  }
  async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); toast('Copiado'); }
    catch (e) {
      var ta = document.createElement('textarea'); ta.value = texto; document.body.appendChild(ta);
      ta.select(); try { document.execCommand('copy'); toast('Copiado'); } catch (e2) { toast('No se pudo copiar', true); }
      ta.remove();
    }
  }

  global.DON = {
    MOZZA: MOZZA, CONDICIONES_DEFAULT: CONDICIONES_DEFAULT, NORMAS: NORMAS, notaExtra: notaExtra, normasHtml: normasHtml,
    rpc: rpc, login: login, logout: logout, getSesion: getSesion, tokenVigente: tokenVigente,
    textoError: textoError, dinero: dinero, fecha: fecha, fechaCorta: fechaCorta, fechaHora: fechaHora,
    hoyISO: hoyISO, esc: esc, telWa: telWa, waLink: waLink,
    urlInstitucion: urlInstitucion, urlCupon: urlCupon, urlCaja: urlCaja,
    lineasCupon: lineasCupon, estadoCupon: estadoCupon, vigenciaTexto: vigenciaTexto, eventoFrase: eventoFrase, qrSvg: qrSvg,
    imagenCupon: imagenCupon, descargarCupon: descargarCupon, compartirCupon: compartirCupon,
    toast: toast, copiar: copiar, pintarLogos: pintarLogos, promoReginaHtml: promoReginaHtml
  };
})(window);
