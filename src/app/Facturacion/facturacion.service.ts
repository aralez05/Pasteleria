import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

export interface VentaItem {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  importe: number;
}

export interface VentaTicket {
  folio: string;
  fecha: string;
  trabajadorId: string;
  trabajadorNombre: string;
  items: VentaItem[];
  subtotal: number;
  iva: number;
  total: number;
  facturado: boolean;
  uuidFactura?: string;
  metodoPago: string;
}

export interface FacturaSAT {
  folioFactura: string;
  folioTicket: string;
  uuidSAT: string;
  rfcReceptor: string;
  razonSocial: string;
  codigoPostal: string;
  regimenFiscal: string;
  usoCFDI: string;
  correo: string;
  fechaEmision: string;
  subtotal: number;
  iva: number;
  total: number;
  items: VentaItem[];
}

export interface UsuarioSesion {
  id: string;
  correo: string;
  nombre: string;
  rol: 'admin' | 'trabajador' | 'cliente';
}

const STORAGE_USUARIO_KEY = 'olenka_ezis_usuario_store';

@Injectable({
  providedIn: 'root'
})
export class FacturacionService {

  private http = inject(HttpClient);

  private readonly API_URL = 'https://bakcend-5pyr.onrender.com/api/productos';

  // =========================================================================
  // ESTADO REACTIVO (SIGNALS)
  // =========================================================================

  /** Usuario autenticado (único valor guardado en localStorage para persistir sesión) */
  readonly usuarioActual = signal<UsuarioSesion | null>(this.cargarSesionUsuario());
  readonly rolUsuario = computed(() => this.usuarioActual()?.rol ?? null);

  readonly trabajadorActualId = computed(() => this.usuarioActual()?.id ?? '');
  readonly trabajadorActualNombre = computed(() => this.usuarioActual()?.nombre ?? '');

  /** Listas reactivas alimentadas desde MySQL en Aiven */
  readonly ventas = signal<VentaTicket[]>([]);
  readonly facturas = signal<FacturaSAT[]>([]);

  constructor() {
    // Si ya hay una sesión activa al cargar la app, traemos los datos de la BD
    if (this.usuarioActual()) {
      this.cargarVentas();
      this.cargarFacturas();
    }
  }

  // =========================================================================
  // AUTENTICACIÓN
  // =========================================================================


  /**
 * Inicio de sesión local para pruebas en pantalla
 */
  loginDemo(rol: 'admin' | 'trabajador' | 'cliente', customEmail?: string, customNombre?: string): UsuarioSesion {
    let usuario: UsuarioSesion;

    if (rol === 'admin') {
      usuario = {
        id: 'admin-1',
        correo: customEmail || 'admin@olenkayezis.com',
        nombre: customNombre || 'Ezis Galván (Administrador)',
        rol: 'admin'
      };
    } else if (rol === 'trabajador') {
      usuario = {
        id: 'trab-1',
        correo: customEmail || 'maria.gonzalez@olenkayezis.com',
        nombre: customNombre || 'María González (Turno Matutino)',
        rol: 'trabajador'
      };
    } else {
      usuario = {
        id: 'cli-' + Date.now().toString().slice(-4),
        correo: customEmail || 'cliente@dulcemomento.com',
        nombre: customNombre || 'Lucía Monroy Pérez',
        rol: 'cliente'
      };
    }

    this.usuarioActual.set(usuario);
    localStorage.setItem('olenka_ezis_usuario_store', JSON.stringify(usuario));

    // Cargamos los datos iniciales
    this.cargarVentas();
    this.cargarFacturas();

    return usuario;
  }
  login(correo: string, contrasena: string): Observable<UsuarioSesion> {
    return this.http.post<UsuarioSesion>(`${this.API_URL}/login`, { correo, contrasena }).pipe(
      tap((usuario) => {
        this.usuarioActual.set(usuario);
        localStorage.setItem(STORAGE_USUARIO_KEY, JSON.stringify(usuario));

        // Al iniciar sesión, cargamos las ventas y facturas reales desde Aiven
        this.cargarVentas();
        this.cargarFacturas();
      })
    );
  }

  logout() {
    this.usuarioActual.set(null);
    localStorage.removeItem(STORAGE_USUARIO_KEY);
    this.ventas.set([]);
    this.facturas.set([]);
  }

  private cargarSesionUsuario(): UsuarioSesion | null {
    try {
      const data = localStorage.getItem(STORAGE_USUARIO_KEY);
      if (data) return JSON.parse(data);
    } catch { }
    return null;
  }

