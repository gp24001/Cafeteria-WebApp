import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import ProductoModel from "../../../src/js/boundary/producto_model.js";
import ProductoDao from "../../../src/js/control/producto_dao.js";
import TipoProductoDao from "../../../src/js/control/tipo_producto_dao.js";
import CaracteristicaDao from "../../../src/js/control/caracteristica_dao.js";
import TipoCaracteristicaDao from "../../../src/js/control/tipo_caracteristica_dao.js";
import ProductoCaracteristicaDao from "../../../src/js/control/producto_caracteristica_dao.js";
import ProductoTipoProductoDao from "../../../src/js/control/producto_tipo_producto_dao.js";

mocha.setup("tdd");

suite("ProductoModel: Unidad", function () {
    let pantalla, categorias, categoria, productos, catalogo;
    const bebidas = { idTipoProducto: "bebidas", nombre: "Bebidas", activo: true };
    const cafe = { idProducto: "cafe", nombre: "Café", activo: true, comentarios: "Con leche", precioSugerido: 2 };
    const te = { idProducto: "te", nombre: "Té", activo: true, precioSugerido: 1 };

    setup(() => {
        pantalla = new ProductoModel();
        categorias = sinon.stub(TipoProductoDao.prototype, "findRange").resolves({ datos: [bebidas] });
        categoria = sinon.stub(TipoProductoDao.prototype, "findById").resolves(bebidas);
        productos = sinon.stub(ProductoDao.prototype, "productosDeCategoria").resolves([cafe, te]);
        catalogo = sinon.stub(ProductoDao.prototype, "listarTodos").resolves([cafe, te]);
        sinon.stub(CaracteristicaDao.prototype, "listarTodos").resolves([]);
        sinon.stub(TipoCaracteristicaDao.prototype, "listarTodos").resolves([]);
        sinon.stub(ProductoCaracteristicaDao.prototype, "listarTodos").resolves([]);
        sinon.stub(ProductoTipoProductoDao.prototype, "listarTodos").resolves([
            { activo: true, idTipoProducto: { idTipoProducto: "bebidas" } }
        ]);
    });
    teardown(() => { pantalla.remove(); sinon.restore(); });

    /** Monta la pantalla en uno de sus dos modos de navegación. */
    function abrir(idCategoria) {
        if (idCategoria) pantalla.setAttribute("id-categoria", idCategoria);
        pantalla.setAttribute("seleccionable", "");
        document.body.appendChild(pantalla);
        return pantalla.contenido;
    }

    test("al abrir el catálogo, muestra el buscador y permite elegir solo categorías activas", async function () {
        categorias.resolves({ datos: [bebidas, { nombre: "Postres", activo: false }] });
        const buscador = abrir();
        const lista = buscador.querySelector("tipo-producto-model");
        await lista.cargar();
        const tarjetas = Array.from(lista.root.querySelectorAll("tarjeta-tipo-producto"));
        expect(buscador.localName).to.equal("buscador-productos");
        expect(tarjetas.map(tarjeta => tarjeta.tipoProducto.nombre)).to.deep.equal(["Bebidas"]);
        expect(tarjetas[0].hasAttribute("seleccionable")).to.be.true;
        sinon.assert.notCalled(categoria);
        sinon.assert.notCalled(productos);
    });

    test("al abrir una categoría, solo consulta sus productos y conserva la posibilidad de agregarlos", async function () {
        const detalle = abrir("bebidas");
        await detalle.cargar();
        const tarjetas = Array.from(detalle.root.querySelectorAll("tarjeta-producto"));
        expect(detalle.localName).to.equal("productos-categoria");
        expect(detalle.root.querySelector("h2").textContent).to.equal("Bebidas");
        expect(tarjetas.map(tarjeta => tarjeta.producto.nombre)).to.deep.equal(["Café", "Té"]);
        expect(tarjetas.every(tarjeta => tarjeta.hasAttribute("seleccionable"))).to.be.true;
        sinon.assert.calledWithExactly(categoria, "bebidas");
        sinon.assert.calledWithExactly(productos, "bebidas");
        sinon.assert.notCalled(catalogo);
    });

    test("una categoría inactiva abierta por URL no consulta ni muestra sus productos", async function () {
        categoria.resolves({ ...bebidas, activo: false });
        const detalle = abrir("bebidas");
        await detalle.cargar();
        sinon.assert.notCalled(productos);
        expect(detalle.root.querySelector("[role=status]").textContent).to.equal("Categoría no disponible.");
        expect(detalle.root.querySelector("tarjeta-producto")).to.equal(null);
    });

    test("cargar permite buscar y seleccionar productos aunque falle la consulta auxiliar de categorías", async function () {
        sinon.stub(TipoProductoDao.prototype, "listarTodos").rejects(new Error("Sin categorías"));
        const buscador = abrir();
        await buscador.cargar();
        buscador.entrada.value = "cafe";
        await buscador.mostrar();
        const tarjeta = buscador.lista.firstElementChild;
        expect(tarjeta.producto.idProducto).to.equal("cafe");
        expect(buscador.entrada.disabled).to.be.false;
        const agregar = sinon.spy();
        pantalla.addEventListener("agregar-producto", agregar);
        tarjeta.abrir();
        tarjeta.boton.click();
        sinon.assert.calledOnce(agregar);
        expect(agregar.firstCall.args[0].detail).to.include({ idProducto: cafe.idProducto, precioSugerido: cafe.precioSugerido, cantidad: 1 });
    });

    test("el filtro de categoría se conserva al actualizar sus productos en segundo plano", async function () {
        const detalle = abrir("bebidas");
        await detalle.cargar();
        const tarjeta = detalle.root.querySelector("tarjeta-producto");
        detalle.busqueda.boton.click();
        detalle.busqueda.entrada.value = "CAFE leche";
        detalle.busqueda.entrada.dispatchEvent(new Event("input"));
        productos.resolves([{ ...cafe, precioSugerido: 3 }, te]);
        await detalle.cargar(true);
        const tarjetas = Array.from(detalle.root.querySelectorAll("tarjeta-producto"));
        expect(detalle.busqueda.entrada.value).to.equal("CAFE leche");
        expect(tarjetas.map(tarjeta => tarjeta.hidden)).to.deep.equal([false, true]);
        expect(tarjetas[0]).to.equal(tarjeta);
        expect(tarjeta.producto.precioSugerido).to.equal(3);
    });

    test("una falla de productos se notifica una vez y una consulta correcta permite volver a avisar", async function () {
        productos.rejects(new Error("Productos no disponibles"));
        const avisos = sinon.spy();
        pantalla.addEventListener("notificar", avisos);
        const detalle = abrir("bebidas");
        await detalle.cargar();
        await detalle.cargar(true);
        sinon.assert.calledOnce(avisos);
        expect(avisos.firstCall.args[0].detail).to.deep.equal({ mensaje: "Productos no disponibles", tipo: "error" });
        expect(detalle.root.querySelector("[role=status]").textContent).to.equal("");
        productos.resolves([]);
        await detalle.cargar(true);
        expect(detalle.root.querySelector("[role=status]").textContent).to.equal("No hay productos en esta categoría.");
        productos.rejects(new Error("Productos no disponibles"));
        await detalle.cargar(true);
        sinon.assert.calledTwice(avisos);
    });
});

mocha.run();
