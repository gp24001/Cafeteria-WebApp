import { expect } from "../../lib/chai/index.js";
import { SesionEmpleado } from "../../../src/js/control/sesion_empleado.js";
import EmpleadoDao from "../../../src/js/control/empleado_dao.js";

mocha.setup("tdd");
suite("SesionEmpleado: Integración con la API", function () {
    this.timeout(30000);
    test("el ingreso real conserva solo el identificador local y obtiene los roles activos del empleado", async function () {
        const memoria = new Map();
        const sesion = new SesionEmpleado({ getItem: clave => memoria.get(clave) || null,
            setItem: (clave, valor) => memoria.set(clave, valor), removeItem: clave => memoria.delete(clave) });
        let empleadoValido;
        for (const empleado of (await new EmpleadoDao().listarTodos()).filter(e => e.activo)) {
            try { await sesion.consultar(empleado.idEmpleado); empleadoValido = empleado; break; }
            catch (error) { if (!/rol activo|inactivo/.test(error.message || "")) throw error; }
        }
        if (!empleadoValido) { this.test.title += " (pendiente: no hay empleados activos con acceso)"; this.skip(); return; }
        const actual = await sesion.iniciar(empleadoValido.nombre, empleadoValido.idEmpleado);
        expect(actual.empleado.idEmpleado).to.equal(empleadoValido.idEmpleado);
        expect(actual.roles).to.be.an("array").that.is.not.empty;
        expect(sesion.rutas().length).to.be.greaterThan(0);
        expect(JSON.parse(memoria.get(sesion.clave))).to.deep.equal({ idEmpleado: empleadoValido.idEmpleado });
        sesion.cerrar();
        expect(memoria.size).to.equal(0);
        expect(sesion.actual).to.equal(null);
    });
});
mocha.run();
