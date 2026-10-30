# 🧁 Olenka Y Ezis · Sistema Integral para Pastelerías

**Todo tu negocio de repostería en una sola plataforma:** catálogo en línea, pedidos, inventario por sucursal y control de tu equipo, desde el celular o la computadora.

Pensado para pastelerías y panaderías con una o varias sucursales que quieren dejar atrás las libretas, los mensajes sueltos y los inventarios en hojas de cálculo.

---

## ¿Qué problema resuelve?

| Antes | Con el sistema |
|---|---|
| Pedidos por WhatsApp, llamada o papel | Cada pedido queda registrado con su folio, cliente, sucursal y estado |
| No sabes qué hay en el mostrador hasta contarlo | Inventario actualizado al instante, con avisos de productos por agotarse |
| El cliente pregunta "¿ya está mi pastel?" | El cliente ve el estado de su pedido sin llamar |
| Cada sucursal lleva su propio control | Una sola vista consolidada de toda la cadena |
| Cualquiera puede mover precios o inventario | Cada persona ve y hace solo lo que le corresponde a su puesto |

---

## Características principales

### 🛍️ Para tus clientes
- Catálogo visual con fotos, sabores, porciones y precios.
- Búsqueda por nombre, sabor o ingrediente, y filtros por categoría.
- Disponibilidad a la vista: *disponible*, *últimas piezas* o *agotado*.
- Selección de productos y confirmación del pedido en pocos pasos.
- Elección de sucursal, **recoger en tienda o entrega a domicilio**, forma de pago y dedicatoria para el pastel.
- Seguimiento de cada pedido: *Pendiente → En horno → Decorando → Listo → Entregado*.

### 👩‍🍳 Para tu personal de mostrador y taller
- Panel de inventario con indicadores: variedades, piezas en stock, productos por agotarse y agotados.
- Ajuste de existencias en un toque (+1, −1, +5, −5) o con cantidad exacta.
- Lista de pedidos de su sucursal, con búsqueda y filtros por estado.
- Avance de cada pedido por las etapas del taller.
- Alta de personal con **aprobación del administrador**: nadie entra sin tu autorización.

### 📊 Para la administración
- Control total del catálogo: agregar productos, cambiar precios y retirar los que ya no se venden.
- Vista consolidada de **todas las sucursales** con pedidos, ventas e indicadores de producción.
- Desglose por tienda con un clic para analizar cada sucursal por separado.
- Búsqueda por folio, cliente, sucursal o producto.
- Cambio de estado y cancelación de pedidos con reintegro automático al inventario.

### ⚙️ Automatizaciones incluidas
- El inventario se descuenta al registrar un pedido y se repone si se cancela.
- Los precios y totales los calcula el sistema, así que el cliente no puede alterarlos.
- Los pedidos nuevos aparecen en el panel del personal y de administración sin recargar la página.
- Aviso por correo al administrador cuando alguien solicita acceso como personal.
- Módulo de facturación y tickets de mostrador.

---

## Pensado por roles

| | Cliente | Personal | Administrador |
|---|:--:|:--:|:--:|
| Ver catálogo y hacer pedidos | ✔ | | |
| Seguir sus pedidos | ✔ | | |
| Ver y avanzar pedidos de su sucursal | | ✔ | ✔ |
| Ajustar inventario | | ✔ | ✔ |
| Cambiar precios, altas y bajas de productos | | | ✔ |
| Ver todas las sucursales y sus ventas | | | ✔ |
| Aprobar a nuevo personal | | | ✔ |

---

## Multi-sucursal desde el primer día

Cada pedido se asigna a la sucursal que lo prepara. El personal trabaja con los pedidos de su tienda y la administración ve la cadena completa, con indicadores por sucursal. Agregar una sucursal nueva no requiere cambiar el sistema.

---

## Tecnología

| | |
|---|---|
| **Interfaz** | Angular, diseño adaptable a celular, tableta y computadora |
| **Servidor** | Node.js y Express |
| **Base de datos** | MySQL, compatible con servicios administrados en la nube |
| **Correo** | Notificaciones por correo electrónico |

Arquitectura sencilla de mantener: interfaz, servidor y base de datos independientes, lo que permite crecer o cambiar cada parte sin rehacer las demás.

---

## Personalización

El sistema se adapta a la identidad de tu negocio:
- Nombre, logotipo, colores y tipografías.
- Catálogo, categorías, etiquetas ("Más vendido", "Tradicional", "Nuevo") y porciones.
- Sucursales, tarifas de envío y formas de pago.
- Textos y mensajes para tus clientes.

---

## Implementación

Incluye según el paquete que elijas:
1. Instalación y configuración en tu servidor o nube.
2. Carga inicial de tu catálogo y sucursales.
3. Alta de tu equipo y capacitación para cada rol.
4. Acompañamiento durante las primeras semanas.

**Requisitos:** un servicio de alojamiento con Node.js y una base de datos MySQL. Nosotros te ayudamos a elegirlos.

---

## Hoja de ruta

Funciones que se incorporan según las necesidades de cada cliente:
- Cobro en línea con tarjeta.
- Timbrado de facturas CFDI con un proveedor de certificación autorizado.
- Avisos al cliente por correo o WhatsApp cuando cambie el estado de su pedido.
- Reportes de ventas por periodo, producto y sucursal.
- Aplicación móvil.

---


## Licencia

Software propietario. Todos los derechos reservados. Queda prohibida su copia, distribución o uso comercial sin autorización por escrito.

© 2026 *Yuriel--Pablo*