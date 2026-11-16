// Subir v1 a v2, v3, etc. cuando cambie cualquier archivo de urlsToCache.
// Cada versión conserva una copia completa de los recursos estáticos de la interfaz.
const CACHE_NAME = "cafefe.app.cache.v3";
const CACHE_PREFIX = `${self.registration.scope}::cafefe.app.cache.`;
const CACHE_KEY = `${self.registration.scope}::${CACHE_NAME}`;

// Lista explícita: código del frontend, plantillas, estilos e imágenes locales.
// Los DAO se guardan como código JavaScript; sus respuestas REST nunca se almacenan.
// Las capturas del manifest solo se usan al instalar y no son necesarias sin conexión.
const urlsToCache = [
    "./index.html",
    "./app.js",
    "./instalar.js",
    "./registrar-sw.js",
    "./manifest.json",
    "./js/boundary/producto_model.js",
    "./js/boundary/orden_model.js",
    "./js/boundary/pago_model.js",
    "./js/boundary/components/bandeja_ordenes/bandeja_ordenes.html",
    "./js/boundary/components/barra_superior/barra_superior.html",
    "./js/boundary/components/barra_superior/barra_superior.js",
    "./js/boundary/components/bienvenida/bienvenida.html",
    "./js/boundary/components/bienvenida/bienvenida.js",
    "./js/boundary/components/buscador_productos/buscador_productos.html",
    "./js/boundary/components/buscador_productos/buscador_productos.js",
    "./js/boundary/components/busqueda_filtro/busqueda_filtro.html",
    "./js/boundary/components/busqueda_filtro/busqueda_filtro.js",
    "./js/boundary/components/carrito_orden/carrito_orden.html",
    "./js/boundary/components/carrito_orden/carrito_orden.js",
    "./js/boundary/components/categorias_producto/categorias_producto.html",
    "./js/boundary/components/categorias_producto/categorias_producto.js",
    "./js/boundary/components/cobro_factura/cobro_factura.html",
    "./js/boundary/components/cobro_factura/cobro_factura.js",
    "./js/boundary/components/ingreso/ingreso.html",
    "./js/boundary/components/ingreso/ingreso.js",
    "./js/boundary/components/items_preparacion/items_preparacion.html",
    "./js/boundary/components/items_preparacion/items_preparacion.js",
    "./js/boundary/components/lista_dinamica/lista_dinamica.js",
    "./js/boundary/components/menu_lateral/menu_lateral.html",
    "./js/boundary/components/menu_lateral/menu_lateral.js",
    "./js/boundary/components/notificaciones_sistema/notificaciones_sistema.html",
    "./js/boundary/components/notificaciones_sistema/notificaciones_sistema.js",
    "./js/boundary/components/pie_pagina/pie_pagina.html",
    "./js/boundary/components/pie_pagina/pie_pagina.js",
    "./js/boundary/components/plantilla/plantilla.js",
    "./js/boundary/components/productos_categoria/productos_categoria.html",
    "./js/boundary/components/productos_categoria/productos_categoria.js",
    "./js/boundary/components/resumen_orden/resumen_orden.html",
    "./js/boundary/components/resumen_orden/resumen_orden.js",
    "./js/boundary/components/tarjeta_producto/tarjeta_producto.html",
    "./js/boundary/components/tarjeta_producto/tarjeta_producto.js",
    "./js/boundary/components/tarjeta_simple/tarjeta_simple.html",
    "./js/boundary/components/tarjeta_simple/tarjeta_simple.js",
    "./js/boundary/components/tarjeta_tipo_producto/tarjeta_tipo_producto.html",
    "./js/boundary/components/tarjeta_tipo_producto/tarjeta_tipo_producto.js",
    "./js/control/actualizacion_automatica.js",
    "./js/control/busqueda_catalogo.js",
    "./js/control/caja_dao.js",
    "./js/control/caracteristica_dao.js",
    "./js/control/cobro_dao.js",
    "./js/control/default_dao.js",
    "./js/control/empleado_dao.js",
    "./js/control/empleado_rol_dao.js",
    "./js/control/factura_dao.js",
    "./js/control/factura_orden_producto_dao.js",
    "./js/control/filtro_catalogo.js",
    "./js/control/formato_caracteristicas.js",
    "./js/control/importes.js",
    "./js/control/orden_dao.js",
    "./js/control/orden_producto_dao.js",
    "./js/control/pago_dao.js",
    "./js/control/pago_detalle_dao.js",
    "./js/control/preparacion_estado.js",
    "./js/control/presentaciones_producto.js",
    "./js/control/producto_caracteristica_dao.js",
    "./js/control/producto_dao.js",
    "./js/control/producto_tipo_producto_dao.js",
    "./js/control/recepcion_orden_dao.js",
    "./js/control/rol_dao.js",
    "./js/control/sesion_empleado.js",
    "./js/control/ticket_pdf.js",
    "./js/control/tipo_caracteristica_dao.js",
    "./js/control/tipo_producto_dao.js",
    "./js/control/vistas.js",
    "./js/control/workers/busqueda_catalogo_worker.js",
    "./js/entity/caja.js",
    "./js/entity/caracteristica.js",
    "./js/entity/default_error.js",
    "./js/entity/default_response.js",
    "./js/entity/empleado.js",
    "./js/entity/empleado_rol.js",
    "./js/entity/factura.js",
    "./js/entity/factura_orden_producto.js",
    "./js/entity/orden.js",
    "./js/entity/orden_producto.js",
    "./js/entity/pago.js",
    "./js/entity/pago_detalle.js",
    "./js/entity/producto.js",
    "./js/entity/producto_caracteristica.js",
    "./js/entity/producto_tipo_producto.js",
    "./js/entity/rol.js",
    "./js/entity/tipo_caracteristica.js",
    "./js/entity/tipo_producto.js",
    "./resources/estilos/aplicacion.css",
    "./resources/estilos/barra_superior.css",
    "./resources/estilos/busqueda_filtro.css",
    "./resources/estilos/cobro.css",
    "./resources/estilos/empleados.css",
    "./resources/estilos/inicio.css",
    "./resources/estilos/menu_lateral.css",
    "./resources/estilos/notificaciones.css",
    "./resources/estilos/orden_publica.css",
    "./resources/estilos/pie_pagina.css",
    "./resources/estilos/preparacion.css",
    "./resources/estilos/principal.css",
    "./resources/estilos/producto_detalle.css",
    "./resources/estilos/tarjeta.css",
    "./resources/iconos/icono-48.png",
    "./resources/iconos/icono-72.png",
    "./resources/iconos/icono-96.png",
    "./resources/iconos/icono-128.png",
    "./resources/iconos/icono-144.png",
    "./resources/iconos/icono-152.png",
    "./resources/iconos/icono-180.png",
    "./resources/iconos/icono-192.png",
    "./resources/iconos/icono-256.png",
    "./resources/iconos/icono-384.png",
    "./resources/iconos/icono-512.png",
    "./resources/imagenes/bebidacaliente.png",
    "./resources/imagenes/bebidafria.png",
    "./resources/imagenes/categoria.png",
    "./resources/imagenes/comida.png",
    "./resources/imagenes/logo.jpg",
    "./resources/imagenes/postre.png",
    "./resources/imagenes/iconos/barraSuperior.png",
    "./resources/imagenes/iconos/buscar.png",
    "./resources/imagenes/iconos/carrito.png",
    "./resources/imagenes/iconos/contraer.png",
    "./resources/imagenes/iconos/eliminar.png",
    "./resources/imagenes/iconos/inicio.png",
    "./resources/imagenes/iconos/pagos.png",
    "./resources/imagenes/iconos/preparacion.png",
    "./resources/imagenes/iconos/productos.png",
    "./resources/imagenes/iconos/volver.png"
];

