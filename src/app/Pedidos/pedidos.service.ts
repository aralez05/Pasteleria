import { Injectable, signal, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { FacturacionService } from '../Facturacion/facturacion.service';

export interface PedidoItem {
  productoId?: string; // id del producto en la tabla "productos" (obligatorio al crear un pedido)
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  importe: number;
  notas?: string;
}

export interface Pedido {
  id: string; // Ej. PED-8041 (PED- + id_pedido de la BD)
  clienteId: string;
  clienteNombre: string;
  clienteTelefono: string;
  clienteEmail: string;
  sucursalId: string;
  sucursalNombre: string;
  fechaCreacion: string; // ISO
  fechaEntregaEstimada: string;
  items: PedidoItem[];
  subtotal: number;
  costoEnvio: number;
  total: number;
  metodoEntrega: 'Sucursal' | 'Domicilio';
  direccionEntrega?: string;
  metodoPago: 'Efectivo en Entrega' | 'Tarjeta en Línea' | 'Transferencia SPEI';
  estado: 'Pendiente' | 'En Horno' | 'Decorando' | 'Listo' | 'Entregado' | 'Cancelado';
  notasEspeciales?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PedidosService {
  private http = inject(HttpClient);
  private facturacionService = inject(FacturacionService);

  private readonly API_URL = 'https://bakcend-5pyr.onrender.com/api/pedidos';

  /** Pedidos cargados desde MySQL (según el rol del usuario conectado) */
  readonly pedidos = signal<Pedido[]>([]);

  private usuarioCargado: any = null;
  private temporizador: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Cada vez que cambia el usuario (login / logout) se recargan sus pedidos
    effect(() => {
      const usuario = this.facturacionService.usuarioActual();

      if (this.temporizador) {
        clearInterval(this.temporizador);
        this.temporizador = null;
      }

      this.usuarioCargado = usuario;

      if (!usuario) {
        queueMicrotask(() => this.pedidos.set([]));
        return;
      }

      this.recargar();

      // Personal y admin ven los pedidos nuevos sin tener que refrescar la página
      if (usuario.rol === 'admin' || usuario.rol === 'trabajador') {
        this.temporizador = setInterval(() => this.recargar(), 15000);
      }
    });
  }

  /** Vuelve a consultar los pedidos en la base de datos */
  recargar(): void {
    const usuario = this.usuarioCargado;
    if (!usuario) return;

    // El cliente solo pide los suyos; trabajador y admin piden todos
    const url = usuario.rol === 'cliente' ? `${this.API_URL}/cliente/${usuario.id}` : this.API_URL;

    this.http.get<Pedido[]>(url).subscribe({
      next: (lista) => this.pedidos.set(lista),
      error: (err) => console.error('Error al cargar pedidos desde la BD:', err)
    });
  }

  // =========================================================================
  // CONSULTAS (mismos métodos que usan cliente, trabajador y admin)
  // =========================================================================

  pedidosPorCliente(clienteId?: string, clienteEmail?: string): Pedido[] {
    if (!clienteId && !clienteEmail) return [];

    return this.pedidos().filter((p) => {
      const matchId = clienteId && String(p.clienteId) === String(clienteId);
      const matchEmail = clienteEmail && p.clienteEmail?.toLowerCase() === clienteEmail.toLowerCase();
      return matchId || matchEmail;
    });
  }

  pedidosPorSucursal(sucursalId: string): Pedido[] {
    return this.pedidos().filter((p) => p.sucursalId === sucursalId);
  }

  todosLosPedidos(): Pedido[] {
    return this.pedidos();
  }

  // =========================================================================
  // ACCIONES
  // =========================================================================

  /**
   * Cambia el estado de un pedido. Se refleja al instante en pantalla y se guarda en MySQL.
   * Si el servidor lo rechaza, se vuelve a cargar la lista real.
   */
  actualizarEstado(pedidoId: string, nuevoEstado: Pedido['estado']): void {
    this.pedidos.update((lista) =>
      lista.map((p) => (p.id === pedidoId ? { ...p, estado: nuevoEstado } : p))
    );

    this.http.patch<Pedido>(`${this.API_URL}/${pedidoId}/estado`, { estado: nuevoEstado }).subscribe({
      next: (actualizado) =>
        this.pedidos.update((lista) => lista.map((p) => (p.id === pedidoId ? actualizado : p))),
      error: (err) => {
        console.error('Error al actualizar el estado del pedido:', err);
        this.recargar();
      }
    });
  }

  /**
   * Crea un pedido en la base de datos. DEVUELVE UN OBSERVABLE: hay que suscribirse.
   * Cada item debe incluir productoId. El servidor recalcula precios y descuenta stock.
   */
  crearPedido(nuevo: Omit<Pedido, 'id' | 'fechaCreacion'>): Observable<Pedido> {
    const cuerpo = {
      clienteId: nuevo.clienteId,
      sucursalId: nuevo.sucursalId,
      sucursalNombre: nuevo.sucursalNombre,
      fechaEntregaEstimada: nuevo.fechaEntregaEstimada,
      items: nuevo.items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad, notas: i.notas })),
      costoEnvio: nuevo.costoEnvio,
      metodoEntrega: nuevo.metodoEntrega,
      direccionEntrega: nuevo.direccionEntrega,
      metodoPago: nuevo.metodoPago,
      notasEspeciales: nuevo.notasEspeciales
    };

    return this.http.post<Pedido>(this.API_URL, cuerpo).pipe(
      tap((creado) => this.pedidos.update((lista) => [creado, ...lista]))
    );
  }

  cancelarPedido(pedidoId: string): void {
    this.actualizarEstado(pedidoId, 'Cancelado');
  }

  /** Antes restablecía datos de ejemplo; ahora solo recarga desde la base de datos */
  restablecerPedidos(): void {
    this.recargar();
  }
}
