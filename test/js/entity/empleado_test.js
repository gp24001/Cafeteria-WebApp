import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import DefaultDao from "../../../src/js/control/default_dao.js";
import Empleado from "../../../src/js/entity/empleado.js";
import { registros } from "./datos_entidades.js";

mocha.setup("tdd");
suite("Empleado: unidad", function () {
    const datos = registros.Empleado;
    let peticion;
    setup(() => { peticion = sinon.stub(window, "fetch"); });
    teardown(() => sinon.restore());

    test("conserva nombre y estado inactivo del empleado al recuperar y serializar la entidad", async function () {
        const original = JSON.stringify(datos);
        peticion.resolves(new Response(original));
        const registro = await new DefaultDao(Empleado).findById(datos.idEmpleado);
        expect(registro).to.be.instanceOf(Empleado);
        expect(JSON.stringify(registro)).to.equal(original);
        expect(JSON.stringify(datos)).to.equal(original);
        expect(peticion.firstCall.args[1]).to.equal(undefined);
    });

    test("Conserva únicamente los campos recibidos de la API", async function () {
        const parcial = { idEmpleado: datos.idEmpleado };
        peticion.resolves(new Response(JSON.stringify(parcial)));
        const registro = await new DefaultDao(Empleado).findById(datos.idEmpleado);
        expect(registro).to.be.instanceOf(Empleado);
        expect(Object.keys(registro)).to.deep.equal(["idEmpleado"]);
        expect(JSON.stringify(registro)).to.equal(JSON.stringify(parcial));
    });
});
mocha.run();