const APP_ROOT = new URL(self.registration.scope);
const INDEX_URL = new URL("./index.html", APP_ROOT);
const STATIC_URLS = new Set(urlsToCache.map(ruta => new URL(ruta, APP_ROOT).href));

self.addEventListener("install", evento => {
    // addAll rechaza la instalación completa si falta un recurso: la versión anterior sigue activa.
    // reload obtiene los archivos vigentes del servidor, sin reutilizar la caché HTTP anterior.
    evento.waitUntil(caches.open(CACHE_KEY).then(cache => cache.addAll(
        urlsToCache.map(ruta => new Request(new URL(ruta, APP_ROOT), {
            cache: "reload",
            credentials: "same-origin"
        }))
    )));
    // No se fuerza skipWaiting: las pestañas abiertas terminan usando su propia versión.
});

self.addEventListener("activate", evento => {
    evento.waitUntil((async () => {
        const nombres = await caches.keys();
        await Promise.all(nombres
            .filter(nombre => nombre.startsWith(CACHE_PREFIX) && nombre !== CACHE_KEY)
            .map(nombre => caches.delete(nombre)));
        await self.clients.claim();
    })());
});

/** Busca únicamente en esta versión; si falta el recurso permite su petición normal a la red. */
async function desdeCacheOInternet(peticion, clave) {
    const cache = await caches.open(CACHE_KEY);
    const respuesta = await cache.match(clave);
    // No se agregan respuestas de ejecución a la copia estática ni datos de la API.
    return respuesta || fetch(peticion);
}

self.addEventListener("fetch", evento => {
    const peticion = evento.request;
    if (peticion.method !== "GET" || peticion.headers.has("authorization") || peticion.headers.has("range")) return;

    const url = new URL(peticion.url);
    if (url.origin !== self.location.origin) return;
    // Exclusiones adicionales a la lista exacta: REST, BrowserSync y páginas de pruebas.
    if (/\/(?:resources\/v1|browser-sync|socket\.io|tests?)(?:\/|$)/i.test(url.pathname)) return;

    if (peticion.mode === "navigate") {
        // La aplicación resuelve sus vistas con el hash; raíz e index sirven el mismo HTML estático.
        // Sus parámetros de consulta no se almacenan ni se extienden a otras rutas.
        if (url.pathname !== APP_ROOT.pathname && url.pathname !== INDEX_URL.pathname) return;
        evento.respondWith(desdeCacheOInternet(peticion, INDEX_URL.href));
        return;
    }

    // No ignorar consultas en assets: evita confundir URLs con recursos o respuestas diferentes.
    if (url.search || !STATIC_URLS.has(url.href)) return;
    evento.respondWith(desdeCacheOInternet(peticion, url.href));
});
