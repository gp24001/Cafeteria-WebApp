import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import DefaultDao from "../../../src/js/control/default_dao.js";
import Rol from "../../../src/js/entity/rol.js";
import { registros } from "./datos_entidades.js";

mocha.setup("tdd");
suite("Rol: unidad", function () {
    const datos = registros.Rol;
    let peticion;
    setup(() => { peticion = sinon.stub(window, "fetch"); });
    teardown(() => sinon.restore());

    test("conserva nombre y estado del permiso al recuperar y serializar la entidad", async function () {
        const original = JSON.stringify(datos);
        peticion.resolves(new Response(original));
        const registro = await new DefaultDao(Rol).findById(datos.idRol);
        expect(registro).to.be.instanceOf(Rol);
        expect(JSON.stringify(registro)).to.equal(original);
        expect(JSON.stringify(datos)).to.equal(original);
        expect(peticion.firstCall.args[1]).to.equal(undefined);
    });

    test("Conserva únicamente los campos recibidos de la API", async function () {
        const parcial = { idRol: datos.idRol };
        peticion.resolves(new Response(JSON.stringify(parcial)));
        const registro = await new DefaultDao(Rol).findById(datos.idRol);
        expect(registro).to.be.instanceOf(Rol);
        expect(Object.keys(registro)).to.deep.equal(["idRol"]);
        expect(JSON.stringify(registro)).to.equal(JSON.stringify(parcial));
    });
});
mocha.run();
