import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { FacturacionService } from '../Facturacion/facturacion.service'; // Ajusta la ruta a tu servicio de facturación

export interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  sabor: string;
  precio: number;
  stock: number; // Cantidad disponible en inventario
  imagen: string;
  badge?: string | null; // Ej: "Más Vendido", "Tradicional", "Artesanal"
  porciones?: string | null; // Ej: "10-12 porciones", "Por pieza"
}

export interface ProductoSeleccionado {
  producto: Producto;
  cantidad: number;
}

@Injectable({
  providedIn: 'root'
})
export class CatalogoService {
  private http = inject(HttpClient);
  private facturacionService = inject(FacturacionService);

  // URL del backend Express conectado a MySQL
  private readonly API_URL = 'https://bakcend-5pyr.onrender.com/api/productos';

  /** Señal reactiva cargada directamente desde la base de datos */
  readonly productos = signal<Producto[]>([]);

  /** Selecciones/Carrito local del cliente */
  readonly seleccion = signal<Map<string, number>>(new Map());

  // =========================================================================
  // CONTROL Y REACCIÓN SEGÚN EL ROL DEL USUARIO
  // =========================================================================

  readonly rolActual = computed(() => {
    return this.facturacionService.usuarioActual()?.rol || 'visitante';
  });

  /** Privilegios de edición operativa (stock) */
  readonly esPersonalOp = computed(() => {
    const rol = this.rolActual();
    return rol === 'admin' || rol === 'trabajador';
  });

  /** Privilegios absolutos (precios, crear y eliminar productos) */
  readonly esAdmin = computed(() => this.rolActual() === 'admin');

  constructor() {
    this.cargarProductos();
  }

  /**
   * MySQL devuelve los DECIMAL (precio) como texto, por ejemplo "350.00".
   * Aquí los convertimos a número para que las sumas y comparaciones funcionen.
   */
  private normalizar(p: Producto): Producto {
    return { ...p, precio: Number(p.precio), stock: Number(p.stock) };
  }

  /** Consulta los productos en la base de datos */
  cargarProductos(): void {
    this.http.get<Producto[]>(this.API_URL).subscribe({
      next: (datos) => this.productos.set(datos.map((p) => this.normalizar(p))),
      error: (err) => console.error('Error al cargar productos desde la BD:', err)
    });
  }

  // =========================================================================
  // MÉTRICAS Y COMPUTED
  // =========================================================================

  readonly totalPiezasSeleccionadas = computed(() => {
    let total = 0;
    for (const cantidad of this.seleccion().values()) {
      total += cantidad;
    }
    return total;
  });

  readonly totalMontoSeleccionado = computed(() => {
    let monto = 0;
    const mapa = this.seleccion();
    for (const prod of this.productos()) {
      const cant = mapa.get(prod.id) || 0;
      monto += prod.precio * cant;
    }
    return Math.round(monto * 100) / 100;
  });

  readonly categorias = computed(() => {
    const cats = new Set(this.productos().map((p) => p.categoria));
    return ['Todos', ...Array.from(cats)];
  });

  // =========================================================================
  // SELECCIÓN LOCAL (CARRITO)
  // =========================================================================

  getCantidadSeleccionada(id: string): number {
    return this.seleccion().get(id) || 0;
  }

  setCantidadSeleccionada(id: string, cantidadDeseada: number): void {
    const prod = this.productos().find((p) => p.id === id);
    if (!prod) return;

    const cantFinal = Math.max(0, Math.min(cantidadDeseada, prod.stock));
    this.seleccion.update((mapa) => {
      const nuevo = new Map(mapa);
      if (cantFinal <= 0) {
        nuevo.delete(id);
      } else {
        nuevo.set(id, cantFinal);
      }
      return nuevo;
    });
  }

  incrementarSeleccion(id: string): void {
    this.setCantidadSeleccionada(id, this.getCantidadSeleccionada(id) + 1);
  }

  decrementarSeleccion(id: string): void {
    this.setCantidadSeleccionada(id, this.getCantidadSeleccionada(id) - 1);
  }

  limpiarSeleccion(): void {
    this.seleccion.set(new Map());
  }

  // =========================================================================
  // ACCIONES CON LA BASE DE DATOS (devuelven Observable: hay que suscribirse)
  // =========================================================================

  /** Actualiza el stock (TRABAJADOR y ADMIN) */
  actualizarStock(id: string, nuevoStock: number): Observable<Producto> {
    if (!this.esPersonalOp()) {
      return throwError(() => new Error('Acceso denegado: se requiere rol de Trabajador o Administrador.'));
    }

    const stockNormalizado = Math.max(0, Math.floor(nuevoStock));

    return this.http.patch<Producto>(`${this.API_URL}/${id}/stock`, { stock: stockNormalizado }).pipe(
      map((p) => this.normalizar(p)),
      tap((prodActualizado) => {
        this.productos.update((lista) => lista.map((p) => (p.id === id ? prodActualizado : p)));
        if (this.getCantidadSeleccionada(id) > stockNormalizado) {
          this.setCantidadSeleccionada(id, stockNormalizado);
        }
      })
    );
  }

  /** Actualiza el precio (ÚNICAMENTE ADMIN) */
  actualizarPrecio(id: string, nuevoPrecio: number): Observable<Producto> {
    if (!this.esAdmin()) {
      return throwError(() => new Error('Acceso denegado: solo el Administrador puede cambiar precios.'));
    }

    const precioNormalizado = Math.max(0, Math.round(nuevoPrecio * 100) / 100);

    return this.http.patch<Producto>(`${this.API_URL}/${id}/precio`, { precio: precioNormalizado }).pipe(
      map((p) => this.normalizar(p)),
      tap((prodActualizado) => {
        this.productos.update((lista) => lista.map((p) => (p.id === id ? prodActualizado : p)));
      })
    );
  }

  /** Elimina un producto (ÚNICAMENTE ADMIN) */
  eliminarProducto(id: string): Observable<void> {
    if (!this.esAdmin()) {
      return throwError(() => new Error('Acceso denegado: solo el Administrador puede eliminar productos.'));
    }

    return this.http.delete<void>(`${this.API_URL}/${id}`).pipe(
      tap(() => {
        this.productos.update((lista) => lista.filter((p) => p.id !== id));
        this.seleccion.update((mapa) => {
          const nuevo = new Map(mapa);
          nuevo.delete(id);
          return nuevo;
        });
      })
    );
  }

  /** Registra un nuevo producto (ÚNICAMENTE ADMIN). El backend genera el id. */
  agregarProducto(productoNuevo: Omit<Producto, 'id'>): Observable<Producto> {
    if (!this.esAdmin()) {
      return throwError(() => new Error('Acceso denegado: solo el Administrador puede agregar productos.'));
    }

    return this.http.post<Producto>(this.API_URL, productoNuevo).pipe(
      map((p) => this.normalizar(p)),
      tap((productoCreado) => {
        this.productos.update((lista) => [productoCreado, ...lista]);
      })
    );
  }

  /** Vacía la selección y recarga los productos desde la base de datos */
  restablecerValoresPorDefecto(): void {
    this.limpiarSeleccion();
    this.cargarProductos();
  }

  /** Extrae un mensaje legible de un error HTTP o de un Error normal */
  mensajeDeError(err: any): string {
    return err?.error?.mensaje || err?.error?.error || err?.message || 'Ocurrió un error inesperado.';
  }
}
