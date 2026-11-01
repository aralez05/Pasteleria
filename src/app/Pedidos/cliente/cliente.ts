import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PedidosService, Pedido, PedidoItem } from '../pedidos.service';
import { FacturacionService } from '../../Facturacion/facturacion.service';
import { CatalogoService, Producto } from '../../Catalogo/catalogo.service'; // ajusta la ruta si tu carpeta se llama distinto
import { SucursalesService } from '../../Sucursales/sucursales.service';

@Component({
  selector: 'app-cliente-pedidos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cliente.html',
  styleUrl: './cliente.css',
})
export class Clientes {
  public pedidosService = inject(PedidosService);
  public facturacionService = inject(FacturacionService);
  public catalogoService = inject(CatalogoService);
  public sucursalesService = inject(SucursalesService);

  /** Costo fijo de envío a domicilio (pon aquí tu tarifa real) */
  readonly COSTO_ENVIO_DOMICILIO = 45;

  // Filtro de estado
  readonly filtroEstado = signal<string>('Todos');

  // Modal para detalle de pedido
  readonly pedidoDetalle = signal<Pedido | null>(null);

  // =========================================================================
  // FINALIZAR PEDIDO (productos que se eligieron en el catálogo)
  // =========================================================================

  readonly sucursalElegida = signal('');
  readonly metodoEntrega = signal<'Sucursal' | 'Domicilio'>('Sucursal');
  readonly direccionEntrega = signal('');
  readonly metodoPago = signal<Pedido['metodoPago']>('Efectivo en Entrega');
  readonly notasEspeciales = signal('');
  readonly fechaEntrega = signal(this.formatoFechaLocal(24 * 60 * 60 * 1000)); // por defecto: mañana a esta hora
  readonly fechaMinima = this.formatoFechaLocal(0);

  readonly enviando = signal(false);
  readonly errorPedido = signal<string | null>(null);
  readonly exitoPedido = signal<string | null>(null);

  /** Productos que el cliente eligió en el catálogo */
  readonly productosEnSeleccion = computed(() => {
    const mapa = this.catalogoService.seleccion();
    const resultado: { producto: Producto; cantidad: number; subtotal: number }[] = [];

    for (const prod of this.catalogoService.productos()) {
      const cant = mapa.get(prod.id) || 0;
      if (cant > 0) {
        resultado.push({ producto: prod, cantidad: cant, subtotal: prod.precio * cant });
      }
    }
    return resultado;
  });

  readonly sucursalActual = computed(() => {
    const lista = this.sucursalesService.sucursales();
    return lista.find((s) => s.id === this.sucursalElegida()) ?? lista[0];
  });

  readonly subtotalSeleccion = computed(() => this.catalogoService.totalMontoSeleccionado());

  readonly costoEnvio = computed(() =>
    this.metodoEntrega() === 'Domicilio' ? this.COSTO_ENVIO_DOMICILIO : 0
  );

  readonly totalSeleccion = computed(
    () => Math.round((this.subtotalSeleccion() + this.costoEnvio()) * 100) / 100
  );

  incrementar(id: string): void {
    this.catalogoService.incrementarSeleccion(id);
  }

  decrementar(id: string): void {
    this.catalogoService.decrementarSeleccion(id);
  }

  quitarProducto(id: string): void {
    this.catalogoService.setCantidadSeleccionada(id, 0);
  }

  vaciarSeleccion(): void {
    this.catalogoService.limpiarSeleccion();
  }

  cerrarExito(): void {
    this.exitoPedido.set(null);
  }

