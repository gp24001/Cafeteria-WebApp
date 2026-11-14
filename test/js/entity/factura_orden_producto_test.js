import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import DefaultDao from "../../../src/js/control/default_dao.js";
import FacturaOrdenProducto from "../../../src/js/entity/factura_orden_producto.js";
import Factura from "../../../src/js/entity/factura.js";
import OrdenProducto from "../../../src/js/entity/orden_producto.js";
import Orden from "../../../src/js/entity/orden.js";
import Producto from "../../../src/js/entity/producto.js";
import { registros } from "./datos_entidades.js";

mocha.setup("tdd");
suite("FacturaOrdenProducto: unidad", function () {
    const datos = registros.FacturaOrdenProducto;
    let peticion;
    setup(() => { peticion = sinon.stub(window, "fetch"); });
    teardown(() => sinon.restore());

    test("conserva precio facturado y vínculos de la unidad al recuperar y serializar la entidad", async function () {
        const original = JSON.stringify(datos);
        peticion.resolves(new Response(original));
        const registro = await new DefaultDao(FacturaOrdenProducto).findById(datos.idFacturaOrdenProducto);
        expect(registro).to.be.instanceOf(FacturaOrdenProducto);
        for (const [ruta, Tipo] of [["idFactura", Factura], ["idOrdenProducto", OrdenProducto], ["idOrdenProducto.idOrden", Orden], ["idOrdenProducto.idProducto", Producto]]) {
            expect(ruta.split(".").reduce((valor, campo) => valor[campo], registro), ruta).to.be.instanceOf(Tipo);
        }
        expect(JSON.stringify(registro)).to.equal(original);
        expect(JSON.stringify(datos)).to.equal(original);
        expect(peticion.firstCall.args[1]).to.equal(undefined);
    });

    test("Conserva únicamente los campos recibidos de la API", async function () {
        const parcial = { idFacturaOrdenProducto: datos.idFacturaOrdenProducto };
        peticion.resolves(new Response(JSON.stringify(parcial)));
        const registro = await new DefaultDao(FacturaOrdenProducto).findById(datos.idFacturaOrdenProducto);
        expect(registro).to.be.instanceOf(FacturaOrdenProducto);
        expect(Object.keys(registro)).to.deep.equal(["idFacturaOrdenProducto"]);
        expect(JSON.stringify(registro)).to.equal(JSON.stringify(parcial));
    });
});
mocha.run();
