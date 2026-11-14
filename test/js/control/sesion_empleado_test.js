import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import { SesionEmpleado } from "../../../src/js/control/sesion_empleado.js";
import EmpleadoRolDao from "../../../src/js/control/empleado_rol_dao.js";

mocha.setup("tdd");
suite("SesionEmpleado: Unidad", function () {
    const id = "11111111-1111-4111-8111-111111111111";
    let sesion, datos, empleado, roles, asignaciones;
    setup(() => {
        datos = new Map();
        const almacen = { getItem: clave => datos.get(clave) || null, setItem: (clave, valor) => datos.set(clave, valor), removeItem: clave => datos.delete(clave) };
        sesion = new SesionEmpleado(almacen);
        empleado = sinon.stub(sesion.empleados, "findById").resolves({ idEmpleado: id, nombre: "Ana", apellido: "Pérez", activo: true });
        roles = sinon.stub(sesion.rolesDao, "listarTodos").resolves([{ idRol: "barista", nombre: "Barista", activo: true }]);
        asignaciones = sinon.stub(EmpleadoRolDao.prototype, "listarTodos").resolves([{ idEmpleadoRol: "asignacion", idRol: { idRol: "barista" }, activo: true }]);
    });
    teardown(() => sinon.restore());

    test("valida nombre y UUID y resuelve relaciones de rol representadas solo por ID", async function () {
        await sesion.iniciar("  ANA PEREZ  ", id.toUpperCase());
        sinon.assert.calledOnceWithExactly(empleado, id);
        expect(sesion.actual.roles[0]).to.deep.equal({ idRol: "barista", nombre: "Barista", idEmpleadoRol: "asignacion" });
        expect(sesion.puedeAcceder("preparacion")).to.be.true;
        expect(sesion.puedeAcceder("pagos")).to.be.false;
        expect(sesion.destino).to.equal("preparacion");
        expect(JSON.parse(datos.get(sesion.clave))).to.deep.equal({ idEmpleado: id });
    });

    test("rechaza UUID inválido y nombre incorrecto sin crear sesión", async function () {
        expect((await sesion.iniciar("Ana", "incorrecto").catch(e => e)).message).to.include("incorrectos");
        sinon.assert.notCalled(empleado);
        expect((await sesion.iniciar("Otra persona", id).catch(e => e)).message).to.include("incorrectos");
        expect(sesion.actual).to.equal(null);
        expect(datos.size).to.equal(0);
    });

    test("rechaza empleados inactivos antes de consultar sus roles", async function () {
        empleado.resolves({ idEmpleado: id, nombre: "Ana", activo: false });
        expect((await sesion.iniciar("Ana", id).catch(e => e)).message).to.include("inactivo");
        sinon.assert.notCalled(roles);
        sinon.assert.notCalled(asignaciones);
    });

    test("no concede acceso por asignaciones ni roles inactivos", async function () {
        asignaciones.resolves([{ idRol: { idRol: "barista" }, activo: false }]);
        expect((await sesion.iniciar("Ana", id).catch(e => e)).message).to.include("rol activo");
        asignaciones.resolves([{ idRol: { idRol: "barista" }, activo: true }]);
        roles.resolves([{ idRol: "barista", nombre: "Barista", activo: false }]);
        expect((await sesion.iniciar("Ana", id).catch(e => e)).message).to.include("rol activo");
        expect(sesion.actual).to.equal(null);
    });

    test("admite varios roles y asigna a cajero su propia área", async function () {
        roles.resolves([{ idRol: "caja", nombre: "Cajero", activo: true }, { idRol: "cocina", nombre: "Cocinero", activo: true }]);
        asignaciones.resolves([{ idEmpleadoRol: "caja1", idRol: { idRol: "caja" }, activo: true }]);
        await sesion.iniciar("Ana", id);
        expect(sesion.destino).to.equal("pagos");
        expect(sesion.puedeAcceder("preparacion")).to.be.false;
        asignaciones.resolves([{ idEmpleadoRol: "caja1", idRol: { idRol: "caja" }, activo: true }, { idEmpleadoRol: "cocina1", idRol: { idRol: "cocina" }, activo: true }]);
        await sesion.iniciar("Ana", id);
        expect(sesion.rutas()).to.deep.equal(["pagos", "preparacion"]);
    });

    test("restaura consultando los roles reales y descarta permisos escritos en almacenamiento", async function () {
        datos.set(sesion.clave, JSON.stringify({ idEmpleado: id, roles: [{ nombre: "Cajero" }] }));
        await sesion.restaurar();
        sinon.assert.calledOnce(empleado);
        expect(sesion.puedeAcceder("pagos")).to.be.false;
        expect(sesion.puedeAcceder("preparacion")).to.be.true;
        sesion.cerrar();
        expect(sesion.actual).to.equal(null);
        expect(datos.size).to.equal(0);
    });

    test("descarta sesión corrupta o empleado que perdió acceso", async function () {
        datos.set(sesion.clave, "{invalido");
        await sesion.restaurar();
        expect(datos.size).to.equal(0);
        datos.set(sesion.clave, JSON.stringify({ idEmpleado: id }));
        empleado.rejects(new Error("Empleado eliminado"));
        await sesion.restaurar();
        expect(sesion.actual).to.equal(null);
        expect(sesion.restaurando).to.be.false;
        expect(datos.size).to.equal(0);
    });

    test("cerrar sesión invalida un ingreso que todavía no terminó", async function () {
        let resolver;
        empleado.returns(new Promise(resolve => { resolver = resolve; }));
        const ingreso = sesion.iniciar("Ana", id);
        sesion.cerrar();
        resolver({ idEmpleado: id, nombre: "Ana", activo: true });
        expect(await ingreso).to.equal(null);
        expect(sesion.actual).to.equal(null);
        expect(datos.size).to.equal(0);
    });
});
mocha.run();