  // =========================================================================
  // PETICIONES A LA BASE DE DATOS (AIVEN VIA BACKEND)
  // =========================================================================

  /** Carga todas las ventas desde MySQL */
  cargarVentas(): void {
    this.http.get<VentaTicket[]>(`${this.API_URL}/ventas`).subscribe({
      next: (datos) => this.ventas.set(datos),
      error: (err) => console.error('Error cargando ventas desde BD:', err)
    });
  }

  /** Carga todas las facturas desde MySQL */
  cargarFacturas(): void {
    this.http.get<FacturaSAT[]>(`${this.API_URL}/facturas`).subscribe({
      next: (datos) => this.facturas.set(datos),
      error: (err) => console.error('Error cargando facturas desde BD:', err)
    });
  }

  /** Registra una nueva venta guardándola en la BD */
  emitirFactura(
    ticket: VentaTicket,
    datosFiscales: any
  ): Observable<FacturaSAT> { // <-- Debe retornar Observable<FacturaSAT>
    return this.http.post<FacturaSAT>(`${this.API_URL}/facturas`, {
      folioTicket: ticket.folio,
      ...datosFiscales
    }).pipe(
      tap((nuevaFactura) => {
        this.facturas.update(lista => [nuevaFactura, ...lista]);
        this.ventas.update(lista =>
          lista.map(v => v.folio === ticket.folio ? { ...v, facturado: true, uuidFactura: nuevaFactura.uuidSAT } : v)
        );
      })
    );
  }

  registrarVenta(
    items: VentaItem[],
    trabajadorId: string = this.trabajadorActualId(),
    trabajadorNombre: string = this.trabajadorActualNombre(),
    metodoPago: string = 'Efectivo'
  ): Observable<VentaTicket> { // <-- Debe retornar Observable<VentaTicket>
    return this.http.post<VentaTicket>(`${this.API_URL}/ventas`, {
      items,
      trabajadorId,
      trabajadorNombre,
      metodoPago
    }).pipe(
      tap((nuevaVenta) => {
        this.ventas.update(lista => [nuevaVenta, ...lista]);
      })
    );
  }


  /** Busca un ticket por su folio desde la memoria actual */
  buscarTicketPorFolio(folio: string): VentaTicket | undefined {
    const limpio = folio.trim().toUpperCase();
    return this.ventas().find(v => v.folio.toUpperCase() === limpio);
  }

  // =========================================================================
  // MÉTRICAS (COMPUTED PROPERTIES) - PERMANECEN INTACTAS
  // =========================================================================

  readonly ventasTrabajadorDia = computed(() => {
    const trabId = this.trabajadorActualId();
    const hoyStr = new Date().toISOString().substring(0, 10);
    return this.ventas().filter(v => v.trabajadorId === trabId && v.fecha.startsWith(hoyStr));
  });

  readonly totalTrabajadorDia = computed(() => {
    return this.ventasTrabajadorDia().reduce((acc, v) => acc + v.total, 0);
  });

  readonly ventasTrabajadorSemana = computed(() => {
    const trabId = this.trabajadorActualId();
    return this.ventas().filter(v => v.trabajadorId === trabId);
  });

  readonly totalTrabajadorSemana = computed(() => {
    return this.ventasTrabajadorSemana().reduce((acc, v) => acc + v.total, 0);
  });

  readonly ventasTrabajadorMes = computed(() => {
    const trabId = this.trabajadorActualId();
    return this.ventas().filter(v => v.trabajadorId === trabId);
  });

  readonly totalTrabajadorMes = computed(() => {
    return this.ventasTrabajadorMes().reduce((acc, v) => acc + v.total, 0);
  });

  readonly ventasTiendaDia = computed(() => {
    const hoyStr = new Date().toISOString().substring(0, 10);
    return this.ventas().filter(v => v.fecha.startsWith(hoyStr));
  });

  readonly totalTiendaDia = computed(() => {
    return this.ventasTiendaDia().reduce((acc, v) => acc + v.total, 0);
  });

  readonly ventasTiendaSemana = computed(() => {
    return this.ventas();
  });

  readonly totalTiendaSemana = computed(() => {
    return this.ventasTiendaSemana().reduce((acc, v) => acc + v.total, 0);
  });

  readonly ventasTiendaMes = computed(() => {
    return this.ventas();
  });

  readonly totalTiendaMes = computed(() => {
    return this.ventasTiendaMes().reduce((acc, v) => acc + v.total, 0);
  });

  readonly ivaTotalMes = computed(() => {
    return this.ventasTiendaMes().reduce((acc, v) => acc + v.iva, 0);
  });
}