  /** Valida los datos y guarda el pedido en la base de datos */
  confirmarPedido(): void {
    if (this.enviando()) return;
    this.errorPedido.set(null);

    const usuario: any = this.facturacionService.usuarioActual();
    if (!usuario) {
      this.errorPedido.set('Inicia sesión para hacer tu pedido.');
      return;
    }

    const items: PedidoItem[] = this.productosEnSeleccion().map((i) => ({
      productoId: i.producto.id,
      nombre: i.producto.nombre,
      cantidad: i.cantidad,
      precioUnitario: i.producto.precio,
      importe: i.subtotal,
    }));
    if (items.length === 0) {
      this.errorPedido.set('Tu selección está vacía. Elige productos en el catálogo.');
      return;
    }

    const sucursal = this.sucursalActual();
    if (!sucursal) {
      this.errorPedido.set('Elige la sucursal que preparará tu pedido.');
      return;
    }

    const esDomicilio = this.metodoEntrega() === 'Domicilio';
    if (esDomicilio && this.direccionEntrega().trim().length < 8) {
      this.errorPedido.set('Escribe la dirección completa de entrega (calle, número y colonia).');
      return;
    }

    const fecha = new Date(this.fechaEntrega());
    if (isNaN(fecha.getTime()) || fecha.getTime() <= Date.now()) {
      this.errorPedido.set('Elige una fecha y hora de entrega que sea posterior a este momento.');
      return;
    }

    this.enviando.set(true);

    this.pedidosService
      .crearPedido({
        clienteId: String(usuario.id),
        clienteNombre: usuario.nombre || usuario.correo || '',
        clienteTelefono: '',
        clienteEmail: usuario.correo || '',
        sucursalId: sucursal.id,
        sucursalNombre: (sucursal as any).nombre,
        fechaEntregaEstimada: fecha.toISOString(),
        items,
        subtotal: this.subtotalSeleccion(),
        costoEnvio: this.costoEnvio(),
        total: this.totalSeleccion(),
        metodoEntrega: this.metodoEntrega(),
        direccionEntrega: esDomicilio ? this.direccionEntrega().trim() : undefined,
        metodoPago: this.metodoPago(),
        estado: 'Pendiente',
        notasEspeciales: this.notasEspeciales().trim() || undefined,
      })
      .subscribe({
        next: (pedido) => {
          this.enviando.set(false);
          this.catalogoService.limpiarSeleccion();
          this.catalogoService.cargarProductos(); // refresca el stock del catálogo
          this.direccionEntrega.set('');
          this.notasEspeciales.set('');
          this.metodoEntrega.set('Sucursal');
          this.filtroEstado.set('Todos');
          this.exitoPedido.set(`¡Listo! Tu pedido ${pedido.id} quedó registrado y ya lo estamos preparando.`);
        },
        error: (err) => {
          this.enviando.set(false);
          this.errorPedido.set(this.catalogoService.mensajeDeError(err));
        },
      });
  }

  /** Fecha en el formato que usa <input type="datetime-local"> (hora local) */
  private formatoFechaLocal(desplazamientoMs: number): string {
    const d = new Date(Date.now() + desplazamientoMs);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }

  // =========================================================================
  // SEGUIMIENTO DE MIS PEDIDOS
  // =========================================================================

  // Pedidos del cliente actual
  readonly misPedidos = computed(() => {
    const usuario = this.facturacionService.usuarioActual();
    const lista = this.pedidosService.pedidosPorCliente(usuario?.id, usuario?.correo);
    const estado = this.filtroEstado();

    if (estado === 'Todos') return lista;
    return lista.filter(p => p.estado === estado);
  });

  // Métricas del cliente
  readonly pedidosActivosCount = computed(() => {
    const usuario = this.facturacionService.usuarioActual();
    return this.pedidosService
      .pedidosPorCliente(usuario?.id, usuario?.correo)
      .filter(p => ['Pendiente', 'En Horno', 'Decorando', 'Listo'].includes(p.estado)).length;
  });

  readonly pedidosEntregadosCount = computed(() => {
    const usuario = this.facturacionService.usuarioActual();
    return this.pedidosService
      .pedidosPorCliente(usuario?.id, usuario?.correo)
      .filter(p => p.estado === 'Entregado').length;
  });

  verDetalle(pedido: Pedido): void {
    this.pedidoDetalle.set(pedido);
  }

  cerrarDetalle(): void {
    this.pedidoDetalle.set(null);
  }

  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'Pendiente': return 'status-pendiente';
      case 'En Horno': return 'status-horno';
      case 'Decorando': return 'status-decorando';
      case 'Listo': return 'status-listo';
      case 'Entregado': return 'status-entregado';
      case 'Cancelado': return 'status-cancelado';
      default: return '';
    }
  }

  getEstadoIcon(estado: string): string {
    switch (estado) {
      case 'Pendiente': return 'schedule';
      case 'En Horno': return 'local_fire_department';
      case 'Decorando': return 'palette';
      case 'Listo': return 'check_circle';
      case 'Entregado': return 'task_alt';
      case 'Cancelado': return 'cancel';
      default: return 'help';
    }
  }
}