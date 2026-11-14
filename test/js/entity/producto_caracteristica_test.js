import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import DefaultDao from "../../../src/js/control/default_dao.js";
import ProductoCaracteristica from "../../../src/js/entity/producto_caracteristica.js";
import Caracteristica from "../../../src/js/entity/caracteristica.js";
import TipoCaracteristica from "../../../src/js/entity/tipo_caracteristica.js";
import Producto from "../../../src/js/entity/producto.js";
import { registros } from "./datos_entidades.js";

mocha.setup("tdd");
suite("ProductoCaracteristica: unidad", function () {
    const datos = registros.ProductoCaracteristica;
    let peticion;
    setup(() => { peticion = sinon.stub(window, "fetch"); });
    teardown(() => sinon.restore());

    test("conserva valor textual y asociaciones de la presentación al recuperar y serializar la entidad", async function () {
        const original = JSON.stringify(datos);
        peticion.resolves(new Response(original));
        const registro = await new DefaultDao(ProductoCaracteristica).findById(datos.idProductoCaracteristica);
        expect(registro).to.be.instanceOf(ProductoCaracteristica);
        for (const [ruta, Tipo] of [["idCaracteristica", Caracteristica], ["idCaracteristica.idTipoCaracteristica", TipoCaracteristica], ["idProducto", Producto]]) {
            expect(ruta.split(".").reduce((valor, campo) => valor[campo], registro), ruta).to.be.instanceOf(Tipo);
        }
        expect(JSON.stringify(registro)).to.equal(original);
        expect(JSON.stringify(datos)).to.equal(original);
        expect(peticion.firstCall.args[1]).to.equal(undefined);
    });

    test("Conserva únicamente los campos recibidos de la API", async function () {
        const parcial = { idProductoCaracteristica: datos.idProductoCaracteristica };
        peticion.resolves(new Response(JSON.stringify(parcial)));
        const registro = await new DefaultDao(ProductoCaracteristica).findById(datos.idProductoCaracteristica);
        expect(registro).to.be.instanceOf(ProductoCaracteristica);
        expect(Object.keys(registro)).to.deep.equal(["idProductoCaracteristica"]);
        expect(JSON.stringify(registro)).to.equal(JSON.stringify(parcial));
    });
});
mocha.run();
