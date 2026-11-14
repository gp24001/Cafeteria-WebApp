import Orden from "../entity/orden.js";
import DefaultDao from "./default_dao.js";
import EmpleadoDao from "./empleado_dao.js";
import EmpleadoRolDao from "./empleado_rol_dao.js";
import RolDao from "./rol_dao.js";
import OrdenProductoDao from "./orden_producto_dao.js";
import { leerPreparacion, leerPreparacionUnidad } from "./preparacion_estado.js";

let preparandoCamarero = null;

/** Acceso al recurso REST Orden. */
export default class OrdenDao extends DefaultDao {
    /** Configura la ruta de Orden. */
    constructor() {
        super(Orden);
        this.URL += "orden";
    }

    /**
     * Registra la orden del cliente.
     * @param {object} solicitud Datos de creación que espera el recurso Orden.
     * @returns {Promise<object>} Registro creado por la API.
     */
    crear(solicitud) {
        return this.solicitarJson(this.URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(solicitud)
        });
    }

    /** Reutiliza la asignación web y prepara sus datos si faltan, sin scripts externos. */
    async camareroVirtual() {
        if (preparandoCamarero) return preparandoCamarero;
        preparandoCamarero = this.prepararCamareroVirtual();
        try { return await preparandoCamarero; }
        finally { preparandoCamarero = null; }
    }

    /** Reutiliza el camarero virtual o crea los datos faltantes sin reactivar registros deshabilitados. */
    async prepararCamareroVirtual() {
        const empleadoDao = new EmpleadoDao();
        const [empleados, roles] = await Promise.all([empleadoDao.listarTodos(), new RolDao().listarTodos()]);
        const rol = roles.find(r => r.activo && r.nombre.trim().toLowerCase() === "camarero");
        if (!rol) throw new Error("Se necesita un rol Camarero activo para recibir pedidos web.");
        let virtual = empleados.find(e => e.nombre === "Camarero" && e.apellido === "Virtual");
        if (virtual && !virtual.activo) throw new Error("El camarero virtual está inactivo.");
        if (!virtual) virtual = await empleadoDao.crear({ nombre: "Camarero", apellido: "Virtual", activo: true,
            observaciones: "Pedidos de clientes invitados de la web" });
        const asignacionDao = new EmpleadoRolDao(virtual.idEmpleado);
        const asignaciones = await asignacionDao.listarTodos();
        const camarero = asignaciones.find(a => a.activo && a.idRol?.idRol === rol.idRol);
        if (camarero) return camarero.idEmpleadoRol;
        if (asignaciones.some(a => a.idRol?.idRol === rol.idRol)) throw new Error("La asignación del camarero virtual está inactiva.");
        const creada = await asignacionDao.crear({ idRol: { idRol: rol.idRol }, activo: true });
        return creada.idEmpleadoRol;
    }

    /**
     * Registra cabecera y unidades. Si se perdió una respuesta, reconcilia la
     * referencia del carrito y las unidades recibidas antes de volver a enviarlas.
     * @param {object} pedido Referencia estable, nombre del cliente y líneas con ID, precio y cantidad.
     * @param {boolean} reintento Consulta lo persistido antes de continuar un pedido parcialmente recibido.
     * @returns {Promise<string>} Identificador de la orden cuando se han registrado todas sus unidades.
     * @throws {Error|object} Propaga el fallo para que el carrito conserve el pedido y permita reconciliarlo.
     */
    async registrarPedido({ referencia, nombre, lineas }, reintento = false) {
        const observacion = `Cliente: ${nombre} · Pedido web ${referencia}`;
        let orden = reintento && (await this.listarTodos()).find(o => leerPreparacion(o.observacion).texto === observacion);
        if (!orden) {
            const idEmpleadoRol = await this.camareroVirtual();
            orden = await this.crear({ fechaOrden: new Date().toISOString(), observacion, idEmpleadoRol: { idEmpleadoRol } });
        }
        const detalle = new OrdenProductoDao(orden.idOrden);
        const guardadas = reintento ? await detalle.listarTodos() : [];
        const marcas = new Set(guardadas.map(unidad => leerPreparacionUnidad(unidad.observaciones).texto));
        for (const linea of lineas) {
            for (let i = 1; i <= linea.cantidad; i++) {
                const marca = `Pedido web ${referencia}/${linea.idProducto}/${i}` + (linea.presentacion ? ` · ${linea.presentacion}` : "");
                if (!marcas.has(marca)) {
                    await detalle.crear({ idProducto: { idProducto: linea.idProducto }, precio: linea.precio, observaciones: marca });
                }
            }
        }
        return orden.idOrden;
    }
}
