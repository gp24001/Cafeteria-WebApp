/** Datos de prueba independientes de la API: conservan estados, importes y relaciones reales del contrato. */
const caja = { idCaja: "caja-web", nombre: "Caja Virtual", activo: true, observaciones: null };
const empleado = { idEmpleado: "empleado-ana", nombre: "Ana", apellido: "Gómez", activo: false, observaciones: "Turno de tarde" };
const rol = { idRol: "rol-cajero", nombre: "Cajero", activo: true, observaciones: null };
const empleadoRol = { idEmpleadoRol: "asignacion", activo: false, observaciones: null, idEmpleado: empleado, idRol: rol };
const tipoProducto = { idTipoProducto: "bebidas", nombre: "Bebidas", activo: false, observaciones: "Frías y calientes" };
const tipoCaracteristica = { idTipoCaracteristica: "volumen", nombre: "Volumen", expresionRegular: "^[0-9]+$", activo: true, observaciones: null };
const caracteristica = { idCaracteristica: "onzas", nombre: "Onzas", activo: true, observaciones: null, idTipoCaracteristica: tipoCaracteristica };
const producto = { idProducto: "latte", nombre: "Latte", precioSugerido: 3.5, activo: false, comentarios: "Con leche" };
const orden = { idOrden: "orden-ana", fechaOrden: "2026-11-13T13:30:00Z", observacion: "Cliente: Ana · Pedido web referencia", idEmpleadoRol: empleadoRol };
const unidad = { idOrdenProducto: "unidad-latte", precio: 2.25, observaciones: "12 Onzas · Leche deslactosada\nPreparación: Listo", idOrden: orden, idProducto: producto };
const factura = { idFactura: "factura-ana", cliente: "Ana", fechaFacturacion: "2026-11-13T13:35:00Z", estado: "PARCIAL", observaciones: null, idCaja: caja, idEmpleadoRol: empleadoRol };
const pago = { idPago: "pago-efectivo", estado: "CONFIRMADO", observaciones: "Abono web referencia", idFactura: factura };
const tipoDescuento = { idTipoDescuento: "porcentaje", nombre: "Porcentaje", activo: true, descuentoMaximo: 0.25, observaciones: null };
const descuento = { idDescuento: "promocion", nombre: "Promoción", fechaInicio: "2026-11-01", fechaFin: "2026-11-30", observaciones: null, idTipoDescuento: tipoDescuento };

export const registros = {
    Caja: caja,
    Caracteristica: caracteristica,
    Descuento: descuento,
    DescuentoProducto: { idDescuentoProducto: "promocion-latte", fechaInicio: "2026-11-01", fechaFin: "2026-11-30", valor: 0.15, observaciones: null, idDescuento: descuento, idProducto: producto },
    Empleado: empleado,
    EmpleadoRol: empleadoRol,
    Factura: factura,
    FacturaOrdenProducto: { idFacturaOrdenProducto: "factura-unidad", precio: 2.25, observaciones: null, idFactura: factura, idOrdenProducto: unidad },
    Orden: orden,
    OrdenProducto: unidad,
    Pago: pago,
    PagoDetalle: { idPagoDetalle: "detalle-tarjeta", monto: 1.75, observaciones: null, referenciaExterna: "AUT-001", idPago: pago, tipoPago: "TARJETA" },
    Producto: producto,
    ProductoCaracteristica: { idProductoCaracteristica: "latte-onzas", valor: "12", idCaracteristica: caracteristica, idProducto: producto },
    ProductoTipoProducto: { idProductoTipoProducto: "latte-bebidas", activo: false, fechaCreacion: "2026-11-01T12:00:00Z", observaciones: null, idProducto: producto, idTipoProducto: tipoProducto },
    Rol: rol,
    TipoCaracteristica: tipoCaracteristica,
    TipoDescuento: tipoDescuento,
    TipoProducto: tipoProducto
};
