// El directorio de este módulo es la raíz pública de Cafefe, incluso en una subcarpeta.
if (window.isSecureContext && "serviceWorker" in navigator) {
    navigator.serviceWorker.register(new URL("./serviceworker.js", import.meta.url)).catch(error => {
        console.warn("No se pudo registrar el Service Worker de Cafefe.", error);
    });
}
