import EmpleadoDao from "./empleado_dao.js";
import EmpleadoRolDao from "./empleado_rol_dao.js";
import RolDao from "./rol_dao.js";

/** Compara nombres y roles sin diferencias de tildes, mayúsculas o espacios repetidos. */
const normalizar = texto => String(texto || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sesión del frontend conforme al login académico. Revalida los roles al recargar. */
export class SesionEmpleado extends EventTarget {
    /** Inicializa el estado y las dependencias de esta clase. */
    constructor(almacen = sessionStorage) {
        super();
        this.almacen = almacen;
        this.clave = "cafefe.empleado.v1";
        this.empleados = new EmpleadoDao();
        this.rolesDao = new RolDao();
        this.actual = null;
        this.restaurando = false;
        this.version = 0;
    }

    /** Obtiene las áreas de trabajo permitidas por los roles activos de la sesión. */
    rutas(sesion = this.actual) {
        const rutas = new Set();
        for (const rol of sesion?.roles || []) {
            const nombre = normalizar(rol.nombre);
            if (["barista", "cocinero", "cocinera"].includes(nombre)) rutas.add("preparacion");
            if (nombre === "cajero" || nombre === "cajera") rutas.add("pagos");
            if (nombre === "camarero" || nombre === "mesero") rutas.add("productos");
        }
        return [...rutas];
    }

    /** Comprueba si la sesión puede abrir la ruta solicitada. */
    puedeAcceder(ruta) {
        if (!["productos", "preparacion", "pagos"].includes(ruta)) return true;
        if (this.restaurando) return false;
        if (ruta === "productos" && !this.actual) return true;
        return this.rutas().includes(ruta);
    }

    /** Devuelve la primera pantalla permitida para la sesión actual. */
    get destino() { return this.rutas()[0] || "productos"; }

    /** Recupera el empleado y sus asignaciones activas desde la API propia. */
    async consultar(idEmpleado) {
        const empleado = await this.empleados.findById(idEmpleado);
        if (!empleado.activo) throw new Error("El empleado está inactivo.");
        const [asignaciones, roles] = await Promise.all([
            new EmpleadoRolDao(empleado.idEmpleado).listarTodos(), this.rolesDao.listarTodos()
        ]);
        const activas = asignaciones.filter(asignacion => asignacion.activo);
        const sesion = {
            empleado: { idEmpleado: empleado.idEmpleado, nombre: empleado.nombre, apellido: empleado.apellido },
            roles: roles.filter(rol => rol.activo && activas.some(a => a.idRol?.idRol === rol.idRol))
                .map(rol => ({ idRol: rol.idRol, nombre: rol.nombre,
                    idEmpleadoRol: activas.find(a => a.idRol?.idRol === rol.idRol).idEmpleadoRol }))
        };
        if (!this.rutas(sesion).length) throw new Error("No tienes un rol activo con acceso a estas pantallas.");
        return sesion;
    }

    /** Valida el nombre y el UUID del empleado antes de establecer la sesión. */
    async iniciar(nombre, identificador) {
        const version = ++this.version;
        const id = identificador.trim().toLowerCase();
        if (!normalizar(nombre) || !uuid.test(id)) throw new Error("Nombre o identificador incorrectos.");
        let sesion;
        try { sesion = await this.consultar(id); }
        catch (error) {
            if (error.error?.status === 404) throw new Error("Nombre o identificador incorrectos.");
            throw error;
        }
        const empleado = sesion.empleado;
        if (![normalizar(empleado.nombre), normalizar(`${empleado.nombre} ${empleado.apellido || ""}`)].includes(normalizar(nombre))) {
            throw new Error("Nombre o identificador incorrectos.");
        }
        if (version !== this.version) return null;
        // Conservar solo el ID; empleado y roles se vuelven a consultar al recargar.
        this.almacen.setItem(this.clave, JSON.stringify({ idEmpleado: empleado.idEmpleado }));
        this.actual = sesion;
        this.dispatchEvent(new Event("cambio"));
        return sesion;
    }

    /**
     * Revalida empleado y roles para recuperar una sesión guardada en esta pestaña.
     * Comparte consultas simultáneas e ignora respuestas anteriores al cierre o a un nuevo ingreso.
     * @returns {Promise<object|null>} Sesión vigente, o nulo si falta una sesión válida o falla la revalidación.
     */
    restaurar() {
        if (this.restauracion) return this.restauracion;
        let id;
        try { id = JSON.parse(this.almacen.getItem(this.clave) || "null")?.idEmpleado; }
        catch { this.almacen.removeItem(this.clave); }
        if (!id || !uuid.test(id)) {
            this.almacen.removeItem(this.clave);
            return Promise.resolve(null);
        }
        this.restaurando = true;
        const version = ++this.version;
        this.restauracion = this.consultar(id).then(sesion => {
            if (version === this.version) this.actual = sesion;
            return this.actual;
        }).catch(() => {
            if (version === this.version) {
                this.actual = null;
                this.almacen.removeItem(this.clave);
            }
            return null;
        }).finally(() => {
            this.restaurando = false;
            this.restauracion = null;
            this.dispatchEvent(new Event("cambio"));
        });
        return this.restauracion;
    }

    /** Invalida operaciones de ingreso pendientes y elimina la sesión de esta pestaña. */
    cerrar() {
        this.version++;
        this.actual = null;
        this.almacen.removeItem(this.clave);
        this.dispatchEvent(new Event("cambio"));
    }
}

export const sesionEmpleado = new SesionEmpleado();
