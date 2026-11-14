import { expect } from "../../lib/chai/index.js";
import ProductoDao from "../../../src/js/control/producto_dao.js";
import { agruparPresentaciones, opcionesDeProducto, gruposVisibles, seleccionarProducto } from "../../../src/js/control/presentaciones_producto.js";

mocha.setup("tdd");
suite("Presentaciones de producto: Integración con la API", function () {
    this.timeout(30000);
    test("las características reales permiten elegir un producto conservando su identificador y precio", async function () {
        const productos = await new ProductoDao().listarTodos();
        const original = JSON.stringify(productos);
        const catalogo = await agruparPresentaciones(productos);
        if (!catalogo.length) { this.test.title += " (pendiente: no hay productos activos)"; this.skip(); return; }
        const configuracion = opcionesDeProducto(catalogo[0]);
        const elecciones = new Map();
        for (let paso = 0; paso < configuracion.grupos.length + 1; paso++) {
            const pendiente = gruposVisibles(configuracion, elecciones).find(grupo => !elecciones.has(grupo.id));
            if (!pendiente) break;
            elecciones.set(pendiente.id, pendiente.opciones[0].id);
        }
        const seleccionado = seleccionarProducto(configuracion, elecciones);
        expect(seleccionado).not.to.equal(null);
        const registrado = productos.find(producto => producto.idProducto === seleccionado.idProducto);
        expect(registrado).not.to.equal(undefined);
        expect(seleccionado.precioSugerido).to.equal(registrado.precioSugerido);
        expect(JSON.stringify(productos)).to.equal(original);
    });
});
mocha.run();
